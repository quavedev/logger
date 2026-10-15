/**
 * Core Logger Implementation
 * Framework-agnostic logger with support for multiple transports
 */

import { LogLevels } from './transports/base.js';
import { ConsoleTransport } from './transports/console.js';
import { SlackTransport } from './transports/slack.js';
import {
  extractErrorFields,
  shouldTreatAsWarning,
  DEFAULT_WARNING_PATTERNS,
} from './utils/errors.js';
import { getEnvironment, ENVIRONMENT_DEVELOPMENT } from './utils/environment.js';

const MAX_CONTEXT_LENGTH = 2000;
const WARN_OPTION_KEYS = new Set(['customChannel', 'fields']);

const isPlainObject = (value) =>
  value != null &&
  typeof value === 'object' &&
  Object.getPrototypeOf(value) === Object.prototype;

const isErrorLike = (value) =>
  value instanceof Error ||
  (value != null &&
    typeof value === 'object' &&
    (value.message != null || value.reason != null || value.stack != null));

// `{ customChannel, fields }` is the options object of `warn`. Anything else
// in a plain object is context.
const isWarnOptions = (value) =>
  isPlainObject(value) &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => WARN_OPTION_KEYS.has(key));

/**
 * Serialize a plain context object into one bounded Slack field
 *
 * @param {Object} context - Context passed as the second `warn` argument
 * @returns {Object} `{ context }` field, or an empty object
 */
function getContextFields(context) {
  if (!isPlainObject(context) || isErrorLike(context)) {
    return {};
  }
  if (!Object.keys(context).length) {
    return {};
  }
  let serialized;
  try {
    serialized = JSON.stringify(context);
  } catch {
    return {};
  }
  return {
    context:
      serialized.length > MAX_CONTEXT_LENGTH
        ? `${serialized.slice(0, MAX_CONTEXT_LENGTH)}…`
        : serialized,
  };
}

/**
 * Check if debug mode is enabled for a given filter text
 *
 * @param {boolean} debugEnabled - Whether debug is globally enabled
 * @param {string|string[]|null} filter - Filter pattern(s)
 * @param {string} filterText - Text to match against filter
 * @returns {boolean} True if debug is allowed
 */
function isDebugAllowed(debugEnabled, filter, filterText) {
  if (!debugEnabled) {
    return false;
  }

  // No filter means all debug is allowed
  if (!filter || !filterText) {
    return true;
  }

  // Handle string filter
  if (typeof filter === 'string') {
    try {
      return Boolean(filterText.match(new RegExp(filter, 'i')));
    } catch {
      return filterText.includes(filter);
    }
  }

  // Handle array of filters
  if (Array.isArray(filter)) {
    return filter.filter(Boolean).some((f) => {
      try {
        return Boolean(filterText.match(new RegExp(f, 'i')));
      } catch {
        return filterText.includes(f);
      }
    });
  }

  return true;
}

/**
 * Validate error logging arguments
 * Error should have 1-2 arguments: message required, error optional
 *
 * @param {Array} args - Arguments passed to error method
 * @returns {boolean} True if arguments are valid
 */
function validateErrorArgs(args) {
  if (!args.length || args.length > 2) {
    // eslint-disable-next-line no-console
    console.trace(
      `[Logger] error() should have 1-2 arguments: message (required) and error (optional)`
    );
    return false;
  }
  return true;
}

