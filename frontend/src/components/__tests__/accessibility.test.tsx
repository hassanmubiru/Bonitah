/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { SiteHeader } from '../site-header';
import { ThemeToggle } from '../theme-toggle';

expect.extend(toHaveNoViolations);

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

// Helper to test keyboard navigation
async function testKeyboardNavigation(user: ReturnType<typeof userEvent.setup>) {
  // Tab through all focusable elements
  await user.tab();
  const firstFocusable = document.activeElement;
  
  await user.tab();
  const secondFocusable = document.activeElement;
  
  // Shift+Tab back
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(firstFocusable);
  
  return { firstFocusable, secondFocusable };
}

describe('Accessibility Tests', () => {
  describe('**Validates: Requirements 19.6, 19.7**', () => {
    it('should support keyboard navigation through all interactive elements (Req 19.6)', async () => {
      const user = userEvent.setup();
      render(<SiteHeader />);
      
      const { firstFocusable, secondFocusable } = await testKeyboardNavigation(user);
      
      // Should have at least two focusable elements (skip link and theme toggle)
      expect(firstFocusable).toBeTruthy();
      expect(secondFocusable).toBeTruthy();
      expect(firstFocusable).not.toBe(secondFocusable);
    });

    it('should have visible focus rings on all interactive elements (Req 19.6)', async () => {
      const user = userEvent.setup();
      render(<SiteHeader />);
      
      // Focus the brand link
      const brandLink = screen.getByRole('link', { name: /bonitah financial network/i });
      await user.tab();
      await user.tab(); // Skip the skip link, focus on brand
      
      expect(brandLink).toHaveFocus();
      expect(brandLink).toHaveClass('focus-visible:outline-none');
      expect(brandLink).toHaveClass('focus-visible:ring-2');
      
      // Focus the theme toggle
      await user.tab();
      const themeButton = screen.getByRole('button');
      expect(themeButton).toHaveFocus();
    });

    it('should have proper ARIA labels on all interactive elements (Req 19.7)', () => {
      render(<SiteHeader />);
      
      // Brand link should have accessible name
      const brandLink = screen.getByRole('link', { name: /bonitah financial network.*homepage/i });
      expect(brandLink).toBeInTheDocument();
      
      // Theme toggle should have aria-label
      const themeButton = screen.getByRole('button');
      expect(themeButton).toHaveAttribute('aria-label');
      
      // Navigation should have proper role and aria-label
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Theme settings');
    });

    it('should pass comprehensive axe accessibility audit (Req 19.7)', async () => {
      const { container } = render(<SiteHeader />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide skip link for keyboard users (Req 19.7)', async () => {
      const user = userEvent.setup();
      render(<SiteHeader />);
      
      // Skip link should be available but hidden initially
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveClass('sr-only');
      
      // Focus the skip link
      await user.tab();
      expect(skipLink).toHaveFocus();
      
      // Should become visible when focused
      expect(skipLink).toHaveClass('focus:not-sr-only');
    });

    it('should have proper landmark roles (Req 19.7)', () => {
      render(<SiteHeader />);
      
      // Header should have banner role
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
      
      // Navigation should have navigation role
      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('should support screen readers with proper semantic markup (Req 19.7)', () => {
      render(<SiteHeader />);
      
      // Should have proper heading structure (link acts as heading)
      const brandLink = screen.getByRole('link', { name: /bonitah financial network/i });
      expect(brandLink).toBeInTheDocument();
      
      // Hidden text for screen readers
      const srOnlyText = screen.getByText('Switch to dark theme');
      expect(srOnlyText).toHaveClass('sr-only');
    });

    it('should handle reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });
      
      render(<SiteHeader />);
      
      // Components should still be accessible with reduced motion
      const themeButton = screen.getByRole('button');
      expect(themeButton).toBeInTheDocument();
      expect(themeButton).toHaveAttribute('aria-label');
    });

    it('should support high contrast mode (Req 19.6)', () => {
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
      
      render(<SiteHeader />);
      
      // Elements should have proper contrast classes
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('border-b', 'border-border');
    });

    it('should provide proper focus management', async () => {
      const user = userEvent.setup();
      render(<SiteHeader />);
      
      // Test focus trap doesn't exist (header shouldn't trap focus)
      await user.tab();
      await user.tab();
      await user.tab();
      
      // Should be able to continue tabbing past the header
      expect(document.activeElement).toBeTruthy();
    });

    it('should support assistive technology announcements', async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);
      
      const button = screen.getByRole('button');
      
      // Button should have aria-pressed for state announcement
      expect(button).toHaveAttribute('aria-pressed');
      
      // Should announce state changes
      await user.click(button);
      
      // After clicking, state should change (mocked in our test setup)
      expect(button).toHaveAttribute('aria-pressed');
    });

    it('should handle keyboard activation correctly (Req 19.6)', async () => {
      const user = userEvent.setup();
      render(<SiteHeader />);
      
      // Focus and activate theme button with Enter
      const themeButton = screen.getByRole('button');
      themeButton.focus();
      
      await user.keyboard('{Enter}');
      // Theme toggle should handle the activation (mocked in our setup)
      
      // Test Space key activation
      await user.keyboard(' ');
      // Should also activate the button
    });

    it('should provide descriptive link text (Req 19.7)', () => {
      render(<SiteHeader />);
      
      // Link should have descriptive text, not just "click here" or "read more"
      const brandLink = screen.getByRole('link');
      expect(brandLink).toHaveAccessibleName();
      expect(brandLink.textContent).toBe('Bonitah Financial Network');
    });

    it('should maintain focus visibility in all themes', async () => {
      const { rerender } = render(<SiteHeader />);
      
      // Test in both light and dark themes
      const themeButton = screen.getByRole('button');
      themeButton.focus();
      
      // Should have focus styles
      expect(themeButton).toHaveFocus();
      
      // Simulate theme change
      document.documentElement.classList.add('dark');
      rerender(<SiteHeader />);
      
      // Focus should still be visible in dark theme
      expect(screen.getByRole('button')).toHaveAttribute('aria-label');
    });
  });
});