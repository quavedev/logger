/**
 * Slack transport
 * Sends log messages to Slack via webhooks
 */

import SlackNotify from 'slack-notify';
import { BaseTransport, LogLevels } from './base.js';
import { isDevelopment, getEnvironmentPrefix } from '../utils/environment.js';

/**
 * Slack-specific log levels
 * Maps to different channels/behaviors
 */
export const SlackLevels = {
  VERBOSE: 'verbose',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  ERROR_BACKGROUND: 'error-bg',
  ACTION: 'action',
  BILLING: 'billing',
  SUSPICIOUS: 'suspicious',
};

/**
 * Slack transport implementation
 * Sends structured messages to Slack webhooks
 */
export class SlackTransport extends BaseTransport {
  /**
   * @param {Object} config - Slack transport configuration
   * @param {string} config.webhookUrl - Default Slack webhook URL
   * @param {Object} [config.webhookUrls] - Level-specific webhook URLs
   * @param {string} [config.webhookUrls.warn] - Webhook for warnings
   * @param {string} [config.webhookUrls.error] - Webhook for errors
   * @param {Object} [config.channels] - Level-specific channel overrides
   * @param {string} [config.channelPrefix] - Prefix for auto-generated channel names
   * @param {boolean} [config.skipInDevelopment=true] - Skip sending in dev
   * @param {boolean} [config.enabled=true] - Enable/disable the transport
   * @param {string} [config.appName] - Application name for messages
   */
  constructor(config = {}) {
    super({ ...config, name: 'slack' });

    this.webhookUrl = config.webhookUrl;
    this.webhookUrls = config.webhookUrls || {};
    this.channels = config.channels || {};
    this.channelPrefix = config.channelPrefix || 'logs';
    this.skipInDevelopment =
      config.skipInDevelopment !== undefined ? config.skipInDevelopment : true;
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.appName = config.appName;
  }

  /**
   * Check if this transport should handle the given log level
   * Only handles warn, error, and error-background by default
   *
   * @param {string} level - Log level to check
   * @returns {boolean}
   */
  shouldHandle(level) {
    if (!this.enabled || !this.webhookUrl) {
      return false;
    }

    // Skip in development unless explicitly enabled
    if (this.skipInDevelopment && isDevelopment()) {
      return false;
    }

    // Only send warn and error levels to Slack by default
    return [
      LogLevels.WARN,
      LogLevels.ERROR,
      LogLevels.ERROR_BACKGROUND,
      SlackLevels.WARN,
      SlackLevels.ERROR,
      SlackLevels.ERROR_BACKGROUND,
    ].includes(level);
  }

  /**
   * Send log message to Slack
   *
   * @param {Object} params - Log parameters
   * @param {string} params.level - Log level
   * @param {string} params.message - Log message
   * @param {Object} [params.fields] - Additional fields to include
   * @param {Error|Object} [params.error] - Error object (may have invalid format)
   * @param {string} [params.customChannel] - Override the default channel
   */
  async send({ level, message, fields = {}, error, customChannel }) {
    if (!this.shouldHandle(level)) {
      return;
    }

    try {
      const webhookUrl = this.getWebhookUrl(level);
      const channel = this.getChannel(level, customChannel);
      const slackLevel = this.mapToSlackLevel(level);

      // Check if error format is invalid
      const hasInvalidErrorFormat = fields.errorFormatInvalid === true;

      let finalMessage = message;
      let finalFields = {
        ...(this.appName && { appName: this.appName }),
        ...fields,
      };

      // If error format is invalid, modify message and fields to explain the issue
      if (hasInvalidErrorFormat && error) {
        finalMessage = `${message}\n\n⚠️ *Error Format Issue*: The error object could not be properly formatted for Slack.`;
        
        // Safely extract error type information
        let errorType = 'Unknown';
        try {
          errorType = error?.constructor?.name || typeof error || 'Unknown';
        } catch {
          errorType = typeof error || 'Unknown';
        }

        finalFields = {
          ...finalFields,
          errorFormatIssue: fields.errorFormatError || 'Unknown format issue',
          originalMessage: message,
          errorType,
          ...(fields.errorRawValue && { errorRawValue: fields.errorRawValue }),
          ...(fields.errorRawMessage && { errorRawMessage: fields.errorRawMessage }),
          ...(fields.errorRawReason && { errorRawReason: fields.errorRawReason }),
          ...(fields.errorRawDetails && { errorRawDetails: fields.errorRawDetails }),
        };
      }

      // Safely serialize fields to avoid circular references or non-serializable values
      const safeFields = this.sanitizeFields(finalFields);

      const data = {
        ...(channel && { channel }),
        text: finalMessage,
        fields: safeFields,
      };

      const slack = SlackNotify(webhookUrl);
      await slack.send(data);
    } catch (err) {
      // Silent failure - don't let Slack issues break the application
      // Provide detailed error information even if err.message is undefined
      const errorMessage = err?.message || err?.toString() || String(err) || 'Unknown error';
      const errorName = err?.name || err?.constructor?.name || 'Error';
      const errorStack = err?.stack || 'No stack trace available';
      
      // eslint-disable-next-line no-console
      console.error(
        `[Logger] Failed to send to Slack: ${errorMessage}`,
        `\nError type: ${errorName}`,
        `\nStack: ${errorStack}`
      );
    }
  }

