'use client';

import { useEffect, useState } from 'react';

/**
 * Development utility to test responsive breakpoints.
 * Displays current viewport size and active breakpoint.
 *
 * Validates requirements:
 * - Mobile: 320-767px (base/unprefixed)
 * - Tablet: 768-1023px (md)
 * - Desktop: >=1024px (lg)
 */
export function ResponsiveTest() {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const getBreakpoint = (width: number) => {
    if (width >= 1024) return 'lg (Desktop >=1024px)';
    if (width >= 768) return 'md (Tablet 768-1023px)';
    return 'base (Mobile 320-767px)';
  };

  const isValidWidth = viewport.width >= 320; // Minimum supported width

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-md bg-background/95 p-2 text-xs shadow-md border">
      <div>
        Viewport: {viewport.width} × {viewport.height}
      </div>
      <div>Breakpoint: {getBreakpoint(viewport.width)}</div>
      <div className={isValidWidth ? 'text-green-600' : 'text-red-600'}>
        {isValidWidth ? '✓ Valid width' : '✗ Below 320px minimum'}
      </div>
    </div>
  );
}
