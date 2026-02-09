import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws';

/**
 * WebSocket connection states
 */
export const ConnectionState = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

/**
 * Custom hook for WebSocket connection to SIEM backend
 */
export function useWebSocket(options = {}) {
    const {
        channels = ['events', 'alerts'],
        onEvent,
        onAlert,
        onEndpoint,
        onStats,
        autoReconnect = true,
        reconnectDelay = 3000
    } = options;

    const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
    const [lastMessage, setLastMessage] = useState(null);
    const [error, setError] = useState(null);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const mountedRef = useRef(true);

    // Store callbacks in refs to avoid reconnection loops
    const callbacksRef = useRef({ onEvent, onAlert, onEndpoint, onStats });
    const optionsRef = useRef({ channels, autoReconnect, reconnectDelay });

    // Update refs when callbacks change
    useEffect(() => {
        callbacksRef.current = { onEvent, onAlert, onEndpoint, onStats };
    }, [onEvent, onAlert, onEndpoint, onStats]);

    useEffect(() => {
        optionsRef.current = { channels, autoReconnect, reconnectDelay };
    }, [channels, autoReconnect, reconnectDelay]);

    // Clear reconnect timeout
    const clearReconnectTimeout = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        clearReconnectTimeout();
        setConnectionState(ConnectionState.CONNECTING);
        setError(null);

        try {
            const ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                if (!mountedRef.current) return;
                console.log('[WS] Connected to', WS_URL);
                setConnectionState(ConnectionState.CONNECTED);

                // Subscribe to channels
                const { channels } = optionsRef.current;
                if (channels.length > 0) {
                    ws.send(JSON.stringify({
                        action: 'subscribe',
                        channels: channels
                    }));
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);

                    const { onEvent, onAlert, onEndpoint, onStats } = callbacksRef.current;

                    // Route to appropriate handler based on channel
                    switch (message.channel) {
                        case 'events':
                            if (onEvent) onEvent(message);
                            break;
                        case 'alerts':
                            if (onAlert) onAlert(message);
                            break;
                        case 'endpoints':
                            if (onEndpoint) onEndpoint(message);
                            break;
                        case 'stats':
                            if (onStats) onStats(message);
                            break;
                        default:
                            // Handle system messages (connected, subscribed, etc.)
                            break;
                    }
                } catch (err) {
                    console.error('[WS] Failed to parse message:', err);
                }
            };

            ws.onclose = (event) => {
                if (!mountedRef.current) return;
                console.log('[WS] Disconnected:', event.code, event.reason);
                setConnectionState(ConnectionState.DISCONNECTED);

                // Auto-reconnect
                const { autoReconnect, reconnectDelay } = optionsRef.current;
                if (autoReconnect && mountedRef.current) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log('[WS] Attempting to reconnect...');
                        connect();
                    }, reconnectDelay);
                }
            };

            ws.onerror = (err) => {
                if (!mountedRef.current) return;
                console.error('[WS] Error:', err);
                setConnectionState(ConnectionState.ERROR);
                setError('WebSocket connection error');
            };

            wsRef.current = ws;
        } catch (err) {
            console.error('[WS] Failed to create WebSocket:', err);
            setConnectionState(ConnectionState.ERROR);
            setError(err.message);
        }
    }, [clearReconnectTimeout]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        clearReconnectTimeout();
        if (wsRef.current) {
            wsRef.current.close(1000, 'Client disconnect');
            wsRef.current = null;
        }
        setConnectionState(ConnectionState.DISCONNECTED);
    }, [clearReconnectTimeout]);

    // Subscribe to additional channels
    const subscribe = useCallback((channel) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'subscribe',
                channel: channel
            }));
        }
    }, []);

    // Unsubscribe from channels
    const unsubscribe = useCallback((channel) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'unsubscribe',
                channel: channel
            }));
        }
    }, []);

    // Send ping (for keepalive)
    const ping = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'ping' }));
        }
    }, []);

    // Connect on mount only (empty dependency array)
    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            clearReconnectTimeout();
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmount');
                wsRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        connectionState,
        isConnected: connectionState === ConnectionState.CONNECTED,
        lastMessage,
        error,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
        ping
    };
}

export default useWebSocket;
