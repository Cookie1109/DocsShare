import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { auth, db, storage, googleProvider } from '../config/firebase';

// ================================
// AUTH SERVICES
// ================================

// Sign up with email and password
export const signUpWithEmail = async (email, displayName, userTag, password) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    // Update profile
    await updateProfile(user, {
      displayName: `${displayName}#${userTag}`
    });
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      userTag: userTag,
      username: `${displayName}#${userTag}`,
      avatar: null,
      role: 'member',
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp()
    });
    
    return { success: true, user };
  } catch (error) {
    console.error('Error signing up:', error);
    let errorMessage = 'Đã xảy ra lỗi khi đăng ký';
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email này đã được sử dụng';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Mật khẩu quá yếu';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email không hợp lệ';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Sign in with username/email and password
export const signInWithCredentials = async (usernameOrEmail, password) => {
  try {
    let email = usernameOrEmail;
    
    // If it's a username format (Name#Tag), convert to email
    if (usernameOrEmail.includes('#') && !usernameOrEmail.includes('@')) {
      email = `${usernameOrEmail.replace('#', '_')}@docsshare.local`;
    }
    
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Update last active
    await updateDoc(doc(db, 'users', result.user.uid), {
      lastActive: serverTimestamp()
    });
    
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Error signing in:', error);
    let errorMessage = 'Tài khoản hoặc mật khẩu không đúng';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Tài khoản không tồn tại. Vui lòng kiểm tra lại thông tin đăng nhập hoặc đăng ký tài khoản mới.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Mật khẩu không đúng. Vui lòng kiểm tra lại mật khẩu.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email không hợp lệ. Vui lòng nhập đúng định dạng email.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'Tài khoản này đã bị vô hiệu hóa.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.';
    } else if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra lại email và mật khẩu.';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      // Create new user document
      const randomTag = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      const displayName = user.displayName ? user.displayName.split(' ')[0] : 'User';
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        userTag: randomTag,
        username: `${displayName}#${randomTag}`,
        avatar: user.photoURL,
        role: 'member',
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp()
      });
    } else {
      // Update last active
      await updateDoc(doc(db, 'users', user.uid), {
        lastActive: serverTimestamp()
      });
    }
    
    return { success: true, user };
  } catch (error) {
    console.error('Error signing in with Google:', error);
    return { success: false, error: 'Đăng nhập Google thất bại' };
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: 'Đăng xuất thất bại' };
  }
};

// Auth state listener
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// ================================
// USER SERVICES
// ================================

// Get user data
export const getUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    } else {
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    return { success: false, error: error.message };
  }
};

// Update user profile
export const updateUserProfile = async (uid, updates) => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: error.message };
  }
};

// Check if username exists
export const checkUsernameExists = async (displayName, userTag) => {
  try {
    const username = `${displayName}#${userTag}`;
    const q = query(collection(db, 'users'), where('username', '==', username));
    const querySnapshot = await getDocs(q);
    
    return { success: true, exists: !querySnapshot.empty };
  } catch (error) {
    console.error('Error checking username:', error);
    return { success: false, error: error.message };
  }
};



// ================================
// FILE SERVICES
// ================================

// Upload file
export const uploadFile = async (file, path) => {
  try {
    const fileRef = ref(storage, path);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return { success: true, url: downloadURL, ref: snapshot.ref };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { success: false, error: error.message };
  }
};

