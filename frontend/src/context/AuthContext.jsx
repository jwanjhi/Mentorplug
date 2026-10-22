import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('mp_user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('mp_token'));
  const [loading, setLoading] = useState(true);

  // Validate session on initial load via GET /api/auth/me
  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('mp_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          localStorage.setItem('mp_user', JSON.stringify(res.data));
        } catch (err) {
          // If token is invalid or expired, clear storage
          localStorage.removeItem('mp_token');
          localStorage.removeItem('mp_user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, []);

  // Login handler
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: receivedToken, user: receivedUser } = res.data;

    localStorage.setItem('mp_token', receivedToken);
    localStorage.setItem('mp_user', JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);

    return receivedUser;
  };

  // Register handler
  const register = async (name, email, password, role) => {
    const res = await api.post('/auth/register', { name, email, password, role });
    const receivedToken = res.data.token;
    let receivedUser = res.data.user;

    // Fallback: If user details were not included in register response, fetch /auth/me immediately
    if (!receivedUser || !receivedUser.role) {
      localStorage.setItem('mp_token', receivedToken);
      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${receivedToken}` },
      });
      receivedUser = meRes.data;
    }

    localStorage.setItem('mp_token', receivedToken);
    localStorage.setItem('mp_user', JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);

    return receivedUser;
  };

  // Google OAuth Login / Registration handler
  const loginWithGoogle = async (idToken, role = null) => {
    const res = await api.post('/auth/google', { idToken, role });
    
    // If backend reports new user needs role selection, return response as-is without saving session
    if (res.data?.needsRole) {
      return res.data;
    }

    const { token: receivedToken, user: receivedUser, isNewUser } = res.data;
    if (receivedToken && receivedUser) {
      localStorage.setItem('mp_token', receivedToken);
      localStorage.setItem('mp_user', JSON.stringify(receivedUser));
      setToken(receivedToken);
      setUser(receivedUser);
    }

    return { user: receivedUser, isNewUser: !!isNewUser };
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('mp_token');
    localStorage.removeItem('mp_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        loginWithGoogle,
        logout,
        setUser,
      }}
    >
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
