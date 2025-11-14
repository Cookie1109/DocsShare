# Phân Tích Chức Năng Quản Lý Thông Tin Người Dùng - DocsShare

## 📋 Tổng Quan

Chức năng quản lý thông tin người dùng trong DocsShare cho phép người dùng xem, cập nhật và quản lý profile của mình. Hệ thống sử dụng **dual storage strategy** với Firebase Authentication (auth metadata) và MySQL (profile data), kết hợp với Firestore để realtime sync.

### Đặc Điểm Nổi Bật

- ✅ **Username System**: Format `DisplayName#Tag` (ví dụ: `Nhân#6039`)
- ✅ **Profile Completion**: Onboarding modal bắt buộc sau lần đăng nhập đầu
- ✅ **Tag Availability Check**: Realtime kiểm tra tag đã sử dụng chưa
- ✅ **Auto-generate Tag**: Tự động tạo tag 4 chữ số duy nhất
- ✅ **Avatar Management**: Upload, preview, remove avatar
- ✅ **Realtime Sync**: Đồng bộ Firebase Auth ↔ MySQL ↔ Firestore
- ✅ **Validation**: Kiểm tra tên hiển thị, tag, avatar size
- ✅ **Profile Status**: Kiểm tra profile đã hoàn tất chưa

---

## 🏗️ Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  OnboardingModal (First Login)                            │  │
│  │  - Input displayName (2-50 chars)                         │  │
│  │  - Input tag (4-6 digits)                                 │  │
│  │  - Auto-check tag availability                            │  │
│  │  - Submit to complete profile                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  UserProfileModal (Update Profile)                        │  │
│  │  - Edit displayName & tag                                 │  │
│  │  - Upload/remove avatar                                   │  │
│  │  - Validation & error handling                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  AuthContext.updateProfile()                              │  │
│  │  - Update Firebase displayName                            │  │
│  │  - Update Firestore user document                         │  │
│  │  - Call backend to update MySQL                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
              Authorization: Bearer <Firebase_ID_Token>
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                 │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Middleware: verifyFirebaseToken                          │  │
│  │  - Decode token → req.user.uid                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Route: POST /api/profile/complete                        │  │
│  │                                                             │  │
│  │  Step 1: Validate displayName & tag                       │  │
│  │  Step 2: Check name#tag uniqueness                        │  │
│  │  Step 3: Update/Create user in MySQL                      │  │
│  │  Step 4: Update Firebase Auth displayName                 │  │
│  │  Step 5: Update Firestore user document                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Database Layer                                            │  │
│  │  MySQL (profile data) + Firestore (realtime sync)         │  │
│  │  Firebase Auth (displayName, photoURL)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Luồng Xử Lý Chi Tiết

### Phase 1: Profile Completion (Onboarding)

#### 1.1. OnboardingModal Component

**File:** `frontend/src/components/Onboarding/OnboardingModal.jsx`

**Kích hoạt khi:**
- User đăng nhập lần đầu (chưa có displayName & tag trong MySQL)
- `profileIncomplete === true` trong AuthContext

**UI Features:**
```jsx
const [formData, setFormData] = useState({
  displayName: '',
  tag: ''
});
const [tagAvailable, setTagAvailable] = useState(null);
const [checkingTag, setCheckingTag] = useState(false);
```

**Validation Rules:**
- **Display Name**: 2-50 ký tự, bắt buộc
- **Tag**: 4-6 chữ số, bắt buộc, unique với displayName

**Realtime Tag Check:**
```javascript
// Debounce 500ms khi user gõ tag
useEffect(() => {
  if (formData.displayName && formData.tag && formData.tag.length >= 4) {
    checkTagTimeoutRef.current = setTimeout(() => {
      checkTagAvailability();
    }, 500);
  }
}, [formData.displayName, formData.tag]);

const checkTagAvailability = async () => {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(
    `http://localhost:5000/api/profile/check-tag/${formData.tag}?displayName=${encodeURIComponent(formData.displayName)}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  setTagAvailable(data.available);
};
```

**Submit Flow:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // 1. Validate form
  if (!validateForm()) return;
  
  // 2. Call backend API
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('http://localhost:5000/api/profile/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      displayName: formData.displayName.trim(),
      tag: formData.tag
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // 3. Reload Firebase user data
    await auth.currentUser.reload();
    
    // 4. Trigger onComplete callback
    onComplete();
  }
};
```

