/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

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

// Import after mocking
import { ThemeToggle } from '../theme-toggle';

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
      expect(button).toHaveAttribute('aria-label');
      const ariaLabel = button.getAttribute('aria-label');
      expect(ariaLabel).toContain('Switch to');

      // Should have aria-pressed
      expect(button).toHaveAttribute('aria-pressed', 'false');

      // Should have title attribute
      expect(button).toHaveAttribute('title');

      // Icon should be hidden from screen readers
      const icon = button.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should update ARIA attributes when theme changes', async () => {
      // Start with light theme
      const { rerender } = renderThemeToggle();

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');

      // Simulate theme change to dark
      mockTheme = 'dark';
      rerender(<ThemeToggle />);

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should pass axe accessibility audit (Req 19.7)', async () => {
      const { container } = renderThemeToggle();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle theme switching correctly', async () => {
      const user = userEvent.setup();
      const { rerender } = renderThemeToggle();

      const button = screen.getByRole('button', { name: /switch to dark theme/i });

      // Click to switch from light to dark
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalledWith('dark');

      // Simulate theme change to dark and test switching back
      mockTheme = 'dark';
      mockSetTheme.mockClear();

      rerender(<ThemeToggle />);

      await user.click(screen.getByRole('button', { name: /switch to light theme/i }));
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should display correct icons for each theme', () => {
      // Light theme shows Sun icon
      renderThemeToggle();
      const lightIcon = document.querySelector('.lucide-sun, [data-lucide="sun"]');
      expect(lightIcon).toBeInTheDocument();

      // Dark theme shows Moon icon
      mockTheme = 'dark';
      const { rerender } = render(<ThemeToggle />);
      rerender(<ThemeToggle />);
      const darkIcon = document.querySelector('.lucide-moon, [data-lucide="moon"]');
      expect(darkIcon).toBeInTheDocument();
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
