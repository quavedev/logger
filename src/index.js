/**
 * @quave/logger
 *
 * Framework-agnostic logger with Slack integration
 * Works with Node.js, Bun, and any JavaScript runtime
 *
 * @example
 * import { createLogger } from '@quave/logger';
 *
 * const logger = createLogger({
 *   appName: 'my-app',
 *   slack: {
 *     webhookUrl: process.env.SLACK_WEBHOOK_URL,
 *   },
 * });
 *
 * logger.info('Server started');
 * logger.warn('Rate limit approaching');
 * logger.error('Database connection failed', error);
 */

// Main exports
export { createLogger } from './logger.js';

// Transport exports (for custom transports)
export { BaseTransport, LogLevels } from './transports/base.js';
export { ConsoleTransport } from './transports/console.js';
export { SlackTransport, SlackLevels } from './transports/slack.js';

// Utility exports
export {
  extractErrorFields,
  shouldTreatAsWarning,
  DEFAULT_WARNING_PATTERNS,
} from './utils/errors.js';

export {
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironment,
  getEnvironmentPrefix,
  ENVIRONMENT_PRODUCTION,
  ENVIRONMENT_STAGING,
  ENVIRONMENT_DEVELOPMENT,
} from './utils/environment.js';

