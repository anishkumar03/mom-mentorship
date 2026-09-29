'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('momAuthToken');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const MOM_USERNAME = process.env.NEXT_PUBLIC_MOM_USERNAME || 'mom';
    const MOM_PASSWORD = process.env.NEXT_PUBLIC_MOM_PASSWORD || '123456';

    if (username === MOM_USERNAME && password === MOM_PASSWORD) {
      localStorage.setItem('momAuthToken', 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('momAuthToken');
    setIsAuthenticated(false);
  };

  if (!mounted) return <>{children}</>;

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
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
    };
  }
  return context;
}
