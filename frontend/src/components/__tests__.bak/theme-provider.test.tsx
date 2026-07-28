/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

import { ThemeProvider } from '../theme-provider';

// Mock next-themes with actual functionality for testing
jest.unmock('next-themes');

// Create a test component that uses theme
function TestThemeConsumer() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="current-theme">{resolvedTheme}</div>
      <div data-testid="theme-value">{theme}</div>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        Set Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
    </div>
  );
}

// Helper to render with theme provider
function renderWithTheme(ui: React.ReactElement, themeProps = {}) {
  const defaultProps = {
    attribute: 'class',
    defaultTheme: 'light',
    enableSystem: false,
    storageKey: 'bfn-theme-test',
    disableTransitionOnChange: false,
  };

  return render(
    <ThemeProvider {...defaultProps} {...themeProps}>
      {ui}
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset document class
    document.documentElement.className = '';
  });

  describe('**Validates: Requirements 19.1, 19.2, 19.3, 19.4**', () => {
    it('should default to light theme on first visit (Req 19.1)', async () => {
      renderWithTheme(<TestThemeConsumer />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });

    it('should apply theme switching within 1 second without reload (Req 19.2)', async () => {
      const user = userEvent.setup();
      renderWithTheme(<TestThemeConsumer />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      const startTime = Date.now();

      await user.click(screen.getByTestId('set-dark'));

      await waitFor(
        () => {
          expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
        },
        { timeout: 1000 },
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify it happens within 1 second (1000ms)
      expect(duration).toBeLessThan(1000);
    });

    it('should persist theme selection across sessions (Req 19.3)', async () => {
      const user = userEvent.setup();

      // First render - set dark theme
      const { unmount } = renderWithTheme(<TestThemeConsumer />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      });

      unmount();

      // Second render - should remember dark theme
      renderWithTheme(<TestThemeConsumer />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    });

    it('should use correct storage key for persistence (Req 19.4)', async () => {
      const user = userEvent.setup();
      const storageKey = 'custom-theme-key';

      renderWithTheme(<TestThemeConsumer />, { storageKey });

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(localStorage.getItem(storageKey)).toBe('dark');
      });
    });

    it('should apply theme class to document element for CSS targeting (Req 19.2)', async () => {
      const user = userEvent.setup();
      renderWithTheme(<TestThemeConsumer />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      // Initially should have light theme class (or no class for light)
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      await user.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      await user.click(screen.getByTestId('set-light'));

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should handle rapid theme switching without race conditions', async () => {
      const user = userEvent.setup();
      renderWithTheme(<TestThemeConsumer />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      // Rapidly switch themes
      await user.click(screen.getByTestId('set-dark'));
      await user.click(screen.getByTestId('set-light'));
      await user.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should not cause hydration mismatch with suppressHydrationWarning', async () => {
      // Test that the component renders without hydration warnings
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      renderWithTheme(<TestThemeConsumer />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      // Should not have hydration warnings
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('hydration'));

      consoleSpy.mockRestore();
    });
  });
});
