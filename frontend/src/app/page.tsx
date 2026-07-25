'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Target, Users, BookOpen, TrendingUp, ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

/**
 * Landing page with hero section and feature highlights (Task 21.1).
 * 
 * Features:
 * - Hero section with BFN branding and value proposition
 * - Feature highlights (savings, goals, community, education)
 * - Call-to-action buttons (Connect Wallet, Learn More)
 * - Fully theme-aware with responsive design
 * - SEO optimized with semantic HTML structure
 * - Accessibility compliant with proper landmarks and ARIA labels
 */
export default function HomePage() {
  return (
    <main
      id="main-content"
      className="flex-1"
      role="main"
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-muted/50 px-4 py-20 sm:py-32">
        <div className="mx-auto max-w-6xl text-center">
          {/* Hero Content */}
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Building Financial{' '}
                <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  Freedom
                </span>{' '}
                Together
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Join the Bonitah Financial Network for decentralized savings, community investing, 
                and financial education on Base blockchain. Build wealth, learn together, achieve your goals.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <ConnectButton />
              <Button variant="outline" size="lg" asChild>
                <Link href="#features" className="group">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-75">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span className="text-sm">Secure on Base</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="text-sm">Community Driven</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <span className="text-sm">Educational First</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need for financial growth
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Our comprehensive platform combines the best of DeFi with community support and education.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Decentralized Savings */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold leading-none tracking-tight">Smart Savings</h3>
                </div>
                <CardDescription>
                  Earn yield on your savings with transparent, decentralized protocols on Base blockchain.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Competitive yields</li>
                  <li>• No lock-up periods</li>
                  <li>• Full transparency</li>
                </ul>
              </CardContent>
            </Card>

            {/* Goal Setting */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold leading-none tracking-tight">Goal Setting</h3>
                </div>
                <CardDescription>
                  Set and track financial goals with milestone rewards and community support.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Custom goal creation</li>
                  <li>• Progress tracking</li>
                  <li>• Milestone rewards</li>
                </ul>
              </CardContent>
            </Card>

            {/* Community Investing */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold leading-none tracking-tight">Community</h3>
                </div>
                <CardDescription>
                  Join investment circles and learn from experienced community members.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Investment circles</li>
                  <li>• Peer learning</li>
                  <li>• Shared strategies</li>
                </ul>
              </CardContent>
            </Card>

            {/* Financial Education */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold leading-none tracking-tight">Education</h3>
                </div>
                <CardDescription>
                  Learn DeFi, blockchain, and traditional finance through interactive content.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Interactive lessons</li>
                  <li>• Expert insights</li>
                  <li>• Progress tracking</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/50 px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to start your financial journey?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Connect your wallet and join thousands of users building wealth together on BFN.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <ConnectButton />
            <Button variant="ghost" asChild>
              <Link href="/auth">
                Explore Dashboard →
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
