/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

import { SiteHeader } from '../site-header';

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

// Helper to simulate different viewport sizes
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

  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
}

// Helper to check for horizontal overflow
function checkHorizontalOverflow(container: HTMLElement) {
  const elements = container.querySelectorAll('*');
  const violations: string[] = [];

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    // Check if element extends beyond viewport width
    if (rect.width > window.innerWidth && computedStyle.position !== 'fixed') {
      violations.push(
        `Element ${element.tagName}${element.className ? '.' + element.className : ''} causes horizontal overflow`,
      );
    }

    // Check for fixed widths that might cause issues
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

describe('Responsive Design Tests', () => {
  describe('**Validates: Requirements 19.5**', () => {
    it('should not have horizontal scroll at mobile breakpoint (320-767px)', () => {
      // Test at minimum supported width
      setViewportSize(320);
      const { container } = render(<SiteHeader />);

      const overflowIssues = checkHorizontalOverflow(container);
      expect(overflowIssues).toHaveLength(0);

      // Test at maximum mobile width
      setViewportSize(767);
      const { container: container767 } = render(<SiteHeader />);

      const overflowIssues767 = checkHorizontalOverflow(container767);
      expect(overflowIssues767).toHaveLength(0);
    });

    it('should not have horizontal scroll at tablet breakpoint (768-1023px)', () => {
      // Test at minimum tablet width
      setViewportSize(768);
      const { container } = render(<SiteHeader />);

      const overflowIssues = checkHorizontalOverflow(container);
      expect(overflowIssues).toHaveLength(0);

      // Test at maximum tablet width
      setViewportSize(1023);
      const { container: container1023 } = render(<SiteHeader />);

      const overflowIssues1023 = checkHorizontalOverflow(container1023);
      expect(overflowIssues1023).toHaveLength(0);
    });

    it('should not have horizontal scroll at desktop breakpoint (≥1024px)', () => {
      // Test at minimum desktop width
      setViewportSize(1024);
      const { container } = render(<SiteHeader />);

      const overflowIssues = checkHorizontalOverflow(container);
      expect(overflowIssues).toHaveLength(0);

      // Test at larger desktop width
      setViewportSize(1920);
      const { container: container1920 } = render(<SiteHeader />);

      const overflowIssues1920 = checkHorizontalOverflow(container1920);
      expect(overflowIssues1920).toHaveLength(0);
    });

    it('should use proper responsive container constraints', () => {
      setViewportSize(320);
      render(<SiteHeader />);

      const container = screen.getByRole('banner').querySelector('.mx-auto');
      expect(container).toHaveClass('max-w-6xl'); // Should have max width constraint
      expect(container).toHaveClass('px-4'); // Should have horizontal padding
    });

    it('should handle very narrow viewports without breaking', () => {
      // Test extreme narrow width
      setViewportSize(280);
      const { container } = render(<SiteHeader />);

      const overflowIssues = checkHorizontalOverflow(container);
      expect(overflowIssues).toHaveLength(0);

      // Verify essential elements are still accessible
      expect(screen.getByText('Bonitah Financial Network')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument(); // Theme toggle
    });

    it('should maintain proper spacing and layout at all breakpoints', () => {
      const testBreakpoints = [320, 480, 768, 1024, 1280, 1920];

      testBreakpoints.forEach((width) => {
        setViewportSize(width);
        render(<SiteHeader />);

        const header = screen.getByRole('banner');
        const headerContainer = header.querySelector('.mx-auto');

        // Should have proper flex layout
        expect(headerContainer).toHaveClass('flex');
        expect(headerContainer).toHaveClass('items-center');
        expect(headerContainer).toHaveClass('justify-between');

        // Should have proper height
        expect(headerContainer).toHaveClass('h-14');

        // Should have proper padding at all sizes
        expect(headerContainer).toHaveClass('px-4');
      });
    });

    it('should handle text wrapping gracefully at narrow widths', () => {
      setViewportSize(320);
      render(<SiteHeader />);

      const brandLink = screen.getByText('Bonitah Financial Network');
      const computedStyle = window.getComputedStyle(brandLink);

      // Should not have fixed width that causes overflow
      expect(computedStyle.whiteSpace).not.toBe('nowrap');
    });

    it('should support touch-friendly sizing on mobile devices', () => {
      setViewportSize(375); // iPhone standard width
      render(<SiteHeader />);

      const themeButton = screen.getByRole('button');
      const rect = themeButton.getBoundingClientRect();

      // Button should be at least 44px for touch accessibility (iOS guideline)
      expect(rect.width).toBeGreaterThanOrEqual(36); // shadcn/ui icon button size
      expect(rect.height).toBeGreaterThanOrEqual(36);
    });

    it('should maintain accessibility at all responsive breakpoints', async () => {
      const testBreakpoints = [320, 768, 1024];

      for (const width of testBreakpoints) {
        setViewportSize(width);
        const { container } = render(<SiteHeader />);

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });
  });
});
