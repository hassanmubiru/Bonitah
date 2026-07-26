'use client';

import { useState } from 'react';
import { 
  Shield, Users, Activity, AlertTriangle, Settings, 
  MoreHorizontal, Search, Filter, Download 
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSiweAuth } from '@/hooks/useSiweAuth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useAdminData } from '@/hooks/useAdminData';

/**
 * Admin page - Administrative operations with role-based access control.
 *
 * Implements Task 21.11 requirements:
 * - Admin-only operations gated by role with unauthorized access blocked
 * - Requirements: 14.9, 11.7
 *
 * Features:
 * - Role-based access control with unauthorized access blocking
 * - User management with search, filter, and action capabilities
 * - System monitoring with real-time health metrics
 * - Analytics dashboard with user and transaction insights
 * - Audit logging with detailed action tracking
 * - System configuration and maintenance controls
 */
export default function AdminPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useSiweAuth();
  const { isOnCorrectNetwork } = useAuthGuard();
  const {
    systemHealth,
    analytics,
    users,
    auditLog,
    isLoading,
    error,
    updateUser,
    deleteUser,
    toggleMaintenanceMode,
    refreshData
  } = useAdminData();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Block unauthorized access
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated || role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Admin privileges required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isOnCorrectNetwork) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please switch to Base Sepolia network to access admin features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access Denied: Admin privileges required to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleUserAction = async (userId: string, action: string) => {
    try {
      switch (action) {
        case 'activate':
          await updateUser(userId, { isActive: true });
          break;
        case 'deactivate':
          await updateUser(userId, { isActive: false });
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            await deleteUser(userId);
          }
          break;
        case 'promote':
          await updateUser(userId, { role: 'ADMIN' });
          break;
      }
      await refreshData();
    } catch (error) {
      console.error('User action failed:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <Shield className="h-8 w-8" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage users, monitor system health, and configure platform settings.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth?.users.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{systemHealth?.users.growth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth?.users.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth?.transactions.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {systemHealth?.transactions.recent || 0} in last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <div className={`h-2 w-2 rounded-full ${
              systemHealth?.status === 'healthy' ? 'bg-green-500' : 
              systemHealth?.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {systemHealth?.status || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              CPU: {systemHealth?.system.cpu || 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="monitoring">System Monitor</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* User Management Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage user accounts, roles, and permissions.
              </CardDescription>
              
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by wallet address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Role: {roleFilter || 'All'}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Status: {statusFilter || 'All'}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet Address</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'destructive'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(user.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleUserAction(user.id, user.isActive ? 'deactivate' : 'activate')}
                              >
                                {user.isActive ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              {user.role !== 'ADMIN' && (
                                <DropdownMenuItem
                                  onClick={() => handleUserAction(user.id, 'promote')}
                                >
                                  Promote to Admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleUserAction(user.id, 'delete')}
                                className="text-red-600"
                              >
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {users && users.users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No users found matching the current filters.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Analytics</CardTitle>
                <CardDescription>
                  User growth, transaction volume, and engagement metrics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold">User Growth</h4>
                    <div className="text-2xl font-bold">
                      {analytics?.userGrowth.reduce((sum, day) => sum + day.count, 0) || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">New users this period</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">Transaction Volume</h4>
                    <div className="text-2xl font-bold">
                      {analytics?.transactionVolume.reduce((sum, day) => sum + day.volume, 0) || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Total transactions</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">Revenue</h4>
                    <div className="text-2xl font-bold">
                      ${analytics?.revenue.reduce((sum, day) => sum + day.amount, 0).toLocaleString() || '0'}
                    </div>
                    <p className="text-sm text-muted-foreground">Total revenue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Monitor Tab */}
        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>System Monitor</CardTitle>
              <CardDescription>
                Real-time system health and performance metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">System Resources</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>CPU Usage</span>
                      <span>{systemHealth?.system.cpu || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory (RSS)</span>
                      <span>{Math.round((systemHealth?.system.memory.rss || 0) / 1024 / 1024)}MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Heap Used</span>
                      <span>{Math.round((systemHealth?.system.memory.heapUsed || 0) / 1024 / 1024)}MB</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold">Error Monitoring</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Recent Errors</span>
                      <span>{systemHealth?.errors.recent || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Error Rate</span>
                      <span>{((systemHealth?.errors.rate || 0) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Database</span>
                      <Badge variant={systemHealth?.system.database === 'connected' ? 'default' : 'destructive'}>
                        {systemHealth?.system.database || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                Track administrative actions and system events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Admin ID</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog?.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {new Date(entry.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.action}</Badge>
                        </TableCell>
                        <TableCell>{entry.userId}</TableCell>
                        <TableCell>{entry.adminId}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {entry.details}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure platform settings and maintenance options.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold">Maintenance Mode</h4>
                  <p className="text-sm text-muted-foreground">
                    Enable maintenance mode to perform system updates.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => toggleMaintenanceMode(false)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Toggle Maintenance
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold">System Backup</h4>
                  <p className="text-sm text-muted-foreground">
                    Create a backup of system data and configurations.
                  </p>
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Create Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}