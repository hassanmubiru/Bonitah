import { render, screen } from '@testing-library/react';

import NotFound from '../not-found';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, className }: any) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

describe('404 Not Found Page (Task 21.1)', () => {
  describe('Error Message', () => {
    it('displays 404 error code prominently', () => {
      render(<NotFound />);
      
      expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('shows user-friendly error message', () => {
      render(<NotFound />);
      
      expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
      expect(screen.getByText(/Sorry, we couldn't find the page you're looking for/)).toBeInTheDocument();
    });

    it('explains possible reasons for the error', () => {
      render(<NotFound />);
      
      expect(screen.getByText(/It might have been moved, deleted, or you may have entered the wrong URL/)).toBeInTheDocument();
    });
  });

  describe('Navigation Options', () => {
    it('provides navigation options card', () => {
      render(<NotFound />);
      
      expect(screen.getByRole('heading', { level: 3, name: /What would you like to do/i })).toBeInTheDocument();
      expect(screen.getByText('Here are some ways to get back on track')).toBeInTheDocument();
    });

    it('includes Go to Homepage button', () => {
      render(<NotFound />);
      
      const homeButton = screen.getByRole('link', { name: /go to homepage/i });
      expect(homeButton).toBeInTheDocument();
      expect(homeButton).toHaveAttribute('href', '/');
    });

    it('includes Back to Dashboard button', () => {
      render(<NotFound />);
      
      const dashboardButton = screen.getByRole('link', { name: /back to dashboard/i });
      expect(dashboardButton).toBeInTheDocument();
      expect(dashboardButton).toHaveAttribute('href', '/auth');
    });

    it('provides contact support link', () => {
      render(<NotFound />);
      
      const supportLink = screen.getByRole('link', { name: 'contact support' });
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', 'mailto:support@bonitah.finance');
    });
  });

  describe('Popular Sections', () => {
    it('displays popular sections heading', () => {
      render(<NotFound />);
      
      expect(screen.getByRole('heading', { level: 2, name: 'Popular sections' })).toBeInTheDocument();
    });

    it('includes quick links to popular sections', () => {
      render(<NotFound />);
      
      const featuresLink = screen.getByRole('link', { name: 'Features' });
      const connectLink = screen.getByRole('link', { name: 'Connect Wallet' });
      const learnLink = screen.getByRole('link', { name: 'Learn More' });

      expect(featuresLink).toBeInTheDocument();
      expect(featuresLink).toHaveAttribute('href', '/#features');
      
      expect(connectLink).toBeInTheDocument();
      expect(connectLink).toHaveAttribute('href', '/auth');
      
      expect(learnLink).toBeInTheDocument();
      expect(learnLink).toHaveAttribute('href', '/');
    });
  });

  describe('Accessibility', () => {
    it('has proper main content landmark', () => {
      render(<NotFound />);
      
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');
    });

    it('uses semantic HTML structure', () => {
      render(<NotFound />);
      
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    });

    it('has descriptive link texts', () => {
      render(<NotFound />);
      
      // All links should have descriptive text or aria-labels
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAccessibleName();
      });
    });
  });

  describe('Design System Consistency', () => {
    it('uses shadcn/ui components', () => {
      const { container } = render(<NotFound />);
      
      // Should use Card components
      expect(container.querySelector('[class*="rounded-xl"]')).toBeInTheDocument();
      expect(container.querySelector('[class*="border"]')).toBeInTheDocument();
      expect(container.querySelector('[class*="bg-card"]')).toBeInTheDocument();
    });

    it('uses consistent button variants', () => {
      const { container } = render(<NotFound />);
      
      // Should have primary and outline button variants
      expect(container.querySelector('[class*="bg-primary"]')).toBeInTheDocument();
      expect(container.querySelector('[class*="border-input"]')).toBeInTheDocument();
    });
  });

  describe('Theme Awareness', () => {
    it('uses theme-aware classes', () => {
      const { container } = render(<NotFound />);
      
      // Check for theme-aware classes
      expect(container.querySelector('[class*="text-primary"]')).toBeInTheDocument();
      expect(container.querySelector('[class*="text-muted-foreground"]')).toBeInTheDocument();
      expect(container.querySelector('[class*="bg-card"]')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('uses responsive classes for mobile-first design', () => {
      const { container } = render(<NotFound />);
      
      // Check for responsive classes
      expect(container.querySelector('[class*="sm:text-4xl"]')).toBeInTheDocument();
      expect(container.querySelector('[class*="max-w-2xl"]')).toBeInTheDocument();
      expect(container.querySelector('[class*="max-w-md"]')).toBeInTheDocument();
    });
  });
});