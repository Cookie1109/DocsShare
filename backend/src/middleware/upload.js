const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đảm bảo thư mục uploads tồn tại
const ensureUploadDir = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const documentsDir = path.join(uploadDir, 'documents');
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }
  
  const avatarsDir = path.join(uploadDir, 'avatars');
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }
};

ensureUploadDir();

// Cấu hình storage cho documents
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/documents'));
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const extension = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, extension);
    
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${extension}`);
  }
});

// Cấu hình storage cho avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${extension}`);
  }
});

// File filter cho documents
const documentFileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,ppt,pptx,xls,xlsx,zip,rar').split(',');
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Loại file không được hỗ trợ. Chỉ chấp nhận: ${allowedTypes.join(', ')}`), false);
  }
};

// File filter cho avatars
const avatarFileFilter = (req, file, cb) => {
  const allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG, GIF)'), false);
  }
};

// Multer instances
const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 25 * 1024 * 1024, // 25MB default
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB cho avatar
  }
});

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 25MB'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Quá nhiều file được tải lên'
      });
    }
  }
  
  if (err.message.includes('Loại file không được hỗ trợ') || 
      err.message.includes('Chỉ chấp nhận file ảnh')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  next(err);
};

module.exports = {
  uploadDocument,
  uploadAvatar,
  handleMulterError
};
