// Update database schema to support Firestore string IDs
const { executeQuery } = require('./src/config/db');

async function updateSchema() {
  try {
    console.log('🔧 UPDATING DATABASE SCHEMA FOR FIRESTORE IDS...\n');
    
    // 1. Check current schema
    console.log('📋 Current groups table structure:');
    const currentSchema = await executeQuery('DESCRIBE `groups`');
    console.table(currentSchema);
    
    // 2. Update groups table to support string IDs
    console.log('\n🔧 Updating groups.id to VARCHAR...');
    
    // First, backup existing data
    const existingGroups = await executeQuery('SELECT * FROM `groups`');
    console.log('💾 Backing up existing groups:', existingGroups.length);
    
    // Drop foreign key constraints temporarily
    await executeQuery('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop all related tables first
    await executeQuery('DROP TABLE IF EXISTS `files`');
    await executeQuery('DROP TABLE IF EXISTS `file_tags`'); 
    await executeQuery('DROP TABLE IF EXISTS `tags`');
    await executeQuery('DROP TABLE IF EXISTS `group_members`');
    await executeQuery('DROP TABLE IF EXISTS `activity_logs`');
    
    // Backup and recreate groups table with string ID
    await executeQuery('DROP TABLE IF EXISTS `groups_backup`');
    await executeQuery(`
      CREATE TABLE \`groups_backup\` AS SELECT * FROM \`groups\`
    `);
    
    await executeQuery('DROP TABLE `groups`');
    
    await executeQuery(`
      CREATE TABLE \`groups\` (
        id VARCHAR(128) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        group_photo_url VARCHAR(2048),
        creator_id VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    
    // Update group_members table
    await executeQuery('DROP TABLE IF EXISTS `group_members_backup`');
    await executeQuery(`
      CREATE TABLE \`group_members_backup\` AS SELECT * FROM \`group_members\`
    `);
    
    await executeQuery('DROP TABLE `group_members`');
    
    await executeQuery(`
      CREATE TABLE group_members (
        group_id VARCHAR(128) NOT NULL,
        user_id VARCHAR(128) NOT NULL,
        role ENUM('admin', 'member') DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    
    // Recreate other tables with updated foreign keys
    await executeQuery(`
      CREATE TABLE files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        storage_path VARCHAR(1024) NOT NULL,
        cloudinary_public_id VARCHAR(512),
        mime_type VARCHAR(100),
        size_bytes BIGINT NOT NULL,
        group_id VARCHAR(128) NOT NULL,
        uploader_id VARCHAR(128) NOT NULL,
        download_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    
    await executeQuery(`
      CREATE TABLE tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        group_id VARCHAR(128) NOT NULL,
        creator_id VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_tag_in_group\` (\`name\`, \`group_id\`),
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    
    await executeQuery(`
      CREATE TABLE file_tags (
        file_id INT NOT NULL,
        tag_id INT NOT NULL,
        PRIMARY KEY (file_id, tag_id),
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    
    await executeQuery(`
      CREATE TABLE activity_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        action_type ENUM('upload', 'download', 'delete_file', 'create_group', 'join_group', 'create_tag') NOT NULL,
        target_id VARCHAR(255),
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    
    // Re-enable foreign key checks
    await executeQuery('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('✅ Schema updated successfully!');
    
    // 3. Show new schema
    console.log('\n📋 New groups table structure:');
    const newSchema = await executeQuery('DESCRIBE `groups`');
    console.table(newSchema);
    
    console.log('\n✅ SCHEMA UPDATE COMPLETED!');
    console.log('🔄 Now re-run sync script to populate with string IDs');
    
  } catch (error) {
    console.error('❌ Schema update error:', error);
  }
  
  process.exit(0);
}

updateSchema();