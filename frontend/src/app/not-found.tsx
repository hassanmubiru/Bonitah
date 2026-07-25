import { Home, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 404 Not Found page (Task 21.1).
 *
 * Features:
 * - User-friendly error message with clear explanation
 * - Navigation options to return to main site sections
 * - Consistent theme-aware design using shadcn/ui components
 * - Proper HTTP 404 status handling via Next.js not-found.tsx convention
 * - Accessibility compliant with proper landmarks and focus management
 * - SEO optimized with proper meta information
 */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex flex-1 items-center justify-center px-4 py-20"
      role="main"
    >
      <div className="w-full max-w-2xl text-center">
        <div className="space-y-8">
          {/* 404 Header */}
          <div className="space-y-4">
            <div className="text-6xl font-bold text-primary sm:text-8xl">404</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
            <p className="text-lg text-muted-foreground">
              Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been
              moved, deleted, or you may have entered the wrong URL.
            </p>
          </div>

          {/* Navigation Options */}
          <Card className="mx-auto max-w-md">
            <CardHeader>
              <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 text-xl">
                <Search className="h-5 w-5" />
                What would you like to do?
              </h3>
              <CardDescription>Here are some ways to get back on track</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full" size="lg">
                <Link href="/" className="group">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Homepage
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/auth" className="group">
                  <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  Back to Dashboard
                </Link>
              </Button>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  If you believe this is an error, please{' '}
                  <Link
                    href="mailto:support@bonitah.finance"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    contact support
                  </Link>
                  .
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Helpful Links */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Popular sections</h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="ghost" asChild>
                <Link href="/#features">Features</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/auth">Connect Wallet</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
