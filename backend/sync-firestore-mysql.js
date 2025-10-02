// Sync Firestore groups to MySQL 
const { executeQuery } = require('./src/config/db');
const admin = require('./src/config/firebaseAdmin');

async function syncFirestoreToMySQL() {
  try {
    console.log('🔄 SYNCING FIRESTORE GROUPS TO MYSQL...\n');
    
    // 1. Get all groups from Firestore
    const groupsSnapshot = await admin.firestore().collection('groups').get();
    console.log(`📋 Found ${groupsSnapshot.docs.length} groups in Firestore`);
    
    // 2. Get all group_members from Firestore  
    const membersSnapshot = await admin.firestore().collection('group_members').get();
    console.log(`👥 Found ${membersSnapshot.docs.length} memberships in Firestore`);
    
    // 3. Sync groups to MySQL
    for (const doc of groupsSnapshot.docs) {
      const groupData = doc.data();
      const groupId = doc.id;
      
      console.log(`📝 Syncing group: ${groupData.name} (${groupId})`);
      
      try {
        // Insert group into MySQL (use Firestore doc ID as MySQL ID)
        await executeQuery(`
          INSERT IGNORE INTO \`groups\` (id, name, description, group_photo_url, creator_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          groupId,
          groupData.name,
          `Synced from Firestore: ${groupData.name}`,
          groupData.groupPhotoUrl || null,
          groupData.creatorId,
          groupData.createdAt ? new Date(groupData.createdAt.toDate()) : new Date()
        ]);
        console.log(`✅ Group ${groupData.name} synced to MySQL`);
      } catch (error) {
        console.log(`⚠️ Group ${groupData.name} sync failed:`, error.message);
      }
    }
    
    // 4. Sync memberships to MySQL
    for (const doc of membersSnapshot.docs) {
      const memberData = doc.data();
      
      console.log(`👤 Syncing membership: ${memberData.userId} -> ${memberData.groupId}`);
      
      try {
        await executeQuery(`
          INSERT IGNORE INTO group_members (group_id, user_id, role, joined_at)
          VALUES (?, ?, ?, ?)
        `, [
          memberData.groupId,
          memberData.userId,
          memberData.role || 'member',
          memberData.joinedAt ? new Date(memberData.joinedAt.toDate()) : new Date()
        ]);
        console.log(`✅ Membership synced: ${memberData.userId} -> ${memberData.groupId}`);
      } catch (error) {
        console.log(`⚠️ Membership sync failed:`, error.message);
      }
    }
    
    // 5. Verify sync
    console.log('\n🔍 VERIFICATION:');
    const mysqlGroups = await executeQuery('SELECT id, name, creator_id FROM `groups`');
    console.log('📋 Groups in MySQL after sync:');
    console.table(mysqlGroups);
    
    const mysqlMembers = await executeQuery(`
      SELECT gm.group_id, gm.user_id, gm.role, g.name as group_name
      FROM group_members gm
      LEFT JOIN \`groups\` g ON gm.group_id = g.id
    `);
    console.log('👥 Memberships in MySQL after sync:');
    console.table(mysqlMembers);
    
    console.log('\n✅ SYNC COMPLETED! Upload should work now.');
    
  } catch (error) {
    console.error('❌ Sync error:', error);
  }
  
  process.exit(0);
}

syncFirestoreToMySQL();