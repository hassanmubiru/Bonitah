/**
 * Not Found Page Component Tests - Task 21.12
 * 
 * Covers loading/error/retry rendering and user experience.
 * 
 * Requirements Coverage:
 * - 11.7: 404 page navigation and user experience
 * - 19.5: Responsive design across devices
 * - 19.6: Accessibility compliance
 * - Static page functionality (no role gating needed)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import NotFoundPage from '../not-found';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ 
    children, 
    href, 
    className 
  }: { 
    children: React.ReactNode; 
    href: string; 
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Home: ({ className, ...props }: any) => <div data-testid="home-icon" className={className} {...props} />,
  ArrowLeft: ({ className, ...props }: any) => <div data-testid="arrow-left-icon" className={className} {...props} />,
  Search: ({ className, ...props }: any) => <div data-testid="search-icon" className={className} {...props} />,
}));

describe('Not Found Page Component Tests (Task 21.12)', () => {
  describe('Page Content and Structure', () => {
    it('displays 404 error message with proper heading hierarchy', () => {
      render(<NotFoundPage />);

      // Should display 404 prominently
      expect(screen.getByText('404')).toBeInTheDocument();
      
      // Should have proper heading structure
      expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Popular sections' })).toBeInTheDocument();
    });

    it('provides clear explanation of the error', () => {
      render(<NotFoundPage />);

      // Should explain what happened and why
      expect(screen.getByText(/Sorry, we couldn't find the page you're looking for/)).toBeInTheDocument();
      expect(screen.getByText(/It might have been moved, deleted, or you may have entered the wrong URL/)).toBeInTheDocument();
    });

    it('displays helpful navigation options', () => {
      render(<NotFoundPage />);

      // Should show "What would you like to do?" section
      expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
      expect(screen.getByText('Here are some ways to get back on track')).toBeInTheDocument();
    });

    it('includes primary navigation buttons', () => {
      render(<NotFoundPage />);

      // Should have main navigation options
      expect(screen.getByRole('link', { name: /go to homepage/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument();
      
      // Verify href attributes
      expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/auth');
    });

    it('provides popular section links', () => {
      render(<NotFoundPage />);

      // Should show popular navigation links
      expect(screen.getByText('Popular sections')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/#features');
      expect(screen.getByRole('link', { name: 'Connect Wallet' })).toHaveAttribute('href', '/auth');
      expect(screen.getByRole('link', { name: 'Learn More' })).toHaveAttribute('href', '/');
    });

    it('includes support contact information', () => {
      render(<NotFoundPage />);

      // Should provide support contact
      expect(screen.getByText(/If you believe this is an error/)).toBeInTheDocument();
      
      const supportLink = screen.getByRole('link', { name: 'contact support' });
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', 'mailto:support@bonitah.finance');
    });
  });

  describe('Accessibility Compliance (Req 19.6)', () => {
    it('has proper main content landmark', () => {
      render(<NotFoundPage />);
      
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');
    });

    it('uses semantic HTML structure with proper headings', () => {
      render(<NotFoundPage />);
      
      // Should have proper heading hierarchy
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('provides accessible icons with proper data attributes', () => {
      render(<NotFoundPage />);
      
      // Icons should have test IDs for accessibility testing
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('has focusable interactive elements', () => {
      render(<NotFoundPage />);
      
      // All buttons and links should be focusable
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
      
      // Primary action buttons should be present
      expect(screen.getByRole('link', { name: /go to homepage/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument();
    });
  });

  describe('Responsive Design (Req 19.5)', () => {
    it('uses responsive typography classes', () => {
      const { container } = render(<NotFoundPage />);
      
      // Should use responsive text sizing
      expect(container.querySelector('.text-6xl')).toBeInTheDocument(); // Large 404 number
      expect(container.querySelector('.sm\\:text-8xl')).toBeInTheDocument(); // Even larger on larger screens
      expect(container.querySelector('.text-3xl')).toBeInTheDocument(); // Main heading
      expect(container.querySelector('.sm\\:text-4xl')).toBeInTheDocument(); // Larger heading on bigger screens
    });

    it('uses responsive layout classes', () => {
      const { container } = render(<NotFoundPage />);
      
      // Should have responsive container and spacing
      expect(container.querySelector('.max-w-2xl')).toBeInTheDocument(); // Content width constraint
      expect(container.querySelector('.max-w-md')).toBeInTheDocument(); // Card width constraint
      expect(container.querySelector('.flex-wrap')).toBeInTheDocument(); // Flexible wrapping for links
    });

    it('ensures mobile-friendly button sizing', () => {
      render(<NotFoundPage />);
      
      // Primary buttons should be full-width on mobile
      const homepageButton = screen.getByRole('link', { name: /go to homepage/i });
      const dashboardButton = screen.getByRole('link', { name: /back to dashboard/i });
      
      expect(homepageButton.closest('*[class*="w-full"]')).toBeInTheDocument();
      expect(dashboardButton.closest('*[class*="w-full"]')).toBeInTheDocument();
    });
  });

  describe('Theme Awareness (Req 19.1)', () => {
    it('uses theme-aware color classes', () => {
      const { container } = render(<NotFoundPage />);
      
      // Should use theme-aware classes for colors
      expect(container.querySelector('.text-primary')).toBeInTheDocument();
      expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument();
    });

    it('uses theme-aware component styling', () => {
      const { container } = render(<NotFoundPage />);
      
      // Should use shadcn/ui components that are theme-aware
      expect(container.querySelector('.border-t')).toBeInTheDocument(); // Border styling
      expect(container.querySelector('.underline-offset-4')).toBeInTheDocument(); // Link styling
    });
  });

  describe('User Experience and Navigation', () => {
    it('provides clear visual hierarchy', () => {
      render(<NotFoundPage />);
      
      // 404 should be the most prominent element
      const errorNumber = screen.getByText('404');
      expect(errorNumber).toBeInTheDocument();
      
      // Main heading should be clear
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Page not found');
      
      // Explanation should be helpful
      expect(screen.getByText(/Sorry, we couldn't find the page/)).toBeInTheDocument();
    });

    it('offers multiple recovery paths', () => {
      render(<NotFoundPage />);
      
      // Should provide different ways to navigate away
      expect(screen.getByRole('link', { name: /go to homepage/i })).toBeInTheDocument(); // Home
      expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument(); // Dashboard
      expect(screen.getByRole('link', { name: 'Features' })).toBeInTheDocument(); // Features
      expect(screen.getByRole('link', { name: 'Connect Wallet' })).toBeInTheDocument(); // Auth
    });

    it('provides support contact as fallback', () => {
      render(<NotFoundPage />);
      
      // Should offer human support as last resort
      const supportLink = screen.getByRole('link', { name: 'contact support' });
      expect(supportLink).toHaveAttribute('href', 'mailto:support@bonitah.finance');
      
      // Context should be clear
      expect(screen.getByText(/If you believe this is an error/)).toBeInTheDocument();
    });

    it('groups related navigation options logically', () => {
      render(<NotFoundPage />);
      
      // Primary actions should be in main card
      expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
      
      // Secondary actions should be in separate section
      expect(screen.getByText('Popular sections')).toBeInTheDocument();
      
      // Support should be separate from main actions
      expect(screen.getByText(/contact support/)).toBeInTheDocument();
    });
  });

  describe('Content Quality and Messaging', () => {
    it('uses friendly and helpful tone', () => {
      render(<NotFoundPage />);
      
      // Should be apologetic and helpful, not technical
      expect(screen.getByText(/Sorry, we couldn't find the page/)).toBeInTheDocument();
      expect(screen.getByText(/Here are some ways to get back on track/)).toBeInTheDocument();
    });

    it('avoids technical jargon in user-facing text', () => {
      render(<NotFoundPage />);
      
      // Should not mention HTTP status codes or technical errors in main text
      const mainText = screen.getByText(/Sorry, we couldn't find the page you're looking for/);
      expect(mainText).not.toHaveTextContent('HTTP');
      expect(mainText).not.toHaveTextContent('404'); // 404 is displayed separately as a visual element
      expect(mainText).not.toHaveTextContent('error code');
    });

    it('suggests probable causes without being technical', () => {
      render(<NotFoundPage />);
      
      // Should explain what might have happened in user-friendly terms
      expect(screen.getByText(/It might have been moved, deleted, or you may have entered the wrong URL/)).toBeInTheDocument();
    });
  });

  describe('Visual Design and Layout', () => {
    it('centers content appropriately', () => {
      const { container } = render(<NotFoundPage />);
      
      // Main container should be centered
      expect(container.querySelector('.items-center')).toBeInTheDocument();
      expect(container.querySelector('.justify-center')).toBeInTheDocument();
      expect(container.querySelector('.text-center')).toBeInTheDocument();
    });

    it('uses appropriate spacing and typography scale', () => {
      const { container } = render(<NotFoundPage />);
      
      // Should have proper spacing between sections
      expect(container.querySelector('.space-y-8')).toBeInTheDocument();
      expect(container.querySelector('.space-y-4')).toBeInTheDocument();
      
      // Typography should create clear hierarchy
      expect(container.querySelector('.text-6xl')).toBeInTheDocument(); // Large 404
      expect(container.querySelector('.text-3xl')).toBeInTheDocument(); // Main heading
      expect(container.querySelector('.text-lg')).toBeInTheDocument(); // Description
    });

    it('uses icons to enhance visual communication', () => {
      render(<NotFoundPage />);
      
      // Icons should support the message
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });
  });
});