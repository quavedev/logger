# @quave/logger

A framework-agnostic logger with Slack integration for Node.js, Bun, and any JavaScript runtime.

## Features

- 🚀 **Framework Independent** - Works with Node.js, Bun, Deno, and any JS runtime
- 📢 **Slack Integration** - Send errors and warnings to Slack channels
- 🔍 **Debug Filtering** - Enable debug mode with pattern-based filtering
- ⚡ **Multiple Transports** - Console and Slack out of the box, extensible for custom transports
- 🎯 **Error Classification** - Automatically downgrade certain errors to warnings
- 🔒 **Production Ready** - Smart defaults for production environments

## Installation

```bash
npm install @quave/logger
# or
bun add @quave/logger
# or
yarn add @quave/logger
```

## Quick Start

```javascript
import { createLogger } from '@quave/logger';

const logger = createLogger({
  appName: 'my-app',
});

logger.info('[API] Server started on port 3000');
logger.warn('[API] Rate limit approaching');
logger.error('[API] Database connection failed', error);
logger.debug('[API] Request details', { id: 123 });
```

## Configuration

### Full Configuration Example

```javascript
import { createLogger } from '@quave/logger';

const logger = createLogger({
  // Application identification
  appName: 'my-app',
  environment: 'production', // 'development' | 'staging' | 'production'

  // Debug configuration
  debug: {
    enabled: true,
    filter: ['API', 'Database'], // Array of regex patterns
  },

  // Slack transport configuration
  slack: {
    enabled: true,
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    
    // Optional: different webhooks for different levels
    webhookUrls: {
      warn: process.env.SLACK_WARN_WEBHOOK,
      error: process.env.SLACK_ERROR_WEBHOOK,
    },
    
    // Optional: custom channels per level
    channels: {
      info: '#app-logs',
      warn: '#app-warnings',
      error: '#app-errors',
      'error-bg': '#app-errors-background',
    },
    
    // Optional: prefix for auto-generated channel names
    channelPrefix: 'myapp',
    
    // Skip Slack in development (default: true)
    skipInDevelopment: true,
  },

  // Error messages to treat as warnings (won't trigger error alerts)
  errorsToTreatAsWarnings: [
    'User not found',
    'Failed to fetch',
    'Rate limit exceeded',
  ],
});
```

### Environment Variables

You can also configure via environment variables:

```bash
NODE_ENV=production
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## API Reference

### Logger Methods

#### `logger.log(...args)`
Basic logging to console only.

```javascript
logger.log('Server starting...');
logger.log('Config loaded', { port: 3000 });
```

#### `logger.info(...args)`
Informational messages to console only.

```javascript
logger.info('[API] Request received', { method: 'POST', path: '/users' });
```

#### `logger.warn(message, [error], [options])`
Warning messages to console and Slack (in production).

```javascript
logger.warn('[API] Rate limit approaching');
logger.warn('[API] Slow query detected', error);
logger.warn('[API] Custom alert', error, { 
  customChannel: 'alerts',
  fields: { userId: '123' }
});
```

#### `logger.error(message, [error])`
Error messages to console and Slack (in production).

**Important**: Must be called with 1-2 arguments only.

```javascript
logger.error('[API] Database connection failed');
logger.error('[API] Authentication failed', error);
```

#### `logger.errorBackground(message, [error])`
Background errors that don't block user actions. Routed to a separate Slack channel.

```javascript
logger.errorBackground('[CRON] Sync job failed', error);
logger.errorBackground('[QUEUE] Message processing failed');
```

#### `logger.debug(filterText, ...args)`
Debug messages (only shown when debug mode is enabled and filter matches).

```javascript
logger.debug('[API] Request details', { headers, body });
logger.debug('[Database] Query executed', { query, duration });
```

#### `logger.isDebugModeOn(filterText)`
Check if debug mode is enabled for a specific filter.

```javascript
if (logger.isDebugModeOn('[API]')) {
  // Do expensive debug computation
}
```

### Direct Slack Access

#### `logger.sendToSlack(params)`
Send a message directly to Slack (bypasses console).

```javascript
await logger.sendToSlack({
  message: 'Deployment completed successfully',
  fields: { version: '1.2.3', environment: 'production' },
  level: 'info',
  customChannel: '#deployments',
});
```

### Transport Management

#### `logger.getTransports()`
Get all registered transports.

```javascript
const transports = logger.getTransports();
console.log(transports.map(t => t.name)); // ['console', 'slack']
```

#### `logger.addTransport(transport)`
Add a custom transport at runtime.

```javascript
import { BaseTransport } from '@quave/logger';

class MyTransport extends BaseTransport {
  async send({ level, message, fields }) {
    // Custom logic
  }
}

logger.addTransport(new MyTransport());
```

## Custom Transports

Create custom transports by extending `BaseTransport`:

```javascript
import { BaseTransport, LogLevels } from '@quave/logger';

class DatadogTransport extends BaseTransport {
  constructor(config) {
    super({ ...config, name: 'datadog' });
    this.apiKey = config.apiKey;
  }

  shouldHandle(level) {
    // Only handle errors
    return [LogLevels.ERROR, LogLevels.ERROR_BACKGROUND].includes(level);
  }

  async send({ level, message, fields, error }) {
    // Send to Datadog API
    await fetch('https://api.datadoghq.com/api/v1/logs', {
      method: 'POST',
      headers: {
        'DD-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        level,
        ...fields,
      }),
    });
  }
}

const logger = createLogger({
  appName: 'my-app',
  transports: [new DatadogTransport({ apiKey: process.env.DD_API_KEY })],
});
```

## Utility Exports

The package also exports utilities you can use independently:

```javascript
import {
  // Error utilities
  extractErrorFields,
  shouldTreatAsWarning,
  DEFAULT_WARNING_PATTERNS,
  
  // Environment utilities
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironment,
  
  // Transport classes
  BaseTransport,
  ConsoleTransport,
  SlackTransport,
  LogLevels,
  SlackLevels,
} from '@quave/logger';
```

## Slack Message Format

Messages sent to Slack include:

- **text**: The log message
- **fields**: Structured data including:
  - `appName`: Your application name
  - `errorMessage`, `errorReason`, `errorDetails`, `errorStack`: Error info (if error provided)
  - Any custom fields you provide

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT © [Quave](https://quave.dev)

