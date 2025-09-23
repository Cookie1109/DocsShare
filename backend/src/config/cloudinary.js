const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình Cloudinary Storage cho Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'docsshare/documents',
    resource_type: 'raw', // Cho phép upload mọi loại file, không chỉ ảnh
    public_id: (req, file) => {
      // Tạo public_id unique với timestamp và random
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const originalName = file.originalname.split('.')[0];
      return `${originalName}-${timestamp}-${random}`;
    },
    format: async (req, file) => {
      // Giữ nguyên extension gốc của file
      const ext = file.originalname.split('.').pop();
      return ext;
    }
  }
});

// Helper functions
const uploadToCloudinary = async (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'docsshare/documents',
        ...options
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

const getCloudinaryUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    ...options
  });
};

module.exports = {
  cloudinary,
  storage,
  uploadToCloudinary,
  deleteFromCloudinary,
  getCloudinaryUrl
};