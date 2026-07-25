'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Settings,
  Shield,
  Database,
  Server,
  Wifi,
  Edit,
  MoreVertical,
  Trash2,
  Download,
  RefreshCw,
  UserCog,
  Eye,
  FileText,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { useSiweAuth } from '@/hooks/useSiweAuth';

interface AdminDashboardData {
  systemHealth: {
    overall: 'healthy' | 'warning' | 'critical';
    services: Record<string, 'healthy' | 'warning' | 'error'>;
  };
  metrics: {
    totalUsers: number;
    activeUsers24h: number;
    newUsers24h: number;
    totalTransactions: number;
    transactions24h: number;
    totalValue: string;
    value24h: string;
  };
  alerts: Array<{
    id: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    userAddress: string;
  }>;
}

interface AdminUser {
  id: string;
  walletAddress: string;
  role: 'USER' | 'VERIFIER' | 'ADMIN';
  verified: boolean;
  reputation: number;
  createdAt: Date;
  lastActiveAt: Date | null;
}

interface AdminTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'GOAL_CONTRIBUTION' | 'CIRCLE_CONTRIBUTION' | 'POOL_CONTRIBUTION';
  amount: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  userAddress: string;
  txHash?: string;
  createdAt: Date;
  confirmedAt: Date | null;
}

interface SystemStatus {
  uptime: number;
  version: string;
  environment: 'development' | 'production' | 'test';
  database: {
    status: 'healthy' | 'warning' | 'error';
    connections: number;
    responseTime: number;
  };
  blockchain: {
    status: 'healthy' | 'warning' | 'error';
    latestBlock: number;
    syncStatus: 'synced' | 'syncing' | 'behind';
  };
  redis: {
    status: 'healthy' | 'warning' | 'error';
    memory: number;
    connections: number;
  };
  metrics: {
    totalUsers: number;
    activeUsers24h: number;
    totalTransactions: number;
    transactions24h: number;
    totalValue: string;
  };
}

/**
 * Admin Dashboard Page (Req 14.9, 11.7)
 * 
 * Role-gated admin interface providing:
 * - System health monitoring and metrics
 * - User management with search and filtering
 * - Transaction oversight and monitoring  
 * - Community management tools
 * - System configuration controls
 * 
 * Access is restricted to ADMIN role only with proper error handling
 * for unauthorized access attempts.
 */
