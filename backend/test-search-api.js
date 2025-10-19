// Test search API manually
const admin = require('./src/config/firebaseAdmin');

async function testSearch() {
  try {
    console.log('\n🧪 Testing search functionality...\n');
    
    // Get all users
    const listUsersResult = await admin.auth().listUsers(1000);
    console.log(`📊 Total users in Firebase Auth: ${listUsersResult.users.length}\n`);
    
    // Simulate search for "Cookiee"
    const searchQuery = 'Cookiee'.toLowerCase();
    const currentUserId = 'qO2gqP5RohU723tYbKaRfpc8okA2'; // Nhan Trong user
    
    console.log(`🔍 Simulating search for: "${searchQuery}"`);
    console.log(`👤 Current user ID: ${currentUserId}\n`);
    
    let matchedUsers = listUsersResult.users.filter(user => {
      // Skip current user
      if (user.uid === currentUserId) {
        console.log(`⏭️  Skipping current user: ${user.displayName}`);
        return false;
      }
      
      const displayName = user.displayName || '';
      const email = user.email || '';
      
      // Extract userTag from displayName (format: "Name#Tag")
      const tagMatch = displayName.match(/#(\w+)$/);
      const userTag = tagMatch ? tagMatch[1] : '';
      const nameWithoutTag = displayName.replace(/#\w+$/, '').trim();
      
      const query = searchQuery.toLowerCase();
      
      // Match by full displayName
      if (displayName.toLowerCase().includes(query)) {
        console.log(`✅ Match by displayName: ${displayName}`);
        return true;
      }
      
      // Match by name without tag
      if (nameWithoutTag.toLowerCase().includes(query)) {
        console.log(`✅ Match by name: ${nameWithoutTag}`);
        return true;
      }
      
      // Match by tag
      if (userTag) {
        if (query.startsWith('#')) {
          const tagQuery = query.substring(1);
          if (userTag.toLowerCase().includes(tagQuery)) {
            console.log(`✅ Match by tag: #${userTag}`);
            return true;
          }
        } else {
          if (userTag.toLowerCase().includes(query)) {
            console.log(`✅ Match by tag: ${userTag}`);
            return true;
          }
        }
      }
      
      // Match by email
      if (email.toLowerCase().includes(query)) {
        console.log(`✅ Match by email: ${email}`);
        return true;
      }
      
      return false;
    });
    
    console.log(`\n📊 Results: ${matchedUsers.length} users matched\n`);
    
    if (matchedUsers.length > 0) {
      console.log('Matched users:');
      matchedUsers.forEach((user, i) => {
        console.log(`  ${i + 1}. ${user.displayName} (${user.email})`);
      });
    } else {
      console.log('❌ No users matched the search query');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSearch();
