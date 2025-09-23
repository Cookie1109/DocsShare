const { executeQuery, executeTransaction } = require('../config/db');

/**
 * Tag Model - Quản lý tags cục bộ theo nhóm
 * 
 * Schema: tags(id, name, group_id, creator_id, created_at)
 * Related: file_tags(file_id, tag_id)
 * 
 * Tags được thiết kế theo mô hình "cục bộ" - mỗi nhóm có thể có tags trùng tên
 * nhưng trong cùng một nhóm thì tên tag là duy nhất
 */

class Tag {
  /**
   * Tạo tag mới
   * @param {Object} tagData - Dữ liệu tag
   * @param {string} tagData.name - Tên tag
   * @param {number} tagData.group_id - ID nhóm
   * @param {string} tagData.creator_id - Firebase UID người tạo
   * @returns {Promise<Object>} Kết quả tạo tag
   */
  static async create(tagData) {
    try {
      const { name, group_id, creator_id } = tagData;
      
      if (!name || !group_id || !creator_id) {
        throw new Error('Missing required fields: name, group_id, creator_id');
      }
      
      return await executeTransaction(async (connection) => {
        // Kiểm tra user có trong nhóm không
        const [memberCheck] = await connection.execute(
          `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
          [group_id, creator_id]
        );
        
        if (memberCheck.length === 0) {
          throw new Error('User is not a member of this group');
        }
        
        // Kiểm tra tag đã tồn tại trong nhóm chưa
        const [existingTag] = await connection.execute(
          `SELECT id FROM tags WHERE name = ? AND group_id = ?`,
          [name, group_id]
        );
        
        if (existingTag.length > 0) {
          return {
            success: false,
            error: 'Tag already exists in this group',
            data: existingTag[0]
          };
        }
        
        // Tạo tag
        const [tagResult] = await connection.execute(
          `INSERT INTO tags (name, group_id, creator_id, created_at)
           VALUES (?, ?, ?, NOW())`,
          [name, group_id, creator_id]
        );
        
        const tagId = tagResult.insertId;
        
        // Log activity
        await connection.execute(
          `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
           VALUES (?, 'create_tag', ?, JSON_OBJECT('tag_name', ?), NOW())`,
          [creator_id, tagId.toString(), name]
        );
        
        return {
          success: true,
          message: 'Tag created successfully',
          data: {
            id: tagId,
            name,
            group_id,
            creator_id
          }
        };
      });
    } catch (error) {
      console.error('Error creating tag:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'Tag already exists in this group' };
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Lấy danh sách tags của nhóm
   * @param {number} groupId - ID nhóm
   * @param {Object} options - Tùy chọn
   * @param {boolean} options.with_file_count - Có đếm số file sử dụng tag không
   * @returns {Promise<Array>} Danh sách tags
   */
  static async getGroupTags(groupId, options = {}) {
    try {
      const { with_file_count = false } = options;
      
      let query = `
        SELECT 
          t.id,
          t.name,
          t.group_id,
          t.creator_id,
          t.created_at,
          u.display_name as creator_name,
          u.tag as creator_tag
      `;
      
      if (with_file_count) {
        query += `, COUNT(ft.file_id) as file_count`;
      }
      
      query += `
        FROM tags t
        JOIN users u ON t.creator_id = u.id
      `;
      
      if (with_file_count) {
        query += `LEFT JOIN file_tags ft ON t.id = ft.tag_id`;
      }
      
      query += `
        WHERE t.group_id = ?
      `;
      
      if (with_file_count) {
        query += `GROUP BY t.id`;
      }
      
      query += `ORDER BY t.name ASC`;
      
      return await executeQuery(query, [groupId]);
    } catch (error) {
      console.error('Error getting group tags:', error);
      throw error;
    }
  }
  
  /**
   * Tìm tag theo ID
   * @param {number} tagId - ID tag
   * @returns {Promise<Object|null>} Thông tin tag
   */
  static async findById(tagId) {
    try {
      const query = `
        SELECT 
          t.id,
          t.name,
          t.group_id,
          t.creator_id,
          t.created_at,
          u.display_name as creator_name,
          u.tag as creator_tag,
          g.name as group_name
        FROM tags t
        JOIN users u ON t.creator_id = u.id
        JOIN \`groups\` g ON t.group_id = g.id
        WHERE t.id = ?
      `;
      
      const tags = await executeQuery(query, [tagId]);
      return tags.length > 0 ? tags[0] : null;
    } catch (error) {
      console.error('Error finding tag by ID:', error);
      throw error;
    }
  }
  
  /**
   * Tìm hoặc tạo tag (upsert)
   * @param {string} name - Tên tag
   * @param {number} groupId - ID nhóm
   * @param {string} creatorId - Firebase UID người tạo
   * @returns {Promise<Object>} Tag (existing hoặc mới tạo)
   */
  static async findOrCreate(name, groupId, creatorId) {
    try {
      // Tìm tag đã tồn tại
      const existingTag = await executeQuery(
        `SELECT id, name, group_id, creator_id FROM tags WHERE name = ? AND group_id = ?`,
        [name, groupId]
      );
      
      if (existingTag.length > 0) {
        return {
          success: true,
          data: existingTag[0],
          created: false
        };
      }
      
      // Tạo tag mới
      const createResult = await this.create({ name, group_id: groupId, creator_id: creatorId });
      
      if (createResult.success) {
        return {
          success: true,
          data: createResult.data,
          created: true
        };
      }
      
      return createResult;
    } catch (error) {
      console.error('Error finding or creating tag:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Lấy danh sách files sử dụng tag
   * @param {number} tagId - ID tag
   * @param {Object} options - Tùy chọn phân trang
   * @param {number} options.limit - Số lượng tối đa
   * @param {number} options.offset - Vị trí bắt đầu
   * @returns {Promise<Array>} Danh sách files
   */
  static async getTagFiles(tagId, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      
      const query = `
        SELECT 
          f.id,
          f.name,
          f.storage_path,
          f.mime_type,
          f.size_bytes,
          f.download_count,
          f.created_at,
          u.display_name as uploader_name,
          u.tag as uploader_tag
        FROM files f
        JOIN file_tags ft ON f.id = ft.file_id
        JOIN users u ON f.uploader_id = u.id
        WHERE ft.tag_id = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      return await executeQuery(query, [tagId, limit, offset]);
    } catch (error) {
      console.error('Error getting tag files:', error);
      throw error;
    }
  }
  
  /**
   * Cập nhật tên tag
   * @param {number} tagId - ID tag
   * @param {string} newName - Tên mới
   * @param {string} updatedBy - Firebase UID người cập nhật
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  static async update(tagId, newName, updatedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Lấy thông tin tag hiện tại
        const [tagInfo] = await connection.execute(
          `SELECT t.name, t.group_id, t.creator_id FROM tags t WHERE t.id = ?`,
          [tagId]
        );
        
        if (tagInfo.length === 0) {
          throw new Error('Tag not found');
        }
        
        const { name: currentName, group_id, creator_id } = tagInfo[0];
        
        // Kiểm tra quyền cập nhật (creator hoặc admin của nhóm)
        if (creator_id !== updatedBy) {
          const [adminCheck] = await connection.execute(
            `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
            [group_id, updatedBy]
          );
          
          if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            throw new Error('Only tag creator or group admin can update tag');
          }
        }
        
        // Kiểm tra tên mới có trùng không (trong cùng nhóm)
        if (newName !== currentName) {
          const [duplicateCheck] = await connection.execute(
            `SELECT id FROM tags WHERE name = ? AND group_id = ? AND id != ?`,
            [newName, group_id, tagId]
          );
          
          if (duplicateCheck.length > 0) {
            throw new Error('Tag name already exists in this group');
          }
        }
        
        // Cập nhật tên tag
        await connection.execute(
          `UPDATE tags SET name = ? WHERE id = ?`,
          [newName, tagId]
        );
        
        return {
          success: true,
          message: 'Tag updated successfully',
          data: { id: tagId, name: newName, group_id, creator_id }
        };
      });
    } catch (error) {
      console.error('Error updating tag:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Xóa tag
   * @param {number} tagId - ID tag
   * @param {string} deletedBy - Firebase UID người xóa
   * @returns {Promise<Object>} Kết quả xóa tag
   */
  static async delete(tagId, deletedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Lấy thông tin tag
        const [tagInfo] = await connection.execute(
          `SELECT t.name, t.group_id, t.creator_id FROM tags t WHERE t.id = ?`,
          [tagId]
        );
        
        if (tagInfo.length === 0) {
          throw new Error('Tag not found');
        }
        
        const { name, group_id, creator_id } = tagInfo[0];
        
        // Kiểm tra quyền xóa (creator hoặc admin của nhóm)
        if (creator_id !== deletedBy) {
          const [adminCheck] = await connection.execute(
            `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
            [group_id, deletedBy]
          );
          
          if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            throw new Error('Only tag creator or group admin can delete tag');
          }
        }
        
        // Kiểm tra tag có đang được sử dụng không
        const [fileTagCount] = await connection.execute(
          `SELECT COUNT(*) as count FROM file_tags WHERE tag_id = ?`,
          [tagId]
        );
        
        const fileCount = fileTagCount[0].count;
        
        // Xóa tag (CASCADE sẽ tự động xóa file_tags)
        await connection.execute(`DELETE FROM tags WHERE id = ?`, [tagId]);
        
        return {
          success: true,
          message: 'Tag deleted successfully',
          data: { 
            files_affected: fileCount,
            tag_name: name
          }
        };
      });
    } catch (error) {
      console.error('Error deleting tag:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Tìm kiếm tags trong nhóm
   * @param {number} groupId - ID nhóm
   * @param {string} searchTerm - Từ khóa tìm kiếm
   * @param {number} limit - Số lượng tối đa
   * @returns {Promise<Array>} Danh sách tags phù hợp
   */
  static async search(groupId, searchTerm, limit = 20) {
    try {
      const query = `
        SELECT 
          t.id,
          t.name,
          t.group_id,
          COUNT(ft.file_id) as file_count
        FROM tags t
        LEFT JOIN file_tags ft ON t.id = ft.tag_id
        WHERE t.group_id = ? AND t.name LIKE ?
        GROUP BY t.id
        ORDER BY file_count DESC, t.name ASC
        LIMIT ?
      `;
      
      return await executeQuery(query, [groupId, `%${searchTerm}%`, limit]);
    } catch (error) {
      console.error('Error searching tags:', error);
      throw error;
    }
  }
  
  /**
   * Lấy thống kê tags của nhóm
   * @param {number} groupId - ID nhóm
   * @returns {Promise<Object>} Thống kê tags
   */
  static async getGroupStats(groupId) {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT t.id) as total_tags,
          COUNT(ft.file_id) as total_tag_usages,
          AVG(tag_file_count.file_count) as avg_files_per_tag
        FROM tags t
        LEFT JOIN file_tags ft ON t.id = ft.tag_id
        LEFT JOIN (
          SELECT tag_id, COUNT(*) as file_count
          FROM file_tags
          GROUP BY tag_id
        ) tag_file_count ON t.id = tag_file_count.tag_id
        WHERE t.group_id = ?
      `;
      
      const stats = await executeQuery(query, [groupId]);
      
      return {
        total_tags: stats[0].total_tags || 0,
        total_tag_usages: stats[0].total_tag_usages || 0,
        avg_files_per_tag: Math.round(stats[0].avg_files_per_tag || 0)
      };
    } catch (error) {
      console.error('Error getting tag stats:', error);
      throw error;
    }
  }
  
  /**
   * Lấy top tags được sử dụng nhiều nhất
   * @param {number} groupId - ID nhóm
   * @param {number} limit - Số lượng tối đa
   * @returns {Promise<Array>} Top tags
   */
  static async getTopTags(groupId, limit = 10) {
    try {
      const query = `
        SELECT 
          t.id,
          t.name,
          COUNT(ft.file_id) as file_count
        FROM tags t
        LEFT JOIN file_tags ft ON t.id = ft.tag_id
        WHERE t.group_id = ?
        GROUP BY t.id
        HAVING file_count > 0
        ORDER BY file_count DESC, t.name ASC
        LIMIT ?
      `;
      
      return await executeQuery(query, [groupId, limit]);
    } catch (error) {
      console.error('Error getting top tags:', error);
      throw error;
    }
  }
}

module.exports = Tag;