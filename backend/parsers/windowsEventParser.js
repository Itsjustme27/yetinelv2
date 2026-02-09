// Windows Event Log Parser
// Parses JSON events from the Windows PowerShell agent

// Windows Security Event IDs of interest
const EVENT_MAPPINGS = {
    // Logon Events
    4624: { type: 'authentication', severity: 'info', desc: 'Successful logon' },
    4625: { type: 'authentication', severity: 'warning', desc: 'Failed logon' },
    4634: { type: 'authentication', severity: 'info', desc: 'Logoff' },
    4647: { type: 'authentication', severity: 'info', desc: 'User initiated logoff' },
    4648: { type: 'authentication', severity: 'info', desc: 'Logon using explicit credentials' },
    4672: { type: 'privilege', severity: 'warning', desc: 'Special privileges assigned' },

    // Account Management
    4720: { type: 'account', severity: 'warning', desc: 'User account created' },
    4722: { type: 'account', severity: 'warning', desc: 'User account enabled' },
    4723: { type: 'account', severity: 'info', desc: 'Password change attempted' },
    4724: { type: 'account', severity: 'warning', desc: 'Password reset attempted' },
    4725: { type: 'account', severity: 'warning', desc: 'User account disabled' },
    4726: { type: 'account', severity: 'warning', desc: 'User account deleted' },
    4738: { type: 'account', severity: 'info', desc: 'User account changed' },
    4740: { type: 'account', severity: 'warning', desc: 'User account locked out' },

    // Process Events
    4688: { type: 'process', severity: 'info', desc: 'New process created' },
    4689: { type: 'process', severity: 'info', desc: 'Process exited' },

    // Service Events
    7045: { type: 'service', severity: 'warning', desc: 'New service installed' },
    4697: { type: 'service', severity: 'warning', desc: 'Service installed' },

    // Object Access
    4656: { type: 'file_access', severity: 'info', desc: 'Handle requested' },
    4663: { type: 'file_access', severity: 'info', desc: 'Object access attempted' },

    // Policy Changes
    4719: { type: 'policy', severity: 'critical', desc: 'System audit policy changed' },

    // Security
    1102: { type: 'security', severity: 'critical', desc: 'Audit log cleared' },
    4616: { type: 'security', severity: 'critical', desc: 'System time changed' },

    // Scheduled Tasks
    4698: { type: 'scheduled_task', severity: 'warning', desc: 'Scheduled task created' },
    4699: { type: 'scheduled_task', severity: 'info', desc: 'Scheduled task deleted' },
    4702: { type: 'scheduled_task', severity: 'warning', desc: 'Scheduled task updated' }
};

// Logon Type mappings
const LOGON_TYPES = {
    2: 'Interactive',
    3: 'Network',
    4: 'Batch',
    5: 'Service',
    7: 'Unlock',
    8: 'NetworkCleartext',
    9: 'NewCredentials',
    10: 'RemoteInteractive',
    11: 'CachedInteractive'
};

function parseWindowsEvent(event) {
    const eventId = event.Id || event.EventId || event.event_id;
    const mapping = EVENT_MAPPINGS[eventId] || {
        type: 'windows',
        severity: 'info',
        desc: `Windows Event ${eventId}`
    };

    // Build parsed event
    const parsed = {
        timestamp: event.TimeCreated || event.time_created || new Date().toISOString(),
        source: 'windows',
        event_type: mapping.type,
        severity: mapping.severity,
        hostname: event.MachineName || event.Computer || event.hostname,
        description: mapping.desc,
        raw_log: JSON.stringify(event),
        parsed_data: {
            event_id: eventId,
            provider: event.ProviderName || event.provider,
            log_name: event.LogName || event.log_name || 'Security',
            level: event.Level || event.level,
            keywords: event.Keywords || event.keywords,
            task: event.Task || event.task,
            opcode: event.Opcode || event.opcode
        }
    };

    // Extract user information
    if (event.Properties || event.properties) {
        const props = event.Properties || event.properties;
        parsed.user = extractUser(props, eventId);
        parsed.parsed_data.properties = props;
    }

    // Parse specific event types
    if (eventId === 4624 || eventId === 4625) {
        parseLogonEvent(parsed, event);
    } else if (eventId === 4688) {
        parseProcessEvent(parsed, event);
    } else if (eventId === 7045 || eventId === 4697) {
        parseServiceEvent(parsed, event);
    }

    return parsed;
}

