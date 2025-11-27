/**
 * Error handling utilities
 * Extracts structured information from Error objects
 */

/**
 * Extract structured fields from an Error object
 * Handles both standard Error objects and custom error types with reason/details
 *
 * @param {Error|Object} error - Error object to extract fields from
 * @returns {Object} Extracted error fields
 * @property {string} [errorMessage] - Error message
 * @property {string} [errorReason] - Error reason (for custom errors)
 * @property {string} [errorDetails] - Error details (for custom errors)
 * @property {string} [errorStack] - Error stack trace
 *
 * @example
 * const fields = extractErrorFields(new Error('Something failed'));
 * // { errorMessage: 'Something failed', errorStack: '...' }
 */
export function extractErrorFields(error) {
  if (!error) {
    return {};
  }

  return {
    ...(error.message && { errorMessage: error.message }),
    ...(error.reason && { errorReason: error.reason }),
    ...(error.details && { errorDetails: error.details }),
    ...(error.stack && { errorStack: error.stack }),
  };
}

/**
 * Check if an error should be treated as a warning based on its message
 * Some errors are expected and shouldn't trigger alerts
 *
 * @param {Error|Object} error - Error to check
 * @param {string[]} patterns - Array of message patterns to match
 * @returns {boolean} True if error should be treated as warning
 *
 * @example
 * const patterns = ['User not found', 'Rate limit'];
 * shouldTreatAsWarning(new Error('User not found'), patterns); // true
 * shouldTreatAsWarning(new Error('Database error'), patterns); // false
 */
export function shouldTreatAsWarning(error, patterns = []) {
  if (!error || !patterns.length) {
    return false;
  }

  const message = error.message || '';
  const reason = error.reason || '';

  return patterns.some(
    (pattern) => message.includes(pattern) || reason.includes(pattern)
  );
}

/**
 * Default error patterns that should be treated as warnings
 * These are common non-critical errors that don't need immediate attention
 */
export const DEFAULT_WARNING_PATTERNS = [
  'User not found',
  'Failed to fetch',
  'Load failed',
  'Network error',
  'Timeout',
];

