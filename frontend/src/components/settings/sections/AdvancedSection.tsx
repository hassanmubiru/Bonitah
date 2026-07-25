'use client';

import { Code, Bug, Beaker, Download, Upload, RotateCcw, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSettingsManager } from '@/hooks/useSettingsManager';

/**
 * Advanced settings and developer options section
 * 
 * Features:
 * - Developer mode controls
 * - Debug logging options
 * - Experimental features
 * - Data management utilities
 * - Advanced troubleshooting tools
 */
export function AdvancedSection() {
  const { settings, updateSetting, exportSettings, resetSettings, isLoading, isResetting } = useSettingsManager();

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          // The importSettings function from the hook would be called here
          console.log('Import settings:', importedSettings);
          // TODO: Add toast notification for success/failure
        } catch (error) {
          console.error('Failed to import settings:', error);
          // TODO: Show error toast notification
        }
      };
      reader.readAsText(file);
    }
  };

  if (isLoading) {
    return <AdvancedSectionSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Code className="h-4 w-4 text-primary" />
            </div>
            Developer Options
          </CardTitle>
          <CardDescription>
            Advanced settings for developers and power users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="developer-mode" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Developer Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable developer tools, debug information, and advanced features
              </p>
            </div>
            <Switch
              id="developer-mode"
              checked={settings.developerMode}
              onCheckedChange={(checked) => updateSetting('developerMode', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="debug-logging" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Logging
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable verbose console logging for troubleshooting
              </p>
            </div>
            <Switch
              id="debug-logging"
              checked={settings.debugLogging}
              onCheckedChange={(checked) => updateSetting('debugLogging', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="experimental-features" className="flex items-center gap-2">
                <Beaker className="h-4 w-4" />
                Experimental Features
              </Label>
              <p className="text-sm text-muted-foreground">
                Try out new features before they're officially released
              </p>
            </div>
            <Switch
              id="experimental-features"
              checked={settings.experimentalFeatures}
              onCheckedChange={(checked) => updateSetting('experimentalFeatures', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export, import, or reset your settings and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={exportSettings}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Settings
            </Button>

            <label className="inline-flex">
              <Button variant="outline" className="flex items-center gap-2 w-full cursor-pointer">
                <Upload className="h-4 w-4" />
                Import Settings
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="sr-only"
              />
            </label>

            <Button
              onClick={resetSettings}
              disabled={isResetting}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
              {isResetting ? 'Resetting...' : 'Reset All'}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Export:</strong> Download your settings as a JSON file for backup or sharing.
            </p>
            <p>
              <strong>Import:</strong> Restore settings from a previously exported JSON file.
            </p>
            <p>
              <strong>Reset:</strong> Restore all settings to their default values.
            </p>
          </div>
        </CardContent>
      </Card>

      {settings.developerMode && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>
              System information and debugging details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs space-y-2 bg-muted p-4 rounded-lg">
              <div>Settings Version: {settings.version}</div>
              <div>Last Modified: {new Date(settings.lastModified).toLocaleString()}</div>
              <div>Browser: {navigator.userAgent}</div>
              <div>Storage Available: {navigator.storage ? 'Yes' : 'No'}</div>
              <div>Theme: {settings.theme}</div>
              <div>Active Features: {
                [
                  settings.highContrast && 'high-contrast',
                  settings.reducedMotion && 'reduced-motion',
                  settings.compactMode && 'compact-mode',
                  settings.developerMode && 'developer-mode'
                ].filter(Boolean).join(', ') || 'none'
              }</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Advanced Settings Warning
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Developer mode and experimental features may affect app stability and performance.
              Debug logging may include sensitive information in browser console output.
              Reset all settings will permanently delete your current preferences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedSectionSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-32 bg-muted rounded" />
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