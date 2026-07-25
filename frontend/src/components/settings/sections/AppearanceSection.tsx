'use client';

import { Type, Layout, Zap, Sidebar } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettingsManager } from '@/hooks/useSettingsManager';

/**
 * Appearance configuration section
 * 
 * Features:
 * - Font size controls
 * - Layout preferences (compact mode, sidebar)
 * - Animation settings
 * - Real-time preview of changes
 */
export function AppearanceSection() {
  const { settings, updateSetting, isLoading } = useSettingsManager();

  if (isLoading) {
    return <AppearanceSectionSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Type className="h-4 w-4 text-primary" />
            </div>
            Typography
          </CardTitle>
          <CardDescription>
            Customize text size and readability settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="font-size">Font Size</Label>
              <p className="text-sm text-muted-foreground">
                Adjust the base font size across the application
              </p>
            </div>
            <Select
              value={settings.fontSize}
              onValueChange={(value: 'small' | 'medium' | 'large') =>
                updateSetting('fontSize', value)
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <p className="font-medium" style={{ fontSize: settings.fontSize === 'small' ? '0.875em' : settings.fontSize === 'large' ? '1.125em' : '1em' }}>
                Preview Text
              </p>
              <p className="text-sm text-muted-foreground" style={{ fontSize: settings.fontSize === 'small' ? '0.75em' : settings.fontSize === 'large' ? '1em' : '0.875em' }}>
                This is how text will appear with your selected font size setting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Layout className="h-4 w-4 text-primary" />
            </div>
            Layout Preferences
          </CardTitle>
          <CardDescription>
            Customize the layout and spacing of interface elements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="compact-mode">Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing and padding for a more condensed interface
              </p>
            </div>
            <Switch
              id="compact-mode"
              checked={settings.compactMode}
              onCheckedChange={(checked) => updateSetting('compactMode', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sidebar-collapsed">Collapsed Sidebar</Label>
              <p className="text-sm text-muted-foreground">
                Keep the sidebar collapsed by default for more space
              </p>
            </div>
            <Switch
              id="sidebar-collapsed"
              checked={settings.sidebarCollapsed}
              onCheckedChange={(checked) => updateSetting('sidebarCollapsed', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            Animations & Effects
          </CardTitle>
          <CardDescription>
            Control motion and visual effects throughout the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="animations-enabled">Enable Animations</Label>
              <p className="text-sm text-muted-foreground">
                Show smooth transitions, hover effects, and loading animations
              </p>
            </div>
            <Switch
              id="animations-enabled"
              checked={settings.animationsEnabled}
              onCheckedChange={(checked) => updateSetting('animationsEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AppearanceSectionSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-56 bg-muted rounded" />
                </div>
                <div className="h-6 w-12 bg-muted rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}