/**
 * Mini SIEM API Client
 * Handles all communication with the backend server
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class SiemApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'SiemApiError';
        this.status = status;
        this.data = data;
    }
}

async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new SiemApiError(
                data.error || 'Request failed',
                response.status,
                data
            );
        }

        return data;
    } catch (err) {
        if (err instanceof SiemApiError) {
            throw err;
        }
        throw new SiemApiError(
            err.message || 'Network error',
            0,
            null
        );
    }
}

// Health check
export async function checkHealth() {
    return request('/health');
}

// Events API
export async function getEvents(options = {}) {
    const params = new URLSearchParams();

    if (options.limit) params.set('limit', options.limit);
    if (options.offset) params.set('offset', options.offset);
    if (options.severity) params.set('severity', options.severity);
    if (options.type) params.set('type', options.type);
    if (options.endpoint) params.set('endpoint', options.endpoint);
    if (options.source) params.set('source', options.source);
    if (options.since) params.set('since', options.since);
    if (options.search) params.set('search', options.search);

    const query = params.toString();
    return request(`/api/events${query ? `?${query}` : ''}`);
}

export async function getEventStats(since = null) {
    const query = since ? `?since=${since}` : '';
    return request(`/api/events/stats${query}`);
}

export async function getEvent(id) {
    return request(`/api/events/${id}`);
}

// Alerts API
export async function getAlerts(options = {}) {
    const params = new URLSearchParams();

    if (options.limit) params.set('limit', options.limit);
    if (options.offset) params.set('offset', options.offset);
    if (options.status) params.set('status', options.status);

    const query = params.toString();
    return request(`/api/alerts${query ? `?${query}` : ''}`);
}

export async function getAlert(id) {
    return request(`/api/alerts/${id}`);
}

export async function updateAlertStatus(id, status, notes = null) {
    return request(`/api/alerts/${id}`, {
        method: 'PATCH',
        body: { status, notes }
    });
}

// Endpoints API
export async function getEndpoints() {
    return request('/api/endpoints');
}

export async function getEndpoint(id) {
    return request(`/api/endpoints/${id}`);
}

// Rules API
export async function getRules(enabledOnly = false) {
    const query = enabledOnly ? '?enabled=true' : '';
    return request(`/api/rules${query}`);
}

export async function toggleRule(id, enabled) {
    return request(`/api/rules/${id}`, {
        method: 'PATCH',
        body: { enabled }
    });
}

// Ingest API (for testing)
export async function ingestTestEvents() {
    return request('/api/ingest/test', { method: 'POST' });
}

export async function ingestSingleEvent(log, source = 'syslog', endpointId = null) {
    return request('/api/ingest/single', {
        method: 'POST',
        body: { log, source, endpoint_id: endpointId }
    });
}

// Export default object for convenience
const siemApi = {
    checkHealth,
    getEvents,
    getEventStats,
    getEvent,
    getAlerts,
    getAlert,
    updateAlertStatus,
    getEndpoints,
    getEndpoint,
    getRules,
    toggleRule,
    ingestTestEvents,
    ingestSingleEvent,
    API_BASE
};

export default siemApi;
