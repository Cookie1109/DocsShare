const admin = require('./src/config/firebaseAdmin');

async function listUsers() {
  try {
    const result = await admin.auth().listUsers(1000);
    console.log(`\n📊 Total Firebase Auth users: ${result.users.length}\n`);
    
    console.log('Users list:');
    console.log('═'.repeat(80));
    
    result.users.forEach((user, index) => {
      const displayName = user.displayName || 'No name';
      const email = user.email || 'No email';
      const uid = user.uid.substring(0, 10);
      
      console.log(`${index + 1}. ${displayName} | ${email} | UID: ${uid}...`);
    });
    
    console.log('═'.repeat(80));
    
    // Search for Truong specifically
    const truongUsers = result.users.filter(u => 
      (u.displayName && u.displayName.toLowerCase().includes('truong')) ||
      (u.displayName && u.displayName.includes('6507'))
    );
    
    if (truongUsers.length > 0) {
      console.log('\n🔍 Found users matching "Truong" or "6507":');
      truongUsers.forEach(u => {
        console.log(`   - ${u.displayName} (${u.email})`);
      });
    } else {
      console.log('\n❌ No users found matching "Truong" or "6507"');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listUsers();
