const cloudinary = require('cloudinary').v2;
const { executeQuery, executeTransaction, db } = require('../config/db');
const admin = require('../config/firebaseAdmin');

// Ensure Cloudinary is configured for destroy operations
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * API Controller cho file upload system
 * - POST /api/files/signature: Tạo Cloudinary signature an toàn
 * - POST /api/files/metadata: Lưu file metadata vào MySQL và Firestore
 */

/**
 * POST /api/files/signature
 * Tạo chữ ký upload an toàn cho Cloudinary
 */
const createUploadSignature = async (req, res) => {
  try {
    // Xác thực người dùng đã được thực hiện bởi Firebase middleware
    const userId = req.user.uid;
    console.log(`✅ Creating upload signature for user: ${req.user.email}`);

    // Tạo timestamp cho signature
    const timestamp = Math.round(Date.now() / 1000);
    
    // Cấu hình upload parameters - chỉ params cần thiết cho signature
    const uploadParams = {
      timestamp: timestamp,
      folder: 'docsshare/documents'
    };

    // Tạo signature sử dụng Cloudinary utils
    const signature = cloudinary.utils.api_sign_request(
      uploadParams,
      process.env.CLOUDINARY_API_SECRET
    );

    // Trả về signature và thông tin cần thiết
    res.json({
      success: true,
      data: {
        signature: signature,
        timestamp: timestamp,
        api_key: process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        folder: uploadParams.folder,
        resource_type: uploadParams.resource_type
      },
      message: 'Upload signature created successfully'
    });

    console.log(`✅ Upload signature created for user ${userId}`);

  } catch (error) {
    console.error('❌ Error creating upload signature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create upload signature',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/files/metadata
 * Lưu thông tin file và tags vào MySQL và Firestore
 */
const saveFileMetadata = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, url, size, mimeType, groupId, tagIds = [] } = req.body;

    // Validation
    if (!name || !url || !size || !mimeType || !groupId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, url, size, mimeType, groupId'
      });
    }

    console.log(`✅ Saving file metadata for user: ${req.user.email}, file: ${name}`);
    console.log(`📊 Processing upload for userId: ${userId}, firestoreGroupId: ${groupId}`);

    // Bắt đầu MySQL transaction
    const result = await executeTransaction(async (connection) => {
      // 1. Tự động tạo user nếu chưa tồn tại
      await connection.execute(
        `INSERT IGNORE INTO users (id, email, display_name, tag) 
         VALUES (?, ?, ?, ?)`,
        [userId, req.user.email, req.user.displayName || req.user.email.split('@')[0], '0001']
      );
      
      // 2. Map Firestore group ID to MySQL ID
      const [groupMapping] = await connection.execute(
        `SELECT mysql_id, group_name FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      let mysqlGroupId, groupName;
      
      if (groupMapping.length === 0) {
        // Auto-create new mapping for unknown Firestore group ID
        console.log(`⚠️ No mapping found for ${groupId}, creating new mapping...`);
        
        // Find next available MySQL group ID
        const [maxIdResult] = await connection.execute(
          `SELECT COALESCE(MAX(mysql_id), 0) + 1 as next_id FROM group_mapping`
        );
        mysqlGroupId = maxIdResult[0].next_id;
        groupName = `Auto Group ${mysqlGroupId}`;
        
        // Create new mapping
        await connection.execute(
          `INSERT INTO group_mapping (firestore_id, mysql_id, group_name, created_at) 
           VALUES (?, ?, ?, NOW())`,
          [groupId, mysqlGroupId, groupName]
        );
        
        console.log(`✅ Created new mapping: ${groupId} -> MySQL ID ${mysqlGroupId} (${groupName})`);
      } else {
        mysqlGroupId = groupMapping[0].mysql_id;
        groupName = groupMapping[0].group_name;
        console.log(`📍 Mapped Firestore ID ${groupId} -> MySQL ID ${mysqlGroupId} (${groupName})`);
      }
      
      // 3. Kiểm tra/tạo group
      const [existingGroup] = await connection.execute(
        `SELECT id, name FROM \`groups\` WHERE id = ?`,
        [mysqlGroupId]
      );
      
      if (existingGroup.length === 0) {
        console.log(`⚠️ Group ${mysqlGroupId} not found, auto-creating...`);
        await connection.execute(
          `INSERT INTO \`groups\` (id, name, description, creator_id) 
           VALUES (?, ?, ?, ?)`,
          [mysqlGroupId, groupName, 'Auto-created group for file sharing', userId]
        );
      }
      
      // 4. Kiểm tra/tạo membership
      const [memberCheck] = await connection.execute(
        `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
        [mysqlGroupId, userId]
      );
      
      if (memberCheck.length === 0) {
        console.log(`⚠️ User not in group ${mysqlGroupId}, auto-adding as admin...`);
        await connection.execute(
          `INSERT INTO group_members (group_id, user_id, role) 
           VALUES (?, ?, 'admin')`,
          [mysqlGroupId, userId]
        );
      }
      
      console.log(`✅ User verified/added as member of group ${groupName}`);

      // 5. Insert file vào bảng files (using MySQL group ID)
      const [fileResult] = await connection.execute(
        `INSERT INTO files (name, storage_path, mime_type, size_bytes, group_id, uploader_id, download_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
        [name, url, mimeType, size, mysqlGroupId, userId]
      );

      const newFileId = fileResult.insertId;

      // 5. Xử lý tags nếu có
      const assignedTags = [];
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          if (typeof tagId === 'number' && tagId > 0) {
            // Kiểm tra tag có tồn tại và thuộc group không (using MySQL group ID)
            const [tagCheck] = await connection.execute(
              `SELECT id, name FROM tags WHERE id = ? AND group_id = ?`,
              [tagId, mysqlGroupId]
            );

            if (tagCheck.length > 0) {
              // Insert vào file_tags
              await connection.execute(
                `INSERT IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)`,
                [newFileId, tagId]
              );
              
              assignedTags.push({
                id: tagCheck[0].id,
                name: tagCheck[0].name
              });
            }
          }
        }
      }

      // 4. Log activity
      await connection.execute(
        `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
         VALUES (?, 'upload', ?, JSON_OBJECT('file_name', ?, 'file_size', ?), NOW())`,
        [userId, newFileId.toString(), name, size]
      );

      return {
        fileId: newFileId,
        assignedTags: assignedTags
      };
    });

    // 6. Cập nhật Firestore cho real-time
    try {
      // Tạo tagsMap từ assigned tags
      const tagsMap = {};
      result.assignedTags.forEach(tag => {
        tagsMap[tag.id.toString()] = tag.name;
      });

      console.log(`🏷️ Saving to Firebase - TagIds: ${JSON.stringify(tagIds)}, AssignedTags: ${JSON.stringify(result.assignedTags)}, TagsMap: ${JSON.stringify(tagsMap)}`);

      // Tạo document trong Firestore
      const fileDoc = {
        id: result.fileId,
        name: name,
        url: url,
        size: size,
        mimeType: mimeType,
        uploaderId: userId,
        uploaderEmail: req.user.email,
        uploaderName: req.user.displayName || req.user.email,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        downloadCount: 0,
        tags: tagsMap,
        tagIds: tagIds || []
      };

      // Lưu vào subcollection groups/{firestoreGroupId}/files/{fileId} 
      // (sử dụng Firestore group ID để consistent với frontend)
      await admin.firestore()
        .collection('groups')
        .doc(groupId.toString())
        .collection('files')
        .doc(result.fileId.toString())
        .set(fileDoc);

      console.log(`✅ File metadata saved to Firestore: groups/${groupId}/files/${result.fileId}`);

    } catch (firestoreError) {
      console.error('⚠️ Firestore update failed, but MySQL transaction succeeded:', firestoreError);
      // Không throw error vì MySQL đã thành công
    }

    // 7. Trả về kết quả trực tiếp từ input data (không cần query lại)
    res.json({
      success: true,
      data: {
        id: result.fileId,
        name: name,
        url: url,
        size: size,
        mimeType: mimeType,
        groupId: groupId,
        uploader: {
          uid: userId,
          name: req.user.displayName || req.user.email.split('@')[0],
          email: req.user.email
        },
        tags: result.assignedTags || [],
        downloadCount: 0,
        createdAt: new Date().toISOString()
      },
      message: 'File metadata saved successfully'
    });

    console.log(`✅ File metadata saved successfully - File ID: ${result.fileId}`);

  } catch (error) {
    console.error('❌ Error saving file metadata:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save file metadata',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * GET /api/files/debug/user-groups
 * Debug endpoint để kiểm tra user groups
 */
const debugUserGroups = async (req, res) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    
    const [userGroups] = await db.execute(`
      SELECT g.id, g.name, gm.user_id, u.email, u.firebase_uid
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id  
      LEFT JOIN users u ON gm.user_id = u.id
      WHERE u.firebase_uid = ? OR gm.user_id = ?
    `, [userId, userId]);
    
    console.log(`🔍 Debug user groups for ${userEmail} (${userId}):`, userGroups);
    
    res.json({
      success: true,
      userId,
      userEmail,
      groups: userGroups
    });
  } catch (error) {
    console.error('❌ Debug user groups error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/files/group/:groupId
 * Lấy danh sách files trong group (bonus endpoint)
 */
const getGroupFiles = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { groupId: firestoreGroupId } = req.params;

    console.log(`🔍 Getting files for Firebase group: ${firestoreGroupId}, user: ${userId}`);

    // Convert Firebase group ID to MySQL group ID
    const groupMapping = await executeQuery(
      `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );

    console.log(`🗺️ Group mapping result:`, groupMapping);

    if (!groupMapping || groupMapping.length === 0) {
      console.log(`⚠️ Group mapping not found for: ${firestoreGroupId} - returning empty file list (new group)`);
      return res.status(200).json({
        success: true,
        data: [] // Return empty array for new groups without MySQL mapping yet
      });
    }

    const mysqlGroupId = groupMapping[0].mysql_id;
    console.log(`✅ Mapped to MySQL group: ${mysqlGroupId}`);

    // Kiểm tra user có trong group không
    const [memberCheck] = await executeQuery(
      `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
      [mysqlGroupId, userId]
    );
    
    if (memberCheck.length === 0) {
      console.log(`❌ User ${userId} is not a member of group ${mysqlGroupId}`);
      return res.status(403).json({
        success: false,
        message: 'User is not a member of this group'
      });
    }

    console.log(`✅ User is member of group ${mysqlGroupId}`);

    // Lấy files với tags (file mới nhất ở dưới cùng như chat)
    const files = await executeQuery(`
      SELECT 
        f.*,
        GROUP_CONCAT(
          JSON_OBJECT('id', t.id, 'name', t.name)
        ) as tags_json
      FROM files f
      LEFT JOIN file_tags ft ON f.id = ft.file_id
      LEFT JOIN tags t ON ft.tag_id = t.id
      WHERE f.group_id = ?
      GROUP BY f.id
      ORDER BY f.created_at ASC
    `, [mysqlGroupId]);

    // Get Firebase user data for all uploaders
    const uploaderIds = [...new Set(files.map(f => f.uploader_id))];
    const uploaderData = {};
    
    for (const uid of uploaderIds) {
      try {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          uploaderData[uid] = {
            displayName: userData.displayName || userData.display_name || userData.email?.split('@')[0],
            userTag: userData.userTag || userData.tag,
            avatar: userData.photoURL || userData.avatar
          };
        }
      } catch (err) {
        console.error(`Error fetching user ${uid} from Firebase:`, err);
      }
    }

    // Parse tags JSON and extract tag IDs
    const filesWithTags = files.map(file => {
      let tagsArray = [];
      let tagIds = [];
      
      if (file.tags_json) {
        try {
          tagsArray = JSON.parse(`[${file.tags_json}]`);
          tagIds = tagsArray.map(t => t.id).filter(id => id != null);
        } catch (err) {
          console.error('Error parsing tags JSON:', err);
        }
      }
      
      const uploader = uploaderData[file.uploader_id] || {};
      
      return {
        id: file.id,
        name: file.name,
        url: file.storage_path,
        size: file.size_bytes,
        mimeType: file.mime_type,
        uploader: {
          uid: file.uploader_id,
          name: uploader.displayName || 'Unknown',
          tag: uploader.userTag,
          avatar: uploader.avatar
        },
        tags: tagsArray,
        tagIds: tagIds,
        downloadCount: file.download_count,
        createdAt: file.created_at
      };
    });

    res.json({
      success: true,
      data: filesWithTags,
      count: filesWithTags.length
    });

  } catch (error) {
    console.error('❌ Error getting group files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get group files'
    });
  }
};

