/**
 * Environment detection utilities
 * Framework-agnostic environment detection based on NODE_ENV
 */

export const ENVIRONMENT_PRODUCTION = 'production';
export const ENVIRONMENT_STAGING = 'staging';
export const ENVIRONMENT_DEVELOPMENT = 'development';

/**
 * Get the current environment from NODE_ENV
 * @returns {string} Current environment name
 */
export function getEnvironment() {
  return process.env.NODE_ENV || ENVIRONMENT_DEVELOPMENT;
}

/**
 * Check if running in production environment
 * @returns {boolean}
 */
export function isProduction() {
  return getEnvironment() === ENVIRONMENT_PRODUCTION;
}

/**
 * Check if running in staging environment
 * @returns {boolean}
 */
export function isStaging() {
  return getEnvironment() === ENVIRONMENT_STAGING;
}

/**
 * Check if running in development environment
 * @returns {boolean}
 */
export function isDevelopment() {
  return getEnvironment() === ENVIRONMENT_DEVELOPMENT;
}

/**
 * Get environment suffix for channel names
 * @returns {string} Environment prefix (empty for production)
 */
export function getEnvironmentPrefix() {
  const env = getEnvironment();
  if (env === ENVIRONMENT_PRODUCTION) {
    return '';
  }
  return `${env}-`;
}

