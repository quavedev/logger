import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, SlackTransport } from '../src/index.js';

const WEBHOOK_URL = 'https://hooks.slack.com/services/test';

const createSlackClient = () => {
  const sent = [];
  return {
    sent,
    createClient: () => ({
      send: async (data) => {
        sent.push(data);
      },
    }),
  };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

const buildLogger = ({ environment = 'production', ...slack } = {}) => {
  const client = createSlackClient();
  const logger = createLogger({
    appName: 'test-app',
    environment,
    slack: {
      webhookUrl: WEBHOOK_URL,
      channels: { warn: '#app-warn', error: '#app-error' },
    },
  });
  // Swap the default slack-notify client for a recorder.
  const slackTransport = logger
    .getTransports()
    .find((transport) => transport.name === 'slack');
  slackTransport.createClient = client.createClient;
  Object.assign(slackTransport, slack);
  return { logger, sent: client.sent };
};

// Runtime-agnostic console stub: Bun's node:test has no `mock.method`.
const stubConsole = (methods) => {
  const originals = {};
  const calls = {};
  methods.forEach((name) => {
    originals[name] = console[name];
    calls[name] = [];
    console[name] = (...args) => calls[name].push(args);
  });
  return {
    calls,
    restore: () => Object.assign(console, originals),
  };
};

describe('createLogger', () => {
  let consoleStub;

  beforeEach(() => {
    consoleStub = stubConsole(['warn', 'error', 'info', 'trace']);
  });

  afterEach(() => {
    consoleStub.restore();
  });

  it('does not overwrite process.env.NODE_ENV', () => {
    const before = process.env.NODE_ENV;
    createLogger({ environment: 'staging' });
    assert.equal(process.env.NODE_ENV, before);
  });

  it('routes warn to customChannel without sending it as a field', async () => {
    const { logger, sent } = buildLogger();

    logger.warn('Prometheus failed', new Error('timeout'), {
      customChannel: 'metrics-warn',
    });
    await flush();

    assert.equal(sent.length, 1);
    assert.equal(sent[0].channel, '#metrics-warn');
    assert.equal(sent[0].fields.errorMessage, 'timeout');
    assert.equal('customChannel' in sent[0].fields, false);
  });

  it('uses the level channel when no customChannel is given', async () => {
    const { logger, sent } = buildLogger();

    logger.warn('Rate limit approaching');
    await flush();

    assert.equal(sent[0].channel, '#app-warn');
  });

  it('does not print the options object to the console', async () => {
    const { logger } = buildLogger();
    const error = new Error('boom');

    logger.warn('Failed', error, { customChannel: 'x', fields: { a: 1 } });
    await flush();

    assert.deepEqual(consoleStub.calls.warn[0], ['Failed', error]);
  });

  it('sends a plain context object as one JSON context field', async () => {
    const { logger, sent } = buildLogger();

    logger.warn('Retry scheduled', { appEnvId: 'env1', attempt: 2 });
    await flush();

    assert.equal(sent[0].fields.context, '{"appEnvId":"env1","attempt":2}');
    assert.deepEqual(consoleStub.calls.warn[0], [
      'Retry scheduled',
      { appEnvId: 'env1', attempt: 2 },
    ]);
  });

  it('truncates a large context', async () => {
    const { logger, sent } = buildLogger();

    logger.warn('Big', { data: 'x'.repeat(5000) });
    await flush();

    assert.equal(sent[0].fields.context.length, 2001);
  });

  it('extracts fields from an Error-like object that is not an Error', async () => {
    const { logger, sent } = buildLogger();

    logger.warn('Meteor error', { message: 'not-found', reason: 'Gone' });
    await flush();

    assert.equal(sent[0].fields.errorMessage, 'not-found');
    assert.equal(sent[0].fields.errorReason, 'Gone');
    assert.equal('context' in sent[0].fields, false);
  });

  it('keeps explicit fields from the options object', async () => {
    const { logger, sent } = buildLogger();

    logger.warn('Tool failed', undefined, { fields: { toolName: 'get-logs' } });
    await flush();

    assert.equal(sent[0].fields.toolName, 'get-logs');
  });

  it('skips Slack when the logger environment is development', async () => {
    const { logger, sent } = buildLogger({ environment: 'development' });

    logger.error('Failed', new Error('boom'));
    await flush();

    assert.equal(sent.length, 0);
  });

  it('sends errors to the error channel', async () => {
    const { logger, sent } = buildLogger();

    logger.error('Failed', new Error('boom'));
    await flush();

    assert.equal(sent[0].channel, '#app-error');
    assert.equal(sent[0].fields.errorMessage, 'boom');
  });
});

describe('SlackTransport', () => {
  it('serializes object fields so Slack does not show [object Object]', () => {
    const transport = new SlackTransport({ webhookUrl: WEBHOOK_URL });

    assert.deepEqual(transport.sanitizeFields({ a: { b: 1 }, c: 'x', d: 2 }), {
      a: '{"b":1}',
      c: 'x',
      d: 2,
    });
  });
});
