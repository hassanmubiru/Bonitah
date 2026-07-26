/**
 * Accessibility Section Component
 * Settings section for accessibility options
 */

import React from 'react';

export function AccessibilitySection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Accessibility Options</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" />
            <span>High Contrast Mode</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" />
            <span>Screen Reader Support</span>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Keyboard Navigation</h3>
        <p className="text-sm text-gray-600">
          Use Tab to navigate between elements and Enter to activate.
        </p>
      </div>
    </div>
  );
}
