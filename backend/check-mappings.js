require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkGroupMappings() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Checking group mappings...');
    
    const [mappings] = await connection.execute(
      'SELECT * FROM group_mapping ORDER BY created_at DESC LIMIT 10'
    );
    
    console.log('\n📊 Recent Group Mappings:');
    if (mappings.length === 0) {
      console.log('  No mappings found');
    } else {
      mappings.forEach(mapping => {
        console.log(`  ${mapping.firestore_id} -> MySQL ID ${mapping.mysql_id} (${mapping.group_name})`);
      });
    }
    
    console.log('\n🔍 Checking recent files...');
    const [files] = await connection.execute(
      'SELECT id, name, group_id, uploader_id, created_at FROM files ORDER BY created_at DESC LIMIT 5'
    );
    
    console.log('\n📄 Recent Files:');
    if (files.length === 0) {
      console.log('  No files found');
    } else {
      files.forEach(file => {
        console.log(`  File ${file.id}: ${file.name} -> Group ${file.group_id} (${file.created_at})`);
      });
    }
    
    await connection.end();
    console.log('\n✅ Check completed');
    
  } catch (error) {
    console.error('❌ Error checking mappings:', error.message);
  }
}

checkGroupMappings();