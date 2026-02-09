const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { ruleOps, alertOps } = require('../database/init');

// In-memory state for threshold-based detection
const thresholdState = new Map(); // key: rule_id:group_key -> { count, window_start, events[] }

// Default detection rules
const DEFAULT_RULES = [
    {
        id: 'brute-force-ssh',
        name: 'SSH Brute Force Detection',
        description: 'Detects 5 or more failed SSH logins within 60 seconds from the same IP',
        enabled: true,
        severity: 'critical',
        rule_type: 'threshold',
        conditions: {
            field: 'parsed_data.auth_type',
            equals: 'ssh',
            additional: {
                field: 'parsed_data.auth_result',
                equals: 'failure'
            },
            threshold: 5,
            window_seconds: 60,
            group_by: 'parsed_data.source_ip'
        },
        actions: { alert: true }
    },
    {
        id: 'login-after-failures',
        name: 'Successful Login After Failures',
        description: 'Detects successful login following 3+ failed attempts (potential compromise)',
        enabled: true,
        severity: 'critical',
        rule_type: 'correlation',
        conditions: {
            sequence: [
                {
                    count: 3,
                    window_seconds: 300,
                    match: {
                        field: 'parsed_data.auth_result',
                        equals: 'failure'
                    }
                },
                {
                    match: {
                        field: 'parsed_data.auth_result',
                        equals: 'success'
                    }
                }
            ],
            group_by: 'parsed_data.source_ip'
        },
        actions: { alert: true }
    },
    {
        id: 'privilege-escalation-sudo',
        name: 'Sudo to Root',
        description: 'Detects privilege escalation to root via sudo',
        enabled: true,
        severity: 'warning',
        rule_type: 'signature',
        conditions: {
            field: 'event_type',
            equals: 'privilege',
            additional: {
                field: 'parsed_data.target_user',
                equals: 'root'
            }
        },
        actions: { alert: true }
    },
    {
        id: 'new-service-installed',
        name: 'New Service Installation',
        description: 'Detects new Windows service installation (Event ID 7045/4697)',
        enabled: true,
        severity: 'warning',
        rule_type: 'signature',
        conditions: {
            any: [
                { field: 'parsed_data.event_id', equals: 7045 },
                { field: 'parsed_data.event_id', equals: 4697 }
            ]
        },
        actions: { alert: true }
    },
    {
        id: 'process-from-temp',
        name: 'Process Execution from Temp Directory',
        description: 'Detects processes running from temporary directories (common malware behavior)',
        enabled: true,
        severity: 'warning',
        rule_type: 'signature',
        conditions: {
            field: 'parsed_data.new_process_name',
            contains_any: ['\\temp\\', '\\tmp\\', '/tmp/', 'appdata\\local\\temp']
        },
        actions: { alert: true }
    },
    {
        id: 'audit-log-cleared',
        name: 'Security Audit Log Cleared',
        description: 'Detects when security audit logs are cleared (Event ID 1102)',
        enabled: true,
        severity: 'critical',
        rule_type: 'signature',
        conditions: {
            field: 'parsed_data.event_id',
            equals: 1102
        },
        actions: { alert: true }
    },
    {
        id: 'external-ssh-login',
        name: 'SSH Login from External IP',
        description: 'Detects SSH logins from non-RFC1918 IP addresses',
        enabled: true,
        severity: 'warning',
        rule_type: 'signature',
        conditions: {
            field: 'parsed_data.auth_type',
            equals: 'ssh',
            additional: {
                field: 'parsed_data.auth_result',
                equals: 'success'
            },
            not: {
                field: 'parsed_data.source_ip',
                matches: '^(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|127\\.|::1|localhost)'
            }
        },
        actions: { alert: true }
    },
    {
        id: 'failed-login-burst',
        name: 'Failed Login Burst',
        description: 'Detects 10 or more failed logins within 5 minutes (any auth type)',
        enabled: true,
        severity: 'warning',
        rule_type: 'threshold',
        conditions: {
            field: 'parsed_data.auth_result',
            equals: 'failure',
            threshold: 10,
            window_seconds: 300,
            group_by: 'hostname'
        },
        actions: { alert: true }
    }
];

// Load default rules into database
function loadDefaultRules() {
    const rulesPath = path.join(__dirname, '../../rules/default-rules.json');

    let rules = DEFAULT_RULES;

    // Try to load from file if exists
    if (fs.existsSync(rulesPath)) {
        try {
            const fileRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
            rules = fileRules;
            console.log('[DETECTION] Loaded rules from file:', rulesPath);
        } catch (e) {
            console.log('[DETECTION] Using embedded default rules');
        }
    } else {
        // Save default rules to file
        fs.writeFileSync(rulesPath, JSON.stringify(DEFAULT_RULES, null, 2));
        console.log('[DETECTION] Created default rules file:', rulesPath);
    }

    // Upsert all rules
    for (const rule of rules) {
        ruleOps.upsert(rule);
    }

    console.log(`[DETECTION] Loaded ${rules.length} detection rules`);
}

// Get nested field value from object
function getFieldValue(obj, fieldPath) {
    if (!fieldPath || !obj) return undefined;

    const parts = fieldPath.split('.');
    let value = obj;

    for (const part of parts) {
        if (value === null || value === undefined) return undefined;
        value = value[part];
    }

    return value;
}