function extractUser(properties, eventId) {
    if (!properties || !Array.isArray(properties)) return null;

    // Different events have user at different positions
    if (eventId === 4624 || eventId === 4625) {
        // TargetUserName is typically at index 5
        return properties[5]?.Value || properties[5] || null;
    } else if (eventId === 4688) {
        // Creator user name
        return properties[1]?.Value || properties[1] || null;
    }

    // Generic extraction
    for (const prop of properties) {
        const val = prop?.Value || prop;
        if (typeof val === 'string' && val.length > 0 && !val.includes('\\') && !val.includes('-')) {
            return val;
        }
    }
    return null;
}

function parseLogonEvent(parsed, event) {
    const props = event.Properties || event.properties || [];

    // Standard logon event property indices
    if (props.length >= 10) {
        parsed.parsed_data.logon_type = LOGON_TYPES[props[8]?.Value || props[8]] || 'Unknown';
        parsed.parsed_data.target_user = props[5]?.Value || props[5];
        parsed.parsed_data.target_domain = props[6]?.Value || props[6];
        parsed.parsed_data.source_ip = props[18]?.Value || props[18] || 'local';
        parsed.parsed_data.source_port = props[19]?.Value || props[19];
        parsed.parsed_data.workstation = props[11]?.Value || props[11];

        // Enhance description
        const logonType = parsed.parsed_data.logon_type;
        const user = parsed.parsed_data.target_user;
        const ip = parsed.parsed_data.source_ip;

        if (event.Id === 4625) {
            parsed.description = `Failed ${logonType} logon for ${user} from ${ip}`;
            // Multiple failed logins should escalate severity
            parsed.parsed_data.failure_reason = props[13]?.Value || props[13];
        } else {
            parsed.description = `${logonType} logon for ${user} from ${ip}`;
        }
    }
}

function parseProcessEvent(parsed, event) {
    const props = event.Properties || event.properties || [];

    if (props.length >= 10) {
        parsed.parsed_data.new_process_name = props[5]?.Value || props[5];
        parsed.parsed_data.command_line = props[8]?.Value || props[8];
        parsed.parsed_data.creator_process = props[13]?.Value || props[13];
        parsed.parsed_data.token_elevation = props[6]?.Value || props[6];

        const processName = parsed.parsed_data.new_process_name?.split('\\').pop() || 'Unknown';
        parsed.description = `Process created: ${processName}`;

        // Check for suspicious locations
        const processPath = (props[5]?.Value || props[5] || '').toLowerCase();
        if (processPath.includes('\\temp\\') ||
            processPath.includes('\\tmp\\') ||
            processPath.includes('\\appdata\\local\\temp')) {
            parsed.severity = 'warning';
            parsed.description = `Suspicious: Process from temp directory: ${processName}`;
        }
    }
}

function parseServiceEvent(parsed, event) {
    const props = event.Properties || event.properties || [];

    if (props.length >= 5) {
        parsed.parsed_data.service_name = props[0]?.Value || props[0];
        parsed.parsed_data.service_path = props[1]?.Value || props[1];
        parsed.parsed_data.service_type = props[2]?.Value || props[2];
        parsed.parsed_data.service_start_type = props[3]?.Value || props[3];
        parsed.parsed_data.service_account = props[4]?.Value || props[4];

        const serviceName = parsed.parsed_data.service_name || 'Unknown';
        parsed.description = `New service installed: ${serviceName}`;
    }
}

function parse(rawData, metadata = {}) {
    // Handle both JSON string and object
    let event;
    if (typeof rawData === 'string') {
        try {
            event = JSON.parse(rawData);
        } catch (e) {
            // Not valid JSON, return basic event
            return {
                timestamp: new Date().toISOString(),
                source: 'windows',
                event_type: 'windows',
                severity: 'info',
                hostname: metadata.hostname || 'unknown',
                description: rawData,
                raw_log: rawData,
                parsed_data: { format: 'non-json' }
            };
        }
    } else {
        event = rawData;
    }

    return parseWindowsEvent(event);
}

module.exports = { parse, EVENT_MAPPINGS, LOGON_TYPES };
