# Changelog

## [Unreleased]

## [1.1.0] - 2026-10-15

### Fixed
- `warn(message, error, { customChannel })` now routes to `customChannel`. Before, the option was sent as a Slack field and the message went to the default warn channel
- `warn` no longer prints the `{ customChannel, fields }` options object to the console
- `warn` extracts Slack fields from Error-like objects (`message`/`reason`/`stack`) that are not `instanceof Error`
- Object-valued Slack fields are sent as JSON instead of rendering as `[object Object]`
- `createLogger({ environment })` no longer overwrites `process.env.NODE_ENV` for the whole process; the environment is kept per logger (and per Slack transport)

### Added
- `warn(message, contextObject)`: a plain context object is sent to Slack as one JSON `context` field (truncated at 2,000 characters)
- `SlackTransport` `createClient` option to inject the Slack client (used by tests)
- Test suite (`npm test`, runs on Node and Bun) and CI

## [1.0.4] - 2026-08-12

### Fixed
- Fixed `shouldTreatAsWarning` throwing when `error.reason` (or `error.message`) is a non-string value such as an object

## [1.0.3] - 2025-12-29

### Fixed
- Fixed Slack channel requirement: channels are now optional and will use webhook's default channel if not specified
- Removed auto-generated channel names when no channel is configured

## [1.0.2] - 2025-12-29

### Fixed
- Fixed "Failed to send to Slack: undefined" errors by improving error handling
- Fixed errors not being sent to Slack when error object format is invalid
- Added graceful handling for malformed error objects (non-objects, null, invalid property types)

### Added
- Error format validation with detailed error messages when format issues are detected
- Field sanitization to prevent serialization issues (circular references, non-serializable values)
- Fallback Slack messages explaining error format issues when detected
- Comprehensive error object format documentation in README

### Changed
- Improved error logging to show detailed error information even when errors are undefined
- Enhanced Slack transport to detect and handle invalid error formats gracefully

## [1.0.1] - 2025-11-27

### Changed
- Updated README with comprehensive documentation

## [1.0.0] - 2025-11-27

### Added
- Initial release
- Framework-agnostic logger with console and Slack transports
- Debug mode with pattern-based filtering
- Error classification (treat certain errors as warnings)
- Support for Node.js, Bun, and other JavaScript runtimes
