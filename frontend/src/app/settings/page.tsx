import { Metadata } from 'next';

import { SettingsPage } from '@/components/settings/SettingsPage';

export const metadata: Metadata = {
  title: 'Settings | Bonitah Financial Network',
  description: 'Manage your preferences, theme, notifications, and privacy settings',
};

/**
 * Settings page route (Task 21.10)
 *
 * Features:
 * - Theme and preference controls persisted for the session (Requirements 19.1, 19.3)
 * - Accessibility options and UI preferences (Requirement 11.7)
 * - Notification and privacy settings
 * - Settings export/import functionality
 * - Mobile-optimized responsive design
 */
export default function Settings() {
  return <SettingsPage />;
}
