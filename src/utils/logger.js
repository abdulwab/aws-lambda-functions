/**
 * Centralized logging utility for Lambda functions
 */

class Logger {
  constructor(context = {}) {
    this.context = context;
  }

  log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message, data = {}) {
    this.log('INFO', message, data);
  }

  error(message, data = {}) {
    this.log('ERROR', message, data);
  }

  warn(message, data = {}) {
    this.log('WARN', message, data);
  }

  debug(message, data = {}) {
    this.log('DEBUG', message, data);
  }
}

module.exports = Logger;
