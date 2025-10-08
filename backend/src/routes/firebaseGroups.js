const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');
const verifyFirebaseToken = require('../middleware/firebaseAuth');

// Apply Firebase auth middleware to all routes
router.use(verifyFirebaseToken);

/**
 * GET /api/firebase-groups/:firestoreGroupId/tags
 * Get tags for a Firebase group (convert to MySQL group ID internally)
 */
router.get('/:firestoreGroupId/tags', async (req, res) => {
  try {
    const { firestoreGroupId } = req.params;
    const userId = req.user.uid;

    // 1. Get MySQL group ID from mapping (auto-create if not exists)
    let [mapping] = await executeQuery(
      `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );

    console.log('🗺️ Group mapping result for tags:', mapping);
    
    let mysqlGroupId;
    
    if (mapping.length === 0) {
      console.log('🆕 Creating new group and mapping for:', firestoreGroupId);
      
      // First create a new group in MySQL
      const [groupResult] = await executeQuery(
        `INSERT INTO \`groups\` (name, description, creator_id) VALUES (?, ?, ?)`,
        [`Group ${firestoreGroupId.substring(0, 8)}`, `Auto-created group for Firebase ID: ${firestoreGroupId}`, userId]
      );
      
      mysqlGroupId = groupResult.insertId;
      
      // Then create the mapping
      const [mappingResult] = await executeQuery(
        `INSERT INTO group_mapping (firestore_id, mysql_id, group_name) VALUES (?, ?, ?)`,
        [firestoreGroupId, mysqlGroupId, `Group ${firestoreGroupId.substring(0, 8)}`]
      );
      
      console.log('✅ Created group:', mysqlGroupId, 'and mapping:', firestoreGroupId, '→', mysqlGroupId);
    } else {
      // Handle both array and object formats
      const mappingItem = Array.isArray(mapping) ? mapping[0] : mapping;
      if (!mappingItem || !mappingItem.mysql_id) {
        console.error('❌ Invalid mapping result:', mapping);
        return res.status(500).json({
          success: false,
          error: 'Invalid group mapping data'
        });
      }
      mysqlGroupId = mappingItem.mysql_id;
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
    let [mapping] = await executeQuery(
      `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );

    console.log('🗺️ Group mapping result for creating tag:', mapping);
    
    let mysqlGroupId;
    
    if (mapping.length === 0) {
      console.log('🆕 Creating new group and mapping for tag creation:', firestoreGroupId);
      
      // First create a new group in MySQL
      const [groupResult] = await executeQuery(
        `INSERT INTO \`groups\` (name, description, creator_id) VALUES (?, ?, ?)`,
        [`Group ${firestoreGroupId.substring(0, 8)}`, `Auto-created group for Firebase ID: ${firestoreGroupId}`, userId]
      );
      
      mysqlGroupId = groupResult.insertId;
      
      // Then create the mapping
      const [mappingResult] = await executeQuery(
        `INSERT INTO group_mapping (firestore_id, mysql_id, group_name) VALUES (?, ?, ?)`,
        [firestoreGroupId, mysqlGroupId, `Group ${firestoreGroupId.substring(0, 8)}`]
      );
      
      console.log('✅ Created group:', mysqlGroupId, 'and mapping for tags:', firestoreGroupId, '→', mysqlGroupId);
    } else {
      // Handle both array and object formats  
      const mappingItem = Array.isArray(mapping) ? mapping[0] : mapping;
      if (!mappingItem || !mappingItem.mysql_id) {
        console.error('❌ Invalid mapping result:', mapping);
        return res.status(500).json({
          success: false,
          error: 'Invalid group mapping data'
        });
      }
      mysqlGroupId = mappingItem.mysql_id;
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

    // Handle different result formats
    const insertId = result.insertId || result[0]?.insertId || result?.affectedRows > 0 ? Date.now() : null;
    
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

// Debug route to check group mapping
router.get('/:firestoreGroupId/debug', async (req, res) => {
  try {
    const { firestoreGroupId } = req.params;
    
    const [mapping] = await executeQuery(
      `SELECT * FROM group_mapping WHERE firestore_id = ?`,
      [firestoreGroupId]
    );
    
    res.json({
      success: true,
      firestoreGroupId,
      mapping,
      mappingLength: mapping.length,
      firstResult: mapping[0] || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;