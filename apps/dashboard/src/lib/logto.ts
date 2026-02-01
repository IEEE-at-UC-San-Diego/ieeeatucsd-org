/**
 * Logto authentication configuration
 *
 * This file provides Logto SDK configuration for the dashboard application.
 * Based on the MIGRATION-PRD.md specification for Logto integration.
 */

import { LogtoConfig } from '@logto/react';

/**
 * Logto configuration object
 * Reads configuration from environment variables
 */
export const logtoConfig: LogtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT || '',
  appId: import.meta.env.VITE_LOGTO_APP_ID || '',
};

/**
 * Validate that required Logto configuration is present
 * @throws Error if configuration is missing
 */
export function validateLogtoConfig(): void {
  const endpoint = import.meta.env.VITE_LOGTO_ENDPOINT;
  const appId = import.meta.env.VITE_LOGTO_APP_ID;

  if (!endpoint) {
    throw new Error(
      'VITE_LOGTO_ENDPOINT is not defined. Please set it in your environment variables.'
    );
  }

  if (!appId) {
    throw new Error(
      'VITE_LOGTO_APP_ID is not defined. Please set it in your environment variables.'
    );
  }
}

/**
 * Get the redirect URI for OAuth callback
 * Defaults to ${VITE_APP_URL}/callback
 */
export function getRedirectUri(): string {
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const configuredRedirectUri = import.meta.env.VITE_LOGTO_REDIRECT_URI;

  return configuredRedirectUri || `${baseUrl}/callback`;
}

/**
 * Get the post-logout redirect URI
 * Defaults to the app base URL
 */
export function getPostLogoutRedirectUri(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}
