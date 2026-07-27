/**
 * Performance optimization utilities for BFN frontend
 */

/**
 * Preload critical resources to improve initial page load
 */
export function preloadCriticalResources() {
  if (typeof window === 'undefined') return;

  // Preload critical API endpoints
  const criticalEndpoints = [
    '/health',
    '/auth/me',
  ];

  criticalEndpoints.forEach(endpoint => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3002';
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = apiUrl;
    document.head.appendChild(link);
  });

  // Preload critical fonts if any
  const fonts = [
    // Add any critical fonts here
  ];

  fonts.forEach(font => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.href = font;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Optimize React Query configuration for better performance
 */
export const optimizedQueryClientConfig = {
  defaultOptions: {
    queries: {
      // Reduce stale time for better perceived performance
      staleTime: 30_000, // 30 seconds
      // Shorter garbage collection time
      gcTime: 5 * 60 * 1000, // 5 minutes
      // Disable automatic refetch on window focus
      refetchOnWindowFocus: false,
      // Reduce retry attempts for faster failure feedback
      retry: 2,
      // Shorter retry delay
      retryDelay: (attemptIndex: number) => Math.min(500 * (2 ** attemptIndex), 1000),
    },
    mutations: {
      // Shorter retry delay for mutations
      retry: 1,
      retryDelay: 500,
    },
  },
};

/**
 * Debounce function to prevent excessive API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit API call frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Lazy load components for better initial bundle size
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const LazyComponent = React.lazy(importFunc);
  
  return React.forwardRef<any, React.ComponentProps<T>>((props, ref) => 
    React.createElement(
      React.Suspense,
      {
        fallback: fallback 
          ? React.createElement(fallback)
          : React.createElement('div', 
              { className: 'flex items-center justify-center p-4' },
              React.createElement('div', 
                { className: 'animate-pulse text-muted-foreground' },
                'Loading...'
              )
            )
      },
      React.createElement(LazyComponent, { ref, ...props })
    )
  );
}

/**
 * Memoize expensive calculations
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Clear cache if it gets too large
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  }) as T;
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map();
  
  static startMark(name: string) {
    this.marks.set(name, performance.now());
  }
  
  static endMark(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No start mark found for ${name}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.marks.delete(name);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
  
  static measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMark(name);
    return fn().finally(() => {
      this.endMark(name);
    });
  }
}

// Import React for lazy loading utility
import React from 'react';