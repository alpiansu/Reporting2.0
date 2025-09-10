import morgan from 'morgan';
import logger from '../config/logger.js';

/**
 * Custom morgan token to log request body (in development only)
 */
morgan.token('body', (req) => {
  if (process.env.NODE_ENV !== 'production' && req.method !== 'GET') {
    // Mask sensitive data like passwords
    const body = { ...req.body };
    if (body.password) body.password = '******';
    if (body.passwordConfirmation) body.passwordConfirmation = '******';
    return JSON.stringify(body);
  }
  return '';
});

/**
 * Custom morgan format
 */
const morganFormat = process.env.NODE_ENV === 'production'
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
  : ':method :url :status :response-time ms - :res[content-length] :body';

/**
 * Custom stream for morgan that uses winston logger
 */
const stream = {
  write: (message) => logger.http(message.trim()),
};

/**
 * Request logging middleware using morgan
 */
const requestLogger = morgan(morganFormat, { stream });

export default requestLogger;