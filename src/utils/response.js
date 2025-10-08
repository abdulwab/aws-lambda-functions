/**
 * Standard API response utilities for Lambda functions
 */

const createResponse = (statusCode, body, headers = {}) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      ...headers
    },
    body: JSON.stringify(body)
  };
};

const success = (data, statusCode = 200) => {
  return createResponse(statusCode, {
    success: true,
    data
  });
};

const error = (message, statusCode = 400, details = null) => {
  return createResponse(statusCode, {
    success: false,
    error: {
      message,
      details
    }
  });
};

const serverError = (message = 'Internal server error', details = null) => {
  return error(message, 500, details);
};

const notFound = (message = 'Resource not found') => {
  return error(message, 404);
};

const badRequest = (message = 'Bad request', details = null) => {
  return error(message, 400, details);
};

module.exports = {
  createResponse,
  success,
  error,
  serverError,
  notFound,
  badRequest
};
