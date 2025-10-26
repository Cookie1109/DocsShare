const admin = require('./src/config/firebaseAdmin');
const db = admin.firestore();

async function deleteFirebaseMember() {
  try {
    const groupId = 'Ng8CGV8KwQG0LmuQTuSs';
    const userId = 'Gj8TcGPUUSPqgyW1dvnz7bMdUc92';
    
    console.log(`🔍 Searching for member documents...`);
    
    // Tìm tất cả documents có userId và groupId này
    const memberSnapshot = await db.collection('group_members')
      .where('groupId', '==', groupId)
      .where('userId', '==', userId)
      .get();
    
    if (memberSnapshot.empty) {
      console.log('❌ No member found in Firebase');
      return;
    }
    
    console.log(`📋 Found ${memberSnapshot.size} document(s)`);
    
    // Xóa tất cả documents tìm được
    const batch = db.batch();
    memberSnapshot.docs.forEach(doc => {
      console.log(`🗑️  Deleting document: ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Successfully deleted member from Firebase');
    
    // Verify
    const verifySnapshot = await db.collection('group_members')
      .where('groupId', '==', groupId)
      .where('userId', '==', userId)
      .get();
      
    console.log(`✅ Verification: ${verifySnapshot.size} documents remaining`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

deleteFirebaseMember();
