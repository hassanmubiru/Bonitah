'use client';

import { useState } from 'react';
import { Settings, Palette, Bell, Shield, Eye, Wrench, Download, Upload, RotateCcw } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeSection } from './sections/ThemeSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { PrivacySection } from './sections/PrivacySection';
import { AccessibilitySection } from './sections/AccessibilitySection';
import { AdvancedSection } from './sections/AdvancedSection';
import { useSettingsManager } from '@/hooks/useSettingsManager';

/**
 * Main Settings page component (Task 21.10)
 * 
 * Provides comprehensive settings management including:
 * - Theme switching with session persistence (Requirements 19.1, 19.3)
 * - Appearance and UI preferences 
 * - Notification configuration
 * - Privacy controls
 * - Accessibility options (Requirement 11.7)
 * - Advanced settings and data management
 * 
 * All settings are persisted across browser sessions using localStorage
 * with immediate UI updates without page reload (within 1s per requirement).
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('appearance');
  const { exportSettings, importSettings, resetSettings, isResetting } = useSettingsManager();

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target?.result as string);
          importSettings(settings);
        } catch (error) {
          console.error('Failed to import settings:', error);
          // TODO: Show error toast notification
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your preferences, theme, notifications, and privacy settings
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-6">
        <button
          onClick={exportSettings}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Export your settings to a file"
        >
          <Download className="h-4 w-4" />
          Export Settings
        </button>
        
        <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
          <Upload className="h-4 w-4" />
          Import Settings
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="sr-only"
          />
        </label>

        <button
          onClick={resetSettings}
          disabled={isResetting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive bg-background border border-input rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reset all settings to default values"
        >
          <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
          Reset All
        </button>
      </div>

      <Card className="p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b bg-muted/50">
            <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-transparent gap-1">
              <TabsTrigger
                value="appearance"
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Appearance</span>
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger
                value="privacy"
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger
                value="accessibility"
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Accessibility</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="appearance" className="mt-0 space-y-6">
              <ThemeSection />
              <AppearanceSection />
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <NotificationsSection />
            </TabsContent>

            <TabsContent value="privacy" className="mt-0">
              <PrivacySection />
            </TabsContent>

            <TabsContent value="accessibility" className="mt-0">
              <AccessibilitySection />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}