/**
 * DELETE /api/files/:fileId
 * Xóa file - chỉ owner hoặc admin có thể xóa
 */
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.uid;
    
    console.log(`🗑️ Delete file request: fileId=${fileId}, userId=${userId}`);
    
    // 1. Lấy thông tin file trước
    const fileInfoResult = await executeQuery(`
      SELECT f.*, map.firestore_id as firebase_group_id
      FROM files f
      JOIN group_mapping map ON f.group_id = map.mysql_id
      WHERE f.id = ?
    `, [fileId]);
    
    if (!fileInfoResult || fileInfoResult.length === 0) {
      console.log(`❌ File ${fileId} not found`);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    const file = fileInfoResult[0];
    
    // 2. Kiểm tra quyền của user với group
    const memberResult = await executeQuery(`
      SELECT role FROM group_members WHERE group_id = ? AND user_id = ?
    `, [file.group_id, userId]);
    
    if (!memberResult || memberResult.length === 0) {
      console.log(`❌ User ${userId} is not a member of group ${file.group_id}`);
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this group'
      });
    }
    
    const userRole = memberResult[0].role;
    
    // 3. Kiểm tra quyền: chỉ owner hoặc admin mới được xóa
    const isOwner = file.uploader_id === userId;
    const isAdmin = userRole === 'admin';
    
    if (!isOwner && !isAdmin) {
      console.log(`❌ User ${userId} is not owner or admin, cannot delete file ${fileId}`);
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own files or you must be an admin'
      });
    }
    
    console.log(`✅ User ${userId} has permission to delete file ${fileId} (${isOwner ? 'owner' : 'admin'})`);
    
    // 4. Xóa file trên Cloudinary
    try {
      // Extract public_id từ Cloudinary URL
      // URL format: https://res.cloudinary.com/cloud_name/raw/upload/v1234567890/docsshare/documents/filename.ext
      const url = file.storage_path;
      console.log(`🔍 Original Cloudinary URL: ${url}`);
      
      let publicId;
      
      try {
        // Parse URL để lấy chính xác public_id
        const urlParts = url.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');
        
        if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
          // Lấy phần sau 'upload/' 
          const afterUpload = urlParts.slice(uploadIndex + 1).join('/');
          
          // Loại bỏ version nếu có (v1234567890/)
          const withoutVersion = afterUpload.replace(/^v\d+\//, '');
          
          // Với raw files, public_id bao gồm cả folder và filename nhưng không có extension
          // Ví dụ: docsshare/documents/filename (không có .doc)
          publicId = withoutVersion.replace(/\.[^/.]+$/, '');
          
          console.log(`🎯 Extracted public_id: ${publicId}`);
        }
      } catch (parseError) {
        console.error('⚠️ Error parsing Cloudinary URL:', parseError);
      }
      
      // Fallback nếu parsing thất bại
      if (!publicId) {
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        const filenameWithoutExt = filename.split('.')[0];
        publicId = `docsshare/documents/${filenameWithoutExt}`;
        console.log(`🔄 Using fallback public_id: ${publicId}`);
      }
      
      console.log(`🔄 Deleting from Cloudinary with public_id: ${publicId}`);
      
      // First, try to verify if file exists by listing resources
      try {
        console.log(`🔍 Checking if file exists in Cloudinary before deletion...`);
        
        const listResult = await cloudinary.api.resources({
          type: 'upload',
          resource_type: 'raw',
          prefix: 'docsshare/documents/',
          max_results: 100
        });
        
        console.log(`📋 Found ${listResult.resources.length} raw files in docsshare/documents/`);
        
        // Find our file in the list
        const targetFile = listResult.resources.find(resource => 
          resource.public_id === publicId || 
          resource.public_id === publicId.replace('docsshare/documents/', '') ||
          resource.public_id.includes(file.storage_path.split('/').pop().split('.')[0])
        );
        
        if (targetFile) {
          console.log(`✅ Found target file in Cloudinary:`, {
            public_id: targetFile.public_id,
            resource_type: targetFile.resource_type,
            format: targetFile.format,
            url: targetFile.secure_url
          });
          
          // Try to delete using the exact public_id from the list
          const deleteResult = await cloudinary.uploader.destroy(targetFile.public_id, {
            resource_type: 'raw'
          });
          
          console.log(`🗑️ Deletion result:`, deleteResult);
          
          if (deleteResult.result === 'ok') {
            console.log(`✅ SUCCESS! File deleted from Cloudinary: ${targetFile.public_id}`);
          } else {
            console.log(`❌ Deletion failed despite file existing: ${deleteResult.result}`);
          }
        } else {
          console.log(`⚠️ File not found in Cloudinary resources list. Possible public_ids checked:`, [
            publicId,
            publicId.replace('docsshare/documents/', ''),
            file.storage_path.split('/').pop().split('.')[0]
          ]);
          
          // List first few resources for debugging
          console.log(`🔍 First few resources in folder:`, listResult.resources.slice(0, 3).map(r => ({
            public_id: r.public_id,
            created_at: r.created_at
          })));
        }
        
      } catch (listError) {
        console.error(`❌ Error listing Cloudinary resources:`, listError.message);
        
        // Fallback to original deletion attempts
        console.log(`🔄 Falling back to direct deletion attempts...`);
        
        const possibleFormats = [
          { publicId: publicId, resourceType: 'raw' },
          { publicId: publicId.replace('docsshare/documents/', ''), resourceType: 'raw' },
          { publicId: file.storage_path.split('/').pop().split('.')[0], resourceType: 'raw' }
        ];
        
        for (const format of possibleFormats) {
          try {
            console.log(`🎯 Attempting deletion with public_id: "${format.publicId}"`);
            
            const result = await cloudinary.uploader.destroy(format.publicId, {
              resource_type: format.resourceType
            });
            
            console.log(`📝 Response:`, result);
            
            if (result.result === 'ok') {
              console.log(`✅ SUCCESS! File deleted: "${format.publicId}"`);
              break;
            }
          } catch (tryError) {
            console.log(`❌ Failed with "${format.publicId}":`, tryError.message);
          }
        }
      }

    } catch (cloudinaryError) {
      console.error('⚠️ Cloudinary deletion failed:', cloudinaryError);
      // Tiếp tục xóa trong database ngay cả khi Cloudinary fail
    }
    
    // 5. Xóa trong database với transaction
    await executeTransaction(async (connection) => {
      // Xóa file_tags trước (foreign key)
      await connection.execute(
        'DELETE FROM file_tags WHERE file_id = ?',
        [fileId]
      );
      
      // Xóa file record
      await connection.execute(
        'DELETE FROM files WHERE id = ?',
        [fileId]
      );
      
      console.log(`✅ File ${fileId} deleted from MySQL database`);
    });
    
    // 6. Xóa trong Firestore cho real-time update
    try {
      const firestoreGroupId = file.firebase_group_id;
      
      await admin.firestore()
        .collection('groups')
        .doc(firestoreGroupId)
        .collection('files')
        .doc(fileId.toString())
        .delete();
      
      console.log(`✅ File deleted from Firestore: groups/${firestoreGroupId}/files/${fileId}`);
    } catch (firestoreError) {
      console.error('⚠️ Firestore deletion failed:', firestoreError);
      // Không throw error vì MySQL đã thành công
    }
    
    res.json({
      success: true,
      message: 'File deleted successfully',
      data: {
        deletedFileId: fileId,
        fileName: file.name
      }
    });
    
    console.log(`✅ File ${fileId} (${file.name}) deleted successfully by user ${userId}`);
    
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createUploadSignature,
  saveFileMetadata,
  getGroupFiles,
  deleteFile,
  debugUserGroups
};