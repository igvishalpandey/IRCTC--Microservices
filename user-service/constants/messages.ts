/**
 * Client-facing response messages. Keep all API wording here so it stays consistent and
 * can be reviewed (or localized) in one place. Log messages are not included — they are
 * for operators and live next to the code that emits them.
 */
export const MESSAGES = {
  COMMON: {
    SUCCESS: 'Success',
    BAD_REQUEST: 'Bad request',
    INVALID_REQUEST: 'Invalid request',
    MALFORMED_JSON: 'Malformed JSON body',
    PAYLOAD_TOO_LARGE: 'Request body is too large',
    VALIDATION_FAILED: 'Validation failed',
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'You do not have permission to perform this action',
    NOT_FOUND: 'Resource not found',
    ROUTE_NOT_FOUND: (method: string, path: string) => `Route ${method} ${path} not found`,
    CONFLICT: 'Resource already exists',
    TOO_MANY_REQUESTS: 'Too many requests, please try again later',
    INTERNAL_ERROR: 'Internal Server Error',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  },

  VALIDATION: {
    AT_LEAST_ONE_FIELD: 'At least one field is required',
  },

  USER: {
    LIST_SUCCESS: 'Users retrieved successfully',
    FETCH_SUCCESS: 'User retrieved successfully',
    CREATED: 'User created successfully',
    UPDATED: 'User updated successfully',
    DELETED: 'User deleted successfully',
    NOT_FOUND: 'User not found',
    EMAIL_EXISTS: 'A user with this email already exists',
  },
} as const;
