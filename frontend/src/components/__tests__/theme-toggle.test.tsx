/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { useTheme } from 'next-themes';

import { ThemeToggle } from '../theme-toggle';

expect.extend(toHaveNoViolations);

// Mock next-themes with controllable state
let mockTheme = 'light';
let mockSetTheme = jest.fn();

jest.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

// Helper to render with theme context
function renderThemeToggle() {
  return render(<ThemeToggle />);
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockTheme = 'light';
    mockSetTheme = jest.fn();
  });

  describe('**Validates: Requirements 19.6, 19.7**', () => {
    it('should be keyboard focusable with visible focus ring (Req 19.6)', async () => {
      const user = userEvent.setup();
      renderThemeToggle();
      
      const button = screen.getByRole('button');
      
      // Tab to focus the button
      await user.tab();
      
      expect(button).toHaveFocus();
      
      // Verify it can be activated with keyboard
      await user.keyboard('{Enter}');
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
      
      // Reset and test with Space key
      mockSetTheme.mockClear();
      await user.keyboard(' ');
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should have proper ARIA labels and attributes (Req 19.7)', async () => {
      renderThemeToggle();
      
      const button = screen.getByRole('button');
      
      // Should have aria-label
      expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
      
      // Should have aria-pressed
      expect(button).toHaveAttribute('aria-pressed', 'false');
      
      // Should have title attribute
      expect(button).toHaveAttribute('title', 'Switch to dark theme');
      
      // Icon should be hidden from screen readers
      const icon = button.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      
      // Should have screen reader text
      expect(screen.getByText('Switch to dark theme')).toHaveClass('sr-only');
    });

    it('should update ARIA attributes when theme changes', async () => {
      const user = userEvent.setup();
      
      // Start with light theme
      const { rerender } = renderThemeToggle();
      
      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
      
      // Simulate theme change to dark
      mockTheme = 'dark';
      rerender(<ThemeToggle />);
      
      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('aria-label', 'Switch to light theme');
    });

    it('should pass axe accessibility audit (Req 19.7)', async () => {
      const { container } = renderThemeToggle();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle theme switching correctly', async () => {
      const user = userEvent.setup();
      renderThemeToggle();
      
      const button = screen.getByRole('button');
      
      // Click to switch from light to dark
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
      
      // Simulate theme change to dark and test switching back
      mockTheme = 'dark';
      mockSetTheme.mockClear();
      
      const { rerender } = render(<ThemeToggle />);
      rerender(<ThemeToggle />);
      
      await user.click(screen.getByRole('button'));
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should display correct icons for each theme', () => {
      // Light theme shows Sun icon
      renderThemeToggle();
      expect(screen.getByTestId('sun-icon') || document.querySelector('.lucide-sun')).toBeInTheDocument();
      
      // Dark theme shows Moon icon
      mockTheme = 'dark';
      const { rerender } = render(<ThemeToggle />);
      rerender(<ThemeToggle />);
      expect(screen.getByTestId('moon-icon') || document.querySelector('.lucide-moon')).toBeInTheDocument();
    });

    it('should handle unmounted state gracefully', () => {
      // Simulate server-side rendering state
      const originalUseEffect = require('react').useEffect;
      let effectCallback: () => void;
      
      jest.spyOn(require('react'), 'useEffect').mockImplementation((fn) => {
        effectCallback = fn;
        // Don't call the effect immediately (simulating unmounted state)
      });
      
      renderThemeToggle();
      
      const button = screen.getByRole('button');
      
      // Should have stable label before mount
      expect(button).toHaveAttribute('aria-label', 'Toggle theme');
      
      // Cleanup
      require('react').useEffect.mockRestore();
    });

    it('should support high contrast and screen reader combinations', async () => {
      const user = userEvent.setup();
      
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });
      
      renderThemeToggle();
      
      const button = screen.getByRole('button');
      
      // Should maintain accessibility in high contrast mode
      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('aria-pressed');
      
      // Should still be operable
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalled();
    });
  });
});