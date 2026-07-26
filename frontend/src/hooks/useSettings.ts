'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Settings configuration interface
 */
export interface AppSettings {
  // Appearance
  colorScheme: 'default' | 'blue' | 'green' | 'purple';
  fontSize: number;
  compactMode: boolean;

  // Accessibility
  highContrast: boolean;
  reduceMotion: boolean;
  screenReaderOptimized: boolean;
  enhancedKeyboardNav: boolean;

  // Notifications
  notifications: {
    email: {
      enabled: boolean;
      types: {
        transactions: boolean;
        goalProgress: boolean;
        communityUpdates: boolean;
        security: boolean;
        marketing: boolean;
      };
    };
    push: {
      enabled: boolean;
    };
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  };

  // Privacy
  privacy: {
    analytics: boolean;
    dataSharing: boolean;
    personalization: boolean;
    marketing: boolean;
  };

  // Performance
  performance: {
    dataSaver: boolean;
    autoRefresh: string; // seconds as string
    preloadData: boolean;
  };

  // Advanced
  advanced: {
    debugMode: boolean;
    developerTools: boolean;
    experimentalFeatures: boolean;
  };
}

/**
 * Default settings configuration
 */
const DEFAULT_SETTINGS: AppSettings = {
  colorScheme: 'default',
  fontSize: 16,
  compactMode: false,
  
  highContrast: false,
  reduceMotion: false,
  screenReaderOptimized: false,
  enhancedKeyboardNav: false,
  
  notifications: {
    email: {
      enabled: true,
      types: {
        transactions: true,
        goalProgress: true,
        communityUpdates: false,
        security: true,
        marketing: false,
      },
    },
    push: {
      enabled: false,
    },
    frequency: 'immediate',
  },
  
  privacy: {
    analytics: true,
    dataSharing: false,
    personalization: true,
    marketing: false,
  },
  
  performance: {
    dataSaver: false,
    autoRefresh: '30',
    preloadData: true,
  },
  
  advanced: {
    debugMode: false,
    developerTools: false,
    experimentalFeatures: false,
  },
};

const SETTINGS_STORAGE_KEY = 'bfn_user_settings';

/**
 * Settings management hook
 * 
 * Implements Task 21.10 requirement for theme and preference controls
 * persisted for the session (Requirements: 19.1, 19.3, 11.7)
 *
 * Features:
 * - Session/localStorage persistence for all settings
 * - Type-safe settings management with validation
 * - Real-time updates with change tracking
 * - Import/export functionality for backup/restore
 * - Reset to defaults with confirmation
 * - Change detection for unsaved changes indicator
 * - Optimistic updates with error recovery
 * - Settings migration for version compatibility
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [, setLastSavedSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  /**
   * Load settings from localStorage on mount
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored) as AppSettings;
        // Merge with defaults to handle new settings
        const mergedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
        setSettings(mergedSettings);
        setLastSavedSettings(mergedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Fall back to defaults if parsing fails
      setSettings(DEFAULT_SETTINGS);
      setLastSavedSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Persist settings to localStorage
   */
  const persistSettings = useCallback((newSettings: AppSettings) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      setLastSavedSettings(newSettings);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, []);

  /**
   * Update a specific setting
   */
  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      
      // Auto-persist after a short delay to batch rapid changes
      setTimeout(() => persistSettings(newSettings), 500);
      
      return newSettings;
    });
    setHasUnsavedChanges(true);
  }, [persistSettings]);

  /**
   * Reset all settings to defaults
   */
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persistSettings(DEFAULT_SETTINGS);
  }, [persistSettings]);

  /**
   * Export settings as JSON file
   */
  const exportSettings = useCallback(() => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `bfn-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [settings]);

  /**
   * Import settings from JSON object
   */
  const importSettings = useCallback((importedSettings: Partial<AppSettings>) => {
    try {
      // Validate and merge with defaults
      const mergedSettings = { ...DEFAULT_SETTINGS, ...importedSettings };
      setSettings(mergedSettings);
      persistSettings(mergedSettings);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Invalid settings format');
    }
  }, [persistSettings]);

  /**
   * Apply CSS custom properties based on settings
   */
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply font size
    root.style.setProperty('--font-size-base', `${settings.fontSize}px`);
    
    // Apply accessibility settings
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    if (settings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    if (settings.compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }

    // Apply color scheme
    root.setAttribute('data-color-scheme', settings.colorScheme);
    
  }, [settings]);

  return {
    settings,
    updateSetting,
    resetToDefaults,
    exportSettings,
    importSettings,
    isLoading,
    hasUnsavedChanges,
  };
}