# Phân Tích Chức Năng Tạo Nhóm - DocsShare

## 📋 Tổng Quan

Chức năng tạo nhóm trong DocsShare cho phép người dùng tạo nhóm học tập/làm việc mới để chia sẻ tài liệu. Hệ thống sử dụng **dual database architecture** với MySQL (persistence) và Firestore (realtime), đảm bảo dữ liệu đồng bộ và UI cập nhật realtime.

### Đặc Điểm Nổi Bật

- ✅ **Dual Database Sync**: Tự động đồng bộ MySQL ↔ Firestore
- ✅ **Realtime Updates**: UI tự động cập nhật khi có nhóm mới
- ✅ **Auto-Navigation**: Tự động chuyển vào nhóm vừa tạo
- ✅ **Creator Role**: Người tạo nhóm tự động là admin
- ✅ **Group Mapping**: Liên kết MySQL ID ↔ Firestore ID
- ✅ **Default Group Name**: Tự động đặt tên "Nhóm của [User]" nếu để trống
- ✅ **Validation**: Kiểm tra tên nhóm, độ dài, ảnh nhóm
- ✅ **Activity Logging**: Ghi lại hoạt động tạo nhóm

---

## 🏗️ Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  CreateGroupModal Component                                │  │
│  │  - Input group name (3-50 chars)                          │  │
│  │  - Upload group photo (optional, max 5MB)                 │  │
│  │  - Validation & error handling                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  AuthContext.createNewGroup()                             │  │
│  │  - Call firebase.createGroup()                             │  │
│  │  - Refresh groups list                                     │  │
│  │  - Auto-select newly created group                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  firebase.createGroup()                                    │  │
│  │  - Get Firebase ID Token                                   │  │
│  │  - Call backend API: POST /api/firebase-groups            │  │
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
│  │  Route: POST /api/firebase-groups                         │  │
│  │                                                             │  │
│  │  Step 1: Create group in MySQL                            │  │
│  │  Step 2: Add creator as admin in group_members            │  │
│  │  Step 3: Create group in Firestore                        │  │
│  │  Step 4: Add creator as admin in Firestore                │  │
│  │  Step 5: Create MySQL ↔ Firestore mapping                 │  │
│  │  Step 6: Log activity                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  MySQL Database                                            │  │
│  │  - groups: (id, name, creator_id, created_at)             │  │
│  │  - group_members: (group_id, user_id, role)               │  │
│  │  - group_mapping: (firestore_id, mysql_id)                │  │
│  │  - activity_logs: (user_id, action_type, target_id)       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            +                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Firestore Database                                        │  │
│  │  - groups/{groupId}: {name, creatorId, groupPhotoUrl}     │  │
│  │  - group_members/{memberId}: {groupId, userId, role}      │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
              Return: { firestoreGroupId, mysqlGroupId }
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      REALTIME UPDATE                             │
│                                                                   │
│  Frontend Firestore Listener detects new group                   │
│  → Auto-update userGroups state                                  │
│  → Auto-select newly created group                               │
│  → Navigate to ChatPage với group đã chọn                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Luồng Xử Lý Chi Tiết

### Phase 1: Frontend - User Input

**Lưu ý:** Dự án có 2 UI để tạo nhóm:
- ✅ **ChatSidebar.jsx** - UI chính, có tên mặc định
- ⚠️ **CreateGroupModal.jsx** - UI phụ, bắt buộc nhập tên

#### 1.1. ChatSidebar Component (UI Chính)

**File:** `frontend/src/components/Chat/ChatSidebar.jsx`

```jsx
const handleCreateGroup = async () => {
  // Logic tên mặc định
  const groupName = newGroupName.trim() || `Nhóm của ${user?.displayName || user?.email || 'Bạn'}`;
  
  try {
    const result = await createNewGroup(groupName, imagePreview);
    
    if (result.success) {
      setNewGroupName('');
      setNewGroupImage(null);
      setImagePreview(null);
      setShowCreateGroup(false);
    }
  } catch (error) {
    alert('Có lỗi xảy ra khi tạo nhóm');
  }
};
```

**UI Features:**
- Input placeholder: `"Nhóm của ${user?.name || 'Bạn'} (mặc định)"`
- Helper text: "Để trống sẽ sử dụng tên mặc định"
- Photo upload với preview
- Auto-generate name: `Nhóm của [DisplayName]`

