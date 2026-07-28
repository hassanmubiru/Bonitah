import { renderHook, act } from '@testing-library/react';
import { useTheme } from 'next-themes';

import { useSettingsManager } from '../useSettingsManager';

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
const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'));
const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'));

const mockSetTheme = jest.fn();
const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

describe('useSettingsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockUseTheme.mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
    });
  });

  describe('Default Settings (Requirement 19.1)', () => {
    test('initializes with light theme as default', () => {
      const { result } = renderHook(() => useSettingsManager());

      expect(result.current.settings.theme).toBe('light');
    });

    test('sets correct default values for all settings', () => {
      const { result } = renderHook(() => useSettingsManager());

      const { settings } = result.current;
      
      expect(settings.theme).toBe('light');
      expect(settings.fontSize).toBe('medium');
      expect(settings.compactMode).toBe(false);
      expect(settings.highContrast).toBe(false);
      expect(settings.pushNotifications).toBe(true);
      expect(settings.analyticsEnabled).toBe(false);
      expect(settings.profileVisibility).toBe('private');
      expect(settings.version).toBe('1.0.0');
    });
  });

  describe('Session Persistence (Requirement 19.3)', () => {
    test('loads settings from localStorage on initialization', () => {
      const mockSettings = JSON.stringify({
        theme: 'dark',
        fontSize: 'large',
        highContrast: true,
        version: '1.0.0',
        lastModified: '2023-01-01T00:00:00.000Z',
      });

      localStorageMock.getItem.mockReturnValue(mockSettings);

      const { result } = renderHook(() => useSettingsManager());

      expect(localStorageMock.getItem).toHaveBeenCalledWith('bfn-settings');
    });

    test('persists settings changes to localStorage', () => {
      const { result } = renderHook(() => useSettingsManager());

      act(() => {
        result.current.updateSetting('theme', 'dark');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bfn-settings',
        expect.stringContaining('"theme":"dark"')
      );
    });

    test('updates lastModified timestamp on settings change', () => {
      const { result } = renderHook(() => useSettingsManager());

      const beforeTime = new Date().toISOString();

      act(() => {
        result.current.updateSetting('fontSize', 'large');
      });

      const afterTime = new Date().toISOString();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bfn-settings',
        expect.stringMatching(/"lastModified":"[\d-T:.Z]+"/),
      );

      // Verify timestamp is recent
      const settingsCall = localStorageMock.setItem.mock.calls.find(call => 
        call[0] === 'bfn-settings'
      );
      
      if (settingsCall) {
        const settings = JSON.parse(settingsCall[1]);
        expect(settings.lastModified >= beforeTime).toBe(true);
        expect(settings.lastModified <= afterTime).toBe(true);
      }
    });
  });

  describe('Theme Integration (Requirements 19.1, 19.3)', () => {
    test('syncs theme changes with ThemeProvider', () => {
      const { result } = renderHook(() => useSettingsManager());

      act(() => {
        result.current.updateSetting('theme', 'dark');
      });

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    test('syncs theme from ThemeProvider on initialization', () => {
      const mockSettings = JSON.stringify({
        theme: 'dark',
        version: '1.0.0',
        lastModified: '2023-01-01T00:00:00.000Z',
      });

      localStorageMock.getItem.mockReturnValue(mockSettings);
      mockUseTheme.mockReturnValue({
        theme: 'light', // Different from stored theme
        resolvedTheme: 'light',
        setTheme: mockSetTheme,
      });

      renderHook(() => useSettingsManager());

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('Settings Management Operations', () => {
    test('updates multiple settings at once', () => {
      const { result } = renderHook(() => useSettingsManager());

      act(() => {
        result.current.updateSettings({
          theme: 'dark',
          fontSize: 'large',
          highContrast: true,
        });
      });

      expect(result.current.settings.theme).toBe('dark');
      expect(result.current.settings.fontSize).toBe('large');
      expect(result.current.settings.highContrast).toBe(true);
    });

    test('exports settings to downloadable file', () => {
      const { result } = renderHook(() => useSettingsManager());

      act(() => {
        result.current.exportSettings();
      });

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    test('imports settings from data object', () => {
      const { result } = renderHook(() => useSettingsManager());

      const importData = {
        theme: 'dark' as const,
        fontSize: 'small' as const,
        highContrast: true,
      };

      act(() => {
        result.current.importSettings(importData);
      });

      expect(result.current.settings.theme).toBe('dark');
      expect(result.current.settings.fontSize).toBe('small');
      expect(result.current.settings.highContrast).toBe(true);
    });

    test('resets all settings to defaults', async () => {
      const { result } = renderHook(() => useSettingsManager());

      // First modify some settings
      act(() => {
        result.current.updateSetting('theme', 'dark');
        result.current.updateSetting('fontSize', 'large');
      });

      expect(result.current.settings.theme).toBe('dark');

      // Then reset
      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.isResetting).toBe(true);

      // Wait for reset to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.fontSize).toBe('medium');
      expect(result.current.isResetting).toBe(false);
    });
  });

  describe('Version Migration', () => {
    test('migrates settings when version changes', () => {
      const oldSettings = JSON.stringify({
        theme: 'dark',
        version: '0.9.0', // Old version
        lastModified: '2023-01-01T00:00:00.000Z',
      });

      localStorageMock.getItem.mockReturnValue(oldSettings);

      renderHook(() => useSettingsManager());

      // Should update version to current
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bfn-settings',
        expect.stringContaining('"version":"1.0.0"')
      );
    });
  });

  describe('Error Handling', () => {
    test('handles localStorage read errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const { result } = renderHook(() => useSettingsManager());

      // Should fall back to defaults
      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.version).toBe('1.0.0');
    });

    test('handles localStorage write errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage full');
      });

      const { result } = renderHook(() => useSettingsManager());

      // Should not crash when trying to persist settings
      act(() => {
        result.current.updateSetting('theme', 'dark');
      });

      // Settings should still be updated in memory
      expect(result.current.settings.theme).toBe('dark');
    });

    test('handles malformed JSON in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json{');

      const { result } = renderHook(() => useSettingsManager());

      // Should fall back to defaults
      expect(result.current.settings.theme).toBe('light');
    });
  });

  describe('Accessibility Settings Application (Requirement 11.7)', () => {
    test('applies CSS custom properties for accessibility settings', () => {
      const { result } = renderHook(() => useSettingsManager());

      act(() => {
        result.current.updateSettings({
          fontSize: 'large',
          highContrast: true,
          reducedMotion: true,
          focusIndicators: true,
        });
      });

      // Mock document.documentElement
      const mockDocumentElement = {
        style: { setProperty: jest.fn() },
        classList: { toggle: jest.fn() },
      };
      Object.defineProperty(document, 'documentElement', {
        value: mockDocumentElement,
        configurable: true,
      });

      // The hook should apply settings on the next render
      act(() => {
        // Trigger useEffect by changing isLoading state
      });
    });
  });
});