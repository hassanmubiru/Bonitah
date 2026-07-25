'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTheme } from 'next-themes';

export interface UserSettings {
  // Theme settings (Requirements 19.1, 19.3)
  theme: 'light' | 'dark' | 'system';
  
  // Appearance settings
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  sidebarCollapsed: boolean;
  animationsEnabled: boolean;
  
  // Accessibility settings (Requirement 11.7)
  highContrast: boolean;
  reducedMotion: boolean;
  focusIndicators: boolean;
  screenReaderOptimized: boolean;
  
  // Notification settings
  pushNotifications: boolean;
  emailNotifications: boolean;
  transactionAlerts: boolean;
  goalReminders: boolean;
  communityUpdates: boolean;
  educationProgress: boolean;
  
  // Privacy settings
  analyticsEnabled: boolean;
  dataSharing: boolean;
  profileVisibility: 'public' | 'private' | 'friends';
  activityTracking: boolean;
  
  // Advanced settings
  developerMode: boolean;
  debugLogging: boolean;
  experimentalFeatures: boolean;
  
  // Session metadata
  lastModified: string;
  version: string;
}

const SETTINGS_KEY = 'bfn-settings';
const SETTINGS_VERSION = '1.0.0';

const DEFAULT_SETTINGS: UserSettings = {
  // Theme defaults (Requirement 19.1: light default)
  theme: 'light',
  
  // Appearance defaults
  fontSize: 'medium',
  compactMode: false,
  sidebarCollapsed: false,
  animationsEnabled: true,
  
  // Accessibility defaults
  highContrast: false,
  reducedMotion: false,
  focusIndicators: true,
  screenReaderOptimized: false,
  
  // Notification defaults
  pushNotifications: true,
  emailNotifications: true,
  transactionAlerts: true,
  goalReminders: true,
  communityUpdates: false,
  educationProgress: true,
  
  // Privacy defaults
  analyticsEnabled: false,
  dataSharing: false,
  profileVisibility: 'private',
  activityTracking: false,
  
  // Advanced defaults
  developerMode: false,
  debugLogging: false,
  experimentalFeatures: false,
  
  // Session metadata
  lastModified: new Date().toISOString(),
  version: SETTINGS_VERSION,
};

/**
 * Settings manager hook for handling user preferences (Task 21.10)
 * 
 * Features:
 * - Session persistence using localStorage (Requirement 19.3)
 * - Theme integration with existing ThemeProvider (Requirements 19.1, 19.3)
 * - Immediate updates without page reload (within 1s per requirement)
 * - Settings export/import functionality
 * - Reset to defaults capability
 * - Version migration support
 */
export function useSettingsManager() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Load settings from localStorage on initialization
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserSettings;
        
        // Version migration logic
        if (parsed.version !== SETTINGS_VERSION) {
          console.log('Migrating settings from version', parsed.version, 'to', SETTINGS_VERSION);
          // Apply migrations here as needed
          parsed.version = SETTINGS_VERSION;
        }
        
        setSettings(parsed);
        
        // Sync theme with existing ThemeProvider
        if (parsed.theme !== theme) {
          setTheme(parsed.theme);
        }
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      // Fall back to defaults
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, [theme, setTheme]);

  // Persist settings to localStorage whenever they change
  const persistSettings = useCallback((newSettings: UserSettings) => {
    try {
      newSettings.lastModified = new Date().toISOString();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      
      // Sync theme changes with ThemeProvider
      if (newSettings.theme !== theme) {
        setTheme(newSettings.theme);
      }
    } catch (error) {
      console.error('Failed to persist settings to localStorage:', error);
    }
  }, [theme, setTheme]);

  // Update a specific setting
  const updateSetting = useCallback(<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    persistSettings(newSettings);
  }, [settings, persistSettings]);

  // Update multiple settings at once
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...updates };
    persistSettings(newSettings);
  }, [settings, persistSettings]);

  // Export settings to JSON file
  const exportSettings = useCallback(() => {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `bonitah-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
    }
  }, [settings]);

  // Import settings from JSON data
  const importSettings = useCallback((importedSettings: Partial<UserSettings>) => {
    try {
      // Validate and merge with defaults to ensure all required fields are present
      const validatedSettings = { ...DEFAULT_SETTINGS, ...importedSettings };
      validatedSettings.version = SETTINGS_VERSION;
      persistSettings(validatedSettings);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw error;
    }
  }, [persistSettings]);

  // Reset all settings to defaults
  const resetSettings = useCallback(async () => {
    setIsResetting(true);
    try {
      // Add a small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const resetSettings = { ...DEFAULT_SETTINGS };
      persistSettings(resetSettings);
    } catch (error) {
      console.error('Failed to reset settings:', error);
    } finally {
      setIsResetting(false);
    }
  }, [persistSettings]);

  // Apply accessibility settings to document
  useEffect(() => {
    if (isLoading) return;

    const { fontSize, highContrast, reducedMotion, focusIndicators } = settings;
    
    // Apply font size
    document.documentElement.style.setProperty(
      '--font-size-scale',
      fontSize === 'small' ? '0.875' : fontSize === 'large' ? '1.125' : '1'
    );
    
    // Apply high contrast
    document.documentElement.classList.toggle('high-contrast', highContrast);
    
    // Apply reduced motion
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
    
    // Apply focus indicators
    document.documentElement.classList.toggle('enhanced-focus', focusIndicators);
    
  }, [settings, isLoading]);

  return {
    settings,
    isLoading,
    isResetting,
    updateSetting,
    updateSettings,
    exportSettings,
    importSettings,
    resetSettings,
  };
}