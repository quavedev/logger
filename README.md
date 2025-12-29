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
    // If not specified, messages will be sent to the webhook's default channel
    channels: {
      info: '#app-logs',
      warn: '#app-warnings',
      error: '#app-errors',
      'error-bg': '#app-errors-background',
    },
    
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

### Error Object Format

When passing an error object to `logger.error()` or `logger.errorBackground()`, the logger expects a standard Error object or an object with compatible properties. The logger will extract the following fields:

**Expected Error Object Structure:**

```javascript
{
  message?: string | number,    // Error message (required for standard Error objects)
  reason?: string | number,      // Custom error reason (optional)
  details?: string | number,     // Custom error details (optional)
  stack?: string                  // Stack trace (optional, usually auto-generated)
}
```

**Valid Error Examples:**

```javascript
// Standard Error object (recommended)
try {
  throw new Error('Something went wrong');
} catch (error) {
  logger.error('[API] Operation failed', error);
}

// Custom error object with reason/details
const customError = {
  message: 'Validation failed',
  reason: 'Invalid input',
  details: 'Email format is incorrect',
  stack: new Error().stack
};
logger.error('[API] Validation error', customError);

// Error with just message
logger.error('[API] Failed', { message: 'Connection timeout' });
```

**Invalid Error Formats:**

The logger will detect and handle invalid error formats gracefully. If an error object has unexpected types or structure, a fallback message will be sent to Slack explaining the format issue:

```javascript
// ❌ These will trigger format warnings:
logger.error('[API] Failed', 'string error');           // Error is not an object
logger.error('[API] Failed', null);                     // Error is null
logger.error('[API] Failed', { message: {} });          // message is not string/number
logger.error('[API] Failed', { reason: [] });           // reason is not string/number
logger.error('[API] Failed', { stack: 123 });           // stack is not string
```

When an invalid format is detected:
- The original error message is still sent to Slack
- A warning is included explaining the format issue
- The raw error value is included for debugging
- The error type and format error details are logged

**Best Practices:**

1. **Always use Error objects** when possible:
   ```javascript
   try {
     // your code
   } catch (error) {
     logger.error('[API] Operation failed', error); // ✅ Good
   }
   ```

2. **For custom errors**, ensure properties are strings or numbers:
   ```javascript
   const customError = {
     message: String(errorMessage),  // ✅ Convert to string
     reason: String(reason),         // ✅ Convert to string
     details: JSON.stringify(data),  // ✅ Serialize objects
   };
   logger.error('[API] Custom error', customError);
   ```

3. **Avoid passing non-object types** directly:
   ```javascript
   // ❌ Bad
   logger.error('[API] Failed', 'error string');
   logger.error('[API] Failed', 404);
   
   // ✅ Good
   logger.error('[API] Failed', new Error('error string'));
   logger.error('[API] Failed', { message: 'Status code: 404' });
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
  - `errorFormatInvalid`, `errorFormatError`, `errorRawValue`: Error format validation info (if format is invalid)
  - Any custom fields you provide

**Error Format Handling:**

If an error object has an unexpected format, the logger will:
- Still send the original message to Slack
- Include a warning explaining the format issue
- Add fields like `errorFormatIssue`, `errorType`, and `errorRawValue` for debugging
- Preserve the original message in `originalMessage` field

This ensures that even when error objects are malformed, you'll still receive notifications in Slack with information about what went wrong.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT © [Quave](https://quave.dev)