/**
 * Create a new logger instance
 *
 * @param {Object} config - Logger configuration
 * @param {string} [config.appName] - Application name for identification
 * @param {string} [config.environment] - Environment (production/staging/development)
 * @param {Object} [config.debug] - Debug configuration
 * @param {boolean} [config.debug.enabled=false] - Enable debug mode
 * @param {string|string[]} [config.debug.filter] - Filter pattern(s) for debug
 * @param {Object} [config.slack] - Slack transport configuration
 * @param {boolean} [config.slack.enabled=true] - Enable Slack transport
 * @param {string} [config.slack.webhookUrl] - Slack webhook URL
 * @param {Object} [config.slack.webhookUrls] - Level-specific webhook URLs
 * @param {Object} [config.slack.channels] - Level-specific channels
 * @param {string} [config.slack.channelPrefix] - Prefix for channel names
 * @param {boolean} [config.slack.skipInDevelopment=true] - Skip Slack in dev
 * @param {string[]} [config.errorsToTreatAsWarnings] - Error patterns to downgrade
 * @param {Array} [config.transports] - Additional custom transports
 * @returns {Object} Logger instance
 *
 * @example
 * const logger = createLogger({
 *   appName: 'my-app',
 *   debug: { enabled: true, filter: 'API' },
 *   slack: {
 *     webhookUrl: process.env.SLACK_WEBHOOK_URL,
 *     channels: { error: '#app-errors' }
 *   }
 * });
 */
