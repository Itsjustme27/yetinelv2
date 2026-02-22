import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('siem_token'));

    useEffect(() => {
        if (token) {
            // Decodes the payload from the JWT to get the user's role
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUser(payload);
        }
    }, [token]);

    const login = (newToken, userData) => {
        localStorage.setItem('siem_token', newToken);
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('siem_token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