---

### Phase 2: Backend - Profile Completion

#### 2.1. Check Tag Availability

**Endpoint:** `GET /api/profile/check-tag/:tag?displayName=<name>`

**File:** `backend/src/routes/profile.js`

```javascript
router.get('/check-tag/:tag', verifyFirebaseToken, async (req, res) => {
  try {
    const { tag } = req.params;
    const { displayName } = req.query;
    
    // Validate tag format (4-6 digits)
    if (!/^\d{4,6}$/.test(tag)) {
      return res.status(400).json({
        success: false,
        error: 'Tag phải là 4-6 chữ số'
      });
    }
    
    // Check if displayName#tag exists in MySQL
    const exists = await User.checkNameTagExists(displayName, tag);
    
    res.json({
      success: true,
      available: !exists,
      message: exists ? 'Tên và tag đã được sử dụng' : 'Tên và tag khả dụng'
    });
  } catch (error) {
    console.error('Error checking tag availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check tag availability'
    });
  }
});
```

#### 2.2. Complete Profile

**Endpoint:** `POST /api/profile/complete`

**File:** `backend/src/routes/profile.js`

```javascript
router.post('/complete', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { displayName, tag } = req.body;
    
    // === STEP 1: Validate Input ===
    if (!displayName || !tag) {
      return res.status(400).json({
        success: false,
        error: 'displayName và tag là bắt buộc'
      });
    }
    
    // Validate displayName (2-50 chars)
    if (displayName.length < 2 || displayName.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Tên hiển thị phải có từ 2-50 ký tự'
      });
    }
    
    // Validate tag (4-6 digits)
    if (!/^\d{4,6}$/.test(tag)) {
      return res.status(400).json({
        success: false,
        error: 'Tag phải là 4-6 chữ số'
      });
    }
    
    // === STEP 2: Check Uniqueness ===
    const exists = await User.checkNameTagExists(displayName, tag);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Tên và tag đã được sử dụng'
      });
    }
    
    // === STEP 3: Get Firebase User Info ===
    const firebaseUser = await admin.auth().getUser(userId);
    const email = firebaseUser.email;
    const avatar_url = firebaseUser.photoURL || null;
    
    // === STEP 4: Update/Create MySQL Record ===
    let user = await User.findById(userId);
    
    if (!user) {
      // Create new user
      const result = await User.create({
        id: userId,
        email,
        display_name: displayName,
        tag
        // Note: Không lưu avatar trong MySQL - chỉ lưu trong Firebase/Firestore
      });
      
      if (!result.success) {
        return res.status(500).json(result);
      }
    } else {
      // Update existing user
      const result = await User.updateProfile(userId, {
        display_name: displayName,
        tag
      });
      
      if (!result.success) {
        return res.status(500).json(result);
      }
    }
    
    // === STEP 5: Update Firebase Auth displayName ===
    const username = `${displayName}#${tag}`;
    await admin.auth().updateUser(userId, {
      displayName: username
    });
    
    // === STEP 6: Update Firestore User Document ===
    const db = admin.firestore();
    await db.collection('users').doc(userId).set({
      uid: userId,
      email,
      displayName,
      userTag: tag,
      username,
      avatar: avatar_url,
      role: 'member',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    res.json({
      success: true,
      message: 'Profile completed successfully',
      user: {
        display_name: displayName,
        tag,
        username,
        avatar_url
      }
    });
  } catch (error) {
    console.error('Error completing profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete profile'
    });
  }
});
```

---

### Phase 3: Profile Update

#### 3.1. UserProfileModal Component

**File:** `frontend/src/pages/ChatPage.jsx`

**UI Components:**
- Avatar upload/preview
- Display name input
- Tag input (read-only sau khi set)
- Save/Cancel buttons

**Avatar Management:**
```javascript
const handleAvatarChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Ảnh không được vượt quá 5MB');
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSaveError('Vui lòng chọn file ảnh');
      return;
    }
    
    setSaveError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      setUserAvatar(e.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const handleRemoveAvatar = () => {
  setUserAvatar(null);
};
```

**Save Profile:**
```javascript
const handleSaveUserInfo = async () => {
  // Validation
  if (!userName.trim()) {
    setSaveError('Tên hiển thị không được để trống');
    return;
  }

  if (userName.trim().length < 2) {
    setSaveError('Tên hiển thị phải có ít nhất 2 ký tự');
    return;
  }

  if (userName.trim().length > 50) {
    setSaveError('Tên hiển thị không được vượt quá 50 ký tự');
    return;
  }

  setIsSaving(true);
  setSaveError('');

  try {
    // Combine name and tag
    const fullName = userTag ? `${userName.trim()}#${userTag}` : userName.trim();
    
    const updatedData = {
      name: fullName,
      avatar: userAvatar
    };
    
    // Update via AuthContext
    const result = await updateProfile(updatedData);
    
    if (result.success) {
      setSaveSuccess(true);
      
      // Close modal after delay
      setTimeout(() => {
        setShowUserProfileModal(false);
        setIsEditing(false);
        setSaveSuccess(false);
      }, 1500);
    } else {
      setSaveError(result.error || 'Không thể cập nhật thông tin');
    }
  } catch (error) {
    console.error('Error updating user:', error);
    setSaveError('Đã xảy ra lỗi. Vui lòng thử lại');
  } finally {
    setIsSaving(false);
  }
};
```

#### 3.2. AuthContext.updateProfile()

**File:** `frontend/src/contexts/AuthContext.jsx`

```javascript
const updateProfile = async (profileData) => {
  if (!user?.uid) return { success: false, error: 'User not authenticated' };
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'No authenticated user found' };
    }
    
    // Update Firebase Auth displayName
    if (profileData.name) {
      await updateUserProfile(currentUser, {
        displayName: profileData.name
      });
    }
    
    // Update Firestore user document
    if (profileData.name || profileData.avatar) {
      const userDocRef = doc(db, 'users', user.uid);
      const updateData = {};
      
      if (profileData.name) {
        const [displayName, tag] = profileData.name.split('#');
        updateData.displayName = displayName;
        updateData.userTag = tag || user.userTag;
        updateData.username = profileData.name;
      }
      
      if (profileData.avatar !== undefined) {
        updateData.avatar = profileData.avatar;
      }
      
      updateData.updatedAt = serverTimestamp();
      
      await updateDoc(userDocRef, updateData);
    }
    
    // Reload Firebase user to get updated data
    await currentUser.reload();
    
    // Update local state
    setUser(prev => ({
      ...prev,
      displayName: profileData.name || prev.displayName,
      avatar: profileData.avatar !== undefined ? profileData.avatar : prev.avatar
    }));
    
    return { success: true };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: error.message };
  }
};
```

---

## 📊 Database Schema

### MySQL Tables

#### 1. `users` Table
```sql
CREATE TABLE `users` (
  `id` VARCHAR(128) PRIMARY KEY,  -- Firebase UID
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `display_name` VARCHAR(50),
  `tag` VARCHAR(6),                -- 4-6 digits
  `role` ENUM('admin', 'member') DEFAULT 'member',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_name_tag (display_name, tag),
  INDEX idx_email (email),
  INDEX idx_display_name (display_name)
);
```

**Lưu ý:**
- ❌ **Không lưu avatar** trong MySQL (chỉ lưu trong Firebase Storage/Firestore)
- ✅ **Unique constraint** trên `(display_name, tag)` → Username duy nhất
- ✅ **Tag**: 4-6 chữ số (ví dụ: 6039, 123456)

### Firestore Collections

#### 1. `users` Collection
```javascript
// Document ID: Firebase UID
{
  uid: "firebase_uid_123",
  email: "user@example.com",
  displayName: "Nhân",           // Tên hiển thị (không có tag)
  userTag: "6039",                // Tag riêng biệt
  username: "Nhân#6039",          // Full username
  avatar: "https://...",          // Avatar URL từ Storage
  role: "member",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastActive: Timestamp
}
```

### Firebase Auth

**User Record:**
```javascript
{
  uid: "firebase_uid_123",
  email: "user@example.com",
  displayName: "Nhân#6039",      // Full username
  photoURL: "https://...",        // Avatar URL
  emailVerified: true,
  metadata: {
    creationTime: "...",
    lastSignInTime: "..."
  }
}
```

---

## 🔐 Security & Validation

### Backend Validation

#### 1. Display Name
```javascript
// Length: 2-50 chars
if (displayName.length < 2 || displayName.length > 50) {
  return res.status(400).json({
    success: false,
    error: 'Tên hiển thị phải có từ 2-50 ký tự'
  });
}
```

#### 2. Tag Format
```javascript
// Format: 4-6 digits
if (!/^\d{4,6}$/.test(tag)) {
  return res.status(400).json({
    success: false,
    error: 'Tag phải là 4-6 chữ số'
  });
}
```

#### 3. Uniqueness Check
```javascript
// Check displayName#tag combination
const exists = await User.checkNameTagExists(displayName, tag);
if (exists) {
  return res.status(409).json({
    success: false,
    error: 'Tên và tag đã được sử dụng'
  });
}
```

**Model Implementation:**
```javascript
// File: backend/src/models/User.js
static async checkNameTagExists(displayName, tag) {
  try {
    const users = await executeQuery(
      `SELECT id FROM users 
       WHERE display_name = ? AND tag = ? 
       LIMIT 1`,
      [displayName, tag]
    );
    
    return users.length > 0;
  } catch (error) {
    console.error('Error checking name-tag:', error);
    return false;
  }
}
```

### Frontend Validation

#### 1. Display Name
```javascript
if (!userName.trim()) {
  setSaveError('Tên hiển thị không được để trống');
  return;
}

