const express = require('express');
const { 
  createUploadSignature, 
  saveFileMetadata, 
  getGroupFiles,
  deleteFile,
  trackDownload
  // debugUserGroups - temporarily removed to test
} = require('../controllers/filesController');
const verifyFirebaseToken = require('../middleware/firebaseAuth');

const router = express.Router();

/**
 * Files API Routes - Signed Upload System
 * Tất cả routes đều yêu cầu Firebase authentication
 */

/**
 * POST /api/files/signature
 * Tạo chữ ký upload an toàn cho Cloudinary
 * 
 * Headers:
 *   Authorization: Bearer <firebase_id_token>
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "signature": "abc123...",
 *       "timestamp": 1696166400,
 *       "api_key": "your_api_key",
 *       "cloud_name": "your_cloud_name",
 *       "folder": "docsshare/documents",
 *       "resource_type": "auto"
 *     }
 *   }
 */
router.post('/signature', verifyFirebaseToken, createUploadSignature);

/**
 * GET /api/files/debug/user-groups
 * Debug endpoint để kiểm tra user groups
 */
// router.get('/debug/user-groups', verifyFirebaseToken, debugUserGroups); // Temporarily disabled

/**
 * POST /api/files/metadata
 * Lưu thông tin file và tags vào MySQL và Firestore
 * 
 * Headers:
 *   Authorization: Bearer <firebase_id_token>
 *   Content-Type: application/json
 * 
 * Body:
 *   {
 *     "name": "document.pdf",
 *     "url": "https://res.cloudinary.com/...",
 *     "size": 1024000,
 *     "mimeType": "application/pdf",
 *     "groupId": 123,
 *     "tagIds": [1, 5, 12]
 *   }
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": 456,
 *       "name": "document.pdf",
 *       "url": "https://res.cloudinary.com/...",
 *       "size": 1024000,
 *       "mimeType": "application/pdf",
 *       "groupId": 123,
 *       "uploader": {
 *         "uid": "firebase_uid",
 *         "name": "John Doe",
 *         "email": "john@example.com"
 *       },
 *       "tags": [
 *         {"id": 1, "name": "Báo Cáo"},
 *         {"id": 5, "name": "Quan Trọng"}
 *       ],
 *       "downloadCount": 0,
 *       "createdAt": "2023-10-01T12:00:00Z"
 *     }
 *   }
 */
router.post('/metadata', verifyFirebaseToken, saveFileMetadata);

/**
 * GET /api/files/group/:groupId
 * Lấy danh sách files trong group (bonus endpoint)
 * 
 * Headers:
 *   Authorization: Bearer <firebase_id_token>
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": [
 *       {
 *         "id": 456,
 *         "name": "document.pdf",
 *         "url": "https://res.cloudinary.com/...",
 *         "uploader": {...},
 *         "tags": [...],
 *         "createdAt": "2023-10-01T12:00:00Z"
 *       }
 *     ],
 *     "count": 1
 *   }
 */
router.get('/group/:groupId', verifyFirebaseToken, getGroupFiles);

/**
 * POST /api/files/:fileId/download
 * Track file download và tăng download count
 * 
 * Headers:
 *   Authorization: Bearer <firebase_id_token>
 * 
 * Params:
 *   fileId: ID của file được download
 * 
 * Response:
 *   {
 *     "success": true,
 *     "message": "Download tracked successfully",
 *     "data": {
 *       "fileId": 456,
 *       "fileName": "document.pdf",
 *       "downloadCount": 5
 *     }
 *   }
 */
router.post('/:fileId/download', verifyFirebaseToken, trackDownload);

/**
 * Error handling middleware cho files routes
 */
router.use((error, req, res, next) => {
  console.error('Files API Error:', error);
  
  // Cloudinary specific errors
  if (error.message && error.message.includes('cloudinary')) {
    return res.status(400).json({
      success: false,
      message: 'Cloudinary service error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  
  // MySQL specific errors
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry detected'
    });
  }
  
  // Firebase specific errors
  if (error.code && error.code.startsWith('auth/')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
  
  // Generic server error
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

/**
 * DELETE /api/files/:fileId
 * Xóa file - chỉ owner hoặc admin có thể xóa
 * 
 * Headers:
 *   Authorization: Bearer <firebase_id_token>
 * 
 * Params:
 *   fileId: ID của file cần xóa
 * 
 * Response Success:
 *   {
 *     "success": true,
 *     "message": "File deleted successfully",
 *     "data": {
 *       "deletedFileId": "123",
 *       "fileName": "document.pdf"
 *     }
 *   }
 * 
 * Response Error:
 *   403: { "success": false, "message": "You can only delete your own files or you must be an admin" }
 *   404: { "success": false, "message": "File not found or you do not have access to this file" }
 */
router.delete('/:fileId', verifyFirebaseToken, deleteFile);

module.exports = router;