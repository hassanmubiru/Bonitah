/**
 * Advanced Section Component
 * Settings section for advanced options and data management
 */

import React from 'react';

export function AdvancedSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Data Management</h3>
        <div className="space-y-2">
          <button className="px-4 py-2 bg-blue-500 text-white rounded">Clear Cache</button>
          <button className="px-4 py-2 bg-red-500 text-white rounded">Reset All Data</button>
        </div>
      </div>
    </div>
  );
}