if (userName.trim().length < 2) {
  setSaveError('Tên hiển thị phải có ít nhất 2 ký tự');
  return;
}

if (userName.trim().length > 50) {
  setSaveError('Tên hiển thị không được vượt quá 50 ký tự');
  return;
}
```

#### 2. Tag Input
```javascript
// Chỉ cho phép nhập số, tối đa 6 chữ số
const handleChange = (e) => {
  const { name, value } = e.target;
  
  if (name === 'tag') {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, [name]: digitsOnly }));
  }
};
```

#### 3. Avatar Validation
```javascript
// File size: max 5MB
if (file.size > 5 * 1024 * 1024) {
  setSaveError('Ảnh không được vượt quá 5MB');
  return;
}

// File type: image only
if (!file.type.startsWith('image/')) {
  setSaveError('Vui lòng chọn file ảnh');
  return;
}
```

---

## 🔄 Realtime Sync Mechanism

### Profile Update Flow

```
User updates profile in UI
         ↓
1. Update Firebase Auth displayName
         ↓
2. Update Firestore user document
         ↓
3. Firestore listener detects change
         ↓
4. AuthContext updates local state
         ↓
5. UI auto-updates everywhere
```

### Firestore Realtime Listener

**File:** `frontend/src/contexts/AuthContext.jsx`

```javascript
// Realtime listener cho user profile updates
useEffect(() => {
  if (!user?.uid) return;

  console.log('🔥 Setting up real-time listener for user:', user.uid);
  
  const userDocRef = doc(db, 'users', user.uid);
  const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const updatedData = docSnapshot.data();
      console.log('📡 Real-time update received:', updatedData);
      
      setUser(prev => {
        const newUser = {
          ...prev,
          ...updatedData,
          name: updatedData.username || prev?.name,
          displayName: updatedData.username || updatedData.displayName,
          avatar: updatedData.avatar,
          userTag: updatedData.userTag
        };
        
        return newUser;
      });
    }
  });
  
  return () => unsubscribe();
}, [user?.uid]);
```

**Trigger:**
- Khi user document trong Firestore được update
- Tự động cập nhật state trong AuthContext
- Tất cả components sử dụng `useAuth()` đều nhận được data mới

---

## 🎨 UI/UX Features

### OnboardingModal Design

```
┌─────────────────────────────────────────┐
│         🎉 Chào mừng DocsShare!         │
│  Vui lòng thiết lập tên hiển thị        │
├─────────────────────────────────────────┤
│                                          │
│  Tên hiển thị *                          │
│  ┌────────────────────────────────────┐ │
│  │ Nhập tên của bạn                   │ │
│  └────────────────────────────────────┘ │
│  2-50 ký tự                              │
│                                          │
│  Tag *                                   │
│  ┌────────────────────────────────────┐ │
│  │ 6039                                │ │
│  └────────────────────────────────────┘ │
│  ✅ Tag khả dụng                         │
│  (hoặc ❌ Tag đã được sử dụng)          │
│                                          │
│  Preview: Nhân#6039                      │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Hoàn tất                        │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### UserProfileModal Design

