# Changelog

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
