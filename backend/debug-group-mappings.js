const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkGroupMappings() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔍 Checking group_mapping table...');
    
    const [mappings] = await connection.execute(
      'SELECT * FROM group_mapping ORDER BY created_at DESC'
    );

    if (mappings.length === 0) {
      console.log('❌ No group mappings found!');
      console.log('This explains why all files go to Group 1 (fallback behavior)');
    } else {
      console.log(`✅ Found ${mappings.length} group mappings:`);
      mappings.forEach(mapping => {
        console.log(`  ${mapping.firestore_id} -> MySQL ID ${mapping.mysql_id} (${mapping.group_name})`);
        console.log(`    Created: ${mapping.created_at}`);
      });
    }

    console.log('\n🔍 Checking recent files and their actual group assignments...');
    
    const [files] = await connection.execute(
      'SELECT id, name, group_id, created_at FROM files ORDER BY created_at DESC LIMIT 5'
    );

    files.forEach(file => {
      console.log(`  File ${file.id}: ${file.name} -> Group ${file.group_id} (${file.created_at})`);
    });

    await connection.end();
    
  } catch (error) {
    console.error('❌ Error checking mappings:', error.message);
  }
}

checkGroupMappings();