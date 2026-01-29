/**
 * Toast Utility for HeroUI Toast System
 * 
 * Provides consistent toast notifications across the dashboard using HeroUI's native toast system.
 * All toasts use the flat variant and are positioned at bottom-right.
 * 
 * @example
 * ```tsx
 * import { showToast } from '@/components/shared/utils/toast';
 * 
 * // Success message
 * showToast.success('Changes saved successfully!');
 * 
 * // Error message
 * showToast.error('Failed to save changes');
 * 
 * // Warning message
 * showToast.warning('This action cannot be undone');
 * 
 * // Info/default message
 * showToast.info('Processing your request...');
 * 
 * // Custom toast with description
 * showToast.success('Event created', 'Your event has been submitted for approval');
 * ```
 */

import { addToast } from '@heroui/react';

interface ToastOptions {
  title: string;
  description?: string;
  timeout?: number;
}

/**
 * Show a success toast notification
 */
function success(title: string, description?: string, timeout?: number) {
  addToast({
    title,
    description,
    color: 'success',
    variant: 'flat',
    timeout: timeout ?? 4000,
  });
}

/**
 * Show an error toast notification
 */
function error(title: string, description?: string, timeout?: number) {
  addToast({
    title,
    description,
    color: 'danger',
    variant: 'flat',
    timeout: timeout ?? 5000,
  });
}

/**
 * Show a warning toast notification
 */
function warning(title: string, description?: string, timeout?: number) {
  addToast({
    title,
    description,
    color: 'warning',
    variant: 'flat',
    timeout: timeout ?? 4000,
  });
}

/**
 * Show an info/default toast notification
 */
function info(title: string, description?: string, timeout?: number) {
  addToast({
    title,
    description,
    color: 'default',
    variant: 'flat',
    timeout: timeout ?? 4000,
  });
}

/**
 * Show a custom toast notification with full control
 */
function custom(options: ToastOptions & { color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' }) {
  addToast({
    variant: 'flat',
    timeout: 4000,
    ...options,
  });
}

export const showToast = {
  success,
  error,
  warning,
  info,
  custom,
};

