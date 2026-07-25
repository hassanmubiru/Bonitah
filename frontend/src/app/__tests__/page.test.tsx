import { render, screen } from '@testing-library/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import HomePage from '../page';

// Mock RainbowKit ConnectButton
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: jest.fn(() => <div data-testid="connect-button">Connect Wallet</div>),
}));

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

describe('Landing Page (Task 21.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hero Section', () => {
    it('displays the main heading with BFN branding', () => {
      render(<HomePage />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Building Financial Freedom Together');
    });

    it('shows the value proposition', () => {
      render(<HomePage />);
      
      expect(screen.getByText(/Join the Bonitah Financial Network for decentralized savings/)).toBeInTheDocument();
      expect(screen.getByText(/Build wealth, learn together, achieve your goals/)).toBeInTheDocument();
    });

    it('renders Connect Wallet button', () => {
      render(<HomePage />);
      
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
      expect(ConnectButton).toHaveBeenCalled();
    });

    it('includes Learn More CTA button', () => {
      render(<HomePage />);
      
      const learnMoreButton = screen.getByRole('link', { name: /learn more/i });
      expect(learnMoreButton).toBeInTheDocument();
      expect(learnMoreButton).toHaveAttribute('href', '#features');
    });

    it('displays trust indicators', () => {
      render(<HomePage />);
      
      expect(screen.getByText('Secure on Base')).toBeInTheDocument();
      expect(screen.getByText('Community Driven')).toBeInTheDocument();
      expect(screen.getByText('Educational First')).toBeInTheDocument();
    });
  });

  describe('Features Section', () => {
    it('displays features section heading', () => {
      render(<HomePage />);
      
      expect(screen.getByRole('heading', { level: 2, name: /Everything you need for financial growth/i })).toBeInTheDocument();
    });

    it('shows all four feature cards', () => {
      render(<HomePage />);
      
      expect(screen.getByRole('heading', { level: 3, name: 'Smart Savings' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Goal Setting' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Community' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Education' })).toBeInTheDocument();
    });

    it('includes feature descriptions and benefits', () => {
      render(<HomePage />);
      
      expect(screen.getByText(/Earn yield on your savings with transparent/)).toBeInTheDocument();
      expect(screen.getByText(/Set and track financial goals/)).toBeInTheDocument();
      expect(screen.getByText(/Join investment circles/)).toBeInTheDocument();
      expect(screen.getByText(/Learn DeFi, blockchain, and traditional finance/)).toBeInTheDocument();
    });
  });

  describe('CTA Section', () => {
    it('displays final call-to-action', () => {
      render(<HomePage />);
      
      expect(screen.getByRole('heading', { level: 2, name: /Ready to start your financial journey/i })).toBeInTheDocument();
      expect(screen.getByText(/Connect your wallet and join thousands of users/)).toBeInTheDocument();
    });

    it('includes dashboard link', () => {
      render(<HomePage />);
      
      const dashboardLink = screen.getByRole('link', { name: /explore dashboard/i });
      expect(dashboardLink).toBeInTheDocument();
      expect(dashboardLink).toHaveAttribute('href', '/auth');
    });

    it('renders second Connect Wallet button', () => {
      render(<HomePage />);
      
      // Should have two ConnectButton instances
      expect(ConnectButton).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('has proper main content landmark', () => {
      render(<HomePage />);
      
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');
    });

    it('uses semantic HTML structure', () => {
      render(<HomePage />);
      
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    });

    it('has proper section landmarks', () => {
      const { container } = render(<HomePage />);
      
      const sections = container.querySelectorAll('section');
      expect(sections).toHaveLength(3); // Hero, Features, CTA
    });
  });

  describe('Responsive Design', () => {
    it('uses responsive classes for mobile-first design', () => {
      const { container } = render(<HomePage />);
      
      // Check for responsive classes on key elements
      expect(container.querySelector('.sm\\:text-5xl')).toBeInTheDocument();
      expect(container.querySelector('.sm\\:flex-row')).toBeInTheDocument();
      expect(container.querySelector('.sm\\:grid-cols-2')).toBeInTheDocument();
    });
  });

  describe('Theme Awareness', () => {
    it('uses theme-aware classes', () => {
      const { container } = render(<HomePage />);
      
      // Check for theme-aware classes
      expect(container.querySelector('.bg-background')).toBeInTheDocument();
      expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument();
      expect(container.querySelector('.bg-primary\\/10')).toBeInTheDocument();
    });
  });
});