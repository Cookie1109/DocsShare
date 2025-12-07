const { executeQuery } = require('../config/db');

/**
 * FileVersion Model - Quản lý lịch sử phiên bản file
 */
class FileVersion {
  /**
   * Lưu phiên bản cũ vào lịch sử
   */
  static async saveVersion(fileId, versionData) {
    const query = `
      INSERT INTO file_versions 
        (file_id, version_number, file_name, storage_path, size_bytes, mime_type, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      fileId,
      versionData.version_number,
      versionData.file_name,
      versionData.storage_path,
      versionData.size_bytes,
      versionData.mime_type,
      versionData.uploaded_by,
      versionData.uploaded_at
    ];
    
    const result = await executeQuery(query, values);
    return result.insertId;
  }

  /**
   * Lấy tất cả phiên bản của file (sắp xếp mới nhất trước)
   */
  static async getVersionsByFileId(fileId) {
    const query = `
      SELECT 
        id,
        version_number,
        file_name,
        storage_path,
        size_bytes,
        mime_type,
        uploaded_by,
        uploaded_at
      FROM file_versions
      WHERE file_id = ?
      ORDER BY version_number DESC
    `;
    
    return await executeQuery(query, [fileId]);
  }

  /**
   * Lấy một phiên bản cụ thể
   */
  static async getVersionByNumber(fileId, versionNumber) {
    const query = `
      SELECT 
        id,
        version_number,
        file_name,
        storage_path,
        size_bytes,
        mime_type,
        uploaded_by,
        uploaded_at
      FROM file_versions
      WHERE file_id = ? AND version_number = ?
      LIMIT 1
    `;
    
    const results = await executeQuery(query, [fileId, versionNumber]);
    return results[0] || null;
  }

  /**
   * Đếm số lượng phiên bản của file
   */
  static async countVersions(fileId) {
    const query = `
      SELECT COUNT(*) as count
      FROM file_versions
      WHERE file_id = ?
    `;
    
    const results = await executeQuery(query, [fileId]);
    return results[0].count;
  }

  /**
   * Lấy phiên bản cũ nhất (để xóa khi vượt quá giới hạn)
   */
  static async getOldestVersion(fileId) {
    const query = `
      SELECT 
        id,
        version_number,
        storage_path
      FROM file_versions
      WHERE file_id = ?
      ORDER BY version_number ASC
      LIMIT 1
    `;
    
    const results = await executeQuery(query, [fileId]);
    return results[0] || null;
  }

  /**
   * Xóa một phiên bản
   */
  static async deleteVersion(versionId) {
    const query = `DELETE FROM file_versions WHERE id = ?`;
    return await executeQuery(query, [versionId]);
  }

  /**
   * Xóa phiên bản cũ nhất nếu vượt quá MAX_VERSIONS
   */
  static async cleanupOldVersions(fileId, maxVersions = 5) {
    const count = await this.countVersions(fileId);
    
    // Lưu ý: maxVersions - 1 vì bản current không nằm trong file_versions
    // VD: MAX = 5 → trong file_versions chỉ giữ 4 phiên bản (+ 1 current = 5 total)
    const maxHistoryVersions = maxVersions - 1;
    
    if (count >= maxHistoryVersions) {
      const oldestVersion = await this.getOldestVersion(fileId);
      
      if (oldestVersion) {
        await this.deleteVersion(oldestVersion.id);
        return {
          deleted: true,
          versionNumber: oldestVersion.version_number,
          storagePath: oldestVersion.storage_path
        };
      }
    }
    
    return { deleted: false };
  }

  /**
   * Lấy thống kê phiên bản
   */
  static async getVersionStats(fileId) {
    const query = `
      SELECT 
        MIN(version_number) as oldest_version,
        MAX(version_number) as latest_version,
        COUNT(*) as total_versions,
        SUM(size_bytes) as total_size
      FROM file_versions
      WHERE file_id = ?
    `;
    
    const results = await executeQuery(query, [fileId]);
    return results[0] || null;
  }
}

module.exports = FileVersion;
