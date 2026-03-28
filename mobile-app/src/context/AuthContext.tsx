import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import type { MobileUser } from '../types/mobile';

interface AuthContextType {
  user: MobileUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearTokens = () => {
    localStorage.removeItem('mobile_access_token');
    localStorage.removeItem('mobile_refresh_token');
  };

  const loadMe = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data);
  };

  useEffect(() => {
    const initialize = async () => {
      const token = localStorage.getItem('mobile_access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        await loadMe();
      } catch (error) {
        clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, []);

  const login = async (email: string, password: string) => {
    const payload = new URLSearchParams();
    payload.set('username', email);
    payload.set('password', password);
    const { data } = await api.post('/auth/login', payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    localStorage.setItem('mobile_access_token', data.access_token);
    localStorage.setItem('mobile_refresh_token', data.refresh_token);
    await loadMe();
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
