const jwt = require('jsonwebtoken');

const protect = (roles = []) => {
  return (req, res, next) => {
    // 1. Added space in split(' ')
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
      // 2. Added fallback secret for your environment
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key-123');
      req.user = decoded;

      // 3. Fixed .includes() method name
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({ message: `Role ${req.user.role} is not authorized` });
      }
      
      next();
    } catch (err) {
      console.error("JWT Verification Error:", err.message);
      res.status(401).json({ message: 'Token is not valid' });
    }
  };
};

module.exports = { protect };