```
┌─────────────────────────────────────────┐
│  Thông tin người dùng              ✕    │
├─────────────────────────────────────────┤
│                                          │
│           ┌───────────┐                  │
│           │   Avatar  │   [Upload]       │
│           │   Image   │   [Remove]       │
│           └───────────┘                  │
│                                          │
│  Tên hiển thị *                          │
│  ┌────────────────────────────────────┐ │
│  │ Nhân                               │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Tag                                     │
│  ┌────────────────────────────────────┐ │
│  │ 6039 (không thể thay đổi)         │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Username: Nhân#6039                     │
│                                          │
│  ┌─────────┐  ┌──────────────────────┐ │
│  │   Hủy   │  │  💾 Lưu thay đổi     │ │
│  └─────────┘  └──────────────────────┘ │
└─────────────────────────────────────────┘
```

### States

**1. Onboarding State**
- Initial: Empty form
- Typing: Realtime tag check
- Checking: "Đang kiểm tra..."
- Available: Green checkmark ✅
- Taken: Red X ❌

**2. Profile Edit State**
- View mode: Display info only
- Edit mode: Editable fields
- Saving: "Đang lưu..." spinner
- Success: Green checkmark + auto-close
- Error: Red error message

---

## 🚀 Auto-Generate Tag Feature

