const File = require('../models/File');
const Tag = require('../models/Tag');
const ActivityLog = require('../models/ActivityLog');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

/**
 * File Controller - Xử lý API requests cho files
 */

class FileController {
  /**
   * Upload file mới
   * POST /api/files/upload
   */
  static async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }
      
      const { group_id, tag_names = [] } = req.body;
      const uploader_id = req.user.id;
      
      if (!group_id) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      // Parse tag_names nếu là string
      let tags = [];
      if (typeof tag_names === 'string') {
        try {
          tags = JSON.parse(tag_names);
        } catch (e) {
          tags = tag_names.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
      } else if (Array.isArray(tag_names)) {
        tags = tag_names;
      }
      
      const fileData = {
        name: req.file.originalname,
        storage_path: req.file.path, // Cloudinary URL
        cloudinary_public_id: req.file.public_id, // Cloudinary public ID
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        group_id: parseInt(group_id),
        uploader_id,
        tag_names: tags
      };
      
      const result = await File.create(fileData);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        // File đã được upload lên Cloudinary, có thể cần xóa nếu tạo record DB thất bại
        // Nhưng để tránh phức tạp, ta sẽ để Cloudinary tự cleanup unused files
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Upload file error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy danh sách files của nhóm
   * GET /api/groups/:groupId/files
   */
  static async getGroupFiles(req, res) {
    try {
      const { groupId } = req.params;
      const { 
        tag_ids,
        mime_types,
        sort_by = 'newest',
        limit = 50,
        offset = 0
      } = req.query;
      
      if (!groupId) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      const options = {
        sort_by,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Parse tag_ids
      if (tag_ids) {
        if (Array.isArray(tag_ids)) {
          options.tag_ids = tag_ids.map(id => parseInt(id));
        } else {
          options.tag_ids = tag_ids.split(',').map(id => parseInt(id));
        }
      }
      
      // Parse mime_types
      if (mime_types) {
        if (Array.isArray(mime_types)) {
          options.mime_types = mime_types;
        } else {
          options.mime_types = mime_types.split(',');
        }
      }
      
      const files = await File.getGroupFiles(parseInt(groupId), options);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Get group files error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy thông tin file theo ID
   * GET /api/files/:fileId
   */
  static async getFileById(req, res) {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'File ID is required'
        });
      }
      
      const file = await File.findById(parseInt(fileId));
      
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      
      res.json({
        success: true,
        data: file
      });
    } catch (error) {
      console.error('Get file by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Download file
   * GET /api/files/:fileId/download
   */
  static async downloadFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.id;
      
      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'File ID is required'
        });
      }
      
      const file = await File.findById(parseInt(fileId));
      
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      
      // Tăng download count
      await File.incrementDownloadCount(parseInt(fileId), userId);
      
      // Redirect tới Cloudinary URL để download
      // Cloudinary sẽ handle việc serve file
      res.redirect(file.storage_path);
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Xóa file
   * DELETE /api/files/:fileId
   */
  static async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      const deletedBy = req.user.id;
      
      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'File ID is required'
        });
      }
      
      const result = await File.delete(parseInt(fileId), deletedBy);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Cập nhật tags của file
   * PUT /api/files/:fileId/tags
   */
  static async updateFileTags(req, res) {
    try {
      const { fileId } = req.params;
      const { tag_names } = req.body;
      const updatedBy = req.user.id;
      
      if (!fileId || !Array.isArray(tag_names)) {
        return res.status(400).json({
          success: false,
          error: 'File ID and tag_names array are required'
        });
      }
      
      const result = await File.updateTags(parseInt(fileId), tag_names, updatedBy);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Update file tags error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Tìm kiếm files
   * GET /api/files/search
   */
  static async searchFiles(req, res) {
    try {
      const {
        q: searchTerm,
        group_ids,
        mime_types,
        tag_names,
        limit = 50,
        offset = 0
      } = req.query;
      
      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          error: 'Search term is required'
        });
      }
      
      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Parse group_ids
      if (group_ids) {
        if (Array.isArray(group_ids)) {
          options.group_ids = group_ids.map(id => parseInt(id));
        } else {
          options.group_ids = group_ids.split(',').map(id => parseInt(id));
        }
      }
      
      // Parse mime_types
      if (mime_types) {
        if (Array.isArray(mime_types)) {
          options.mime_types = mime_types;
        } else {
          options.mime_types = mime_types.split(',');
        }
      }
      
      // Parse tag_names
      if (tag_names) {
        if (Array.isArray(tag_names)) {
          options.tag_names = tag_names;
        } else {
          options.tag_names = tag_names.split(',');
        }
      }
      
      const files = await File.search(searchTerm, options);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Search files error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy thống kê files của nhóm
   * GET /api/groups/:groupId/files/stats
   */
  static async getGroupFileStats(req, res) {
    try {
      const { groupId } = req.params;
      
      if (!groupId) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      const stats = await File.getGroupStats(parseInt(groupId));
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get group file stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy files được download nhiều nhất
   * GET /api/files/popular
   */
  static async getPopularFiles(req, res) {
    try {
      const { group_ids, limit = 20 } = req.query;
      
      const options = {
        limit: parseInt(limit)
      };
      
      // Parse group_ids
      if (group_ids) {
        if (Array.isArray(group_ids)) {
          options.group_ids = group_ids.map(id => parseInt(id));
        } else {
          options.group_ids = group_ids.split(',').map(id => parseInt(id));
        }
      }
      
      const files = await File.getPopularFiles(options);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Get popular files error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy files recent của user
   * GET /api/files/recent
   */
  static async getRecentFiles(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20 } = req.query;
      
      const files = await File.getRecentFiles(userId, parseInt(limit));
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Get recent files error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy files theo MIME type
   * GET /api/files/by-type/:mimeType
   */
  static async getFilesByType(req, res) {
    try {
      const { mimeType } = req.params;
      const { group_ids, limit = 50, offset = 0 } = req.query;
      
      if (!mimeType) {
        return res.status(400).json({
          success: false,
          error: 'MIME type is required'
        });
      }
      
      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Parse group_ids
      if (group_ids) {
        if (Array.isArray(group_ids)) {
          options.group_ids = group_ids.map(id => parseInt(id));
        } else {
          options.group_ids = group_ids.split(',').map(id => parseInt(id));
        }
      }
      
      const files = await File.getByMimeType(mimeType, options);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Get files by type error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = FileController;