/**
 * Base transport interface
 * All transports should implement this interface
 */

/**
 * Log levels enum
 * @readonly
 * @enum {string}
 */
export const LogLevels = {
  DEBUG: 'debug',
  VERBOSE: 'verbose',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  ERROR_BACKGROUND: 'error-background',
};

/**
 * Base transport class
 * Provides common functionality and defines the interface for all transports
 *
 * @abstract
 */
export class BaseTransport {
  /**
   * @param {Object} config - Transport configuration
   * @param {string} [config.name] - Transport name for identification
   */
  constructor(config = {}) {
    this.name = config.name || 'base';
    this.config = config;
  }

  /**
   * Send a log message through this transport
   * Must be implemented by subclasses
   *
   * @abstract
   * @param {Object} params - Log parameters
   * @param {string} params.level - Log level
   * @param {string} params.message - Log message
   * @param {Object} [params.fields] - Additional fields
   * @param {Error} [params.error] - Error object if present
   * @param {Object} [params.context] - Additional context
   * @returns {Promise<void>}
   */
  async send(params) {
    throw new Error('send() must be implemented by subclass');
  }

  /**
   * Check if this transport should handle the given log level
   *
   * @param {string} level - Log level to check
   * @returns {boolean}
   */
  shouldHandle(level) {
    return true;
  }
}

