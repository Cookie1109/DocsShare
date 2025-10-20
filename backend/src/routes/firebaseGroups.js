const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');
const verifyFirebaseToken = require('../middleware/firebaseAuth');
const admin = require('../config/firebaseAdmin');

// Apply Firebase auth middleware to all routes
router.use(verifyFirebaseToken);

/**
 * POST /api/firebase-groups
 * Create a new group in both Firestore and MySQL with proper mapping
 * This ensures both databases stay synchronized
 */
router.post('/', async (req, res) => {
  try {
    const { groupName, groupPhotoUrl } = req.body;
    const creatorId = req.user.uid;

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Group name is required'
      });
    }

    console.log('🆕 Creating new group:', groupName, 'by user:', creatorId);

    // Step 1: Create group in MySQL
    const mysqlResultRaw = await executeQuery(
      `INSERT INTO \`groups\` (name, description, group_photo_url, creator_id, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [groupName.trim(), null, groupPhotoUrl || null, creatorId]
    );

    // Handle different result formats
    const mysqlResult = Array.isArray(mysqlResultRaw[0]) ? mysqlResultRaw[0] : mysqlResultRaw;
    const mysqlGroupId = mysqlResult.insertId;
    console.log('✅ MySQL group created with ID:', mysqlGroupId);

    // Step 2: Add creator as admin in group_members
    await executeQuery(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, 'admin', NOW())`,
      [mysqlGroupId, creatorId]
    );
    console.log('✅ Creator added as admin in MySQL');

    // Step 3: Create group in Firestore
    const firestoreGroupRef = await admin.firestore().collection('groups').add({
      name: groupName.trim(),
      creatorId: creatorId,
      groupPhotoUrl: groupPhotoUrl || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const firestoreGroupId = firestoreGroupRef.id;
    console.log('✅ Firestore group created with ID:', firestoreGroupId);

    // Step 4: Add creator as admin in Firestore group_members
    await admin.firestore().collection('group_members').add({
      groupId: firestoreGroupId,
      userId: creatorId,
      role: 'admin',
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Creator added as admin in Firestore');

    // Step 5: Create mapping between MySQL and Firestore
    await executeQuery(
      `INSERT INTO group_mapping (firestore_id, mysql_id, group_name, creator_id)
       VALUES (?, ?, ?, ?)`,
      [firestoreGroupId, mysqlGroupId, groupName.trim(), creatorId]
    );
    console.log('✅ Mapping created:', firestoreGroupId, '→', mysqlGroupId);

    // Step 6: Log activity
    await executeQuery(
      `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
       VALUES (?, 'create_group', ?, JSON_OBJECT('group_name', ?), NOW())`,
      [creatorId, mysqlGroupId.toString(), groupName.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: {
        firestoreGroupId,
        mysqlGroupId,
        name: groupName.trim(),
        creatorId,
        groupPhotoUrl: groupPhotoUrl || null
      }
    });

  } catch (error) {
    console.error('❌ Error creating group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/firebase-groups/:firestoreGroupId/tags
 * Get tags for a Firebase group (convert to MySQL group ID internally)
 */
router.get('/:firestoreGroupId/tags', async (req, res) => {
  try {
    const { firestoreGroupId } = req.params;
    const userId = req.user.uid;

    // 1. Get MySQL group ID from mapping (auto-create if not exists)
    const mappingResult = await executeQuery(
      `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );

    // Handle different result formats - extract array of rows
    const mapping = Array.isArray(mappingResult[0]) ? mappingResult[0] : 
                    (Array.isArray(mappingResult) ? mappingResult : []);

    console.log('🗺️ Group mapping result for tags:', mapping);
    
    let mysqlGroupId;
    
    if (!mapping || mapping.length === 0) {
      console.log('🆕 Creating new group and mapping for:', firestoreGroupId);
      
      // First create a new group in MySQL
      const groupResultRaw = await executeQuery(
        `INSERT INTO \`groups\` (name, description, creator_id) VALUES (?, ?, ?)`,
        [`Group ${firestoreGroupId.substring(0, 8)}`, `Auto-created group for Firebase ID: ${firestoreGroupId}`, userId]
      );
      
      const groupResult = Array.isArray(groupResultRaw[0]) ? groupResultRaw[0] : groupResultRaw;
      mysqlGroupId = groupResult.insertId;
      
      // Then create the mapping
      await executeQuery(
        `INSERT INTO group_mapping (firestore_id, mysql_id, group_name) VALUES (?, ?, ?)`,
        [firestoreGroupId, mysqlGroupId, `Group ${firestoreGroupId.substring(0, 8)}`]
      );
      
      console.log('✅ Created group:', mysqlGroupId, 'and mapping:', firestoreGroupId, '→', mysqlGroupId);
    } else {
      // Mapping exists - get MySQL group ID
      mysqlGroupId = mapping[0].mysql_id;
      console.log('✅ Found existing mapping:', firestoreGroupId, '→', mysqlGroupId);
    }

    // 2. Skip member check for now (will implement later)
    // TODO: Implement proper group member validation
    console.log('👤 User:', userId, 'accessing group:', mysqlGroupId);

    // 3. Get tags for this group
    const result = await executeQuery(
      `SELECT id, name, creator_id 
       FROM tags 
       WHERE group_id = ? 
       ORDER BY id DESC`,
      [mysqlGroupId]
    );
    
    // Ensure we get array format - MySQL result can be [rows, metadata] or just rows
    const tags = Array.isArray(result[0]) ? result[0] : (Array.isArray(result) ? result : [result]);

    console.log(`🏷️ Raw tags from DB for group ${mysqlGroupId}:`, tags);
    console.log(`🏷️ Tags type: ${typeof tags}, isArray: ${Array.isArray(tags)}, length: ${tags?.length}`);

    // Add default colors for frontend - force to array
    const tagsArray = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    const tagsWithColors = tagsArray.map((tag, index) => ({
      ...tag,
      color: ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500'][index % 6]
    }));

    console.log(`✅ Returning ${tagsWithColors.length} tags:`, tagsWithColors);

    res.json({
      success: true,
      data: tagsWithColors
    });

  } catch (error) {
    console.error('Error fetching Firebase group tags:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/firebase-groups/:firestoreGroupId/tags
 * Create tag for a Firebase group
 */
router.post('/:firestoreGroupId/tags', async (req, res) => {
  try {
    const { firestoreGroupId } = req.params;
    const { name } = req.body;
    const userId = req.user.uid;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required'
      });
    }

    // 1. Get MySQL group ID from mapping (auto-create if not exists)
    const mappingResult = await executeQuery(
      `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );

    // Handle different result formats - extract array of rows
    const mapping = Array.isArray(mappingResult[0]) ? mappingResult[0] : 
                    (Array.isArray(mappingResult) ? mappingResult : []);

    console.log('🗺️ Group mapping result for creating tag:', mapping);
    
    let mysqlGroupId;
    
    if (!mapping || mapping.length === 0) {
      console.log('🆕 Creating new group and mapping for tag creation:', firestoreGroupId);
      
      // First create a new group in MySQL
      const groupResultRaw = await executeQuery(
        `INSERT INTO \`groups\` (name, description, creator_id) VALUES (?, ?, ?)`,
        [`Group ${firestoreGroupId.substring(0, 8)}`, `Auto-created group for Firebase ID: ${firestoreGroupId}`, userId]
      );
      
      const groupResult = Array.isArray(groupResultRaw[0]) ? groupResultRaw[0] : groupResultRaw;
      mysqlGroupId = groupResult.insertId;
      
      // Then create the mapping
      await executeQuery(
        `INSERT INTO group_mapping (firestore_id, mysql_id, group_name) VALUES (?, ?, ?)`,
        [firestoreGroupId, mysqlGroupId, `Group ${firestoreGroupId.substring(0, 8)}`]
      );
      
      console.log('✅ Created group:', mysqlGroupId, 'and mapping for tags:', firestoreGroupId, '→', mysqlGroupId);
    } else {
      // Mapping exists - get MySQL group ID
      mysqlGroupId = mapping[0].mysql_id;
      console.log('✅ Found existing mapping for tag creation:', firestoreGroupId, '→', mysqlGroupId);
    }

    // 2. Skip member check for now (will implement later)
    // TODO: Implement proper group member validation  
    console.log('👤 User:', userId, 'creating tag in group:', mysqlGroupId);

    // 3. Check if tag already exists in this group
    const [existingTag] = await executeQuery(
      `SELECT id FROM tags WHERE name = ? AND group_id = ?`,
      [name.trim(), mysqlGroupId]
    );

    if (existingTag && existingTag.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Tag with this name already exists in the group'
      });
    }

    // 4. Create the tag
    const result = await executeQuery(
      `INSERT INTO tags (name, group_id, creator_id) VALUES (?, ?, ?)`,
      [name.trim(), mysqlGroupId, userId]
    );

    console.log('📝 Insert result:', result);

    // Handle different result formats - properly extract insertId
    let insertId;
    if (Array.isArray(result) && result[0]) {
      // If result is array, check first element
      insertId = result[0].insertId || result[0].id;
    } else if (result.insertId) {
      // Direct insertId property
      insertId = result.insertId;
    } else {
      console.error('❌ Could not extract insertId from result:', result);
      throw new Error('Failed to get tag ID from database');
    }
    
    console.log('✅ Tag created with ID:', insertId);
    
    const newTag = {
      id: insertId,
      name: name.trim(),
      group_id: mysqlGroupId,
      creator_id: userId,
      color: req.body.color || 'bg-blue-500'
    };

    res.status(201).json({
      success: true,
      data: newTag
    });

  } catch (error) {
    console.error('Error creating Firebase group tag:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/firebase-groups/:firestoreGroupId/tags/:tagId
 * Delete a tag from a Firebase group
 */
router.delete('/:firestoreGroupId/tags/:tagId', async (req, res) => {
  try {
    const { firestoreGroupId, tagId } = req.params;
    const userId = req.user.uid;

    console.log(`🗑️ Delete tag request: tagId=${tagId}, firestoreGroupId=${firestoreGroupId}, userId=${userId}`);

    // 1. Get MySQL group ID from mapping
    const mappingResult = await executeQuery(
      `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );

    const mapping = Array.isArray(mappingResult[0]) ? mappingResult[0] : (Array.isArray(mappingResult) ? mappingResult : [mappingResult]);

    if (!mapping || mapping.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    const mysqlGroupId = mapping[0].mysql_id;

    // 2. Check if tag exists and belongs to this group
    const tagCheckResult = await executeQuery(
      `SELECT id, name FROM tags WHERE id = ? AND group_id = ?`,
      [tagId, mysqlGroupId]
    );

    const tagCheck = Array.isArray(tagCheckResult[0]) ? tagCheckResult[0] : (Array.isArray(tagCheckResult) ? tagCheckResult : [tagCheckResult]);

    console.log('🔍 tagCheck result:', tagCheck, 'length:', tagCheck.length);

    if (!tagCheck || tagCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found or does not belong to this group'
      });
    }

    const tagName = tagCheck[0].name;

    // 3. Get file count using this tag
    const fileCountResult = await executeQuery(
      `SELECT COUNT(*) as count FROM file_tags WHERE tag_id = ?`,
      [tagId]
    );

    const fileCount = Array.isArray(fileCountResult[0]) ? fileCountResult[0] : (Array.isArray(fileCountResult) ? fileCountResult : [fileCountResult]);

    const filesUsingTag = fileCount[0]?.count || 0;
    console.log(`📊 Tag "${tagName}" is used by ${filesUsingTag} file(s)`);

    // 4. Get all files that have this tag (before deleting)
    const filesWithTagResult = await executeQuery(
      `SELECT file_id FROM file_tags WHERE tag_id = ?`,
      [tagId]
    );
    
    const filesWithTag = Array.isArray(filesWithTagResult[0]) ? filesWithTagResult[0] : (Array.isArray(filesWithTagResult) ? filesWithTagResult : [filesWithTagResult]);
    const fileIdsToUpdate = filesWithTag.map(row => row.file_id);
    
    console.log(`📝 Files to update in Firestore:`, fileIdsToUpdate);

    // 5. Delete the tag from MySQL (CASCADE will handle file_tags)
    await executeQuery(
      `DELETE FROM tags WHERE id = ?`,
      [tagId]
    );

    console.log(`✅ Tag ${tagId} deleted from MySQL successfully`);

    // 6. Update Firestore - remove tagId from all files
    if (fileIdsToUpdate.length > 0) {
      const db = admin.firestore();
      const batch = db.batch();
      
      for (const fileId of fileIdsToUpdate) {
        const fileRef = db.collection('groups').doc(firestoreGroupId).collection('files').doc(fileId.toString());
        
        // Remove from both tagIds array and tags object
        batch.update(fileRef, {
          tagIds: admin.firestore.FieldValue.arrayRemove(parseInt(tagId)),
          [`tags.${tagId}`]: admin.firestore.FieldValue.delete()
        });
      }
      
      await batch.commit();
      console.log(`✅ Updated ${fileIdsToUpdate.length} files in Firestore, removed tagId ${tagId} from both tagIds and tags`);
    }

    console.log(`✅ Tag ${tagId} deleted completely`);

    res.json({
      success: true,
      message: 'Tag deleted successfully',
      data: {
        tagId: parseInt(tagId),
        filesAffected: filesUsingTag
      }
    });

  } catch (error) {
    console.error('Error deleting Firebase group tag:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Debug route to check group mapping
router.get('/:firestoreGroupId/debug', async (req, res) => {
  try {
    const { firestoreGroupId } = req.params;
    
    const mappingResult = await executeQuery(
      `SELECT * FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );
    
    // Handle different result formats
    const mapping = Array.isArray(mappingResult[0]) ? mappingResult[0] : 
                    (Array.isArray(mappingResult) ? mappingResult : []);
    
    res.json({
      success: true,
      firestoreGroupId,
      mapping,
      mappingLength: mapping ? mapping.length : 0,
      firstResult: mapping && mapping[0] ? mapping[0] : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;