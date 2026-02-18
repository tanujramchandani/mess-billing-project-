import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      console.log('[Auth] Fetching user profile...');
      const response = await authAPI.getProfile();
      console.log('[Auth] Profile received:', response.data);
      setUser(response.data);
    } catch (error) {
      console.error('[Auth] Failed to fetch profile:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, fetchProfile]);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { access, refresh, user: userData } = response.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      setToken(access);
      setUser(userData);
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
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        setToken(access);
        setUser(userData);
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
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully.');
  };

  const updateUser = async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      setUser(response.data);
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
