import jwt from '../config/jwt.js';
import logger from '../config/logger.js';

/**
 * Middleware to authenticate JWT token
 * Extracts token from Authorization header and verifies it
 */
const authenticateJWT = (req, res, next) => {
  // Get authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }
  
  // Check if the header has the correct format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Invalid authorization format. Format is "Bearer [token]"' });
  }
  
  const token = parts[1];
  
  // Verify the token
  const decoded = jwt.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  
  // Attach user info to request object
  req.user = decoded;
  next();
};

/**
 * Middleware to check if user has required role
 * @param {String|Array} roles - Required role(s) to access the route
 */
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const userRole = req.user.role;
    
    // If roles is a string, convert to array
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!requiredRoles.includes(userRole)) {
      //logger berikan informasi lebih detail terkait requiredRoles dan userRole
      logger.warn(`User ${req.user.username} (${req.user.id}) with role ${userRole} attempted to access restricted route with insufficient permissions. Required roles: ${requiredRoles}`);
      return res.status(403).json({ message: 'Insufficient permissions to access this resource' });
    }
    
    next();
  };
};

export default {
  authenticateJWT,
  authorizeRole,
};

// Named exports for backward compatibility
export const authenticateToken = authenticateJWT;
export { authenticateJWT, authorizeRole };