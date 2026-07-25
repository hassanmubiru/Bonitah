'use client';

import { Eye, Zap, Focus, Headphones } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettingsManager } from '@/hooks/useSettingsManager';

/**
 * Accessibility configuration section (Requirement 11.7)
 * 
 * Features:
 * - High contrast mode
 * - Reduced motion settings
 * - Enhanced focus indicators
 * - Screen reader optimizations
 * - Real-time accessibility preference application
 */
export function AccessibilitySection() {
  const { settings, updateSetting, isLoading } = useSettingsManager();

  if (isLoading) {
    return <AccessibilitySectionSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            Visual Accessibility
          </CardTitle>
          <CardDescription>
            Customize visual elements to improve readability and reduce eye strain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="high-contrast" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                High Contrast Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Increase color contrast for better visibility and readability
              </p>
            </div>
            <Switch
              id="high-contrast"
              checked={settings.highContrast}
              onCheckedChange={(checked) => updateSetting('highContrast', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="enhanced-focus" className="flex items-center gap-2">
                <Focus className="h-4 w-4" />
                Enhanced Focus Indicators
              </Label>
              <p className="text-sm text-muted-foreground">
                Show prominent focus rings and outlines for keyboard navigation
              </p>
            </div>
            <Switch
              id="enhanced-focus"
              checked={settings.focusIndicators}
              onCheckedChange={(checked) => updateSetting('focusIndicators', checked)}
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
            Motion & Animation
          </CardTitle>
          <CardDescription>
            Control motion effects to reduce distraction and motion sensitivity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="reduced-motion" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Reduced Motion
              </Label>
              <p className="text-sm text-muted-foreground">
                Minimize animations and motion effects throughout the interface
              </p>
            </div>
            <Switch
              id="reduced-motion"
              checked={settings.reducedMotion}
              onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Headphones className="h-4 w-4 text-primary" />
            </div>
            Screen Reader Support
          </CardTitle>
          <CardDescription>
            Optimize the interface for screen readers and assistive technologies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="screen-reader-optimized" className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Screen Reader Optimized
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable additional ARIA labels and descriptions for better screen reader experience
              </p>
            </div>
            <Switch
              id="screen-reader-optimized"
              checked={settings.screenReaderOptimized}
              onCheckedChange={(checked) => updateSetting('screenReaderOptimized', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Status Indicator */}
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Accessibility Status
            </p>
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <p>
                Current active features:{' '}
                {[
                  settings.highContrast && 'High Contrast',
                  settings.reducedMotion && 'Reduced Motion',
                  settings.focusIndicators && 'Enhanced Focus',
                  settings.screenReaderOptimized && 'Screen Reader Optimized',
                ]
                  .filter(Boolean)
                  .join(', ') || 'None'}
              </p>
              <p>
                These settings are applied immediately and persist across browser sessions.
                For additional accessibility support, contact our team at accessibility@bonitah.com
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keyboard Navigation</CardTitle>
          <CardDescription>
            Essential keyboard shortcuts for navigating the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Tab</span>
                <span className="text-muted-foreground">Next element</span>
              </div>
              <div className="flex justify-between">
                <span>Shift + Tab</span>
                <span className="text-muted-foreground">Previous element</span>
              </div>
              <div className="flex justify-between">
                <span>Enter/Space</span>
                <span className="text-muted-foreground">Activate button</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Escape</span>
                <span className="text-muted-foreground">Close modal/menu</span>
              </div>
              <div className="flex justify-between">
                <span>Arrow keys</span>
                <span className="text-muted-foreground">Navigate menus</span>
              </div>
              <div className="flex justify-between">
                <span>Alt + S</span>
                <span className="text-muted-foreground">Open settings</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccessibilitySectionSkeleton() {
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
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
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