export function createLogger(config = {}) {
  const {
    appName,
    debug: debugConfig = {},
    slack: slackConfig = {},
    errorsToTreatAsWarnings = DEFAULT_WARNING_PATTERNS,
    transports: customTransports = [],
  } = config;

  // Resolved once per logger. Never written back to process.env: NODE_ENV
  // changes how frameworks and libraries behave for the whole process.
  const environment = config.environment || getEnvironment();
  const isDevelopmentEnv = () => environment === ENVIRONMENT_DEVELOPMENT;

  // Initialize transports
  const transports = [
    // Console transport is always enabled
    new ConsoleTransport(),
  ];

  // Add Slack transport if configured
  if (slackConfig.webhookUrl) {
    transports.push(
      new SlackTransport({
        ...slackConfig,
        appName,
        environment,
      })
    );
  }

  // Add custom transports
  transports.push(...customTransports);

  /**
   * Send log to all applicable transports
   *
   * @param {Object} params - Log parameters
   */
  async function sendToTransports({
    level,
    message,
    args,
    fields,
    error,
    customChannel,
  }) {
    const promises = transports
      .filter((transport) => transport.shouldHandle(level))
      .map((transport) =>
        transport.send({
          level,
          message,
          args,
          fields: {
            ...fields,
            ...extractErrorFields(error),
          },
          error,
          customChannel,
        })
      );

    // Fire and forget - don't block on transport delivery
    Promise.all(promises).catch((err) => {
      // Provide detailed error information even if err.message is undefined
      const errorMessage = err?.message || err?.toString() || String(err) || 'Unknown error';
      const errorName = err?.name || err?.constructor?.name || 'Error';
      // eslint-disable-next-line no-console
      console.error(
        `[Logger] Transport error: ${errorMessage}`,
        `\nError type: ${errorName}`
      );
    });
  }

  return {
    /**
     * Log general messages (console only)
     * @param {...any} args - Arguments to log
     */
    log(...args) {
      sendToTransports({
        level: 'log',
        message: args[0],
        args: args.slice(1),
      });
    },

    /**
     * Log informational messages (console only)
     * @param {...any} args - Arguments to log
     */
    info(...args) {
      sendToTransports({
        level: LogLevels.INFO,
        message: args[0],
        args: args.slice(1),
      });
    },

    /**
     * Log warning messages (console + Slack in production)
     *
     * @param {string} message - Warning message
     * @param {Error|Object} [errorOrContext] - Optional Error, or a plain
     *   context object (sent to Slack as one JSON `context` field)
     * @param {Object} [options] - Optional options
     * @param {string} [options.customChannel] - Custom Slack channel
     * @param {Object} [options.fields] - Additional fields for Slack
     */
    warn(...args) {
      const [message, ...rest] = args;
      const options = isWarnOptions(rest[rest.length - 1])
        ? rest.pop()
        : undefined;
      const [errorOrContext] = rest;
      const error = isErrorLike(errorOrContext) ? errorOrContext : undefined;

      sendToTransports({
        level: LogLevels.WARN,
        message,
        // The console prints the data, never the options object.
        args: rest,
        fields: {
          ...(options?.fields || {}),
          ...(!error && getContextFields(errorOrContext)),
        },
        error,
        customChannel: options?.customChannel,
      });
    },

    /**
     * Log error messages (console + Slack in production)
     *
     * IMPORTANT: Must be called with 1-2 arguments:
     * - 1 argument: message only
     * - 2 arguments: message + error object
     *
     * @param {string} message - Error message (required)
     * @param {Error} [error] - Error object (optional)
     */
    error(...args) {
      if (!validateErrorArgs(args)) {
        if (isDevelopmentEnv()) {
          return;
        }
      }

      const message = args[0];
      const error = args[1];

      // Check if this error should be treated as a warning
      if (error && shouldTreatAsWarning(error, errorsToTreatAsWarnings)) {
        sendToTransports({
          level: LogLevels.WARN,
          message: `${message} [error treated as warn]`,
          args: [error],
          error,
        });
        return;
      }

      sendToTransports({
        level: LogLevels.ERROR,
        message,
        args: error ? [error] : [],
        error,
      });
    },

    /**
     * Log background error messages (console + Slack in production)
     * Use for errors in background tasks that don't block user actions
     *
     * IMPORTANT: Must be called with 1-2 arguments:
     * - 1 argument: message only
     * - 2 arguments: message + error object
     *
     * @param {string} message - Error message (required)
     * @param {Error} [error] - Error object (optional)
     */
    errorBackground(...args) {
      if (!validateErrorArgs(args)) {
        if (isDevelopmentEnv()) {
          return;
        }
      }

      const message = args[0];
      const error = args[1];

      // Check if this error should be treated as a warning
      if (error && shouldTreatAsWarning(error, errorsToTreatAsWarnings)) {
        sendToTransports({
          level: LogLevels.WARN,
          message: `${message} [background error treated as warn]`,
          args: [error],
          error,
        });
        return;
      }

      sendToTransports({
        level: LogLevels.ERROR_BACKGROUND,
        message,
        args: error ? [error] : [],
        error,
        fields: { isBackground: true },
      });
    },

    /**
     * Log debug messages (console only, when debug enabled and filter matches)
     *
     * @param {string} filterText - Text to match against debug filter
     * @param {...any} args - Additional arguments to log
     */
    debug(...args) {
      if (isDebugAllowed(debugConfig.enabled, debugConfig.filter, args[0])) {
        sendToTransports({
          level: LogLevels.DEBUG,
          message: args[0],
          args: args.slice(1),
        });
      }
    },

    /**
     * Check if debug mode is enabled for a given filter text
     *
     * @param {string} filterText - Text to check against filter
     * @returns {boolean} True if debug is allowed
     */
    isDebugModeOn(filterText) {
      return isDebugAllowed(debugConfig.enabled, debugConfig.filter, filterText);
    },

    /**
     * Send a custom message to Slack (bypasses console)
     * Useful for sending notifications or custom alerts
     *
     * @param {Object} params - Message parameters
     * @param {string} params.message - Message text
     * @param {Object} [params.fields] - Additional fields
     * @param {string} [params.level] - Log level for channel routing
     * @param {string} [params.customChannel] - Override channel
     */
    async sendToSlack({ message, fields = {}, level = LogLevels.INFO, customChannel }) {
      const slackTransport = transports.find((t) => t.name === 'slack');
      if (slackTransport) {
        await slackTransport.send({ level, message, fields, customChannel });
      }
    },

    /**
     * Get all registered transports
     * Useful for testing or adding dynamic transports
     *
     * @returns {Array} Array of transport instances
     */
    getTransports() {
      return [...transports];
    },

    /**
     * Add a new transport at runtime
     *
     * @param {BaseTransport} transport - Transport instance to add
     */
    addTransport(transport) {
      transports.push(transport);
    },
  };
}

