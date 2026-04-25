'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

/**
 * Auth Context
 *
 * WHAT IS CONTEXT?
 * React Context is like a "global variable" that any component can access
 * without passing it down through every level of components (called "prop drilling").
 *
 * WHY WE NEED IT:
 * Multiple pages need to know: Is the user logged in? What's their username?
 * Instead of every page checking independently, we check once at the top level
 * and share that info everywhere.
 *
 * HOW TO USE:
 * In any component: const { user, login, logout } = useAuth();
 */

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  subscription: string;
  kayfabe_strikes: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (username: string, email: string, password: string, birthdate: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, check if we have a saved token and fetch user
  useEffect(() => {
    const token = localStorage.getItem('rrd_token');
    if (token) {
      api.get<User>('/api/auth/me').then((res) => {
        if (res.success && res.data) {
          setUser(res.data);
        } else {
          localStorage.removeItem('rrd_token');
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/api/auth/login', { email, password });

    if (res.success && res.data) {
      localStorage.setItem('rrd_token', res.data.token);
      setUser(res.data.user);
      return { success: true };
    }

    return { success: false, message: res.message || 'Login failed' };
  };

  const register = async (username: string, email: string, password: string, birthdate: string) => {
    const res = await api.post<{ user: User; token: string }>('/api/auth/register', { username, email, password, birthdate });

    if (res.success && res.data) {
      localStorage.setItem('rrd_token', res.data.token);
      setUser(res.data.user);
      return { success: true };
    }

    return { success: false, message: res.message || 'Registration failed' };
  };

  const logout = () => {
    api.post('/api/auth/logout', {});
    localStorage.removeItem('rrd_token');
    setUser(null);
  };

  const refreshUser = () => {
    api.get<User>('/api/auth/me').then((res) => {
      if (res.success && res.data) {
        setUser(res.data);
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — use this in components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
