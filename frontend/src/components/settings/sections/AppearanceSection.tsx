/**
 * Appearance Section Component  
 * Settings section for appearance and UI preferences
 */

import React from 'react';

export function AppearanceSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Typography</h3>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Font Size</label>
          <input type="range" min="12" max="18" defaultValue="14" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Layout Preferences</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" />
            <span>Compact Mode</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" />
            <span>Collapsed Sidebar</span>
          </label>
        </div>
      </div>
    </div>
  );
}
