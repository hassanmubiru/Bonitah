/**
 * Notifications Section Component
 * Settings section for notification preferences
 */

import React from 'react';

export function NotificationsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Notification Categories</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked />
            <span>Transaction Alerts</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked />
            <span>System Updates</span>
          </label>
        </div>
      </div>
    </div>
  );
}
