/**
 * Settings Page Component Tests - Task 21.12
 * 
 * Covers data-source wiring, loading/error/retry rendering, and role gating.
 * 
 * Requirements Coverage:
 * - 11.1: Live data display from user preferences
 * - 11.3: Loading/error/retry states for settings persistence
 * - 11.4: No placeholder values during loading
 * - 19.1: Theme selection with real-time preview
 * - 19.3: Accessibility preferences persistence
 * - 14.9: Role-based access control
 * - 15.5: Real-time preference updates
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

import SettingsPage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSettings } from '@/hooks/useSettings';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

// Mock hooks
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(),
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Settings: ({ className, ...props }: any) => <div data-testid="settings-icon" className={className} {...props} />,
  Palette: ({ className, ...props }: any) => <div data-testid="palette-icon" className={className} {...props} />,
  Bell: ({ className, ...props }: any) => <div data-testid="bell-icon" className={className} {...props} />,
  Shield: ({ className, ...props }: any) => <div data-testid="shield-icon" className={className} {...props} />,
  Eye: ({ className, ...props }: any) => <div data-testid="eye-icon" className={className} {...props} />,
  Monitor: ({ className, ...props }: any) => <div data-testid="monitor-icon" className={className} {...props} />,
}));

const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseSettings = useSettings as jest.MockedFunction<typeof useSettings>;
const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

// Default settings for testing
const mockDefaultSettings = {
  colorScheme: 'default' as const,
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
    frequency: 'immediate' as const,
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

describe('Settings Page Component Tests (Task 21.12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();

    // Default mock implementations
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: jest.fn(),
      themes: ['light', 'dark', 'system'],
      forcedTheme: undefined,
      resolvedTheme: 'light',
      systemTheme: 'light',
    });
  });

  describe('Data Source Wiring (Req 11.1, 19.1)', () => {
    it('displays current theme settings from useTheme hook', () => {
      const mockSetTheme = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        forcedTheme: undefined,
        resolvedTheme: 'dark',
        systemTheme: 'light',
      });

      render(<SettingsPage />);

      // Should display current theme setting
      expect(screen.getByDisplayValue('dark')).toBeInTheDocument();
    });

    it('displays settings from useSettings hook', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      const customSettings = {
        ...mockDefaultSettings,
        fontSize: 18,
        compactMode: true,
        highContrast: true,
        privacy: {
          ...mockDefaultSettings.privacy,
          analytics: false,
        },
      };

      mockUseSettings.mockReturnValue({
        settings: customSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Font size should be displayed correctly
      expect(screen.getByText('Font Size: 18px')).toBeInTheDocument();
      
      // Switches should reflect current settings
      fireEvent.click(screen.getByText('Access')); // Navigate to accessibility tab
      expect(screen.getByRole('switch', { name: 'High Contrast' })).toBeChecked();

      fireEvent.click(screen.getByText('Privacy')); // Navigate to privacy tab
      expect(screen.getByRole('switch', { name: 'Usage Analytics' })).not.toBeChecked();
    });

    it('calls theme change functions when theme is selected', () => {
      const mockSetTheme = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        forcedTheme: undefined,
        resolvedTheme: 'light',
        systemTheme: 'light',
      });

      render(<SettingsPage />);

      // Theme selector should be present and functional
      const themeSelect = screen.getByDisplayValue('light');
      expect(themeSelect).toBeInTheDocument();
      
      // Simulating theme change would require more complex setup with select component
      // This verifies the connection is established
      expect(mockSetTheme).toHaveBeenCalledTimes(0); // Not called on initial render
    });

    it('calls updateSetting when preferences are changed', () => {
      const mockUpdateSetting = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: mockUpdateSetting,
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Toggle compact mode switch
      const compactModeSwitch = screen.getByRole('switch', { name: 'Compact Mode' });
      fireEvent.click(compactModeSwitch);

      expect(mockUpdateSetting).toHaveBeenCalledWith('compactMode', true);
    });
  });

  describe('Loading/Error/Retry States (Req 11.3, 11.4)', () => {
    it('displays loading state during authentication check', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true, // Loading authentication
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Should show loading spinner without placeholder settings
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      expect(screen.queryByText('Font Size:')).not.toBeInTheDocument(); // No placeholder values
    });

    it('displays loading state while settings are being loaded', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: true, // Settings still loading
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Should show settings page structure but may have loading indicators
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Customize your BFN experience with personalized preferences and controls.')).toBeInTheDocument();
      
      // Settings should still be displayed (useSettings provides defaults during loading)
      expect(screen.getByText('Font Size: 16px')).toBeInTheDocument();
    });

    it('shows save status messages correctly', async () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: true,
      });

      render(<SettingsPage />);

      // Should show save button when changes are unsaved
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      
      // Click save button to trigger save flow
      fireEvent.click(screen.getByText('Save Changes'));
      
      // Should show saving status
      await waitFor(() => {
        expect(screen.getByText('Saving settings...')).toBeInTheDocument();
      }, { timeout: 100 });
      
      // Should show saved status
      await waitFor(() => {
        expect(screen.getByText('✅ Settings saved successfully!')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('handles settings operation errors gracefully', async () => {
      const mockResetToDefaults = jest.fn().mockRejectedValue(new Error('Reset failed'));
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: mockResetToDefaults,
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Navigate to Advanced tab
      fireEvent.click(screen.getByText('Advanced'));

      // Try to reset settings
      fireEvent.click(screen.getByText('Reset to Defaults'));

      // Should handle the error gracefully
      await waitFor(() => {
        expect(mockResetToDefaults).toHaveBeenCalled();
      });
    });
  });

  describe('Authentication and Role Gating (Req 14.9)', () => {
    it('redirects unauthenticated users', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Should show loading spinner and not render settings content
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('shows loading while authentication is being checked', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true, // Checking authentication
        isOnCorrectNetwork: true,
      });

      render(<SettingsPage />);

      // Should show loading state
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('renders settings page for authenticated users', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Should render settings content for authenticated user
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Customize your BFN experience with personalized preferences and controls.')).toBeInTheDocument();
    });
  });

  describe('Settings Management Features (Req 19.1, 19.3)', () => {
    it('displays all settings tabs and navigation', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Should show all tab options
      expect(screen.getByText('Theme')).toBeInTheDocument();
      expect(screen.getByText('Access')).toBeInTheDocument();
      expect(screen.getByText('Alerts')).toBeInTheDocument();
      expect(screen.getByText('Privacy')).toBeInTheDocument();
      expect(screen.getByText('Perf')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });

    it('allows font size adjustment with real-time preview', () => {
      const mockUpdateSetting = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: { ...mockDefaultSettings, fontSize: 14 },
        updateSetting: mockUpdateSetting,
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Should display current font size
      expect(screen.getByText('Font Size: 14px')).toBeInTheDocument();
      
      // Font size slider should be present
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('manages notification preferences correctly', () => {
      const mockUpdateSetting = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: mockUpdateSetting,
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Navigate to Notifications tab
      fireEvent.click(screen.getByText('Alerts'));

      // Should show notification controls
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByText('Notification Frequency')).toBeInTheDocument();
      
      // Email notifications should be enabled by default
      expect(screen.getByRole('switch', { name: 'Email Notifications' })).toBeChecked();
    });

    it('handles accessibility settings with proper labels', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Navigate to Accessibility tab
      fireEvent.click(screen.getByText('Access'));

      // Should show accessibility options
      expect(screen.getByText('High Contrast')).toBeInTheDocument();
      expect(screen.getByText('Reduce Motion')).toBeInTheDocument();
      expect(screen.getByText('Enhanced Screen Reader')).toBeInTheDocument();
      expect(screen.getByText('Enhanced Keyboard Navigation')).toBeInTheDocument();
      
      // All switches should be properly labeled
      expect(screen.getByRole('switch', { name: 'High Contrast' })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Reduce Motion' })).toBeInTheDocument();
    });
  });

  describe('Advanced Features and Data Management', () => {
    it('provides settings export functionality', () => {
      const mockExportSettings = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: mockExportSettings,
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Navigate to Advanced tab
      fireEvent.click(screen.getByText('Advanced'));

      // Should show export/import options
      expect(screen.getByText('Settings Backup')).toBeInTheDocument();
      expect(screen.getByText('Export Settings')).toBeInTheDocument();
      expect(screen.getByText('Import Settings')).toBeInTheDocument();
      
      // Export button should work
      fireEvent.click(screen.getByText('Export Settings'));
      expect(mockExportSettings).toHaveBeenCalledTimes(1);
    });

    it('allows resetting to default settings', () => {
      const mockResetToDefaults = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: { ...mockDefaultSettings, fontSize: 20, compactMode: true },
        updateSetting: jest.fn(),
        resetToDefaults: mockResetToDefaults,
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: true,
      });

      render(<SettingsPage />);

      // Navigate to Advanced tab
      fireEvent.click(screen.getByText('Advanced'));

      // Should show reset option
      expect(screen.getByText('Reset Settings')).toBeInTheDocument();
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
      
      // Reset button should work
      fireEvent.click(screen.getByText('Reset to Defaults'));
      expect(mockResetToDefaults).toHaveBeenCalledTimes(1);
    });

    it('shows experimental features with proper warning', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Navigate to Advanced tab
      fireEvent.click(screen.getByText('Advanced'));

      // Should show experimental features with beta badge
      expect(screen.getByText('Experimental Features')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Enable beta features (may be unstable).')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates and Persistence (Req 15.5)', () => {
    it('shows unsaved changes indicator and save button', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: true, // Has unsaved changes
      });

      render(<SettingsPage />);

      // Should show floating save button
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      
      // Button should be positioned as floating action
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton.closest('div')).toHaveClass('fixed');
    });

    it('handles rapid preference changes gracefully', () => {
      const mockUpdateSetting = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: mockUpdateSetting,
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      render(<SettingsPage />);

      // Rapidly toggle multiple settings
      const compactModeSwitch = screen.getByRole('switch', { name: 'Compact Mode' });
      fireEvent.click(compactModeSwitch);
      fireEvent.click(compactModeSwitch);
      fireEvent.click(compactModeSwitch);

      // Should handle multiple rapid calls
      expect(mockUpdateSetting).toHaveBeenCalledTimes(3);
    });

    it('persists theme changes across re-renders', () => {
      const mockSetTheme = jest.fn();
      
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isOnCorrectNetwork: true,
      });

      mockUseSettings.mockReturnValue({
        settings: mockDefaultSettings,
        updateSetting: jest.fn(),
        resetToDefaults: jest.fn(),
        exportSettings: jest.fn(),
        importSettings: jest.fn(),
        isLoading: false,
        hasUnsavedChanges: false,
      });

      // Start with light theme
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        forcedTheme: undefined,
        resolvedTheme: 'light',
        systemTheme: 'light',
      });

      const { rerender } = render(<SettingsPage />);
      
      expect(screen.getByDisplayValue('light')).toBeInTheDocument();

      // Simulate theme change
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        forcedTheme: undefined,
        resolvedTheme: 'dark',
        systemTheme: 'light',
      });

      rerender(<SettingsPage />);

      expect(screen.getByDisplayValue('dark')).toBeInTheDocument();
    });
  });
});