**Fallback Logic:**
```javascript
user?.displayName  // Ưu tiên displayName
  || user?.email   // Nếu không có displayName → dùng email
  || 'Bạn'         // Nếu không có gì → dùng "Bạn"
```

#### 1.2. CreateGroupModal Component (UI Phụ)

**File:** `frontend/src/components/Chat/CreateGroupModal.jsx`

```jsx
const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  const { createNewGroup } = useAuth();
```

**Validation Rules:**
- ✅ Tên nhóm: 3-50 ký tự
- ✅ Ảnh nhóm: Tùy chọn, tối đa 5MB
- ✅ Không cho phép submit khi tên trống

**UI Features:**
- Photo upload preview (ảnh hiển thị trước khi upload)
- Character counter (hiển thị 0/50)
- Loading state (spinner + "Đang tạo...")
- Error messages (hiển thị lỗi validation)

#### 1.3. Validation Logic

**ChatSidebar (Không bắt buộc nhập):**
```javascript
const handleCreateGroup = async () => {
  // Không validation - cho phép để trống
  const groupName = newGroupName.trim() || `Nhóm của ${user?.displayName || user?.email || 'Bạn'}`;
  // Proceed với tên đã tạo...
};
```

**CreateGroupModal (Bắt buộc nhập):**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validation
  if (!groupName.trim()) {
    setError('Vui lòng nhập tên nhóm');
    return;
  }

  if (groupName.length < 3) {
    setError('Tên nhóm phải có ít nhất 3 ký tự');
    return;
  }

  if (groupName.length > 50) {
    setError('Tên nhóm không được vượt quá 50 ký tự');
    return;
  }

  setIsCreating(true);
  setError('');

  try {
    let groupPhotoUrl = null;
    if (groupPhoto) {
      // TODO: Upload group photo
      // groupPhotoUrl = await uploadGroupPhoto(groupPhoto);
    }

    const result = await createNewGroup(groupName.trim(), groupPhotoUrl);
    
    if (result.success) {
      handleClose(); // Close modal và reset form
    } else {
      setError(result.error || 'Có lỗi xảy ra khi tạo nhóm');
    }
  } catch (error) {
    console.error('Error creating group:', error);
    setError('Có lỗi xảy ra khi tạo nhóm');
  } finally {
    setIsCreating(false);
  }
};
```

---

### Phase 2: Frontend - AuthContext

#### 2.1. AuthContext.createNewGroup()

**File:** `frontend/src/contexts/AuthContext.jsx`

```javascript
const createNewGroup = async (groupName, groupPhotoUrl = null) => {
  if (!user?.uid) return { success: false, error: 'User not authenticated' };
  
  try {
    // 1. Gọi firebase service để tạo nhóm
    const result = await createGroup(groupName, user.uid, groupPhotoUrl);
    
    if (result.success) {
      // 2. Refresh danh sách nhóm của user
      await loadUserGroups();
      
      // 3. Auto-select nhóm vừa tạo
      if (result.groupId) {
        await selectGroup(result.groupId);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error creating group:', error);
    return { success: false, error: error.message };
  }
};
```

**Responsibilities:**
1. ✅ Kiểm tra user đã đăng nhập chưa
2. ✅ Gọi API tạo nhóm qua firebase service
3. ✅ Refresh danh sách nhóm (để hiển thị nhóm mới)
4. ✅ Tự động chọn nhóm vừa tạo (navigate vào nhóm)

#### 2.2. Firebase Service Call

**File:** `frontend/src/services/firebase.js`

```javascript
export const createGroup = async (groupName, creatorId, groupPhotoUrl = null) => {
  try {
    // 1. Lấy Firebase ID Token để authenticate
    const auth = getAuth();
    const token = await auth.currentUser.getIdToken();

    // 2. Gọi backend API
    const response = await fetch('http://localhost:5000/api/firebase-groups', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupName,
        groupPhotoUrl
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create group');
    }

    console.log('✅ Group created successfully:', data);

    // 3. Return Firestore group ID (để frontend select group)
    return { 
      success: true, 
      groupId: data.data.firestoreGroupId,
      mysqlGroupId: data.data.mysqlGroupId
    };
  } catch (error) {
    console.error('Error creating group:', error);
    return { success: false, error: error.message };
  }
};
```

---

### Phase 3: Backend - API Handler

#### 3.1. Route Handler

**File:** `backend/src/routes/firebaseGroups.js`

**Endpoint:** `POST /api/firebase-groups`

**Flow:**

```javascript
router.post('/', async (req, res) => {
  try {
    const { groupName, groupPhotoUrl } = req.body;
    const creatorId = req.user.uid; // Từ verifyFirebaseToken middleware

    // Validation
    if (!groupName || !groupName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Group name is required'
      });
    }

    console.log('🆕 Creating new group:', groupName, 'by user:', creatorId);

    // === STEP 0: Ensure user exists in MySQL ===
    const existingUser = await executeQuery(
      `SELECT id FROM users WHERE id = ?`,
      [creatorId]
    );

    if (!existingUser || existingUser.length === 0) {
      // Create user in MySQL from Firebase data
      const firebaseUser = await admin.auth().getUser(creatorId);
      const firestoreUserDoc = await admin.firestore()
        .collection('users').doc(creatorId).get();
      const firestoreUserData = firestoreUserDoc.exists 
        ? firestoreUserDoc.data() 
        : {};
      
      await executeQuery(
        `INSERT INTO users (id, email, display_name, tag, created_at, last_login_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [
          creatorId,
          firebaseUser.email || req.user.email,
          firestoreUserData.displayName || firebaseUser.displayName || 'User',
          firestoreUserData.userTag || '0000'
        ]
      );
      console.log('✅ User created in MySQL:', creatorId);
    }

    // === STEP 1: Create group in MySQL ===
    const mysqlResult = await executeQuery(
      `INSERT INTO \`groups\` (name, description, creator_id, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [groupName.trim(), null, creatorId]
    );

    const mysqlGroupId = mysqlResult.insertId;
    console.log('✅ MySQL group created with ID:', mysqlGroupId);

    // === STEP 2: Add creator as admin in group_members (MySQL) ===
    await executeQuery(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, 'admin', NOW())`,
      [mysqlGroupId, creatorId]
    );
    console.log('✅ Creator added as admin in MySQL');

    // === STEP 3: Create group in Firestore ===
    const firestoreGroupRef = await admin.firestore()
      .collection('groups').add({
        name: groupName.trim(),
        creatorId: creatorId,
        groupPhotoUrl: groupPhotoUrl || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    const firestoreGroupId = firestoreGroupRef.id;
    console.log('✅ Firestore group created with ID:', firestoreGroupId);

    // === STEP 4: Add creator as admin in Firestore group_members ===
    await admin.firestore().collection('group_members').add({
      groupId: firestoreGroupId,
      userId: creatorId,
      role: 'admin',
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Creator added as admin in Firestore');

    // === STEP 5: Create mapping between MySQL and Firestore ===
    await executeQuery(
      `INSERT INTO group_mapping (firestore_id, mysql_id, group_name, creator_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mysql_id = VALUES(mysql_id), group_name = VALUES(group_name)`,
      [firestoreGroupId, mysqlGroupId, groupName.trim(), creatorId]
    );
    console.log('✅ Mapping created:', firestoreGroupId, '→', mysqlGroupId);

    // === STEP 6: Log activity ===
    await executeQuery(
      `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
       VALUES (?, 'create_group', ?, JSON_OBJECT('group_name', ?), NOW())`,
      [creatorId, mysqlGroupId.toString(), groupName.trim()]
    );

    // Return success với cả 2 IDs
    return res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: {
        firestoreGroupId,
        mysqlGroupId,
        name: groupName.trim(),
        creatorId,
        groupPhotoUrl: groupPhotoUrl || null
      }
    });

  } catch (error) {
    console.error('❌ Error creating group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});
```

---

## 🔀 So Sánh 2 UI Tạo Nhóm

### ChatSidebar.jsx (Recommended)

**Location:** `frontend/src/components/Chat/ChatSidebar.jsx`

**Đặc điểm:**
- ✅ Cho phép để trống tên nhóm
- ✅ Tự động tạo tên: `Nhóm của [User]`
- ✅ Helper text rõ ràng: "Để trống sẽ sử dụng tên mặc định"
- ✅ Placeholder động: `Nhóm của ${user?.name || 'Bạn'} (mặc định)`
- ✅ UX tốt hơn - linh hoạt hơn

**Code:**
```javascript
const handleCreateGroup = async () => {
  const groupName = newGroupName.trim() 
    || `Nhóm của ${user?.displayName || user?.email || 'Bạn'}`;
  
  const result = await createNewGroup(groupName, imagePreview);
  // ...
};
```

**Use Case:**
- User muốn tạo nhóm nhanh → Không cần nghĩ tên
- User muốn tên custom → Vẫn nhập được

### CreateGroupModal.jsx

**Location:** `frontend/src/components/Chat/CreateGroupModal.jsx`

**Đặc điểm:**
- ❌ Bắt buộc nhập tên nhóm (tối thiểu 3 ký tự)
- ❌ Không có logic tên mặc định
- ⚠️ Validation nghiêm ngặt hơn
- 📏 Character counter: 0/50

**Code:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!groupName.trim()) {
    setError('Vui lòng nhập tên nhóm');
    return;
  }
  
  if (groupName.length < 3) {
    setError('Tên nhóm phải có ít nhất 3 ký tự');
    return;
  }
  // ...
};
```

**Use Case:**
- UI cũ, có thể sẽ bị thay thế
- Dùng trong GroupsList component

### Recommendation

**Nên dùng:** ChatSidebar.jsx
- UX tốt hơn
- Linh hoạt hơn
- Có tên mặc định thông minh

**Nên refactor:** CreateGroupModal.jsx
- Thêm logic tên mặc định tương tự ChatSidebar
- Hoặc remove component này nếu không cần thiết

---

## 📊 Database Schema

### MySQL Tables

#### 1. `groups` Table
```sql
CREATE TABLE `groups` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `creator_id` VARCHAR(128) NOT NULL,  -- Firebase UID
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_creator (`creator_id`),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);
```

**Lưu ý:** 
- ❌ Không lưu `group_photo_url` trong MySQL (chỉ lưu trong Firestore)
- ✅ `creator_id` là Firebase UID (string)

#### 2. `group_members` Table
```sql
CREATE TABLE `group_members` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,  -- Firebase UID
  `role` ENUM('admin', 'member') DEFAULT 'member',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_member (group_id, user_id),
  INDEX idx_user (`user_id`),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);
```

#### 3. `group_mapping` Table
```sql
CREATE TABLE `group_mapping` (
  `firestore_id` VARCHAR(255) PRIMARY KEY,
  `mysql_id` INT NOT NULL,
  `group_name` VARCHAR(255),
  `creator_id` VARCHAR(128),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_mysql_id (mysql_id),
  INDEX idx_mysql_id (`mysql_id`),
  FOREIGN KEY (mysql_id) REFERENCES `groups`(id) ON DELETE CASCADE
);
```

**Purpose:** Liên kết giữa MySQL ID (số) và Firestore ID (string)

#### 4. `activity_logs` Table
```sql
CREATE TABLE `activity_logs` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` VARCHAR(128) NOT NULL,
  `action_type` VARCHAR(50),  -- 'create_group'
  `target_id` VARCHAR(255),   -- MySQL group ID
  `details` JSON,              -- { "group_name": "..." }
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_action (user_id, action_type),
  INDEX idx_created_at (created_at)
);
```

---

### Firestore Collections

#### 1. `groups` Collection
```javascript
// Document ID: Auto-generated (e.g., "abc123def456")
{
  name: "Nhóm Học Tập React",
  creatorId: "firebase_uid_123",
  groupPhotoUrl: "https://storage.googleapis.com/...",  // Chỉ lưu trong Firestore
  createdAt: Timestamp(2025-11-13 10:30:00)
}
```

#### 2. `group_members` Collection
```javascript
// Document ID: Auto-generated
{
  groupId: "abc123def456",      // Reference to groups/{groupId}
  userId: "firebase_uid_123",   // Reference to users/{userId}
  role: "admin",                 // "admin" hoặc "member"
  joinedAt: Timestamp(2025-11-13 10:30:00)
}
```

**Indexes:**
```javascript
// Composite index
groupId ASC, userId ASC

// Query: Lấy tất cả members của 1 group
db.collection('group_members')
  .where('groupId', '==', 'abc123def456')
  .get()
```

---

## 🔐 Security & Validation

### Backend Validation

#### 1. Authentication
```javascript
// Middleware: verifyFirebaseToken
router.use(verifyFirebaseToken);

// Trong route handler:
const creatorId = req.user.uid;  // Đảm bảo user đã đăng nhập
```

#### 2. Input Validation
```javascript
// Group name required
if (!groupName || !groupName.trim()) {
  return res.status(400).json({
    success: false,
    error: 'Group name is required'
  });
}

// Frontend validation: 3-50 chars
// Backend nên thêm validation tương tự
```

#### 3. User Existence Check
```javascript
// Đảm bảo user tồn tại trong MySQL trước khi tạo nhóm
const existingUser = await executeQuery(
  `SELECT id FROM users WHERE id = ?`,
  [creatorId]
);

if (!existingUser || existingUser.length === 0) {
  // Tạo user từ Firebase data
  // ...
}
```

### Frontend Validation

#### 1. Form Validation

**ChatSidebar (Flexible):**
```javascript
// Không validation - cho phép để trống
const groupName = newGroupName.trim() 
  || `Nhóm của ${user?.displayName || user?.email || 'Bạn'}`;

// groupName luôn có giá trị → Không cần check empty
```

**CreateGroupModal (Strict):**
```javascript
// Tên nhóm không được trống
if (!groupName.trim()) {
  setError('Vui lòng nhập tên nhóm');
  return;
}

// Tối thiểu 3 ký tự
if (groupName.length < 3) {
  setError('Tên nhóm phải có ít nhất 3 ký tự');
  return;
}

// Tối đa 50 ký tự
if (groupName.length > 50) {
  setError('Tên nhóm không được vượt quá 50 ký tự');
  return;
}
```

#### 2. Photo Validation
```javascript
const handlePhotoChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    // Kiểm tra kích thước file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh không được vượt quá 5MB');
      return;
    }
    
    setGroupPhoto(file);
    // Preview ảnh...
  }
};
```

---

## 🚀 Realtime Updates

### Frontend Listener

**File:** `frontend/src/contexts/AuthContext.jsx`

```javascript
// Realtime listener cho user groups
useEffect(() => {
  if (!user?.uid) return;

  console.log('🔥 Setting up realtime listener for user groups:', user.uid);
  
  // Query các nhóm mà user là thành viên
  const membershipQuery = query(
    collection(db, 'group_members'),
    where('userId', '==', user.uid)
  );
  
  const unsubscribe = onSnapshot(membershipQuery, async (snapshot) => {
    console.log('📡 Group membership update detected');
    
    // Lấy danh sách groupIds
    const groupIds = snapshot.docs.map(doc => doc.data().groupId);
    
    if (groupIds.length === 0) {
      setUserGroups([]);
      return;
    }
    
    // Load group details cho mỗi groupId
    const groupsData = [];
    for (const groupId of groupIds) {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (groupDoc.exists()) {
        groupsData.push({
          id: groupDoc.id,
          ...groupDoc.data()
        });
      }
    }
    
    setUserGroups(groupsData);
    console.log('✅ Groups updated:', groupsData.length);
  });
  
  return () => unsubscribe();
}, [user?.uid]);
```

**Trigger:**
- Khi có group_members document mới được tạo (user join/create group)
- Khi group_members document bị xóa (user leave/kick from group)
- UI tự động cập nhật danh sách nhóm

---

## 🎨 UI/UX Features

### ChatSidebar Design (UI Chính)

#### Visual Elements
```
┌─────────────────────────────────────────┐
│  👥 Tạo nhóm mới                    ✕   │
├─────────────────────────────────────────┤
│                                          │
│  Ảnh nhóm                                │
│  ┌───────────┐                           │
│  │  👥 Icon  │  [+ Chọn ảnh]             │
│  └───────────┘                           │
│                                          │
│  Tên nhóm                                │
│  ┌────────────────────────────────────┐ │
│  │ Nhóm của Nhân (mặc định)          │ │
│  └────────────────────────────────────┘ │
│  Để trống sẽ sử dụng tên mặc định       │
│                                          │
│  ┌─────────┐  ┌──────────────────────┐ │
│  │   Hủy   │  │     Tạo nhóm         │ │
│  └─────────┘  └──────────────────────┘ │
└─────────────────────────────────────────┘
```

### CreateGroupModal Design (UI Phụ)

#### Visual Elements
```
┌─────────────────────────────────────────┐
│  👥 Tạo nhóm mới                    ✕   │
├─────────────────────────────────────────┤
│                                          │
│           ┌───────────┐                  │
│           │  👥 Icon  │   📷             │
│           └───────────┘                  │
│         Ảnh nhóm (tùy chọn)             │
│                                          │
│  Tên nhóm *                              │
│  ┌────────────────────────────────────┐ │
│  │ Nhập tên nhóm...                   │ │
│  └────────────────────────────────────┘ │
│  Ít nhất 3 ký tự              0/50      │
│                                          │
│  ┌─────────────────────────────────┐   │
│  │ ⚠️ Tên nhóm phải có ít nhất 3 ký│   │
│  │    tự                            │   │
│  └─────────────────────────────────┘   │
│                                          │
│  ┌─────────┐  ┌──────────────────────┐ │
│  │   Hủy   │  │  🔄 Đang tạo...      │ │
│  └─────────┘  └──────────────────────┘ │
└─────────────────────────────────────────┘
```

#### States

**1. Initial State**
- Ảnh: Placeholder icon
- Input: Trống
- Button: "Tạo nhóm" (disabled)

**2. Typing State**
- Counter cập nhật: "15/50"
- Button enable khi >= 3 chars

**3. Loading State**
- Button: "🔄 Đang tạo..." (disabled)
- Modal không thể close

**4. Error State**
- Error message hiển thị màu đỏ
- Input border màu đỏ
- Button vẫn enabled (cho phép retry)

**5. Success State**
- Modal tự động đóng
- Danh sách nhóm tự động cập nhật
- Auto-navigate vào nhóm mới

---

## 📈 Performance Optimizations

### 1. Optimistic UI Updates
```javascript
// Không chờ Firestore listener, update state ngay
const createNewGroup = async (groupName, groupPhotoUrl) => {
  const result = await createGroup(groupName, user.uid, groupPhotoUrl);
  
  if (result.success) {
    // Optimistic update
    setUserGroups(prev => [...prev, {
      id: result.groupId,
      name: groupName,
      creatorId: user.uid
    }]);
    
    // Background refresh để đảm bảo data chính xác
    loadUserGroups();
  }
};
```

### 2. Parallel Database Writes
```javascript
// Step 3 & 4: Create Firestore group và add member song song
await Promise.all([
  admin.firestore().collection('groups').add({...}),
  admin.firestore().collection('group_members').add({...})
]);
```

### 3. Transaction for MySQL
```javascript
// Sử dụng transaction để đảm bảo atomicity
await executeTransaction(async (connection) => {
  // Create group
  const [groupResult] = await connection.execute(...);
  
  // Add member
  await connection.execute(...);
  
  // Log activity
  await connection.execute(...);
});
```

### 4. Background Photo Upload
```javascript
// TODO: Upload ảnh trong background, không block UI
if (groupPhoto) {
  uploadGroupPhoto(groupPhoto).then(url => {
    // Update group photo URL sau khi upload xong
    updateGroupPhoto(groupId, url);
  });
}
```

---

## 🔧 Error Handling

### Backend Error Cases

#### 1. Missing Group Name
```javascript
if (!groupName || !groupName.trim()) {
  return res.status(400).json({
    success: false,
    error: 'Group name is required'
  });
}
```

#### 2. MySQL Insert Failed
```javascript
try {
  const mysqlResult = await executeQuery(...);
} catch (error) {
  console.error('❌ MySQL insert failed:', error);
  return res.status(500).json({
    success: false,
    error: 'Failed to create group in database'
  });
}
```

#### 3. Firestore Write Failed
```javascript
try {
  const firestoreGroupRef = await admin.firestore()
    .collection('groups').add({...});
} catch (error) {
  console.error('❌ Firestore write failed:', error);
  
  // Rollback MySQL nếu Firestore failed
  await executeQuery(
    `DELETE FROM \`groups\` WHERE id = ?`,
    [mysqlGroupId]
  );
  
  return res.status(500).json({
    success: false,
    error: 'Failed to create group in realtime database'
  });
}
```

#### 4. Mapping Creation Failed
```javascript
try {
  await executeQuery(`INSERT INTO group_mapping ...`);
} catch (error) {
  console.error('⚠️ Mapping failed but group created');
  // Không rollback - group đã tạo thành công
  // Log error để admin fix sau
}
```

### Frontend Error Handling

#### 1. Network Error
```javascript
try {
  const response = await fetch(...);
} catch (error) {
  return { 
    success: false, 
    error: 'Không thể kết nối đến server. Vui lòng kiểm tra mạng.' 
  };
}
```

#### 2. API Error Response
```javascript
const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || 'Failed to create group');
}
```

#### 3. UI Error Display
```javascript
{error && (
  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-sm text-red-600">{error}</p>
  </div>
)}
```

---

## 🧪 Testing Scenarios

### Unit Tests

#### Backend Tests
```javascript
describe('POST /api/firebase-groups', () => {
  it('should create group successfully', async () => {
    const res = await request(app)
      .post('/api/firebase-groups')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ groupName: 'Test Group' });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.firestoreGroupId).toBeDefined();
  });
  
  it('should reject empty group name', async () => {
    const res = await request(app)
      .post('/api/firebase-groups')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ groupName: '' });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Group name is required');
  });
  
  it('should require authentication', async () => {
    const res = await request(app)
      .post('/api/firebase-groups')
      .send({ groupName: 'Test Group' });
    
    expect(res.status).toBe(401);
  });
});
```

#### Frontend Tests
```javascript
describe('CreateGroupModal', () => {
  it('should validate minimum length', () => {
    render(<CreateGroupModal isOpen={true} />);
    
    const input = screen.getByPlaceholderText('Nhập tên nhóm...');
    fireEvent.change(input, { target: { value: 'AB' } });
    
    const button = screen.getByText('Tạo nhóm');
    fireEvent.click(button);
    
    expect(screen.getByText(/ít nhất 3 ký tự/i)).toBeInTheDocument();
  });
  
  it('should call createNewGroup on submit', async () => {
    const createMock = jest.fn().mockResolvedValue({ success: true });
    
    render(<CreateGroupModal isOpen={true} />);
    
    const input = screen.getByPlaceholderText('Nhập tên nhóm...');
    fireEvent.change(input, { target: { value: 'Test Group' } });
    
    const button = screen.getByText('Tạo nhóm');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith('Test Group', null);
    });
  });
});
```

### Integration Tests

#### End-to-End Flow
```javascript
describe('Create Group E2E', () => {
  it('should create group and navigate to it', async () => {
    // 1. Login
    await loginAsUser('test@example.com', 'password');
    
    // 2. Open create modal
    await click('Tạo nhóm mới');
    
    // 3. Fill form
    await type('Nhập tên nhóm...', 'My Test Group');
    
    // 4. Submit
    await click('Tạo nhóm');
    
    // 5. Verify navigation
    await waitFor(() => {
      expect(getSelectedGroup().name).toBe('My Test Group');
    });
    
    // 6. Verify database
    const mysqlGroup = await queryMySQL(
      'SELECT * FROM `groups` WHERE name = ?',
      ['My Test Group']
    );
    expect(mysqlGroup).toBeDefined();
    
    const firestoreGroup = await getFirestoreDoc(
      'groups',
      mysqlGroup.firestore_id
    );
    expect(firestoreGroup.name).toBe('My Test Group');
  });
});
```

---

## 📊 Monitoring & Logging

### Backend Logs

```javascript
console.log('🆕 Creating new group:', groupName, 'by user:', creatorId);
console.log('✅ MySQL group created with ID:', mysqlGroupId);
console.log('✅ Creator added as admin in MySQL');
console.log('✅ Firestore group created with ID:', firestoreGroupId);
console.log('✅ Creator added as admin in Firestore');
console.log('✅ Mapping created:', firestoreGroupId, '→', mysqlGroupId);
```

### Error Logs

```javascript
console.error('❌ Error creating group:', error);
console.error('❌ MySQL insert failed:', error);
console.error('❌ Firestore write failed:', error);
console.warn('⚠️ User not found in MySQL, creating from Firebase...');
```

### Activity Tracking

```sql
INSERT INTO activity_logs 
  (user_id, action_type, target_id, details, created_at)
