/**
 * Simple dropdown menu implementation for admin page
 */

import React from 'react';

export interface DropdownMenuProps {
  children: React.ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  return <div className="dropdown-menu">{children}</div>;
}

export interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function DropdownMenuTrigger({ children, asChild }: DropdownMenuTriggerProps) {
  if (asChild) {
    return <>{children}</>;
  }
  return <button className="dropdown-trigger">{children}</button>;
}

export interface DropdownMenuContentProps {
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}

export function DropdownMenuContent({ children, align = 'start' }: DropdownMenuContentProps) {
  return <div className={`dropdown-content align-${align}`}>{children}</div>;
}

export interface DropdownMenuItemProps {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function DropdownMenuItem({ onClick, className, children }: DropdownMenuItemProps) {
  return (
    <button className={`dropdown-item ${className || ''}`} onClick={onClick}>
      {children}
    </button>
  );
}