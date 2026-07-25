import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTheme } from 'next-themes';

import { SettingsPage } from '../SettingsPage';

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock URL.createObjectURL for settings export
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: jest.fn().mockReturnValue('blob:mock-url'),
});
Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn(),
});

// Mock document.body methods for file download
const mockAppendChild = jest.spyOn(document.body, 'appendChild');
const mockRemoveChild = jest.spyOn(document.body, 'removeChild');

// Suppress console errors during testing
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock theme provider functions
const mockSetTheme = jest.fn();
const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockUseTheme.mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
    });
    mockAppendChild.mockImplementation(() => document.createElement('a'));
    mockRemoveChild.mockImplementation(() => document.createElement('a'));
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Theme Configuration (Requirements 19.1, 19.3)', () => {
    test('displays theme selection with light as default', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Theme Preference')).toBeInTheDocument();
      });

      const lightButton = screen.getByRole('button', { name: /light/i });
      const darkButton = screen.getByRole('button', { name: /dark/i });
      const systemButton = screen.getByRole('button', { name: /system/i });

      expect(lightButton).toBeInTheDocument();
      expect(darkButton).toBeInTheDocument();
      expect(systemButton).toBeInTheDocument();
    });

    test('switches theme immediately when selection changes', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Theme Preference')).toBeInTheDocument();
      });

      const darkButton = screen.getByRole('button', { name: /dark/i });
      await user.click(darkButton);

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    test('persists theme selection to localStorage', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Theme Preference')).toBeInTheDocument();
      });

      const darkButton = screen.getByRole('button', { name: /dark/i });
      await user.click(darkButton);

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'bfn-settings',
          expect.stringContaining('"theme":"dark"')
        );
      });
    });

    test('shows theme persistence information', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Theme Persistence')).toBeInTheDocument();
        expect(
          screen.getByText(/Theme changes apply instantly without requiring a page reload/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Features (Requirement 11.7)', () => {
    test('displays accessibility options', async () => {
      render(<SettingsPage />);

      // Click on accessibility tab
      const accessibilityTab = screen.getByRole('tab', { name: /accessibility/i });
      await userEvent.setup().click(accessibilityTab);

      await waitFor(() => {
        expect(screen.getByText('Visual Accessibility')).toBeInTheDocument();
        expect(screen.getByText('High Contrast Mode')).toBeInTheDocument();
        expect(screen.getByText('Enhanced Focus Indicators')).toBeInTheDocument();
        expect(screen.getByText('Reduced Motion')).toBeInTheDocument();
        expect(screen.getByText('Screen Reader Optimized')).toBeInTheDocument();
      });
    });

    test('toggles accessibility features and persists to storage', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const accessibilityTab = screen.getByRole('tab', { name: /accessibility/i });
      await user.click(accessibilityTab);

      await waitFor(() => {
        expect(screen.getByText('High Contrast Mode')).toBeInTheDocument();
      });

      const highContrastSwitch = screen.getByRole('switch', { name: /high-contrast/i });
      await user.click(highContrastSwitch);

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'bfn-settings',
          expect.stringContaining('"highContrast":true')
        );
      });
    });

    test('displays keyboard navigation information', async () => {
      render(<SettingsPage />);

      const accessibilityTab = screen.getByRole('tab', { name: /accessibility/i });
      await userEvent.setup().click(accessibilityTab);

      await waitFor(() => {
        expect(screen.getByText('Keyboard Navigation')).toBeInTheDocument();
        expect(screen.getByText('Tab')).toBeInTheDocument();
        expect(screen.getByText('Next element')).toBeInTheDocument();
        expect(screen.getByText('Alt + S')).toBeInTheDocument();
        expect(screen.getByText('Open settings')).toBeInTheDocument();
      });
    });
  });

  describe('Settings Management', () => {
    test('exports settings to file', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Export Settings')).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export settings/i });
      await user.click(exportButton);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    test('resets all settings to defaults', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Reset All')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset all/i });
      await user.click(resetButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Resetting...')).toBeInTheDocument();
      });

      // Should persist default settings
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'bfn-settings',
          expect.stringContaining('"theme":"light"')
        );
      });
    });
  });

  describe('Notification Settings', () => {
    test('displays notification categories', async () => {
      render(<SettingsPage />);

      const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
      await userEvent.setup().click(notificationsTab);

      await waitFor(() => {
        expect(screen.getByText('General Notifications')).toBeInTheDocument();
        expect(screen.getByText('Push Notifications')).toBeInTheDocument();
        expect(screen.getByText('Email Notifications')).toBeInTheDocument();
        expect(screen.getByText('Transaction Alerts')).toBeInTheDocument();
        expect(screen.getByText('Goal Reminders')).toBeInTheDocument();
        expect(screen.getByText('Community Updates')).toBeInTheDocument();
        expect(screen.getByText('Education Progress')).toBeInTheDocument();
      });
    });

    test('toggles notification preferences', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
      await user.click(notificationsTab);

      await waitFor(() => {
        expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      });

      const pushNotificationSwitch = screen.getByRole('switch', { name: /push-notifications/i });
      await user.click(pushNotificationSwitch);

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'bfn-settings',
          expect.stringContaining('"pushNotifications":false')
        );
      });
    });
  });

  describe('Privacy Settings', () => {
    test('displays privacy controls', async () => {
      render(<SettingsPage />);

      const privacyTab = screen.getByRole('tab', { name: /privacy/i });
      await userEvent.setup().click(privacyTab);

      await waitFor(() => {
        expect(screen.getByText('Data & Analytics')).toBeInTheDocument();
        expect(screen.getByText('Analytics Collection')).toBeInTheDocument();
        expect(screen.getByText('Data Sharing')).toBeInTheDocument();
        expect(screen.getByText('Profile Visibility')).toBeInTheDocument();
      });
    });

    test('shows privacy security notice', async () => {
      render(<SettingsPage />);

      const privacyTab = screen.getByRole('tab', { name: /privacy/i });
      await userEvent.setup().click(privacyTab);

      await waitFor(() => {
        expect(screen.getByText('Privacy & Security Notice')).toBeInTheDocument();
        expect(
          screen.getByText(/Your financial data is always private and secure/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Session Persistence (Requirement 19.3)', () => {
    test('loads saved settings from localStorage on initialization', async () => {
      const mockSettings = JSON.stringify({
        theme: 'dark',
        fontSize: 'large',
        highContrast: true,
        pushNotifications: false,
        version: '1.0.0',
        lastModified: '2023-01-01T00:00:00.000Z',
      });

      localStorageMock.getItem.mockReturnValue(mockSettings);
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        resolvedTheme: 'dark',
        setTheme: mockSetTheme,
      });

      render(<SettingsPage />);

      expect(localStorageMock.getItem).toHaveBeenCalledWith('bfn-settings');
    });

    test('handles localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      render(<SettingsPage />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('has responsive tab layout', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const tabsList = screen.getByRole('tablist');
        expect(tabsList).toHaveClass('grid', 'w-full', 'grid-cols-6');
      });
    });

    test('contains settings title and description', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
        expect(
          screen.getByText('Manage your preferences, theme, notifications, and privacy settings')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Appearance Settings', () => {
    test('displays font size controls', async () => {
      render(<SettingsPage />);

      // Appearance tab should be active by default
      await waitFor(() => {
        expect(screen.getByText('Typography')).toBeInTheDocument();
        expect(screen.getByText('Font Size')).toBeInTheDocument();
      });

      const fontSizeSelect = screen.getByRole('combobox');
      expect(fontSizeSelect).toBeInTheDocument();
    });

    test('shows layout preferences', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Layout Preferences')).toBeInTheDocument();
        expect(screen.getByText('Compact Mode')).toBeInTheDocument();
        expect(screen.getByText('Collapsed Sidebar')).toBeInTheDocument();
        expect(screen.getByText('Enable Animations')).toBeInTheDocument();
      });
    });
  });
});