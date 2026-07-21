import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, resolving conflicts deterministically.
 * The canonical shadcn/ui helper used by all UI primitives.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
