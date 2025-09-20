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
      errorMessage = 'Tài khoản không tồn tại';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Mật khẩu không đúng';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email không hợp lệ';
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
// GROUPS SERVICES
// ================================

// Create group
export const createGroup = async (groupData, creatorUid) => {
  try {
    const docRef = await addDoc(collection(db, 'groups'), {
      ...groupData,
      creatorUid,
      members: [creatorUid],
      memberCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return { success: true, groupId: docRef.id };
  } catch (error) {
    console.error('Error creating group:', error);
    return { success: false, error: error.message };
  }
};

// Get user's groups
export const getUserGroups = async (uid) => {
  try {
    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', uid),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const groups = [];
    
    querySnapshot.forEach((doc) => {
      groups.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, data: groups };
  } catch (error) {
    console.error('Error getting user groups:', error);
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
  
  // Files
  uploadFile,
  deleteFile
};