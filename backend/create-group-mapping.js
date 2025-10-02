// Create mapping between Firestore string IDs and MySQL integer IDs
const { executeQuery } = require('./src/config/db');
const admin = require('./src/config/firebaseAdmin');

async function createGroupMapping() {
  try {
    console.log('🔄 CREATING FIRESTORE-MYSQL GROUP MAPPING...\n');
    
    // 1. Get all groups from Firestore
    const groupsSnapshot = await admin.firestore().collection('groups').get();
    console.log(`📋 Found ${groupsSnapshot.docs.length} groups in Firestore`);
    
    // 2. Create mapping table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS group_mapping (
        firestore_id VARCHAR(128) PRIMARY KEY,
        mysql_id INT AUTO_INCREMENT UNIQUE,
        group_name VARCHAR(255),
        creator_id VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(mysql_id)
      )
    `);
    
    // 3. Insert groups with mapping
    for (const doc of groupsSnapshot.docs) {
      const groupData = doc.data();
      const firestoreId = doc.id;
      
      console.log(`📝 Mapping group: ${groupData.name} (${firestoreId})`);
      
      try {
        // Insert into mapping table (mysql_id will auto-increment)
        await executeQuery(`
          INSERT IGNORE INTO group_mapping (firestore_id, group_name, creator_id)
          VALUES (?, ?, ?)
        `, [firestoreId, groupData.name, groupData.creatorId]);
        
        // Get the generated mysql_id
        const [mapping] = await executeQuery(`
          SELECT mysql_id FROM group_mapping WHERE firestore_id = ?
        `, [firestoreId]);
        
        const mysqlId = mapping[0].mysql_id;
        
        // Insert into groups table with mysql_id
        await executeQuery(`
          INSERT IGNORE INTO \`groups\` (id, name, description, creator_id)
          VALUES (?, ?, ?, ?)
        `, [
          mysqlId,
          groupData.name,
          `Mapped from Firestore: ${groupData.name}`,
          groupData.creatorId
        ]);
        
        console.log(`✅ Group mapped: ${firestoreId} -> ${mysqlId}`);
        
      } catch (error) {
        console.log(`⚠️ Mapping failed for ${groupData.name}:`, error.message);
      }
    }
    
    // 4. Create memberships with mapped IDs
    const membersSnapshot = await admin.firestore().collection('group_members').get();
    
    for (const doc of membersSnapshot.docs) {
      const memberData = doc.data();
      
      // Get MySQL group ID from mapping
      const [mapping] = await executeQuery(`
        SELECT mysql_id FROM group_mapping WHERE firestore_id = ?
      `, [memberData.groupId]);
      
      if (mapping.length > 0) {
        const mysqlGroupId = mapping[0].mysql_id;
        
        await executeQuery(`
          INSERT IGNORE INTO group_members (group_id, user_id, role)
          VALUES (?, ?, ?)
        `, [mysqlGroupId, memberData.userId, memberData.role || 'member']);
        
        console.log(`✅ Membership mapped: ${memberData.userId} -> group ${mysqlGroupId}`);
      }
    }
    
    // 5. Show mapping results
    console.log('\n📋 GROUP MAPPING:');
    const mappings = await executeQuery(`
      SELECT m.firestore_id, m.mysql_id, m.group_name, g.creator_id
      FROM group_mapping m
      LEFT JOIN \`groups\` g ON m.mysql_id = g.id
    `);
    console.table(mappings);
    
    console.log('\n👥 MEMBERSHIPS:');
    const memberships = await executeQuery(`
      SELECT gm.group_id, gm.user_id, gm.role, g.name
      FROM group_members gm
      LEFT JOIN \`groups\` g ON gm.group_id = g.id
    `);
    console.table(memberships);
    
    console.log('\n✅ MAPPING COMPLETED!');
    console.log('💡 Frontend should use Firestore IDs, backend will map to MySQL IDs');
    
  } catch (error) {
    console.error('❌ Mapping error:', error);
  }
  
  process.exit(0);
}

createGroupMapping();