VALUES 
  ('user_123', 'create_group', '45', '{"group_name":"React Study"}', NOW());
```

**Query:**
```sql
-- Lấy lịch sử tạo nhóm của user
SELECT * FROM activity_logs 
WHERE user_id = 'user_123' 
  AND action_type = 'create_group'
ORDER BY created_at DESC;
```

---

## 🔮 Future Enhancements

### 1. Photo Upload Integration
```javascript
// Upload ảnh lên Firebase Storage
const uploadGroupPhoto = async (file) => {
  const storageRef = ref(storage, `group_photos/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};
```

### 2. Group Templates
```javascript
// Cho phép tạo nhóm từ template
const templates = [
  { name: 'Nhóm Học Tập', icon: '📚', tags: ['study', 'education'] },
  { name: 'Nhóm Dự Án', icon: '💼', tags: ['project', 'work'] },
  { name: 'Nhóm Thảo Luận', icon: '💬', tags: ['discussion'] }
];
```

### 3. Invite Members on Creation
```javascript
// Thêm members ngay khi tạo nhóm
const createNewGroup = async (groupName, photoUrl, memberIds = []) => {
  const result = await createGroup(groupName, user.uid, photoUrl);
  
  if (result.success && memberIds.length > 0) {
    await Promise.all(
      memberIds.map(memberId => 
        inviteMemberToGroup(result.groupId, memberId)
      )
    );
  }
};
```

### 4. Group Categories
```javascript
// Phân loại nhóm
const categories = [
  'Học tập',
  'Công việc',
  'Nghiên cứu',
  'Dự án',
  'Khác'
];

// Thêm vào schema
groups: {
  name: String,
  category: String,
  tags: Array<String>
}
```

### 5. Group Privacy Settings
```javascript
// Nhóm public/private
groups: {
  name: String,
  isPrivate: Boolean,  // true = chỉ mời được, false = ai cũng join
  requireApproval: Boolean  // true = admin phê duyệt request join
}
```

---

## 📚 Code References

### Frontend Files
- **Main UI:** `frontend/src/components/Chat/ChatSidebar.jsx` ⭐ (có tên mặc định)
- **Alt UI:** `frontend/src/components/Chat/CreateGroupModal.jsx` (bắt buộc nhập tên)
- **Context:** `frontend/src/contexts/AuthContext.jsx`
- **Service:** `frontend/src/services/firebase.js`
- **Usage:** `frontend/src/components/Chat/GroupsList.jsx`

### Backend Files
- **Route:** `backend/src/routes/firebaseGroups.js`
- **Model:** `backend/src/models/Group.js`
- **Middleware:** `backend/src/middleware/firebaseAuth.js`
- **Sync:** `backend/src/config/syncHelper.js`

### Database
- **MySQL:** `groups`, `group_members`, `group_mapping`, `activity_logs`
- **Firestore:** `groups/{id}`, `group_members/{id}`

---

## 🎓 Best Practices

### ✅ DO
1. **Validate input cả frontend và backend**
2. **Sử dụng transactions cho MySQL** - Đảm bảo atomicity
3. **Log mọi steps** - Dễ debug khi có lỗi
4. **Handle errors gracefully** - Rollback khi cần
5. **Auto-sync MySQL ↔ Firestore** - Đảm bảo consistency
6. **Use optimistic UI updates** - Tăng trải nghiệm người dùng
7. **Verify user authentication** - Kiểm tra token trước khi tạo

### ❌ DON'T
1. **Không skip validation** - Luôn validate input
2. **Không ignore errors** - Log và handle mọi errors
3. **Không hardcode user IDs** - Lấy từ authenticated user
4. **Không tạo group mà không add creator** - Phải có admin
5. **Không quên tạo mapping** - Cần để sync MySQL ↔ Firestore
6. **Không block UI quá lâu** - Upload ảnh trong background

---

**Ngày cập nhật:** 13/11/2025  
**Version:** 1.0  
**Tác giả:** DocsShare Development Team
