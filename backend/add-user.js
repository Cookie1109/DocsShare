const { executeQuery } = require('./src/config/db');

async function addCurrentUser() {
  try {
    const userEmail = 'hoauy95@gmail.com';
    const userId = 'hoauy95@gmail.com'; // Using email as ID for now
    const displayName = 'hehe'; // From UI
    
    console.log(`Adding user ${userEmail} to database...`);
    
    // Add user to users table
    const tag = '#5996'; // Generate a tag
    await executeQuery(
      `INSERT INTO users (id, email, display_name, tag, created_at) 
       VALUES (?, ?, ?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE 
       email = VALUES(email), 
       display_name = VALUES(display_name),
       tag = VALUES(tag)`,
      [userId, userEmail, displayName, tag]
    );
    
    console.log('✅ User added successfully');
    
    // Add user to an existing group (group 3 - "hehe")
    const groupId = 3; // From mapping table: IewNBzGITBR8513xZRUN -> 3
    
    await executeQuery(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, 'member', NOW())
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [groupId, userId]
    );
    
    console.log(`✅ User added to group ${groupId}`);
    
    // Verify the addition
    const memberCheck = await executeQuery(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
    
    console.log('🔍 Verification:', memberCheck);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addCurrentUser();