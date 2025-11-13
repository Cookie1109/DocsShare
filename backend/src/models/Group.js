const { executeQuery, executeTransaction } = require('../config/db');
const { syncGroup, syncGroupMember, syncGroupDelete } = require('../config/syncHelper');

/**
 * Group Model - Quản lý nhóm
 * 
 * Schema: groups(id, name, description, group_photo_url, creator_id, created_at)
 * Related: group_members(group_id, user_id, role, joined_at)
 */

class Group {
  /**
   * Tạo nhóm mới
   * @param {Object} groupData - Dữ liệu nhóm
   * @param {string} groupData.name - Tên nhóm
   * @param {string} groupData.description - Mô tả nhóm
   * @param {string} groupData.creator_id - Firebase UID của người tạo
   * @returns {Promise<Object>} Kết quả tạo nhóm
   */
  static async create(groupData) {
    try {
      const { name, description, creator_id } = groupData;
      
      if (!name || !creator_id) {
        throw new Error('Missing required fields: name, creator_id');
      }
      
      return await executeTransaction(async (connection) => {
        // Tạo nhóm (không lưu group_photo_url - chỉ lưu trong Firebase)
        const [groupResult] = await connection.execute(
          `INSERT INTO \`groups\` (name, description, creator_id, created_at)
           VALUES (?, ?, ?, NOW())`,
          [name, description, creator_id]
        );
        
        const groupId = groupResult.insertId;
        
        // Thêm creator làm admin của nhóm
        await connection.execute(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, 'admin', NOW())`,
          [groupId, creator_id]
        );
        
        // Log activity
        await connection.execute(
          `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
           VALUES (?, 'create_group', ?, JSON_OBJECT('group_name', ?), NOW())`,
          [creator_id, groupId.toString(), name]
        );
        
        // Sync to Firebase after successful MySQL insert
        await syncGroup(groupId, 'CREATE', { name, creator_id });
        await syncGroupMember(groupId, creator_id, 'CREATE', { role: 'admin' });
        
        return {
          success: true,
          message: 'Group created successfully',
          data: {
            id: groupId,
            name,
            description,
            creator_id,
            role: 'admin'
          }
        };
      });
    } catch (error) {
      console.error('Error creating group:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Tìm nhóm theo ID
   * @param {number} groupId - ID nhóm
   * @returns {Promise<Object|null>} Thông tin nhóm
   */
  static async findById(groupId) {
    try {
      const query = `
        SELECT 
          g.id,
          g.name,
          g.description,
          g.group_photo_url,
          g.creator_id,
          g.created_at,
          u.display_name as creator_name,
          u.tag as creator_tag,
          COUNT(gm.user_id) as member_count
        FROM \`groups\` g
        JOIN users u ON g.creator_id = u.id
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ?
        GROUP BY g.id
      `;
      
      const groups = await executeQuery(query, [groupId]);
      return groups.length > 0 ? groups[0] : null;
    } catch (error) {
      console.error('Error finding group by ID:', error);
      throw error;
    }
  }
  
  /**
   * Lấy danh sách thành viên của nhóm
   * @param {number} groupId - ID nhóm
   * @returns {Promise<Array>} Danh sách thành viên
   */
  static async getMembers(groupId) {
    try {
      const query = `
        SELECT 
          u.id,
          u.email,
          u.display_name,
          u.tag,
          gm.role,
          gm.joined_at
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ?
        ORDER BY 
          CASE gm.role 
            WHEN 'admin' THEN 1 
            WHEN 'member' THEN 2 
          END,
          gm.joined_at ASC
      `;
      
      return await executeQuery(query, [groupId]);
    } catch (error) {
      console.error('Error getting group members:', error);
      throw error;
    }
  }
  
  /**
   * Thêm thành viên vào nhóm
   * @param {number} groupId - ID nhóm
   * @param {string} userId - Firebase UID
   * @param {string} addedBy - Firebase UID của người thêm
   * @returns {Promise<Object>} Kết quả thêm thành viên
   */
  static async addMember(groupId, userId, addedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Kiểm tra user có quyền thêm thành viên không (phải là admin)
        const [adminCheck] = await connection.execute(
          `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
          [groupId, addedBy]
        );
        
        if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
          throw new Error('Only admins can add members');
        }
        
        // Kiểm tra user đã là thành viên chưa
        const [existingMember] = await connection.execute(
          `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
          [groupId, userId]
        );
        
        if (existingMember.length > 0) {
          throw new Error('User is already a member of this group');
        }
        
        // Thêm thành viên
        await connection.execute(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, 'member', NOW())`,
          [groupId, userId]
        );
        
        // Log activity
        await connection.execute(
          `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
           VALUES (?, 'join_group', ?, JSON_OBJECT('added_by', ?), NOW())`,
          [userId, groupId.toString(), addedBy]
        );
        
        // Sync to Firebase after successful add
        await syncGroupMember(groupId, userId, 'CREATE', { role });
        
        return {
          success: true,
          message: 'Member added successfully'
        };
      });
    } catch (error) {
      console.error('Error adding member:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Xóa thành viên khỏi nhóm
   * @param {number} groupId - ID nhóm
   * @param {string} userId - Firebase UID của thành viên cần xóa
   * @param {string} removedBy - Firebase UID của người xóa
   * @returns {Promise<Object>} Kết quả xóa thành viên
   */
  static async removeMember(groupId, userId, removedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Kiểm tra quyền xóa (admin hoặc chính user đó rời nhóm)
        if (userId !== removedBy) {
          const [adminCheck] = await connection.execute(
            `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
            [groupId, removedBy]
          );
          
          if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            throw new Error('Only admins can remove members');
          }
        }
        