  /**
   * Sanitize fields to ensure they can be safely serialized
   * Handles circular references and non-serializable values
   *
   * @param {Object} fields - Fields to sanitize
   * @returns {Object} Sanitized fields
   */
  sanitizeFields(fields) {
    const sanitized = {};
    const seen = new WeakSet();

    const sanitizeValue = (value, depth = 0) => {
      // Prevent deep recursion
      if (depth > 5) {
        return '[Max depth reached]';
      }

      // Handle null and undefined - keep as is for slack-notify to handle
      if (value === null || value === undefined) {
        return value;
      }

      // Handle primitives - keep as is
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
      }

      // Handle arrays - recursively sanitize elements
      if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, depth + 1));
      }

      // Handle objects (check for circular references)
      if (typeof value === 'object') {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);

        try {
          // Test if it can be stringified (catches circular refs and non-serializable values)
          JSON.stringify(value);
          // If it can be stringified, return as-is (slack-notify will handle it)
          return value;
        } catch (stringifyError) {
          // If stringification fails, try to extract safe properties
          if (value instanceof Error) {
            return {
              name: value.name || 'Error',
              message: value.message || String(value),
              stack: value.stack || undefined,
            };
          }
          // For other objects that can't be stringified, return a safe representation
          return `[Non-serializable ${value.constructor?.name || 'Object'}]`;
        }
      }

      // Fallback: convert to string
      try {
        return String(value);
      } catch {
        return '[Unable to convert to string]';
      }
    };

    for (const [key, value] of Object.entries(fields)) {
      try {
        sanitized[key] = sanitizeValue(value);
      } catch (fieldError) {
        // If sanitization fails for a field, use a safe fallback
        sanitized[key] = `[Error sanitizing field: ${fieldError?.message || 'Unknown'}]`;
      }
    }

    return sanitized;
  }

  /**
   * Get the webhook URL for a specific level
   *
   * @param {string} level - Log level
   * @returns {string} Webhook URL
   */
  getWebhookUrl(level) {
    if (level === LogLevels.WARN && this.webhookUrls.warn) {
      return this.webhookUrls.warn;
    }
    if (
      (level === LogLevels.ERROR || level === LogLevels.ERROR_BACKGROUND) &&
      this.webhookUrls.error
    ) {
      return this.webhookUrls.error;
    }
    return this.webhookUrl;
  }

  /**
   * Get the channel for a specific level
   *
   * @param {string} level - Log level
   * @param {string} [customChannel] - Override channel
   * @returns {string|undefined} Channel name with # prefix, or undefined to use webhook default
   */
  getChannel(level, customChannel) {
    if (customChannel) {
      return customChannel.startsWith('#')
        ? customChannel
        : `#${customChannel}`;
    }

    // Check for level-specific channel override
    const slackLevel = this.mapToSlackLevel(level);
    if (this.channels[slackLevel]) {
      const ch = this.channels[slackLevel];
      return ch.startsWith('#') ? ch : `#${ch}`;
    }

    // Return undefined to use webhook's default channel
    return undefined;
  }

  /**
   * Map internal log level to Slack level
   *
   * @param {string} level - Internal log level
   * @returns {string} Slack level
   */
  mapToSlackLevel(level) {
    switch (level) {
      case LogLevels.ERROR_BACKGROUND:
        return SlackLevels.ERROR_BACKGROUND;
      case LogLevels.ERROR:
        return SlackLevels.ERROR;
      case LogLevels.WARN:
        return SlackLevels.WARN;
      case LogLevels.INFO:
        return SlackLevels.INFO;
      default:
        return level;
    }
  }
}