### Backend Implementation

**Endpoint:** `POST /api/profile/auto-generate-tag`

**File:** `backend/src/routes/profile.js`

```javascript
router.post('/auto-generate-tag', verifyFirebaseToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    
    if (!displayName) {
      return res.status(400).json({
        success: false,
        error: 'displayName is required'
      });
    }
    
    // Generate random 4-digit tag until unique
    let tag = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!tag && attempts < maxAttempts) {
      const randomTag = Math.floor(1000 + Math.random() * 9000).toString();
      const exists = await User.checkNameTagExists(displayName, randomTag);
      
      if (!exists) {
        tag = randomTag;
        break;
      }
      
      attempts++;
    }
    
    if (!tag) {
      return res.status(500).json({
        success: false,
        error: 'Could not generate unique tag. Please try again.'
      });
    }
    
    res.json({
      success: true,
      tag
    });
  } catch (error) {
    console.error('Error generating tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tag'
    });
  }
});
```

**Algorithm:**
1. Generate random 4-digit number (1000-9999)
2. Check if `displayName#tag` exists in database
3. If exists → retry with new random number
4. Max 10 attempts
5. Return unique tag or error

**Usage:**
```javascript
// Frontend call
const generateTag = async () => {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('http://localhost:5000/api/profile/auto-generate-tag', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      displayName: formData.displayName
    })
  });
  
  const data = await response.json();
  if (data.success) {
    setFormData(prev => ({ ...prev, tag: data.tag }));
  }
};
```

