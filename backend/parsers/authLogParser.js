// Auth Log Parser for Linux authentication events (/var/log/auth.log)
// Handles SSH, sudo, su, PAM events

const syslogParser = require('./syslogParser');

// Patterns for auth events
const PATTERNS = {
    // SSH patterns
    SSH_FAILED: /Failed (?:password|publickey) for (?:invalid user )?(\S+) from (\S+) port (\d+)/i,
    SSH_SUCCESS: /Accepted (?:password|publickey) for (\S+) from (\S+) port (\d+)/i,
    SSH_DISCONNECT: /Disconnected from (?:user )?(\S+)?\s*(\S+) port (\d+)/i,
    SSH_INVALID_USER: /Invalid user (\S+) from (\S+)/i,
    SSH_CONNECTION_CLOSED: /Connection closed by (?:authenticating user )?(\S+)?\s*(\S+) port (\d+)/i,

    // Sudo patterns
    SUDO_SUCCESS: /(\S+) : TTY=(\S+) ; PWD=([^;]+) ; USER=(\S+) ; COMMAND=(.*)/,
    SUDO_FAILURE: /(\S+) : .*authentication failure.*/i,

    // SU patterns
    SU_SUCCESS: /Successful su for (\S+) by (\S+)/i,
    SU_FAILURE: /FAILED su for (\S+) by (\S+)/i,
    SU_SESSION: /pam_unix\(su(?:-l)?:session\): session (\w+) for user (\S+)/i,

    // PAM patterns
    PAM_SESSION: /pam_unix\((\S+):session\): session (\w+) for user (\S+)/i,
    PAM_AUTH_FAILURE: /pam_unix\((\S+):auth\): authentication failure.* user=(\S+)/i,

    // User/Group changes
    USER_ADDED: /new user: name=(\S+), UID=(\d+)/i,
    USER_MODIFIED: /changed user '(\S+)'/i,
    GROUP_ADDED: /new group: name=(\S+), GID=(\d+)/i,
    PASSWORD_CHANGED: /password changed for (\S+)/i
};

function parseAuthEvent(message, baseParsed) {
    const result = {
        ...baseParsed,
        event_type: 'authentication'
    };

    // SSH Failed Login
    let match = message.match(PATTERNS.SSH_FAILED);
    if (match) {
        result.severity = 'warning';
        result.user = match[1];
        result.description = `SSH failed login for ${match[1]} from ${match[2]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'ssh',
            auth_result: 'failure',
            username: match[1],
            source_ip: match[2],
            source_port: parseInt(match[3])
        };
        return result;
    }

    // SSH Successful Login
    match = message.match(PATTERNS.SSH_SUCCESS);
    if (match) {
        result.severity = 'info';
        result.user = match[1];
        result.description = `SSH successful login for ${match[1]} from ${match[2]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'ssh',
            auth_result: 'success',
            username: match[1],
            source_ip: match[2],
            source_port: parseInt(match[3])
        };
        return result;
    }

    // SSH Invalid User
    match = message.match(PATTERNS.SSH_INVALID_USER);
    if (match) {
        result.severity = 'warning';
        result.user = match[1];
        result.description = `SSH invalid user ${match[1]} from ${match[2]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'ssh',
            auth_result: 'invalid_user',
            username: match[1],
            source_ip: match[2]
        };
        return result;
    }

    // Sudo Success
    match = message.match(PATTERNS.SUDO_SUCCESS);
    if (match) {
        const toRoot = match[4] === 'root';
        result.severity = toRoot ? 'warning' : 'info';
        result.user = match[1];
        result.description = `Sudo: ${match[1]} ran command as ${match[4]}: ${match[5]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'sudo',
            auth_result: 'success',
            username: match[1],
            tty: match[2],
            pwd: match[3],
            target_user: match[4],
            command: match[5]
        };
        if (toRoot) {
            result.event_type = 'privilege';
            result.description = `Privilege escalation: ${match[1]} -> root: ${match[5]}`;
        }
        return result;
    }

    // Sudo Failure
    match = message.match(PATTERNS.SUDO_FAILURE);
    if (match) {
        result.severity = 'warning';
        result.user = match[1];
        result.description = `Sudo authentication failure for ${match[1]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'sudo',
            auth_result: 'failure',
            username: match[1]
        };
        return result;
    }

    // SU Success
    match = message.match(PATTERNS.SU_SUCCESS);
    if (match) {
        const toRoot = match[1] === 'root';
        result.severity = toRoot ? 'warning' : 'info';
        result.user = match[2];
        result.description = `SU: ${match[2]} switched to ${match[1]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'su',
            auth_result: 'success',
            username: match[2],
            target_user: match[1]
        };
        if (toRoot) {
            result.event_type = 'privilege';
        }
        return result;
    }

    // SU Failure
    match = message.match(PATTERNS.SU_FAILURE);
    if (match) {
        result.severity = 'warning';
        result.user = match[2];
        result.description = `SU failed: ${match[2]} to ${match[1]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'su',
            auth_result: 'failure',
            username: match[2],
            target_user: match[1]
        };
        return result;
    }

    // PAM Authentication Failure
    match = message.match(PATTERNS.PAM_AUTH_FAILURE);
    if (match) {
        result.severity = 'warning';
        result.user = match[2];
        result.description = `PAM authentication failure for ${match[2]} via ${match[1]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'pam',
            auth_result: 'failure',
            pam_service: match[1],
            username: match[2]
        };
        return result;
    }

    // PAM Session
    match = message.match(PATTERNS.PAM_SESSION);
    if (match) {
        result.severity = 'info';
        result.user = match[3];
        result.description = `Session ${match[2]} for ${match[3]} via ${match[1]}`;
        result.parsed_data = {
            ...result.parsed_data,
            auth_type: 'pam',
            pam_service: match[1],
            session_action: match[2],
            username: match[3]
        };
        return result;
    }

    // Password Changed
    match = message.match(PATTERNS.PASSWORD_CHANGED);
    if (match) {
        result.severity = 'warning';
        result.user = match[1];
        result.description = `Password changed for ${match[1]}`;
        result.event_type = 'account';
        result.parsed_data = {
            ...result.parsed_data,
            action: 'password_change',
            username: match[1]
        };
        return result;
    }

    // User Added
    match = message.match(PATTERNS.USER_ADDED);
    if (match) {
        result.severity = 'warning';
        result.description = `New user created: ${match[1]} (UID: ${match[2]})`;
        result.event_type = 'account';
        result.parsed_data = {
            ...result.parsed_data,
            action: 'user_created',
            username: match[1],
            uid: parseInt(match[2])
        };
        return result;
    }

    return result;
}

function parse(rawLog, metadata = {}) {
    // First parse as syslog
    const baseParsed = syslogParser.parse(rawLog, metadata);

    // Get the message part
    const message = baseParsed.parsed_data?.message || baseParsed.description;

    // Enhance with auth-specific parsing
    const authParsed = parseAuthEvent(message, baseParsed);
    authParsed.source = 'auth';

    return authParsed;
}

module.exports = { parse };
