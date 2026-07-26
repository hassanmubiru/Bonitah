/**
 * Privacy Section Component
 * Settings section for privacy and security preferences
 */

import React from 'react';

export function PrivacySection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Privacy Controls</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" />
            <span>Share usage analytics</span>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Security Notice</h3>
        <p className="text-sm text-gray-600">
          Your data is protected with industry-standard encryption.
        </p>
      </div>
    </div>
  );
}
