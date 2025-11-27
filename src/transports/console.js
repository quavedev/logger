/**
 * Console transport
 * Outputs log messages to the console with appropriate methods
 */

import { BaseTransport, LogLevels } from './base.js';

/**
 * Console transport implementation
 * Maps log levels to appropriate console methods
 */
export class ConsoleTransport extends BaseTransport {
  constructor(config = {}) {
    super({ ...config, name: 'console' });
  }

  /**
   * Send log message to console
   *
   * @param {Object} params - Log parameters
   * @param {string} params.level - Log level
   * @param {string} params.message - Log message
   * @param {Array} [params.args] - Additional arguments to log
   */
  async send({ level, message, args = [] }) {
    const consoleMethod = this.getConsoleMethod(level);
    consoleMethod(message, ...args);
  }

  /**
   * Get the appropriate console method for a log level
   *
   * @param {string} level - Log level
   * @returns {Function} Console method
   */
  getConsoleMethod(level) {
    switch (level) {
      case LogLevels.DEBUG:
        return console.debug.bind(console);
      case LogLevels.VERBOSE:
      case LogLevels.INFO:
        return console.info.bind(console);
      case LogLevels.WARN:
        return console.warn.bind(console);
      case LogLevels.ERROR:
      case LogLevels.ERROR_BACKGROUND:
        return console.error.bind(console);
      default:
        return console.log.bind(console);
    }
  }
}