---

## 📈 Performance Optimizations

### 1. Debounced Tag Check
```javascript
// Chờ 500ms sau khi user ngừng gõ mới check
useEffect(() => {
  if (formData.displayName && formData.tag && formData.tag.length >= 4) {
    clearTimeout(checkTagTimeoutRef.current);
    
    checkTagTimeoutRef.current = setTimeout(() => {
      checkTagAvailability();
    }, 500);
  }
  
  return () => {
    if (checkTagTimeoutRef.current) {
      clearTimeout(checkTagTimeoutRef.current);
    }
  };
}, [formData.displayName, formData.tag]);
```

### 2. Optimistic UI Updates
```javascript
// Update local state ngay, background sync sau
setUser(prev => ({
  ...prev,
  displayName: newDisplayName,
  avatar: newAvatar
}));

// Background sync to Firestore
updateDoc(userDocRef, updateData).catch(error => {
  console.error('Background sync failed:', error);
  // Có thể rollback hoặc retry
});
```

### 3. Firestore Listener Optimization
```javascript
// Chỉ subscribe khi user đã login
useEffect(() => {
  if (!user?.uid) return;  // Early exit
  
  const unsubscribe = onSnapshot(userDocRef, callback);
  
  return () => unsubscribe();  // Cleanup khi unmount
}, [user?.uid]);
```

### 4. Avatar Preview (Client-side)
```javascript
// Không upload ngay, chỉ preview local
const reader = new FileReader();
reader.onload = (e) => {
  setUserAvatar(e.target.result);  // Base64 preview
};
reader.readAsDataURL(file);

// Upload khi user click Save
const uploadAvatar = async () => {
  const storageRef = ref(storage, `avatars/${user.uid}`);
  await uploadBytes(storageRef, avatarFile);
  const url = await getDownloadURL(storageRef);
  return url;
};
```

---

## 🐛 Error Handling

### Backend Error Cases

#### 1. Invalid Input
```javascript
if (!displayName || !tag) {
  return res.status(400).json({
    success: false,
    error: 'displayName và tag là bắt buộc'
  });
}
```

#### 2. Tag Format Error
```javascript
if (!/^\d{4,6}$/.test(tag)) {
  return res.status(400).json({
    success: false,
    error: 'Tag phải là 4-6 chữ số'
  });
}
```

#### 3. Duplicate Username
```javascript
const exists = await User.checkNameTagExists(displayName, tag);
if (exists) {
  return res.status(409).json({  // 409 Conflict
    success: false,
    error: 'Tên và tag đã được sử dụng'
  });
}
```

#### 4. Database Error
```javascript
try {
  await User.create({...});
} catch (error) {
  console.error('Database error:', error);
  return res.status(500).json({
    success: false,
    error: 'Failed to create user profile'
  });
}
```

### Frontend Error Handling

#### 1. Validation Errors
```javascript
const validateForm = () => {
  if (!formData.displayName.trim()) {
    setError('Vui lòng nhập tên hiển thị');
    return false;
  }
  
  if (formData.tag.length < 4 || formData.tag.length > 6) {
    setError('Tag phải có từ 4-6 chữ số');
    return false;
  }
  
  if (tagAvailable === false) {
    setError('Tên và tag đã được sử dụng. Vui lòng chọn tag khác');
    return false;
  }
  
  return true;
};
```

#### 2. Network Errors
```javascript
try {
  const response = await fetch(...);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
} catch (error) {
  if (error.message === 'Failed to fetch') {
    setError('Không thể kết nối đến server. Vui lòng kiểm tra mạng.');
  } else {
    setError(error.message);
  }
}
```

