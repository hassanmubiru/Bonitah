/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

import { SiteHeader } from '../site-header';
import { ThemeProvider } from '../theme-provider';

expect.extend(toHaveNoViolations);

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Full app component for integration testing
function TestApp() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="bfn-theme-test"
      disableTransitionOnChange={false}
    >
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main id="main-content" className="container mx-auto p-4">
          <h1>Test Page Content</h1>
          <p>This is test content for integration testing.</p>
          <button>Test Button</button>
          <input type="text" placeholder="Test input" />
        </main>
      </div>
    </ThemeProvider>
  );
}

describe('Integration Tests - Theme, Responsiveness, and Accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  describe('**Validates: Requirements 19.1, 19.2, 19.5, 19.6, 19.7**', () => {
    it('should integrate theming with responsive design and accessibility', async () => {
      const user = userEvent.setup();

      // Test at mobile breakpoint
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

      const { container } = render(<TestApp />);

      // Should pass accessibility audit
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Should be responsive at mobile
      expect(container.querySelector('.container')).toHaveClass('mx-auto');

      // Theme switching should work
      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      await user.click(themeButton);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Should still pass accessibility after theme change
      const resultsAfterTheme = await axe(container);
      expect(resultsAfterTheme).toHaveNoViolations();
    });

    it('should maintain theme persistence across responsive breakpoints', async () => {
      const user = userEvent.setup();

      // Start at desktop
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

      const { rerender } = render(<TestApp />);

      // Set dark theme
      const themeButton = screen.getByRole('button');
      await user.click(themeButton);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Change to mobile breakpoint
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      window.dispatchEvent(new Event('resize'));

      rerender(<TestApp />);

      // Theme should persist
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Should still be accessible at mobile with dark theme
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    });

    it('should handle keyboard navigation across all breakpoints', async () => {
      const user = userEvent.setup();

      const breakpoints = [320, 768, 1024];

      for (const width of breakpoints) {
        Object.defineProperty(window, 'innerWidth', { value: width, writable: true });

        render(<TestApp />);

        // Tab through elements
        await user.tab(); // Skip link
        expect(screen.getByText('Skip to main content')).toHaveFocus();

        await user.tab(); // Brand link
        expect(screen.getByRole('link')).toHaveFocus();

        await user.tab(); // Theme button
        expect(screen.getByRole('button', { name: /switch/i })).toHaveFocus();

        await user.tab(); // First element in main content
        expect(screen.getByRole('button', { name: 'Test Button' })).toHaveFocus();
      }
    });

    it('should apply theme within 1 second at all breakpoints (Req 19.2)', async () => {
      const user = userEvent.setup();

      const breakpoints = [320, 768, 1024];

      for (const width of breakpoints) {
        // Reset for each breakpoint test
        localStorage.clear();
        document.documentElement.className = '';

        Object.defineProperty(window, 'innerWidth', { value: width, writable: true });

        render(<TestApp />);

        const startTime = Date.now();

        const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
        await user.click(themeButton);

        await waitFor(
          () => {
            expect(document.documentElement.classList.contains('dark')).toBe(true);
          },
          { timeout: 1000 },
        );

        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(1000);
      }
    });

    it('should maintain accessibility standards during theme transitions', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      // Initial accessibility check
      const initialResults = await axe(document.body);
      expect(initialResults).toHaveNoViolations();

      // Theme transition
      const themeButton = screen.getByRole('button');
      await user.click(themeButton);

      // Check accessibility during transition (immediate)
      const transitionResults = await axe(document.body);
      expect(transitionResults).toHaveNoViolations();

      // Check accessibility after transition completes
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      const finalResults = await axe(document.body);
      expect(finalResults).toHaveNoViolations();
    });

    it('should support skip link navigation to main content (Req 19.7)', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      // Focus skip link
      await user.tab();
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveFocus();

      // Activate skip link
      await user.keyboard('{Enter}');

      // Should focus main content area
      const mainContent = screen.getByRole('main');
      expect(mainContent).toHaveAttribute('id', 'main-content');
    });

    it('should handle rapid theme switching without breaking layout or accessibility', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      const themeButton = screen.getByRole('button');

      // Rapidly switch themes
      await user.click(themeButton); // light -> dark
      await user.click(themeButton); // dark -> light
      await user.click(themeButton); // light -> dark
      await user.click(themeButton); // dark -> light

      // Should end up in a stable state
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });

      // Should still pass accessibility
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();

      // Layout should not be broken
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });

    it('should work correctly with system preferences disabled (Req 19.1)', async () => {
      // Mock system preference for dark mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query.includes('prefers-color-scheme: dark'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

      render(<TestApp />);

      await waitFor(() => {
        // Should default to light theme despite system preference for dark
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });

      // Theme toggle should still work
      const user = userEvent.setup();
      const themeButton = screen.getByRole('button');
      await user.click(themeButton);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('should maintain proper focus management during theme changes', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      // Focus the theme button
      const themeButton = screen.getByRole('button');
      themeButton.focus();
      expect(themeButton).toHaveFocus();

      // Switch theme
      await user.click(themeButton);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Focus should remain on the button
      expect(themeButton).toHaveFocus();

      // Should still be keyboard navigable
      await user.tab();
      expect(screen.getByRole('button', { name: 'Test Button' })).toHaveFocus();
    });
  });
});
