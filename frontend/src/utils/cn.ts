/**
 * Utility function for conditional class names
 * Similar to clsx or classnames libraries but lightweight
 */

import { type ClassValue } from 'clsx';

/**
 * Conditionally joins class names together
 * @param inputs - Class names to join (strings, objects, arrays)
 * @returns Combined class names string
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      for (const item of input) {
        if (typeof item === 'string') {
          classes.push(item);
        }
      }
    } else if (typeof input === 'object' && input !== null) {
      for (const [key, value] of Object.entries(input)) {
        if (value && typeof key === 'string') {
          classes.push(key);
        }
      }
    }
  }

  return classes.join(' ');
}

export default cn;