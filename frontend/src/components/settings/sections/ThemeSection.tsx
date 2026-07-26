/**
 * Theme Section Component
 * Settings section for theme configuration
 */

import React from 'react';

export function ThemeSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Theme Preference</h3>
        <p>Choose your preferred color theme.</p>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Theme Persistence</h3>
        <p>Theme changes apply instantly without requiring a page reload.</p>
      </div>
    </div>
  );
}