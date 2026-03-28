import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { redirectToLogin } from '../utils/authNavigation';

const SESSION_TIMEOUT_KEY = 'session_timeout_minutes';
const LAST_ACTIVITY_KEY = 'last_activity_at';
const SESSION_TIMEOUT_EVENT = 'session-timeout-changed';

interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    user_code: string;
    permissions: string[];
}

interface AuthContextType {
    user: User | null;
    login: (token: string, refreshToken: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(() => {
        const raw = Number(localStorage.getItem(SESSION_TIMEOUT_KEY) || 0);
        return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    });

    const applySessionTimeout = (value: unknown) => {
        const parsed = Number(value ?? 0);
        const nextValue = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
        localStorage.setItem(SESSION_TIMEOUT_KEY, String(nextValue));
        setSessionTimeoutMinutes(nextValue);
    };

    const clearSession = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setUser(null);
    };

    const logoutAndRedirect = (reason: 'logout' | 'timeout' | 'unauthorized' = 'logout') => {
        clearSession();
        redirectToLogin(reason);
    };

    const fetchSessionTimeout = async () => {
        try {
            const { data } = await api.get('/settings/company');
            applySessionTimeout(data?.session_timeout_minutes);
        } catch (error) {
            console.error('Failed to load session timeout', error);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('access_token');
            await fetchSessionTimeout();

            if (token) {
                try {
                    const { data } = await api.get('/auth/me');
                    setUser(data);
                    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
                } catch (error) {
                    console.error('Auth init failed', error);
                    clearSession();
                }
            }

            setIsLoading(false);
        };

        void initAuth();
    }, []);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === SESSION_TIMEOUT_KEY) {
                applySessionTimeout(event.newValue);
            }
        };

        const handleTimeoutChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{ sessionTimeoutMinutes?: number }>;
            applySessionTimeout(customEvent.detail?.sessionTimeoutMinutes);
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener(SESSION_TIMEOUT_EVENT, handleTimeoutChanged as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(SESSION_TIMEOUT_EVENT, handleTimeoutChanged as EventListener);
        };
    }, []);

    useEffect(() => {
        if (!user || sessionTimeoutMinutes <= 0) {
            return;
        }

        const updateActivity = () => {
            const now = Date.now();
            const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
            if (!last || now - last > 10000) {
                localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
            }
        };

        const checkTimeout = () => {
            const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
            if (!last) {
                localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
                return;
            }

            if (Date.now() - last >= sessionTimeoutMinutes * 60 * 1000) {
                logoutAndRedirect('timeout');
            }
        };

        updateActivity();

        const activityEvents: Array<keyof WindowEventMap> = [
            'mousemove',
            'keydown',
            'click',
            'scroll',
            'touchstart',
        ];

        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, updateActivity);
        });

        const intervalId = window.setInterval(checkTimeout, 30000);

        return () => {
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, updateActivity);
            });
            window.clearInterval(intervalId);
        };
    }, [user, sessionTimeoutMinutes]);

    const login = (token: string, refreshToken: string) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        void fetchSessionTimeout();
        api.get('/auth/me')
            .then(({ data }) => setUser(data))
            .catch((error) => {
                console.error('Failed to load user profile after login', error);
                clearSession();
            });
    };

    const logout = () => {
        logoutAndRedirect('logout');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