export default function AdminPage() {
  // Mock authentication - in real app would use useSiweAuth hook
  const isAuthenticated = true;
  const role = 'ADMIN'; // Mock admin role for demonstration
  const address = '0x742d35cc6C8d6D0c9b8B2C8d9F7b0b8b8b8b8b8b';
  const authLoading = false;
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // API base URL
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';

  // Check admin access and redirect if unauthorized
  useEffect(() => {
    if (!authLoading && isAuthenticated && role !== 'ADMIN') {
      setError('Access denied. Admin role required.');
      return;
    }

    if (!authLoading && !isAuthenticated) {
      setError('Authentication required. Please sign in.');
      return;
    }

    if (isAuthenticated && role === 'ADMIN') {
      loadAdminData();
    }
  }, [isAuthenticated, role, authLoading]);

  const getAuthToken = () => localStorage.getItem('bfn-auth-token');

  const loadAdminData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Load dashboard data
      const dashboardResponse = await fetch(`${apiUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!dashboardResponse.ok) {
        if (dashboardResponse.status === 403) {
          throw new Error('Access denied. Admin role required.');
        }
        throw new Error('Failed to load dashboard data');
      }

      const dashboard = await dashboardResponse.json();
      
      // Convert date strings to Date objects
      dashboard.alerts = dashboard.alerts.map((alert: any) => ({
        ...alert,
        timestamp: new Date(alert.timestamp),
      }));
      
      dashboard.recentActivity = dashboard.recentActivity.map((activity: any) => ({
        ...activity,
        timestamp: new Date(activity.timestamp),
      }));

      setDashboardData(dashboard);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const params = new URLSearchParams({
        page: '1',
        limit: '50',
      });

      if (userSearch) params.append('search', userSearch);
      if (userRoleFilter !== 'all') params.append('role', userRoleFilter);

      const response = await fetch(`${apiUrl}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users.map((user: any) => ({
          ...user,
          createdAt: new Date(user.createdAt),
          lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt) : null,
        })));
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadTransactions = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/admin/transactions?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions.map((tx: any) => ({
          ...tx,
          createdAt: new Date(tx.createdAt),
          confirmedAt: tx.confirmedAt ? new Date(tx.confirmedAt) : null,
        })));
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const loadSystemStatus = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/admin/system`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (err) {
      console.error('Failed to load system status:', err);
    }
  };

  // Load data when switching tabs
  useEffect(() => {
    if (!isAuthenticated || role !== 'ADMIN') return;

    switch (activeTab) {
      case 'users':
        loadUsers();
        break;
      case 'transactions':
        loadTransactions();
        break;
      case 'system':
        loadSystemStatus();
        break;
    }
  }, [activeTab, userSearch, userRoleFilter]);

  const formatAddress = (address: string) => 
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const formatAmount = (amount: string) => {
    const eth = parseFloat(amount) / 1e18;
    return `${eth.toFixed(4)} ETH`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': case 'critical': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading admin panel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="max-w-2xl mx-auto border-red-200">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
        {!isAuthenticated && (
          <div className="text-center mt-6">
            <Button onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          System management and oversight • Signed in as {formatAddress(address || '')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardData && (
            <>
              {/* System Health Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System Health</CardTitle>
                    {getStatusIcon(dashboardData.systemHealth.overall)}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getStatusColor(dashboardData.systemHealth.overall)}`}>
                      {dashboardData.systemHealth.overall.toUpperCase()}
                    </div>
                    <div className="space-y-1 mt-3">
                      {Object.entries(dashboardData.systemHealth.services).map(([service, status]) => (
                        <div key={service} className="flex items-center justify-between text-xs">
                          <span className="capitalize">{service}</span>
                          <span className={getStatusColor(status)}>
                            {status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardData.metrics.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      +{dashboardData.metrics.newUsers24h} new today
                    </p>
                    <p className="text-xs text-green-600">
                      {dashboardData.metrics.activeUsers24h} active (24h)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatAmount(dashboardData.metrics.totalValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      +{formatAmount(dashboardData.metrics.value24h)} today
                    </p>
                    <p className="text-xs text-green-600">
                      {dashboardData.metrics.transactions24h} transactions (24h)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Active Alerts */}
              {dashboardData.alerts.some(alert => !alert.resolved) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Active Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dashboardData.alerts
                        .filter(alert => !alert.resolved)
                        .map(alert => (
                          <Alert key={alert.id} className="border-l-4 border-l-yellow-500">
                            <AlertDescription className="flex items-center justify-between">
                              <div>
                                <Badge variant={alert.type === 'CRITICAL' ? 'destructive' : 'secondary'}>
                                  {alert.type}
                                </Badge>
                                <span className="ml-2">{alert.message}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {alert.timestamp.toLocaleTimeString()}
                              </span>
                            </AlertDescription>
                          </Alert>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dashboardData.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatAddress(activity.userAddress)}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {activity.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage user accounts, roles, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter Controls */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by wallet address..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="VERIFIER">Verifier</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Users Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reputation</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-xs">
                          {formatAddress(user.walletAddress)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'ADMIN' ? 'destructive' : user.role === 'VERIFIER' ? 'secondary' : 'outline'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.verified ? 'default' : 'outline'}>
                            {user.verified ? 'Verified' : 'Unverified'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.reputation}</TableCell>
                        <TableCell>{user.createdAt.toLocaleDateString()}</TableCell>
                        <TableCell>
                          {user.lastActiveAt 
                            ? user.lastActiveAt.toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Transaction Oversight
              </CardTitle>
              <CardDescription>
                Monitor and review platform transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>TX Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {tx.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatAmount(tx.amount)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatAddress(tx.userAddress)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              tx.status === 'CONFIRMED' ? 'default' :
                              tx.status === 'PENDING' ? 'secondary' : 'destructive'
                            }
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.createdAt.toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.txHash ? formatAddress(tx.txHash) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="community" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Community Management</CardTitle>
              <CardDescription>
                Manage circles, pools, and community activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Community Management</h3>
                <p className="text-muted-foreground">
                  Community management tools will be implemented based on blockchain data.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          {systemStatus && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Database</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-lg font-bold ${getStatusColor(systemStatus.database.status)}`}>
                      {systemStatus.database.status.toUpperCase()}
                    </div>
                    <div className="space-y-1 mt-2 text-xs text-muted-foreground">
                      <div>Connections: {systemStatus.database.connections}</div>
                      <div>Response: {systemStatus.database.responseTime}ms</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Blockchain</CardTitle>
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-lg font-bold ${getStatusColor(systemStatus.blockchain.status)}`}>
                      {systemStatus.blockchain.syncStatus.toUpperCase()}
                    </div>
                    <div className="space-y-1 mt-2 text-xs text-muted-foreground">
                      <div>Block: {systemStatus.blockchain.latestBlock.toLocaleString()}</div>
                      <div>Status: {systemStatus.blockchain.status}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Redis Cache</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-lg font-bold ${getStatusColor(systemStatus.redis.status)}`}>
                      {systemStatus.redis.status.toUpperCase()}
                    </div>
                    <div className="space-y-1 mt-2 text-xs text-muted-foreground">
                      <div>Memory: {(systemStatus.redis.memory / 1024 / 1024).toFixed(1)}MB</div>
                      <div>Connections: {systemStatus.redis.connections}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                      <p className="font-semibold">{formatUptime(systemStatus.uptime)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="font-semibold">{systemStatus.version}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Environment</p>
                      <Badge variant={systemStatus.environment === 'production' ? 'destructive' : 'secondary'}>
                        {systemStatus.environment}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="font-semibold">{formatAmount(systemStatus.metrics.totalValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}