#### 3. UI Error Display
```javascript
{error && (
  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
    <span className="text-sm text-red-800">{error}</span>
  </div>
)}
```

---

## 🧪 Testing Scenarios

### Unit Tests

#### Backend Tests
```javascript
describe('POST /api/profile/complete', () => {
  it('should complete profile successfully', async () => {
    const res = await request(app)
      .post('/api/profile/complete')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ displayName: 'TestUser', tag: '1234' });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('TestUser#1234');
  });
  
  it('should reject duplicate username', async () => {
    // Create first user
    await createUser({ displayName: 'TestUser', tag: '1234' });
    
    // Try to create duplicate
    const res = await request(app)
      .post('/api/profile/complete')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ displayName: 'TestUser', tag: '1234' });
    
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('đã được sử dụng');
  });
  
  it('should validate tag format', async () => {
    const res = await request(app)
      .post('/api/profile/complete')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ displayName: 'TestUser', tag: 'abc' });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('4-6 chữ số');
  });
});

describe('GET /api/profile/check-tag/:tag', () => {
  it('should return available for new tag', async () => {
    const res = await request(app)
      .get('/api/profile/check-tag/9999?displayName=NewUser')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(res.body.available).toBe(true);
  });
  
  it('should return unavailable for existing tag', async () => {
    await createUser({ displayName: 'ExistingUser', tag: '1111' });
    
    const res = await request(app)
      .get('/api/profile/check-tag/1111?displayName=ExistingUser')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(res.body.available).toBe(false);
  });
});
```

#### Frontend Tests
```javascript
describe('OnboardingModal', () => {
  it('should validate display name length', () => {
    render(<OnboardingModal isOpen={true} />);
    
    const input = screen.getByPlaceholderText(/tên hiển thị/i);
    fireEvent.change(input, { target: { value: 'A' } });
    
    const button = screen.getByText(/hoàn tất/i);
    fireEvent.click(button);
    
    expect(screen.getByText(/ít nhất 2 ký tự/i)).toBeInTheDocument();
  });
  
  it('should only allow digits in tag input', () => {
    render(<OnboardingModal isOpen={true} />);
    
    const tagInput = screen.getByLabelText(/tag/i);
    fireEvent.change(tagInput, { target: { value: 'abc123' } });
    
    expect(tagInput.value).toBe('123');
  });
  
  it('should check tag availability on input', async () => {
    const mockCheckTag = jest.fn().mockResolvedValue({ available: true });
    
    render(<OnboardingModal isOpen={true} />);
    
    const nameInput = screen.getByPlaceholderText(/tên hiển thị/i);
    const tagInput = screen.getByLabelText(/tag/i);
    
    fireEvent.change(nameInput, { target: { value: 'TestUser' } });
    fireEvent.change(tagInput, { target: { value: '1234' } });
    
    await waitFor(() => {
      expect(mockCheckTag).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```javascript
describe('Profile Management E2E', () => {
  it('should complete onboarding and update profile', async () => {
    // 1. Login as new user
    await loginAsUser('newuser@example.com', 'password');
    
    // 2. See onboarding modal
    expect(screen.getByText(/chào mừng/i)).toBeInTheDocument();
    
    // 3. Fill form
    await type('Tên hiển thị', 'NewUser');
    await type('Tag', '5678');
    
    // 4. Submit
    await click('Hoàn tất');
    
    // 5. Verify profile completed
    await waitFor(() => {
      expect(getUserProfile().username).toBe('NewUser#5678');
    });
    
    // 6. Update profile
    await click('Thông tin người dùng');
    await type('Tên hiển thị', 'UpdatedName');
    await click('Lưu thay đổi');
    
    // 7. Verify update
    await waitFor(() => {
      expect(getUserProfile().username).toBe('UpdatedName#5678');
    });
  });
});
```

---

## 📊 Monitoring & Logging

### Backend Logs

```javascript
console.log('✅ Profile completed for user:', userId);
console.log('📝 Updated displayName:', displayName);
console.log('🏷️  Assigned tag:', tag);
console.log('👤 Username:', username);
```

### Error Logs

```javascript
console.error('❌ Error completing profile:', error);
console.error('❌ Database error:', error);
console.error('⚠️ Validation failed:', validationErrors);
```

### Activity Tracking (Future)

```sql
INSERT INTO activity_logs 
  (user_id, action_type, details, created_at)