// Delete file
export const deleteFile = async (filePath) => {
  try {
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
};

// ================================
// GROUP SERVICES
// ================================

// Create a new group
export const createGroup = async (groupName, creatorId, groupPhotoUrl = null) => {
  try {
    // Create group document
    const groupRef = await addDoc(collection(db, 'groups'), {
      name: groupName,
      creatorId: creatorId,
      groupPhotoUrl: groupPhotoUrl,
      createdAt: serverTimestamp()
    });

    // Add creator as admin in group_members
    await addDoc(collection(db, 'group_members'), {
      groupId: groupRef.id,
      userId: creatorId,
      role: 'admin',
      joinedAt: serverTimestamp()
    });

    return { success: true, groupId: groupRef.id };
  } catch (error) {
    console.error('Error creating group:', error);
    return { success: false, error: error.message };
  }
};

// Get all groups that user is member of
export const getUserGroups = async (userId) => {
  try {
    // Get user's group memberships
    const membershipQuery = query(
      collection(db, 'group_members'),
      where('userId', '==', userId)
    );
    const membershipSnapshot = await getDocs(membershipQuery);
    
    const groupIds = membershipSnapshot.docs.map(doc => doc.data().groupId);
    
    if (groupIds.length === 0) {
      return { success: true, groups: [] };
    }

    // Get group details
    const groups = [];
    for (const groupId of groupIds) {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        
        // Get user's role in this group
        const userMembership = membershipSnapshot.docs.find(
          doc => doc.data().groupId === groupId
        );
        
        groups.push({
          id: groupDoc.id,
          ...groupData,
          userRole: userMembership?.data().role
        });
      }
    }

    return { success: true, groups };
  } catch (error) {
    console.error('Error getting user groups:', error);
    return { success: false, error: error.message };
  }
};

// Get all members of a group
export const getGroupMembers = async (groupId) => {
  try {
    const membersQuery = query(
      collection(db, 'group_members'),
      where('groupId', '==', groupId)
    );
    const membersSnapshot = await getDocs(membersQuery);
    
    const members = [];
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      
      // Get user details
      const userDoc = await getDoc(doc(db, 'users', memberData.userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        members.push({
          membershipId: memberDoc.id,
          ...memberData,
          user: userData
        });
      }
    }

    return { success: true, members };
  } catch (error) {
    console.error('Error getting group members:', error);
    return { success: false, error: error.message };
  }
};

// Add member to group
export const addGroupMember = async (groupId, userId, role = 'member') => {
  try {
    // Check if user is already in group
    const existingQuery = query(
      collection(db, 'group_members'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      return { success: false, error: 'User is already in this group' };
    }

    // Add user to group
    await addDoc(collection(db, 'group_members'), {
      groupId: groupId,
      userId: userId,
      role: role,
      joinedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding group member:', error);
    return { success: false, error: error.message };
  }
};

// Remove member from group
export const removeGroupMember = async (membershipId) => {
  try {
    await deleteDoc(doc(db, 'group_members', membershipId));
    return { success: true };
  } catch (error) {
    console.error('Error removing group member:', error);
    return { success: false, error: error.message };
  }
};

// Check user role in group
export const getUserRoleInGroup = async (groupId, userId) => {
  try {
    const memberQuery = query(
      collection(db, 'group_members'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    const memberSnapshot = await getDocs(memberQuery);
    
    if (memberSnapshot.empty) {
      return { success: true, role: null };
    }

    const memberData = memberSnapshot.docs[0].data();
    return { success: true, role: memberData.role };
  } catch (error) {
    console.error('Error checking user role:', error);
    return { success: false, error: error.message };
  }
};

// Update member role in group
export const updateMemberRole = async (membershipId, newRole) => {
  try {
    await updateDoc(doc(db, 'group_members', membershipId), {
      role: newRole
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating member role:', error);
    return { success: false, error: error.message };
  }
};

// Delete a group (admin only)
export const deleteGroupFromFirestore = async (groupId) => {
  try {
    // Delete all group members
    const membersQuery = query(
      collection(db, 'group_members'),
      where('groupId', '==', groupId)
    );
    const membersSnapshot = await getDocs(membersQuery);
    
    // Delete all member documents
    const deletePromises = membersSnapshot.docs.map(memberDoc => 
      deleteDoc(doc(db, 'group_members', memberDoc.id))
    );
    await Promise.all(deletePromises);

    // Delete the group document
    await deleteDoc(doc(db, 'groups', groupId));

    return { success: true };
  } catch (error) {
    console.error('Error deleting group:', error);
    return { success: false, error: error.message };
  }
};

export default {
  // Auth
  signUpWithEmail,
  signInWithCredentials,
  signInWithGoogle,
  signOutUser,
  onAuthStateChange,
  
  // Users
  getUserData,
  updateUserProfile,
  checkUsernameExists,
  
  // Groups
  createGroup,
  getUserGroups,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  getUserRoleInGroup,
  updateMemberRole,
  deleteGroupFromFirestore,
  
  // Files
  uploadFile,
  deleteFile
};