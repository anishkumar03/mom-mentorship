'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('momAuthToken');
      setIsAuthenticated(stored === 'true');
    } catch (e) {
      console.error('Failed to read auth from localStorage:', e);
    }
    setIsLoading(false);
  }, []);

  const login = (username: string, password: string): boolean => {
    const MOM_USERNAME = process.env.NEXT_PUBLIC_MOM_USERNAME || 'mom';
    const MOM_PASSWORD = process.env.NEXT_PUBLIC_MOM_PASSWORD || '123456';

    if (username === MOM_USERNAME && password === MOM_PASSWORD) {
      try {
        localStorage.setItem('momAuthToken', 'true');
        setIsAuthenticated(true);
        return true;
      } catch (e) {
        console.error('Failed to set auth token:', e);
        return false;
      }
    }
    return false;
  };

  const logout = () => {
    try {
      localStorage.removeItem('momAuthToken');
    } catch (e) {
      console.error('Failed to remove auth token:', e);
    }
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      isAuthenticated: false,
      login: () => false,
      logout: () => {},
      isLoading: true,
    };
  }
  return context;
}