VALUES 
  ('user_123', 'profile_complete', '{"username":"Nhân#6039"}', NOW());
```

---

## 🔮 Future Enhancements

### 1. Change Username Feature
```javascript
// Cho phép user đổi displayName (giữ nguyên tag)
const changeUsername = async (newDisplayName) => {
  // Check new name#tag không trùng
  const exists = await checkNameTagExists(newDisplayName, currentTag);
  
  if (!exists) {
    await updateProfile({
      display_name: newDisplayName
    });
  }
};
```

### 2. Custom Tag (Premium Feature)
```javascript
// Cho phép user chọn custom tag (thay vì random)
const requestCustomTag = async (displayName, customTag) => {
  // Validate tag format
  // Check availability
  // Require premium account
  // Assign tag
};
```

### 3. Username History
```sql
CREATE TABLE username_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(128),
  old_username VARCHAR(60),
  new_username VARCHAR(60),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4. Avatar Crop & Resize
```javascript
// Client-side crop before upload
import Cropper from 'react-easy-crop';

const cropAvatar = async (imageSrc) => {
  const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
  const resizedImage = await resizeImage(croppedImage, 200, 200);
  return resizedImage;
};
```

### 5. Profile Completion Progress
```javascript
const profileCompleteness = {
  displayName: user.displayName ? 25 : 0,
  tag: user.tag ? 25 : 0,
  avatar: user.avatar ? 25 : 0,
  bio: user.bio ? 25 : 0
};

const total = Object.values(profileCompleteness).reduce((a, b) => a + b, 0);
// Show: "Profile 75% complete"
```

---

## 📚 Code References

### Frontend Files
- **Onboarding:** `frontend/src/components/Onboarding/OnboardingModal.jsx`
- **Profile Modal:** `frontend/src/pages/ChatPage.jsx` (lines 60-150)
- **Context:** `frontend/src/contexts/AuthContext.jsx`
- **Firebase Service:** `frontend/src/services/firebase.js`

### Backend Files
- **Route:** `backend/src/routes/profile.js`
- **Model:** `backend/src/models/User.js`
- **Middleware:** `backend/src/middleware/firebaseAuth.js`

### Database
- **MySQL:** `users` table
- **Firestore:** `users/{uid}` collection
- **Firebase Auth:** User metadata (displayName, photoURL)

---

## 🎓 Best Practices

### ✅ DO
1. **Validate input cả frontend và backend** - Đảm bảo dữ liệu đúng định dạng
2. **Check username uniqueness** - Tránh duplicate displayName#tag
3. **Use debounce cho realtime checks** - Giảm số lượng API calls
4. **Sync 3 databases** - Firebase Auth, MySQL, Firestore đồng bộ
5. **Handle errors gracefully** - Hiển thị error message rõ ràng
6. **Optimize avatar upload** - Resize, crop, validate trước khi upload
7. **Log user activities** - Theo dõi profile updates

### ❌ DON'T
1. **Không skip validation** - Luôn validate ở cả 2 phía
2. **Không cho phép duplicate usernames** - Check uniqueness trước khi save
3. **Không lưu avatar trong MySQL** - Chỉ lưu trong Firebase/Firestore
4. **Không block UI khi check tag** - Dùng debounce và loading state
5. **Không hardcode tag** - Luôn generate hoặc validate
6. **Không quên cleanup listeners** - Unsubscribe khi component unmount

---

**Ngày cập nhật:** 13/11/2025  
**Version:** 1.0  
**Tác giả:** DocsShare Development Team
