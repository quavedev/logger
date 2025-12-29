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
 * @property {boolean} [errorFormatInvalid] - True if error format was unexpected
 * @property {string} [errorFormatError] - Description of format issue if present
 *
 * @example
 * const fields = extractErrorFields(new Error('Something failed'));
 * // { errorMessage: 'Something failed', errorStack: '...' }
 */
export function extractErrorFields(error) {
  if (!error) {
    return {};
  }

  try {
    // Validate that error is an object-like structure
    if (typeof error !== 'object') {
      return {
        errorFormatInvalid: true,
        errorFormatError: `Expected error to be an object, but received ${typeof error}`,
        errorRawValue: String(error),
      };
    }

    // Handle null (typeof null === 'object' in JavaScript)
    if (error === null) {
      return {
        errorFormatInvalid: true,
        errorFormatError: 'Error object is null',
      };
    }

    // Safely extract fields with type checking
    const fields = {};
    
    if (error.message !== undefined) {
      const messageValue = error.message;
      if (typeof messageValue === 'string' || typeof messageValue === 'number') {
        fields.errorMessage = String(messageValue);
      } else {
        fields.errorFormatInvalid = true;
        fields.errorFormatError = 'error.message must be a string or number';
        fields.errorRawMessage = String(messageValue);
      }
    }

    if (error.reason !== undefined) {
      const reasonValue = error.reason;
      if (typeof reasonValue === 'string' || typeof reasonValue === 'number') {
        fields.errorReason = String(reasonValue);
      } else {
        fields.errorFormatInvalid = true;
        fields.errorFormatError = fields.errorFormatError 
          ? `${fields.errorFormatError}; error.reason must be a string or number`
          : 'error.reason must be a string or number';
        fields.errorRawReason = String(reasonValue);
      }
    }

    if (error.details !== undefined) {
      const detailsValue = error.details;
      if (typeof detailsValue === 'string' || typeof detailsValue === 'number') {
        fields.errorDetails = String(detailsValue);
      } else {
        fields.errorFormatInvalid = true;
        fields.errorFormatError = fields.errorFormatError 
          ? `${fields.errorFormatError}; error.details must be a string or number`
          : 'error.details must be a string or number';
        fields.errorRawDetails = String(detailsValue);
      }
    }

    if (error.stack !== undefined) {
      const stackValue = error.stack;
      if (typeof stackValue === 'string') {
        fields.errorStack = stackValue;
      } else {
        fields.errorFormatInvalid = true;
        fields.errorFormatError = fields.errorFormatError 
          ? `${fields.errorFormatError}; error.stack must be a string`
          : 'error.stack must be a string';
      }
    }

    return fields;
  } catch (extractionError) {
    // If extraction itself fails, return a safe error indicator
    return {
      errorFormatInvalid: true,
      errorFormatError: `Failed to extract error fields: ${extractionError.message}`,
      errorRawValue: String(error),
    };
  }
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

