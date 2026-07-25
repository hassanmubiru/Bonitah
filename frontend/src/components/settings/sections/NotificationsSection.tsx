'use client';

import { Bell, Mail, DollarSign, Target, Users, GraduationCap } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettingsManager } from '@/hooks/useSettingsManager';

/**
 * Notifications configuration section
 * 
 * Features:
 * - Push notification controls
 * - Email notification preferences
 * - Category-specific notification settings
 * - Granular control over alert types
 */
export function NotificationsSection() {
  const { settings, updateSetting, isLoading } = useSettingsManager();

  if (isLoading) {
    return <NotificationsSectionSkeleton />;
  }

  const notificationCategories = [
    {
      key: 'transactionAlerts' as const,
      icon: DollarSign,
      title: 'Transaction Alerts',
      description: 'Notifications for deposits, withdrawals, and transfers',
    },
    {
      key: 'goalReminders' as const,
      icon: Target,
      title: 'Goal Reminders',
      description: 'Progress updates and milestone notifications for savings goals',
    },
    {
      key: 'communityUpdates' as const,
      icon: Users,
      title: 'Community Updates',
      description: 'Activity in your savings circles and investment pools',
    },
    {
      key: 'educationProgress' as const,
      icon: GraduationCap,
      title: 'Education Progress',
      description: 'Course completions, certificates, and learning streaks',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            General Notifications
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="push-notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Push Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive browser notifications when the app is open
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={settings.pushNotifications}
              onCheckedChange={(checked) => updateSetting('pushNotifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="email-notifications" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive important updates via email
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Categories</CardTitle>
          <CardDescription>
            Choose which types of activities trigger notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.key} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor={category.key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {category.title}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
                <Switch
                  id={category.key}
                  checked={settings[category.key]}
                  onCheckedChange={(checked) => updateSetting(category.key, checked)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">About Notifications</p>
            <p className="text-xs text-muted-foreground">
              Push notifications require browser permission. Email notifications will be sent to
              your registered email address. You can adjust these settings at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsSectionSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-muted rounded-md">
                <div className="h-4 w-4 bg-muted-foreground/20 rounded" />
              </div>
              <div className="h-5 w-32 bg-muted rounded" />
            </div>
            <div className="h-4 w-48 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-56 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-12 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}