        // Kiểm tra user có phải creator không (creator không thể bị xóa)
        const [creatorCheck] = await connection.execute(
          `SELECT creator_id FROM \`groups\` WHERE id = ?`,
          [groupId]
        );
        
        if (creatorCheck.length > 0 && creatorCheck[0].creator_id === userId) {
          throw new Error('Group creator cannot be removed. Transfer ownership first.');
        }
        
        // Xóa thành viên
        const [result] = await connection.execute(
          `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
          [groupId, userId]
        );
        
        if (result.affectedRows === 0) {
          throw new Error('User is not a member of this group');
        }
        
        // Sync to Firebase after successful remove
        const syncResult = await syncGroupMember(groupId, userId, 'DELETE', null);
        if (!syncResult.success) {
          console.error(`⚠️ Firebase sync failed after removing member ${userId} from group ${groupId}:`, syncResult.error);
          console.error('❌ DATA MISMATCH: Member removed from MySQL but still in Firebase!');
        }
        
        return {
          success: true,
          message: userId === removedBy ? 'Left group successfully' : 'Member removed successfully',
          firebaseSyncSuccess: syncResult.success
        };
      });
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Cập nhật vai trò thành viên
   * @param {number} groupId - ID nhóm
   * @param {string} userId - Firebase UID
   * @param {string} newRole - Vai trò mới ('admin' hoặc 'member')
   * @param {string} updatedBy - Firebase UID của người cập nhật
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  static async updateMemberRole(groupId, userId, newRole, updatedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Kiểm tra quyền cập nhật (chỉ admin)
        const [adminCheck] = await connection.execute(
          `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
          [groupId, updatedBy]
        );
        
