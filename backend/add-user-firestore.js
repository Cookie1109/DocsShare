const admin = require('./src/config/firebaseAdmin');

async function addUserToFirestore() {
  try {
    const userId = 'hoauy95@gmail.com';
    const displayName = 'hehe';
    const email = 'hoauy95@gmail.com';
    
    console.log('🔄 Adding user to Firestore...');
    
    const db = admin.firestore();
    
    // Check if user exists in Firestore
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // Create user in Firestore
      await userRef.set({
        email: email,
        displayName: displayName,
        tag: '#5996',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ User created in Firestore');
    } else {
      console.log('✅ User already exists in Firestore');
    }
    
    // Add user to group in Firestore (group 3 -> IewNBzGITBR8513xZRUN)
    const firestoreGroupId = 'IewNBzGITBR8513xZRUN';
    
    // Check if membership exists
    const membershipQuery = db.collection('group_members')
      .where('userId', '==', userId)
      .where('groupId', '==', firestoreGroupId);
    
    const membershipSnapshot = await membershipQuery.get();
    
    if (membershipSnapshot.empty) {
      // Add membership
      await db.collection('group_members').add({
        userId: userId,
        groupId: firestoreGroupId,
        role: 'member',
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ User added to group ${firestoreGroupId} in Firestore`);
    } else {
      console.log(`✅ User already member of group ${firestoreGroupId}`);
    }
    
    // Verify the sync
    console.log('\n🔍 Verification - User memberships:');
    const finalMembershipSnapshot = await db.collection('group_members')
      .where('userId', '==', userId)
      .get();
    
    finalMembershipSnapshot.forEach(doc => {
      console.log('Membership:', doc.data());
    });
    
    // Check if group exists
    const groupRef = db.collection('groups').doc(firestoreGroupId);
    const groupDoc = await groupRef.get();
    
    if (groupDoc.exists()) {
      console.log('\n✅ Group exists:', groupDoc.data());
    } else {
      console.log('\n❌ Group does not exist, creating...');
      await groupRef.set({
        name: 'hehe',
        description: 'Test group for hehe user',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        creatorId: userId,
        memberCount: 1
      });
      console.log('✅ Group created');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addUserToFirestore();