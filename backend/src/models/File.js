const { executeQuery, executeTransaction } = require('../config/db');

/**
 * File Model - Quản lý files
 * 
 * Schema: files(id, name, storage_path, mime_type, size_bytes, group_id, uploader_id, download_count, created_at)
 * Related: file_tags(file_id, tag_id)
 */

class File {
  /**
   * Tạo file mới
   * @param {Object} fileData - Dữ liệu file
   * @param {string} fileData.name - Tên file
   * @param {string} fileData.storage_path - URL Cloudinary của file
   * @param {string} fileData.mime_type - Loại file
   * @param {number} fileData.size_bytes - Kích thước file (bytes)
   * @param {number} fileData.group_id - ID nhóm
   * @param {string} fileData.uploader_id - Firebase UID người upload
   * @param {Array} fileData.tag_names - Mảng tên các tag (optional)
   * @returns {Promise<Object>} Kết quả tạo file
   */
  static async create(fileData) {
    try {
      const { 
        name, 
        storage_path, 
        mime_type, 
        size_bytes, 
        group_id, 
        uploader_id,
        tag_names = [],
        cloudinary_public_id = null
      } = fileData;
      
      if (!name || !storage_path || !group_id || !uploader_id) {
        throw new Error('Missing required fields: name, storage_path, group_id, uploader_id');
      }
      
      return await executeTransaction(async (connection) => {
        // Kiểm tra user có trong nhóm không
        const [memberCheck] = await connection.execute(
          `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
          [group_id, uploader_id]
        );
        
        if (memberCheck.length === 0) {
          throw new Error('User is not a member of this group');
        }
        
        // Tạo file
        const [fileResult] = await connection.execute(
          `INSERT INTO files (name, storage_path, cloudinary_public_id, mime_type, size_bytes, group_id, uploader_id, download_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
          [name, storage_path, cloudinary_public_id, mime_type, size_bytes, group_id, uploader_id]
        );
        
        const fileId = fileResult.insertId;
        
        // Gắn tags nếu có (từ tag_names)
        if (tag_names && tag_names.length > 0) {
          const Tag = require('./Tag');
          
          for (const tagName of tag_names) {
            if (typeof tagName === 'string' && tagName.trim()) {
              // Tìm hoặc tạo tag
              const tagResult = await Tag.findOrCreate(
                tagName.trim(),
                group_id,
                uploader_id
              );
              
              if (tagResult.success && tagResult.data) {
                // Gắn tag vào file
                await connection.execute(
                  `INSERT IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)`,
                  [fileId, tagResult.data.id]
                );
              }
            }
          }
        }
        
        // Log activity
        await connection.execute(
          `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
           VALUES (?, 'upload', ?, JSON_OBJECT('file_name', ?, 'file_size', ?), NOW())`,
          [uploader_id, fileId.toString(), name, size_bytes]
        );
        
        return {
          success: true,
          message: 'File uploaded successfully',
          data: {
            id: fileId,
            name,
            storage_path,
            mime_type,
            size_bytes,
            group_id,
            uploader_id,
            download_count: 0
          }
        };
      });
    } catch (error) {
      console.error('Error creating file:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Tìm file theo ID
   * @param {number} fileId - ID file
   * @returns {Promise<Object|null>} Thông tin file
   */
  static async findById(fileId) {
    try {
      const query = `
        SELECT 
          f.id,
          f.name,
          f.storage_path,
          f.mime_type,
          f.size_bytes,
          f.group_id,
          f.uploader_id,
          f.download_count,
          f.created_at,
          u.display_name as uploader_name,
          u.tag as uploader_tag,
          g.name as group_name
        FROM files f
        JOIN users u ON f.uploader_id = u.id
        JOIN \`groups\` g ON f.group_id = g.id
        WHERE f.id = ?
      `;
      
      const files = await executeQuery(query, [fileId]);
      
      if (files.length === 0) {
        return null;
      }
      
      // Lấy tags của file
      const tags = await this.getFileTags(fileId);
      
      return {
        ...files[0],
        tags
      };
    } catch (error) {
      console.error('Error finding file by ID:', error);
      throw error;
    }
  }
  
  /**
   * Lấy danh sách files trong nhóm
   * @param {number} groupId - ID nhóm
   * @param {Object} options - Tùy chọn lọc
   * @param {string} options.search - Từ khóa tìm kiếm
   * @param {Array} options.tag_ids - Lọc theo tags
   * @param {string} options.uploader_id - Lọc theo người upload
   * @param {number} options.limit - Số lượng tối đa
   * @param {number} options.offset - Vị trí bắt đầu
   * @returns {Promise<Array>} Danh sách files
   */
  static async getGroupFiles(groupId, options = {}) {
    try {
      const { search, tag_ids, uploader_id, limit = 50, offset = 0 } = options;
      
      let whereConditions = ['f.group_id = ?'];
      let params = [groupId];
      
      // Tìm kiếm theo tên
      if (search) {
        whereConditions.push('f.name LIKE ?');
        params.push(`%${search}%`);
      }
      
      // Lọc theo người upload
      if (uploader_id) {
        whereConditions.push('f.uploader_id = ?');
        params.push(uploader_id);
      }
      
      let query = `
        SELECT DISTINCT
          f.id,
          f.name,
          f.storage_path,
          f.mime_type,
          f.size_bytes,
          f.group_id,
          f.uploader_id,
          f.download_count,
          f.created_at,
          u.display_name as uploader_name,
          u.tag as uploader_tag
        FROM files f
        JOIN users u ON f.uploader_id = u.id
      `;
      
      // Lọc theo tags
      if (tag_ids && tag_ids.length > 0) {
        query += `
          JOIN file_tags ft ON f.id = ft.file_id
          JOIN tags t ON ft.tag_id = t.id
        `;
        whereConditions.push(`t.id IN (${tag_ids.map(() => '?').join(', ')})`);
        params.push(...tag_ids);
      }
      
      query += ` WHERE ${whereConditions.join(' AND ')}`;
      query += ` ORDER BY f.created_at DESC`;
      query += ` LIMIT ? OFFSET ?`;
      
      params.push(limit, offset);
      
      const files = await executeQuery(query, params);
      
      // Lấy tags cho từng file
      for (const file of files) {
        file.tags = await this.getFileTags(file.id);
      }
      
      return files;
    } catch (error) {
      console.error('Error getting group files:', error);
      throw error;
    }
  }
  
  /**
   * Lấy tags của một file
   * @param {number} fileId - ID file
   * @returns {Promise<Array>} Danh sách tags
   */
  static async getFileTags(fileId) {
    try {
      const query = `
        SELECT 
          t.id,
          t.name,
          t.group_id
        FROM tags t
        JOIN file_tags ft ON t.id = ft.tag_id
        WHERE ft.file_id = ?
        ORDER BY t.name
      `;
      
      return await executeQuery(query, [fileId]);
    } catch (error) {
      console.error('Error getting file tags:', error);
      return [];
    }
  }
  
  /**
   * Cập nhật tags của file
   * @param {number} fileId - ID file
   * @param {Array} tagIds - Mảng ID tags mới
   * @param {string} updatedBy - Firebase UID người cập nhật
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  static async updateTags(fileId, tagIds, updatedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Kiểm tra quyền (phải là uploader hoặc admin của nhóm)
        const [fileInfo] = await connection.execute(
          `SELECT f.uploader_id, f.group_id 
           FROM files f WHERE f.id = ?`,
          [fileId]
        );
        
        if (fileInfo.length === 0) {
          throw new Error('File not found');
        }
        
        const { uploader_id, group_id } = fileInfo[0];
        
        if (uploader_id !== updatedBy) {
          // Kiểm tra có phải admin của nhóm không
          const [adminCheck] = await connection.execute(
            `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
            [group_id, updatedBy]
          );
          
          if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            throw new Error('Only file uploader or group admin can update tags');
          }
        }
        
        // Xóa tags cũ
        await connection.execute(
          `DELETE FROM file_tags WHERE file_id = ?`,
          [fileId]
        );
        
        // Thêm tags mới
        if (tagIds.length > 0) {
          for (const tagId of tagIds) {
            // Kiểm tra tag thuộc nhóm này
            const [tagCheck] = await connection.execute(
              `SELECT id FROM tags WHERE id = ? AND group_id = ?`,
              [tagId, group_id]
            );
            
            if (tagCheck.length > 0) {
              await connection.execute(
                `INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?)`,
                [fileId, tagId]
              );
            }
          }
        }
        
        return {
          success: true,
          message: 'File tags updated successfully'
        };
      });
    } catch (error) {
      console.error('Error updating file tags:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Tăng download count
   * @param {number} fileId - ID file
   * @param {string} downloadedBy - Firebase UID người download
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  static async incrementDownloadCount(fileId, downloadedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Kiểm tra file tồn tại và user có quyền download
        const [fileInfo] = await connection.execute(
          `SELECT f.group_id, f.name, f.download_count
           FROM files f WHERE f.id = ?`,
          [fileId]
        );
        
        if (fileInfo.length === 0) {
          throw new Error('File not found');
        }
        
        const { group_id, name, download_count } = fileInfo[0];
        
        // Kiểm tra user có trong nhóm không
        const [memberCheck] = await connection.execute(
          `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
          [group_id, downloadedBy]
        );
        
        if (memberCheck.length === 0) {
          throw new Error('User is not a member of this group');
        }
        
        // Tăng download count
        await connection.execute(
          `UPDATE files SET download_count = download_count + 1 WHERE id = ?`,
          [fileId]
        );
        
        // Log activity
        await connection.execute(
          `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
           VALUES (?, 'download', ?, JSON_OBJECT('file_name', ?), NOW())`,
          [downloadedBy, fileId.toString(), name]
        );
        
        return {
          success: true,
          message: 'Download recorded successfully',
          data: { download_count: download_count + 1 }
        };
      });
    } catch (error) {
      console.error('Error incrementing download count:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Xóa file
   * @param {number} fileId - ID file
   * @param {string} deletedBy - Firebase UID người xóa
   * @returns {Promise<Object>} Kết quả xóa file
   */
  static async delete(fileId, deletedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Kiểm tra quyền xóa (uploader hoặc admin của nhóm)
        const [fileInfo] = await connection.execute(
          `SELECT f.uploader_id, f.group_id, f.name, f.storage_path, f.cloudinary_public_id
           FROM files f WHERE f.id = ?`,
          [fileId]
        );
        
        if (fileInfo.length === 0) {
          throw new Error('File not found');
        }
        
        const { uploader_id, group_id, name, storage_path, cloudinary_public_id } = fileInfo[0];
        
        if (uploader_id !== deletedBy) {
          // Kiểm tra có phải admin của nhóm không
          const [adminCheck] = await connection.execute(
            `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
            [group_id, deletedBy]
          );
          
          if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            throw new Error('Only file uploader or group admin can delete file');
          }
        }
        
        // Xóa file (CASCADE sẽ tự động xóa file_tags)
        await connection.execute(`DELETE FROM files WHERE id = ?`, [fileId]);
        
        // Log activity
        await connection.execute(
          `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
           VALUES (?, 'delete_file', ?, JSON_OBJECT('file_name', ?), NOW())`,
          [deletedBy, fileId.toString(), name]
        );
        
        // Xóa file từ Cloudinary nếu có public_id
        if (cloudinary_public_id) {
          try {
            const { deleteFromCloudinary } = require('../config/cloudinary');
            await deleteFromCloudinary(cloudinary_public_id);
          } catch (cloudinaryError) {
            console.error('Error deleting from Cloudinary:', cloudinaryError);
            // Không throw error vì file đã xóa khỏi DB
          }
        }
        
        return {
          success: true,
          message: 'File deleted successfully',
          data: { 
            storage_path,
            cloudinary_public_id
          }
        };
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Lấy thống kê files
   * @param {number} groupId - ID nhóm (optional)
   * @returns {Promise<Object>} Thống kê
   */
  static async getStats(groupId = null) {
    try {
      let whereCondition = '';
      let params = [];
      
      if (groupId) {
        whereCondition = 'WHERE group_id = ?';
        params = [groupId];
      }
      
      const query = `
        SELECT 
          COUNT(*) as total_files,
          SUM(size_bytes) as total_size,
          SUM(download_count) as total_downloads,
          AVG(size_bytes) as avg_file_size
        FROM files
        ${whereCondition}
      `;
      
      const stats = await executeQuery(query, params);
      
      return {
        total_files: stats[0].total_files || 0,
        total_size: stats[0].total_size || 0,
        total_downloads: stats[0].total_downloads || 0,
        avg_file_size: Math.round(stats[0].avg_file_size || 0)
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      throw error;
    }
  }
}

module.exports = File;