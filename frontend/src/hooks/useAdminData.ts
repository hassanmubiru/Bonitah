'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Admin data management hook
 * 
 * Implements Task 21.11 requirements for admin API integration
 */
export function useAdminData() {
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  /**
   * Get authorization header with JWT token
   */
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('bfn-auth-token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }, []);

  /**
   * Fetch system health data
   */
  const fetchSystemHealth = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/system/health`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch system health');
      }

      const data = await response.json();
      setSystemHealth(data);
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      setError('Failed to load system health data');
    }
  }, [apiUrl, getAuthHeaders]);

  /**
   * Fetch analytics data
   */
  const fetchAnalytics = useCallback(async (period: string = '7d') => {
    try {
      const response = await fetch(`${apiUrl}/admin/analytics?period=${period}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError('Failed to load analytics data');
    }
  }, [apiUrl, getAuthHeaders]);

  /**
   * Fetch users with pagination and filters
   */
  const fetchUsers = useCallback(async (params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  } = {}) => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${apiUrl}/admin/users?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError('Failed to load users data');
    }
  }, [apiUrl, getAuthHeaders]);

  /**
   * Fetch audit log
   */
  const fetchAuditLog = useCallback(async (params: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
  } = {}) => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${apiUrl}/admin/audit?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit log');
      }

      const data = await response.json();
      setAuditLog(data);
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
      setError('Failed to load audit log');
    }
  }, [apiUrl, getAuthHeaders]);

  /**
   * Update user
   */
  const updateUser = useCallback(async (userId: string, updateData: {
    role?: string;
    isActive?: boolean;
  }) => {
    try {
      const response = await fetch(`${apiUrl}/admin/users/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }, [apiUrl, getAuthHeaders]);

  /**
   * Delete user
   */
  const deleteUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${apiUrl}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }, [apiUrl, getAuthHeaders]);

  /**
   * Toggle maintenance mode
   */
  const toggleMaintenanceMode = useCallback(async (enabled: boolean) => {
    try {
      const response = await fetch(`${apiUrl}/admin/system/maintenance`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle maintenance mode');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to toggle maintenance mode:', error);
      throw error;
    }
  }, [apiUrl, getAuthHeaders]);

  /**
   * Refresh all data
   */
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchSystemHealth(),
        fetchAnalytics(),
        fetchUsers(),
        fetchAuditLog(),
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSystemHealth, fetchAnalytics, fetchUsers, fetchAuditLog]);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    systemHealth,
    analytics,
    users,
    auditLog,
    isLoading,
    error,
    updateUser,
    deleteUser,
    toggleMaintenanceMode,
    refreshData,
    fetchUsers,
    fetchAnalytics,
    fetchAuditLog,
  };
}