// Check if condition matches event
function matchesCondition(event, condition) {
    if (!condition) return false;

    // Handle 'any' condition (OR)
    if (condition.any && Array.isArray(condition.any)) {
        return condition.any.some(c => matchesCondition(event, c));
    }

    // Handle 'all' condition (AND)
    if (condition.all && Array.isArray(condition.all)) {
        return condition.all.every(c => matchesCondition(event, c));
    }

    const fieldValue = getFieldValue(event, condition.field);

    // equals check
    if (condition.equals !== undefined) {
        if (fieldValue !== condition.equals) return false;
    }

    // contains check
    if (condition.contains !== undefined) {
        if (!fieldValue || !String(fieldValue).toLowerCase().includes(String(condition.contains).toLowerCase())) {
            return false;
        }
    }

    // contains_any check
    if (condition.contains_any && Array.isArray(condition.contains_any)) {
        if (!fieldValue) return false;
        const val = String(fieldValue).toLowerCase();
        const found = condition.contains_any.some(c => val.includes(String(c).toLowerCase()));
        if (!found) return false;
    }

    // matches (regex) check
    if (condition.matches !== undefined) {
        try {
            const regex = new RegExp(condition.matches, 'i');
            if (!fieldValue || !regex.test(String(fieldValue))) return false;
        } catch (e) {
            return false;
        }
    }

    // not condition
    if (condition.not) {
        if (matchesCondition(event, condition.not)) return false;
    }

    // Additional nested condition
    if (condition.additional) {
        if (!matchesCondition(event, condition.additional)) return false;
    }

    return true;
}

// Process signature-based rule
function processSignatureRule(event, rule) {
    if (!matchesCondition(event, rule.conditions)) {
        return null;
    }

    return createAlert(event, rule, `Signature match: ${rule.name}`);
}

// Process threshold-based rule
function processThresholdRule(event, rule) {
    if (!matchesCondition(event, rule.conditions)) {
        return null;
    }

    const { threshold, window_seconds, group_by } = rule.conditions;
    const groupValue = group_by ? getFieldValue(event, group_by) : 'global';
    const stateKey = `${rule.id}:${groupValue}`;
    const now = Date.now();
    const windowMs = (window_seconds || 60) * 1000;

    // Get or create state
    let state = thresholdState.get(stateKey);
    if (!state || (now - state.window_start) > windowMs) {
        state = {
            count: 0,
            window_start: now,
            events: []
        };
    }

    // Add this event
    state.count++;
    state.events.push({
        id: event.id,
        timestamp: event.timestamp
    });

    // Prune old events
    state.events = state.events.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return (now - eventTime) < windowMs;
    });
    state.count = state.events.length;

    thresholdState.set(stateKey, state);

    // Check threshold
    if (state.count >= (threshold || 5)) {
        // Reset after alert to avoid alert spam
        thresholdState.set(stateKey, { count: 0, window_start: now, events: [] });

        return createAlert(event, rule, `Threshold exceeded: ${state.count} events in ${window_seconds}s (group: ${groupValue})`);
    }

    return null;
}

// Process correlation rule (simplified)
function processCorrelationRule(event, rule) {
    // For login-after-failures pattern
    const { sequence, group_by } = rule.conditions;
    if (!sequence || sequence.length < 2) return null;

    const groupValue = group_by ? getFieldValue(event, group_by) : 'global';
    const stateKey = `${rule.id}:${groupValue}`;
    const now = Date.now();

    // Check if current event matches success pattern (second in sequence)
    const successPattern = sequence[1]?.match;
    if (successPattern && matchesCondition(event, successPattern)) {
        // Check if we have preceding failures
        const state = thresholdState.get(stateKey);
        const failurePattern = sequence[0];
        const windowMs = (failurePattern.window_seconds || 300) * 1000;

        if (state && state.count >= (failurePattern.count || 3)) {
            const recentFailures = state.events.filter(e => (now - new Date(e.timestamp).getTime()) < windowMs);
            if (recentFailures.length >= (failurePattern.count || 3)) {
                // Clear state and create alert
                thresholdState.delete(stateKey);
                return createAlert(event, rule, `Correlation match: Success after ${recentFailures.length} failures`);
            }
        }
    }

    // Check if current event matches failure pattern (first in sequence)
    const failurePattern = sequence[0]?.match;
    if (failurePattern && matchesCondition(event, failurePattern)) {
        let state = thresholdState.get(stateKey) || { count: 0, window_start: now, events: [] };
        state.count++;
        state.events.push({ id: event.id, timestamp: event.timestamp });
        thresholdState.set(stateKey, state);
    }

    return null;
}

// Create alert from matched rule
function createAlert(event, rule, details) {
    const alert = {
        id: uuidv4(),
        event_id: event.id,
        rule_id: rule.id,
        severity: rule.severity,
        status: 'open',
        title: rule.name,
        description: `${rule.description}\n\nDetails: ${details}`,
        endpoint_id: event.endpoint_id
    };

    // Insert alert into database
    alertOps.insert(alert);

    // Update rule match count
    ruleOps.incrementMatchCount(rule.id);

    console.log(`[DETECTION] Alert generated: ${rule.name} - ${details}`);

    return alert;
}

// Main event processing function
function processEvent(event) {
    const alerts = [];
    const rules = ruleOps.getEnabled();

    for (const rule of rules) {
        try {
            let alert = null;

            switch (rule.rule_type) {
                case 'signature':
                    alert = processSignatureRule(event, rule);
                    break;
                case 'threshold':
                    alert = processThresholdRule(event, rule);
                    break;
                case 'correlation':
                    alert = processCorrelationRule(event, rule);
                    break;
            }

            if (alert) {
                alerts.push(alert);
            }
        } catch (err) {
            console.error(`[DETECTION] Error processing rule ${rule.id}:`, err.message);
        }
    }

    return { alerts };
}

// Cleanup old threshold state periodically
setInterval(() => {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [key, state] of thresholdState.entries()) {
        if ((now - state.window_start) > maxAge) {
            thresholdState.delete(key);
        }
    }
}, 60000);

module.exports = {
    loadDefaultRules,
    processEvent,
    matchesCondition,
    getFieldValue
};
