// Import database schema using Node.js
const fs = require('fs');
const { executeQuery } = require('./src/config/db');

async function importSchema() {
  try {
    console.log('📋 Reading SQL schema file...');
    const sqlContent = fs.readFileSync('../docsshare_db.sql', 'utf8');
    
    console.log('📝 First 200 chars of SQL file:', sqlContent.substring(0, 200));
    
    // Split by semicolon and filter out empty statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        return stmt.length > 10 && 
               (stmt.toUpperCase().includes('CREATE TABLE') || 
                stmt.toUpperCase().includes('INSERT INTO'));
      });
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    if (statements.length > 0) {
      console.log('📝 First statement:', statements[0].substring(0, 100));
    }
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.includes('CREATE TABLE') || statement.includes('INSERT')) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}`);
        console.log(`📝 ${statement.substring(0, 50)}...`);
        
        try {
          await executeQuery(statement);
          console.log('✅ Success');
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('⚠️ Table already exists, skipping');
          } else {
            console.error('❌ Error:', error.message);
          }
        }
      }
    }
    
    console.log('✅ Schema import completed');
    
    // Test tables exist
    const [tables] = await executeQuery('SHOW TABLES');
    console.log('📋 Tables after import:', tables);
    
  } catch (error) {
    console.error('❌ Schema import failed:', error);
  }
  
  process.exit(0);
}

importSchema();