const jwt = require('jsonwebtoken');

// Middleware để xác thực JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token không được cung cấp'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    req.user = user;
    next();
  });
};

// Middleware để kiểm tra quyền admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập'
    });
  }
  next();
};

// Middleware để kiểm tra quyền sở hữu tài liệu
const checkDocumentOwnership = (req, res, next) => {
  // Logic kiểm tra quyền sở hữu sẽ được implement trong controller
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  checkDocumentOwnership
};
