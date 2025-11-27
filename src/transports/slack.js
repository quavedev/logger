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
   * @param {string} [params.customChannel] - Override the default channel
   */
  async send({ level, message, fields = {}, customChannel }) {
    if (!this.shouldHandle(level)) {
      return;
    }

    try {
      const webhookUrl = this.getWebhookUrl(level);
      const channel = this.getChannel(level, customChannel);
      const slackLevel = this.mapToSlackLevel(level);

      const data = {
        ...(channel && { channel }),
        text: message,
        fields: {
          ...(this.appName && { appName: this.appName }),
          ...fields,
        },
      };

      const slack = SlackNotify(webhookUrl);
      await slack.send(data);
    } catch (err) {
      // Silent failure - don't let Slack issues break the application
      // eslint-disable-next-line no-console
      console.error(`[Logger] Failed to send to Slack: ${err.message}`);
    }
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
   * @returns {string|null} Channel name with # prefix
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

    // Generate default channel name with environment prefix
    const envPrefix = getEnvironmentPrefix();
    return `#${this.channelPrefix}-${envPrefix}${slackLevel}`;
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

