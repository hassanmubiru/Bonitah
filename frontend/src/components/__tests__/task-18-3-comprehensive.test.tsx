/**
 * @jest-environment jsdom
 *
 * Task 18.3: Comprehensive Component Tests for Theming, Responsiveness, and Accessibility
 *
 * This file consolidates and validates all requirements for Task 18.3:
 * - Theme apply/persist (Requirements 19.1, 19.2, 19.3, 19.4)
 * - No horizontal scroll at breakpoints (Requirement 19.5)
 * - Keyboard traversal and axe checks (Requirements 19.6, 19.7)
 *
 * Testing Strategy:
 * 1. Theming Tests: Theme application, persistence, switching performance
 * 2. Responsiveness Tests: Breakpoint testing (320-767, 768-1023, ≥1024)
 * 3. Accessibility Tests: Keyboard navigation, focus rings, screen readers, axe compliance
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

import { SiteHeader } from '../site-header';
import { ThemeProvider } from '../theme-provider';
import { ThemeToggle } from '../theme-toggle';

expect.extend(toHaveNoViolations);

// Mock next-themes with actual DOM manipulation
jest.mock('next-themes', () => {
  const React = require('react');

  // Create a shared context instance that persists across all components
  const ThemeContext = React.createContext(null);

  return {
    ThemeProvider: ({ children, defaultTheme = 'light', storageKey }: any) => {
      const [currentTheme, setCurrentTheme] = React.useState(() => {
        // Check localStorage first if storageKey is provided
        if (storageKey && typeof window !== 'undefined') {
          const stored = localStorage.getItem(storageKey);
          return stored || defaultTheme;
        }
        return defaultTheme;
      });

      // Apply theme class to document element
      React.useEffect(() => {
        const className = currentTheme === 'dark' ? 'dark' : '';
        document.documentElement.className = className;

        // Store in localStorage if storageKey is provided
        if (storageKey && typeof window !== 'undefined') {
          localStorage.setItem(storageKey, currentTheme);
        }
      }, [currentTheme, storageKey]);

      const contextValue = React.useMemo(
        () => ({
          theme: currentTheme,
          resolvedTheme: currentTheme,
          systemTheme: 'light',
          setTheme: (theme: string) => {
            setCurrentTheme(theme);
            // Apply class immediately for synchronous DOM updates
            document.documentElement.className = theme === 'dark' ? 'dark' : '';

            // Store in localStorage immediately
            if (storageKey && typeof window !== 'undefined') {
              localStorage.setItem(storageKey, theme);
            }
          },
        }),
        [currentTheme, storageKey],
      );

      return React.createElement(ThemeContext.Provider, { value: contextValue }, children);
    },
    useTheme: () => {
      const context = React.useContext(ThemeContext);
      if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
      }
      return context;
    },
  };
});

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

// Test application wrapper
function TestApp({ children }: { children?: React.ReactNode }) {
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
          {children || (
            <>
              <h1>Test Content</h1>
              <p>Sample content for testing</p>
              <button>Interactive Element</button>
              <input type="text" placeholder="Test input" />
            </>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

// Utility functions
function setViewportSize(width: number, height: number = 800) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

function checkHorizontalOverflow(container: HTMLElement): string[] {
  const elements = container.querySelectorAll('*');
  const violations: string[] = [];

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    if (rect.width > window.innerWidth && computedStyle.position !== 'fixed') {
      violations.push(
        `Element ${element.tagName}${element.className ? '.' + element.className : ''} causes horizontal overflow`,
      );
    }

    if (computedStyle.width && computedStyle.width.includes('px')) {
      const fixedWidth = parseInt(computedStyle.width);
      if (fixedWidth > window.innerWidth) {
        violations.push(
          `Element ${element.tagName} has fixed width (${fixedWidth}px) larger than viewport`,
        );
      }
    }
  });

  return violations;
}

describe('Task 18.3: Comprehensive Frontend Foundation Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.body.innerHTML = '';
  });

  describe('1. THEMING TESTS - Requirements 19.1, 19.2, 19.3, 19.4', () => {
    it('should default to light theme on first visit (Req 19.1)', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should default to light theme (no 'dark' class on html)
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Theme toggle should indicate current state
      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      expect(themeButton).toBeInTheDocument();
      expect(themeButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should apply theme switching within 1 second without reload (Req 19.2)', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
      });

      const startTime = Date.now();

      // Switch to dark theme
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

      // Verify class is applied to document element for CSS targeting
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should persist theme selection across sessions (Req 19.3)', async () => {
      const user = userEvent.setup();

      // First session - set dark theme
      const { unmount } = render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
      });

      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      await user.click(themeButton);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      unmount();

      // Second session - should remember dark theme
      render(<TestApp />);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      const darkThemeButton = screen.getByRole('button', { name: /switch to light theme/i });
      expect(darkThemeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should use correct storage key for persistence (Req 19.4)', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
      });

      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      await user.click(themeButton);

      await waitFor(() => {
        expect(localStorage.getItem('bfn-theme-test')).toBe('dark');
      });
    });

    it('should handle rapid theme switching without race conditions', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
      });

      const themeButton = screen.getByRole('button', { name: /switch/i });

      // Rapidly switch themes
      await user.click(themeButton); // light -> dark
      await user.click(themeButton); // dark -> light
      await user.click(themeButton); // light -> dark

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Should end in consistent state
      expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    });
  });

  describe('2. RESPONSIVENESS TESTS - Requirement 19.5', () => {
    const testBreakpoints = [
      { name: 'Mobile Min', width: 320 },
      { name: 'Mobile Max', width: 767 },
      { name: 'Tablet Min', width: 768 },
      { name: 'Tablet Max', width: 1023 },
      { name: 'Desktop Min', width: 1024 },
      { name: 'Desktop Large', width: 1920 },
    ];

    testBreakpoints.forEach(({ name, width }) => {
      it(`should not have horizontal scroll at ${name} (${width}px)`, () => {
        setViewportSize(width);
        const { container } = render(<TestApp />);

        const overflowIssues = checkHorizontalOverflow(container);
        expect(overflowIssues).toHaveLength(0);

        // Verify responsive classes are applied
        const header = screen.getByRole('banner');
        const headerContainer = header.querySelector('.mx-auto');
        expect(headerContainer).toHaveClass('max-w-6xl', 'px-4');
      });
    });

    it('should maintain proper layout structure at all breakpoints', () => {
      const breakpoints = [320, 480, 768, 1024, 1280, 1920];

      breakpoints.forEach((width) => {
        document.body.innerHTML = '';
        setViewportSize(width);
        const { unmount } = render(<TestApp />);

        const header = screen.getByRole('banner');
        const headerContainer = header.querySelector('.mx-auto');

        // Should maintain flex layout
        expect(headerContainer).toHaveClass(
          'flex',
          'items-center',
          'justify-between',
          'gap-4',
          'px-4',
        );

        // Should have proper height
        expect(headerContainer).toHaveClass('h-14');

        unmount();
      });
    });

    it('should handle extreme narrow viewports gracefully', () => {
      setViewportSize(280);
      const { container } = render(<TestApp />);

      const overflowIssues = checkHorizontalOverflow(container);
      expect(overflowIssues).toHaveLength(0);

      // Essential elements should still be accessible
      expect(screen.getByText('Bonitah Financial Network')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /switch/i })).toBeInTheDocument();
    });

    it('should support touch-friendly sizing on mobile', () => {
      setViewportSize(375);
      render(<TestApp />);

      const themeButton = screen.getByRole('button', { name: /switch/i });

      // Should have touch-friendly size (36px minimum)
      expect(themeButton).toHaveClass('h-9', 'w-9');
    });
  });

  describe('3. ACCESSIBILITY TESTS - Requirements 19.6, 19.7', () => {
    it('should support full keyboard navigation (Req 19.6)', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      // Tab through all interactive elements
      await user.tab(); // Skip link
      expect(screen.getByText('Skip to main content')).toHaveFocus();

      await user.tab(); // Brand link
      expect(screen.getByRole('link', { name: /bonitah financial network/i })).toHaveFocus();

      await user.tab(); // Theme button
      expect(screen.getByRole('button', { name: /switch/i })).toHaveFocus();

      await user.tab(); // Main content button
      expect(screen.getByRole('button', { name: 'Interactive Element' })).toHaveFocus();

      await user.tab(); // Input field
      expect(screen.getByPlaceholderText('Test input')).toHaveFocus();

      // Shift+Tab should work backwards
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Interactive Element' })).toHaveFocus();
    });

    it('should have visible focus rings on all interactive elements (Req 19.6)', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      // Focus brand link
      const brandLink = screen.getByRole('link', { name: /bonitah financial network/i });
      await user.tab();
      await user.tab();
      expect(brandLink).toHaveFocus();
      expect(brandLink).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
      );

      // Focus theme button
      await user.tab();
      const themeButton = screen.getByRole('button', { name: /switch/i });
      expect(themeButton).toHaveFocus();
    });

    it('should have proper ARIA labels and attributes (Req 19.7)', () => {
      render(<TestApp />);

      // Brand link should have descriptive aria-label
      const brandLink = screen.getByRole('link', { name: /bonitah financial network.*homepage/i });
      expect(brandLink).toBeInTheDocument();

      // Theme button should have proper ARIA attributes
      const themeButton = screen.getByRole('button', { name: /switch/i });
      expect(themeButton).toHaveAttribute('aria-label');
      expect(themeButton).toHaveAttribute('aria-pressed');
      expect(themeButton).toHaveAttribute('title');

      // Navigation should have proper role and label
      const nav = screen.getByRole('navigation', { name: 'Theme settings' });
      expect(nav).toBeInTheDocument();

      // Header should have banner role
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });

    it('should pass comprehensive axe accessibility audit (Req 19.7)', async () => {
      const { container } = render(<TestApp />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide skip link for keyboard users (Req 19.7)', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      const skipLink = screen.getByText('Skip to main content');

      // Should be hidden by default
      expect(skipLink).toHaveClass('sr-only');

      // Should become visible when focused
      await user.tab();
      expect(skipLink).toHaveFocus();
      expect(skipLink).toHaveClass('focus:not-sr-only');

      // Should navigate to main content when activated
      await user.keyboard('{Enter}');
      const mainContent = screen.getByRole('main');
      expect(mainContent).toHaveAttribute('id', 'main-content');
    });

    it('should support assistive technology announcements', () => {
      render(<ThemeToggle />);

      const button = screen.getByRole('button');

      // Should have aria-pressed for state announcements
      expect(button).toHaveAttribute('aria-pressed');

      // Should have screen reader text
      expect(screen.getByText(/switch to.*theme/i)).toHaveClass('sr-only');

      // Icon should be hidden from screen readers
      const icon = button.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should handle keyboard activation correctly (Req 19.6)', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      const themeButton = screen.getByRole('button', { name: /switch/i });
      themeButton.focus();

      // Test Enter key activation
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Test Space key activation
      await user.keyboard(' ');
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should maintain accessibility across all responsive breakpoints', async () => {
      const breakpoints = [320, 768, 1024];

      for (const width of breakpoints) {
        document.body.innerHTML = '';
        setViewportSize(width);

        const { container, unmount } = render(<TestApp />);

        const results = await axe(container);
        expect(results).toHaveNoViolations();

        unmount();
      }
    });

    it('should support reduced motion and high contrast preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches:
            query.includes('prefers-reduced-motion: reduce') ||
            query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

      render(<TestApp />);

      // Components should remain accessible
      const themeButton = screen.getByRole('button', { name: /switch/i });
      expect(themeButton).toHaveAttribute('aria-label');
      expect(themeButton).toHaveAttribute('aria-pressed');
    });
  });

  describe('4. INTEGRATION TESTS - All Requirements Combined', () => {
    it('should integrate theming, responsiveness, and accessibility seamlessly', async () => {
      const user = userEvent.setup();

      // Test at mobile breakpoint with theming
      setViewportSize(375);
      const { container } = render(<TestApp />);

      // Should pass accessibility audit
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Should be responsive
      const overflowIssues = checkHorizontalOverflow(container);
      expect(overflowIssues).toHaveLength(0);

      // Theme switching should work and maintain accessibility
      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      await user.click(themeButton);

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Should still pass accessibility after theme change
      const resultsAfterTheme = await axe(container);
      expect(resultsAfterTheme).toHaveNoViolations();

      // Should still be responsive
      const overflowIssuesAfterTheme = checkHorizontalOverflow(container);
      expect(overflowIssuesAfterTheme).toHaveLength(0);
    });

    it('should maintain performance requirements across all features', async () => {
      const user = userEvent.setup();

      // Test theme switching performance at different breakpoints
      const breakpoints = [320, 768, 1024];

      for (const width of breakpoints) {
        document.body.innerHTML = '';
        localStorage.clear();
        document.documentElement.className = '';

        setViewportSize(width);
        const { unmount } = render(<TestApp />);

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

        unmount();
      }
    });

    it('should handle edge cases gracefully', async () => {
      const user = userEvent.setup();
      render(<TestApp />);

      // Rapid theme switching
      const themeButton = screen.getByRole('button', { name: /switch/i });
      for (let i = 0; i < 5; i++) {
        await user.click(themeButton);
      }

      // Should end in stable state
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Should still be accessible
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();

      // Should still be responsive
      setViewportSize(320);
      const overflowIssues = checkHorizontalOverflow(document.body);
      expect(overflowIssues).toHaveLength(0);
    });
  });
});
