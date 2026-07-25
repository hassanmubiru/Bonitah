'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettingsManager } from '@/hooks/useSettingsManager';

/**
 * Theme configuration section (Requirements 19.1, 19.3)
 * 
 * Features:
 * - Light/dark/system theme selection
 * - Integration with existing ThemeProvider
 * - Session persistence via settings manager
 * - Immediate theme switching without page reload (within 1s)
 * - Visual preview of theme options
 */
export function ThemeSection() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { settings, updateSetting } = useSettingsManager();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    // Update both the theme provider and settings
    setTheme(newTheme);
    updateSetting('theme', newTheme);
  };

  if (!mounted) {
    return <ThemeSectionSkeleton />;
  }

  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      description: 'Light theme with bright backgrounds',
      icon: Sun,
      preview: 'bg-white border text-black',
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Dark theme with dim backgrounds',
      icon: Moon,
      preview: 'bg-slate-900 border text-white',
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follow your system preference',
      icon: Monitor,
      preview: 'bg-gradient-to-br from-white to-slate-900 border text-slate-600',
    },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-md">
            {resolvedTheme === 'dark' ? (
              <Moon className="h-4 w-4 text-primary" />
            ) : (
              <Sun className="h-4 w-4 text-primary" />
            )}
          </div>
          Theme Preference
        </CardTitle>
        <CardDescription>
          Choose your preferred theme. Changes apply immediately across all pages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;
            
            return (
              <Button
                key={option.value}
                variant={isSelected ? 'default' : 'outline'}
                className={`h-auto p-4 flex-col gap-3 relative ${
                  isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                onClick={() => handleThemeChange(option.value)}
              >
                <div className={`w-full h-16 rounded-md ${option.preview} flex items-center justify-center`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1 text-center">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-primary rounded-full" />
                  </div>
                )}
              </Button>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Theme Persistence</p>
              <p className="text-xs text-muted-foreground">
                Your theme preference is saved in your browser and will persist across sessions.
                Theme changes apply instantly without requiring a page reload.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeSectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded-md">
            <div className="h-4 w-4 bg-muted-foreground/20 rounded" />
          </div>
          Theme Preference
        </CardTitle>
        <CardDescription>Loading theme settings...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}