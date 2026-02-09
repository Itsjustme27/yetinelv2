// Syslog Parser (RFC 3164 + RFC 5424 ISO format)
// BSD Format: <priority>Jan 24 17:59:42 hostname program[pid]: message
// ISO Format: 2026-01-24T17:59:42.123456+00:00 hostname program[pid]: message

// Traditional BSD format (RFC 3164)
const SYSLOG_BSD_REGEX = /^(?:<(\d+)>)?(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)$/;

// Modern ISO 8601 format (RFC 5424 style)
const SYSLOG_ISO_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?)\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)$/;

// Month name to number mapping
const MONTHS = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3,
    'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7,
    'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
};

// Facility and severity from priority
function parsePriority(priority) {
    const pri = parseInt(priority) || 13; // Default: user.notice
    return {
        facility: Math.floor(pri / 8),
        severity: pri % 8
    };
}

// Severity mapping (syslog severity to SIEM severity)
function mapSeverity(syslogSeverity) {
    if (syslogSeverity <= 2) return 'critical';    // Emergency, Alert, Critical
    if (syslogSeverity <= 4) return 'warning';     // Error, Warning
    return 'info';                                  // Notice, Info, Debug
}

// Parse syslog timestamp to ISO format
function parseTimestamp(timestampStr) {
    const now = new Date();
    const parts = timestampStr.match(/(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/);

    if (!parts) {
        return new Date().toISOString();
    }

    const month = MONTHS[parts[1]];
    const day = parseInt(parts[2]);
    const hours = parseInt(parts[3]);
    const minutes = parseInt(parts[4]);
    const seconds = parseInt(parts[5]);

    // Use current year, handle year boundary
    let year = now.getFullYear();
    const date = new Date(year, month, day, hours, minutes, seconds);

    // If date is in the future, use previous year
    if (date > now) {
        date.setFullYear(year - 1);
    }

    return date.toISOString();
}

// Determine event type from program/message
function classifyEvent(program, message) {
    const prog = program.toLowerCase();
    const msg = message.toLowerCase();

    // Authentication events
    if (prog === 'sshd' || prog === 'su' || prog === 'sudo' || prog === 'login' || prog === 'passwd') {
        return 'authentication';
    }

    // Firewall events
    if (prog === 'iptables' || prog === 'ufw' || prog === 'firewalld' || msg.includes('firewall')) {
        return 'firewall';
    }

    // Network events
    if (prog === 'dhclient' || prog === 'networkmanager' || msg.includes('connection')) {
        return 'network';
    }

    // System events
    if (prog === 'kernel' || prog === 'systemd' || prog === 'init') {
        return 'system';
    }

    // Process events
    if (prog === 'cron' || msg.includes('process') || msg.includes('started') || msg.includes('stopped')) {
        return 'process';
    }

    return 'system';
}

function parse(rawLog, metadata = {}) {
    // Try BSD format first
    let match = rawLog.match(SYSLOG_BSD_REGEX);

    if (match) {
        const [, priority, timestampStr, hostname, program, pid, message] = match;
        const { facility, severity: syslogSeverity } = parsePriority(priority);

        return {
            timestamp: parseTimestamp(timestampStr),
            source: 'syslog',
            event_type: classifyEvent(program, message),
            severity: mapSeverity(syslogSeverity),
            hostname: hostname,
            description: `[${program}] ${message}`,
            raw_log: rawLog,
            parsed_data: {
                format: 'bsd',
                priority: parseInt(priority) || null,
                facility,
                syslog_severity: syslogSeverity,
                program,
                pid: pid ? parseInt(pid) : null,
                message: message
            }
        };
    }

    // Try ISO format
    match = rawLog.match(SYSLOG_ISO_REGEX);

    if (match) {
        const [, isoTimestamp, hostname, program, pid, message] = match;

        return {
            timestamp: new Date(isoTimestamp).toISOString(),
            source: 'syslog',
            event_type: classifyEvent(program, message),
            severity: 'info', // ISO format doesn't include priority by default
            hostname: hostname,
            description: `[${program}] ${message}`,
            raw_log: rawLog,
            parsed_data: {
                format: 'iso',
                program,
                pid: pid ? parseInt(pid) : null,
                message: message
            }
        };
    }

    // Return basic parsed event for non-standard format
    return {
        timestamp: new Date().toISOString(),
        source: 'syslog',
        event_type: 'system',
        severity: 'info',
        hostname: metadata.hostname || 'unknown',
        description: rawLog.trim(),
        raw_log: rawLog,
        parsed_data: {
            format: 'non-standard'
        }
    };
}

module.exports = { parse, parseTimestamp, mapSeverity };