        if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
          throw new Error('Only admins can update member roles');
        }
        
        // Không thể thay đổi role của creator
        const [creatorCheck] = await connection.execute(
          `SELECT creator_id FROM \`groups\` WHERE id = ?`,
          [groupId]
        );
        
        if (creatorCheck.length > 0 && creatorCheck[0].creator_id === userId) {
          throw new Error('Cannot change role of group creator');
        }
        
        // Cập nhật role
        const [result] = await connection.execute(
          `UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`,
          [newRole, groupId, userId]
        );
        
        if (result.affectedRows === 0) {
          throw new Error('User is not a member of this group');
        }
        
        // Sync to Firebase after successful role update
        await syncGroupMember(groupId, userId, 'UPDATE', { role: newRole });
        
        return {
          success: true,
          message: 'Member role updated successfully'
        };
      });
    } catch (error) {
      console.error('Error updating member role:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Xóa nhóm (xóa cả MySQL và Firebase, bao gồm files, tags, members)
   * @param {number} groupId - ID nhóm
   * @param {string} deletedBy - Firebase UID của người xóa
   * @returns {Promise<Object>} Kết quả xóa nhóm
   */
  static async delete(groupId, deletedBy) {
    try {
      return await executeTransaction(async (connection) => {
        // Kiểm tra nhóm có tồn tại và lấy thông tin creator
        const [groupInfo] = await connection.execute(
          `SELECT creator_id FROM \`groups\` WHERE id = ?`,
          [groupId]
        );
        
        if (groupInfo.length === 0) {
          throw new Error('Group not found');
        }
        
        const isCreator = groupInfo[0].creator_id === deletedBy;
        
        // Kiểm tra role của user trong nhóm (nếu không phải creator)
        let isAdmin = false;
        if (!isCreator) {
          const [memberInfo] = await connection.execute(
            `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
            [groupId, deletedBy]
          );
          isAdmin = memberInfo.length > 0 && memberInfo[0].role === 'admin';
        }
        
        if (!isCreator && !isAdmin) {
          throw new Error('Only group creator or admin can delete the group');
        }
        
        console.log(`🗑️ Deleting group ${groupId} from MySQL...`);
        
        // Xóa files trong MySQL (CASCADE không xóa file từ storage)
        const [deletedFiles] = await connection.execute(
          `DELETE FROM files WHERE group_id = ?`,
          [groupId]
        );
        console.log(`✅ Deleted ${deletedFiles.affectedRows} files from MySQL`);
        
        // Xóa tags trong MySQL
        const [deletedTags] = await connection.execute(
          `DELETE FROM tags WHERE group_id = ?`,
          [groupId]
        );
        console.log(`✅ Deleted ${deletedTags.affectedRows} tags from MySQL`);
        
        // Xóa group members
        const [deletedMembers] = await connection.execute(
          `DELETE FROM group_members WHERE group_id = ?`,
          [groupId]
        );
        console.log(`✅ Deleted ${deletedMembers.affectedRows} members from MySQL`);
        
        // Xóa group invitations
        const [deletedInvitations] = await connection.execute(
          `DELETE FROM group_invitations WHERE group_id = ?`,
          [groupId]
        );
        console.log(`✅ Deleted ${deletedInvitations.affectedRows} invitations from MySQL`);
        
        // Xóa nhóm
        const [deletedGroup] = await connection.execute(
          `DELETE FROM \`groups\` WHERE id = ?`,
          [groupId]
        );
        console.log(`✅ Deleted group ${groupId} from MySQL`);
        
        // Sync xóa sang Firebase (xóa group, members, files, tags)
        const syncResult = await syncGroupDelete(groupId);
        
        if (!syncResult.success) {
          console.warn(`⚠️ Firebase sync failed but MySQL delete succeeded`);
          console.warn(`❌ DATA MISMATCH: Group ${groupId} deleted in MySQL but may still exist in Firebase`);
        }
        
        return {
          success: true,
          message: 'Group deleted successfully',
          firebaseSyncSuccess: syncResult.success
        };
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Cập nhật thông tin nhóm
   * @param {number} groupId - ID nhóm
   * @param {Object} updateData - Dữ liệu cập nhật
   * @param {string} updatedBy - Firebase UID của người cập nhật
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  static async update(groupId, updateData, updatedBy) {
    try {
      // Kiểm tra quyền cập nhật (admin)
      const adminCheck = await executeQuery(
        `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, updatedBy]
      );
      
      if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
        throw new Error('Only admins can update group information');
      }
      
      // Bỏ group_photo_url - không lưu trong MySQL, chỉ lưu trong Firebase
      const allowedFields = ['name', 'description'];
      const updates = [];
      const values = [];
      
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          updates.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });
      
      if (updates.length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }
      
      values.push(groupId);
      
      await executeQuery(
        `UPDATE \`groups\` SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      const updatedGroup = await this.findById(groupId);
      
      return {
        success: true,
        message: 'Group updated successfully',
        data: updatedGroup
      };
    } catch (error) {
      console.error('Error updating group:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = Group;