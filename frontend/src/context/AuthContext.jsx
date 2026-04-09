import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(sessionStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);
  const fetchProfileRef = useRef(null);
  const lastFetchRef = useRef(0);

  const fetchProfile = useCallback(async (forceFresh = false) => {
    // Prevent concurrent requests
    if (fetchProfileRef.current && !forceFresh) {
      return fetchProfileRef.current;
    }

    // Prevent too frequent fetches (max once per 5 seconds)
    const now = Date.now();
    if (!forceFresh && now - lastFetchRef.current < 5000) {
      return;
    }

    lastFetchRef.current = now;

    const promise = (async () => {
      try {
        console.log('[Auth] Fetching user profile...');
        const response = await authAPI.getProfile();
        console.log('[Auth] Profile received:', response.data);
        setUser(response.data);
        return response.data;
      } catch (error) {
        console.error('[Auth] Failed to fetch profile:', error);
        if (error.response?.status === 401) {
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
          setToken(null);
          setUser(null);
        }
        throw error;
      } finally {
        fetchProfileRef.current = null;
      }
    })();

    fetchProfileRef.current = promise;
    return promise;
  }, []);

  // Initial profile fetch
  useEffect(() => {
    if (token) {
      fetchProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, fetchProfile]);

  // Periodic profile refresh - every 15 minutes
  useEffect(() => {
    if (!token) return;

    const intervalId = setInterval(() => {
      console.log('[Auth] Periodic profile refresh');
      fetchProfile(true).catch((error) => {
        console.error('[Auth] Periodic refresh failed:', error);
      });
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(intervalId);
  }, [token, fetchProfile]);

  // Refresh profile on window focus
  useEffect(() => {
    if (!token) return;

    const handleFocus = () => {
      console.log('[Auth] Window focus - refreshing profile');
      fetchProfile(true).catch((error) => {
        console.error('[Auth] Focus refresh failed:', error);
      });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [token, fetchProfile]);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { access, refresh, user: userData } = response.data;
      sessionStorage.setItem('access_token', access);
      sessionStorage.setItem('refresh_token', refresh);
      setToken(access);
      setUser(userData);
      lastFetchRef.current = Date.now();
      toast.success(`Welcome back, ${userData.first_name || userData.username}!`);
      return userData;
    } catch (error) {
      const data = error.response?.data;
      let message = 'Login failed. Please check your credentials.';
      if (data) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          message = data.detail[0];
        } else if (data.non_field_errors) {
          message = data.non_field_errors[0];
        } else if (data.message) {
          message = data.message;
        }
      }
      toast.error(message);
      throw error;
    }
  };

  const register = async (data) => {
    try {
      const response = await authAPI.register(data);
      const { access, refresh, user: userData } = response.data;
      if (access) {
        sessionStorage.setItem('access_token', access);
        sessionStorage.setItem('refresh_token', refresh);
        setToken(access);
        setUser(userData);
        lastFetchRef.current = Date.now();
        toast.success('Registration successful! Welcome aboard!');
        return userData;
      } else {
        toast.success('Registration successful! Please login.');
        return null;
      }
    } catch (error) {
      const errors = error.response?.data;
      if (errors && typeof errors === 'object') {
        const firstError = Object.values(errors).flat()[0];
        toast.error(firstError || 'Registration failed.');
      } else {
        toast.error('Registration failed. Please try again.');
      }
      throw error;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    fetchProfileRef.current = null;
    lastFetchRef.current = 0;
    toast.success('Logged out successfully.');
  };

  const updateUser = async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      setUser(response.data);
      lastFetchRef.current = Date.now();
      toast.success('Profile updated successfully!');
      return response.data;
    } catch (error) {
      toast.error('Failed to update profile.');
      throw error;
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateUser,
    fetchProfile,
    isAuthenticated: !!token && !!user,
    isStudent: user?.role === 'student',
    isContractor: user?.role === 'contractor',
    isWarden: user?.role === 'warden',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
