# Chức năng Mời thành viên vào nhóm - DocsShare

## Tổng quan
Phân tích chức năng mời thành viên vào nhóm trong dự án DocsShare, dựa trên code thực tế đã được implement. Chức năng này được chia thành hai phần chính:

1. **Tìm kiếm người dùng** - Tìm kiếm users từ Firebase Authentication
2. **Gửi và xử lý lời mời** - Tạo invitation và xử lý accept/decline

**Kiến trúc hệ thống:**
- Frontend: React + Firebase Firestore (Real-time)
- Backend: Node.js + MySQL (Persistent storage)
- Authentication: Firebase Authentication
- Dual-database: MySQL ↔ Firebase Firestore sync

---

## 1. Chức năng Tìm kiếm Người dùng

### 1.1. Mô tả thực tế
Hệ thống tìm kiếm người dùng trực tiếp từ **Firebase Authentication** (không dùng MySQL). Người dùng có thể tìm kiếm theo:
- Tên hiển thị (displayName)
- Email
- Tag (#2200, #1234, etc.)
- Username format: `Name#Tag` (ví dụ: Cookie#2200)

### 1.2. Luồng hoạt động

```
User nhập từ khóa → Frontend search Firebase directly 
                  ↓
          Filter client-side (debounce 300ms)
                  ↓
          Hiển thị kết quả (loại trừ current user)
```

**Đặc điểm:**
- ✅ Search directly từ Firebase (không cần backend API)
- ✅ Client-side filtering với debounce 300ms
- ✅ Hỗ trợ search theo Name#Tag format
- ✅ Tự động loại trừ current user
- ✅ Giới hạn 100 users để tối ưu performance

### 1.3. API Backend (Alternative)

Ngoài search trực tiếp, backend cung cấp API search qua Firebase Admin:

```
GET /api/firebase-users/search?q={keyword}
```

**File:** `backend/src/routes/firebaseUsers.js`

**Query Parameters:**
- `q` (string, required): Từ khóa tìm kiếm (tối thiểu 2 ký tự)

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "uid": "firebase_uid_123",
      "displayName": "Cookie#2200",
      "userTag": "#2200",
      "email": "user@example.com",
      "avatar": "https://firebase.storage.../avatar.jpg",
      "emailVerified": true
    }
  ]
}
```

**Response Empty (200):**
```json
{
  "success": true,
  "data": []
}
```

### 1.4. Logic tìm kiếm Backend

```javascript
// backend/src/routes/firebaseUsers.js
router.get('/search', async (req, res) => {
  const { q } = req.query;
  const currentUserId = req.user.uid;

  // Validate
  if (!q || q.trim().length < 2) {
    return res.json({ success: true, data: [] });
  }

  // List all Firebase Auth users (max 1000)
  const listUsersResult = await admin.auth().listUsers(1000);
  
  // Filter users
  let matchedUsers = listUsersResult.users.filter(user => {
    // Skip current user
    if (user.uid === currentUserId) return false;
    
    const displayName = user.displayName || '';
    const email = user.email || '';
    
    // Extract tag from displayName (format: "Name#Tag")
    const tagMatch = displayName.match(/#(\w+)$/);
    const userTag = tagMatch ? tagMatch[1] : '';
    const nameWithoutTag = displayName.replace(/#\w+$/, '').trim();
    
    const query = q.toLowerCase();
    
    // Match by:
    // 1. Full displayName (Cookie#2200)
    if (displayName.toLowerCase().includes(query)) return true;
    
    // 2. Name without tag (Cookie)
    if (nameWithoutTag.toLowerCase().includes(query)) return true;
    
    // 3. Tag (#2200 or 2200)
    if (userTag) {
      if (query.startsWith('#')) {
        if (userTag.toLowerCase().includes(query.substring(1))) return true;
      } else {
        if (userTag.toLowerCase().includes(query)) return true;
      }
    }
    
    // 4. Email
    if (email.toLowerCase().includes(query)) return true;
    
    return false;
  });

  // Limit to 20 results
  matchedUsers = matchedUsers.slice(0, 20);
  
  return res.json({ success: true, data: matchedUsers });
});
```

**Đặc điểm:**
- ✅ Tìm kiếm từ Firebase Admin SDK
- ✅ Hỗ trợ partial matching (không phân biệt hoa thường)
- ✅ Tách biệt Name và Tag cho search chính xác
- ✅ Giới hạn 20 kết quả để tối ưu
- ✅ Loại trừ current user tự động

### 1.5. Frontend Implementation

**File:** `frontend/src/components/Chat/AddMemberModal.jsx`

#### 1.5.1. Search Component

```jsx
const AddMemberModal = ({ isOpen, onClose, groupId, groupName }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Debounced search - Tìm kiếm trực tiếp từ Firebase
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    const timeoutId = setTimeout(async () => {
      try {
        const db = getFirestore();
        const usersRef = collection(db, 'users');
        
        // Parse search query
        const searchTrimmed = searchQuery.trim();
        let searchName = '';
        let searchTag = '';
        
        // Phân tích query: "Cookie#2200" → name="cookie", tag="2200"
        if (searchTrimmed.includes('#')) {
          const parts = searchTrimmed.split('#');
          searchName = parts[0].toLowerCase().trim();
          searchTag = parts[1] ? parts[1].toLowerCase().trim() : '';
        } else if (searchTrimmed.startsWith('#')) {
          // Search by tag only (#2200)
          searchTag = searchTrimmed.substring(1).toLowerCase().trim();
        } else {
          // Search by name only (Cookie)
          searchName = searchTrimmed.toLowerCase();
        }
        
        // Lấy tất cả users và filter client-side
        const q = query(usersRef, limit(100));
        const snapshot = await getDocs(q);
        
        const results = [];
        snapshot.forEach(doc => {
          const userData = doc.data();
          const displayName = (userData.displayName || '').toLowerCase();
          const username = (userData.username || '').toLowerCase();
          const email = (userData.email || '').toLowerCase();
          const userTag = (userData.userTag || '').toLowerCase();
          
          let matches = false;
          
          if (searchName && searchTag) {
            // Cả name và tag (Cookie#2200)
            matches = displayName.includes(searchName) && userTag.includes(searchTag);
          } else if (searchTag) {
            // Chỉ tag (#2200)
            matches = userTag.includes(searchTag);
          } else if (searchName) {
            // Chỉ name (Cookie) - tìm trong displayName, username, email
            matches = displayName.includes(searchName) || 
                     username.includes(searchName) || 
                     email.includes(searchName);
          }
          
          // Loại trừ current user
          if (matches && doc.id !== auth.currentUser?.uid) {
            results.push({
              uid: doc.id,
              displayName: userData.displayName || 'Unknown',
              username: userData.username || '',
              email: userData.email || '',
              photoURL: userData.photoURL || userData.avatar || null,
              userTag: userData.userTag || ''
            });
          }
        });
        
        setSearchResults(results);
      } catch (err) {
        console.error('Firebase search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    // JSX UI...
  );
};
```

#### 1.5.2. Đặc điểm Frontend Search

**Ưu điểm:**
- ✅ Real-time search với debounce 300ms
- ✅ Không cần gọi backend API (giảm latency)
- ✅ Client-side filtering linh hoạt
- ✅ Hỗ trợ tìm kiếm phức tạp (Name#Tag)

**Nhược điểm:**
- ❌ Giới hạn 100 users (performance)
- ❌ Cần download users data về client
- ❌ Không scale tốt với hàng nghìn users

**Cải thiện đề xuất:**
```javascript
// Nên chuyển sang dùng backend API cho production:
const searchUsers = async (query) => {
  const token = await auth.currentUser.getIdToken();
  
  const response = await fetch(
    `http://localhost:5000/api/firebase-users/search?q=${encodeURIComponent(query)}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  setSearchResults(data.data);
};
```

### 1.6. UI/UX

**Giao diện tìm kiếm:**
- Input field với placeholder "Tìm kiếm theo tên hoặc email..."
- Loading spinner khi đang search
- Hiển thị kết quả real-time
- Avatar + displayName + email
- Pagination: 3 users/page

**States:**
- `isSearching`: Hiển thị loading spinner
- `searchResults`: Danh sách kết quả
- `selectedUsers`: Users đã chọn để mời
- Empty state: "Nhập ít nhất 2 ký tự để tìm kiếm"

---

## 2. Chức năng Gửi và Xử lý Lời mời

### 2.1. Mô tả thực tế
Sau khi tìm và chọn users, hệ thống gửi lời mời vào nhóm. Lời mời được lưu trong **cả MySQL và Firebase** để đảm bảo persistence và real-time updates.

### 2.2. Database Schema thực tế

#### 2.2.1. Bảng MySQL: `group_invitations`
```sql
CREATE TABLE group_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  inviter_id VARCHAR(255) NOT NULL COMMENT 'Firebase UID',
  invitee_id VARCHAR(255) NOT NULL COMMENT 'Firebase UID',
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  
  -- Ngăn duplicate pending invitations
  UNIQUE KEY unique_pending_invitation (group_id, invitee_id, status),
  
  INDEX idx_invitee (invitee_id, status),
  INDEX idx_group (group_id, status)
);
```

**Đặc điểm:**
- `id`: MySQL auto-increment ID
- `group_id`: MySQL group ID (không phải Firestore ID)
- `inviter_id`, `invitee_id`: Firebase UID
- 3 status: `pending`, `accepted`, `declined`
- UNIQUE constraint: Không thể gửi duplicate pending invitation

#### 2.2.2. Collection Firebase: `group_invitations`
```javascript
{
  invitation_id: 123,        // MySQL ID
  group_id: "firestore_id",  // Firestore group ID
  inviter_id: "firebase_uid",
  invitee_id: "firebase_uid",
  status: "pending",
  created_at: Timestamp
}
```

**Mục đích:** Real-time updates cho notifications

### 2.3. API Endpoints

#### 2.3.1. Gửi lời mời (Bulk invite)
```
POST /api/firebase-users/invite
```

**File:** `backend/src/routes/firebaseUsers.js`

**Request Body:**
```json
{
  "groupId": "firestore_group_id",
  "userIds": ["uid1", "uid2", "uid3"]
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Invitations sent successfully",
  "data": {
    "invited": 3,
    "failed": 0,
    "results": [
      {
        "userId": "uid1",
        "status": "invited"
      }
    ]
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "error": "groupId and userIds array are required"
}
```

#### 2.3.2. Lấy lời mời đang chờ
```
GET /api/invitations/pending
```

**File:** `backend/src/routes/invitations.js`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "group_id": 1,
      "inviter_id": "firebase_uid",
      "status": "pending",
      "created_at": "2025-11-14T10:00:00Z",
      "group_name": "Nhóm Học Tập",
      "group_description": "Mô tả nhóm"
    }
  ]
}
```

#### 2.3.3. Chấp nhận lời mời
```
POST /api/invitations/:invitationId/accept
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Invitation accepted successfully",
  "data": {
    "group": {
      "id": 1,
      "name": "Nhóm Học Tập",
      "description": "..."
    },
    "invitation": { ... }
  }
}
```

**Response Success (200) - Pending Approval:**
```json
{
  "success": true,
  "message": "Invitation accepted. Waiting for admin approval.",
  "pending": true,
  "data": { ... }
}
```

#### 2.3.4. Từ chối lời mời
```
POST /api/invitations/:invitationId/decline
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Invitation declined successfully"
}
```

### 2.4. Luồng xử lý Backend

#### 2.4.1. Gửi lời mời (Implementation thực tế)

**File:** `backend/src/routes/firebaseUsers.js`

```javascript
router.post('/invite', async (req, res) => {
  const { groupId, userIds } = req.body; // Firestore group ID
  const inviterId = req.user.uid;

  // 1. Validate input
  if (!groupId || !userIds || !Array.isArray(userIds)) {
    return res.status(400).json({
      success: false,
      error: 'groupId and userIds array are required'
    });
  }

  // 2. Get MySQL group ID from Firestore mapping
  const groupMapping = await executeQuery(
    `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
    [groupId]
  );

  if (groupMapping.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Group not found'
    });
  }

  const mysqlGroupId = groupMapping[0].mysql_id;

  // 3. Verify inviter is member
  const memberCheck = await executeQuery(
    `SELECT * FROM group_members WHERE group_id = ? AND user_id = ?`,
    [mysqlGroupId, inviterId]
  );

  if (memberCheck.length === 0) {
    return res.status(403).json({
      success: false,
      error: 'You are not a member of this group'
    });
  }

  // 4. Send invitations (bulk)
  const results = [];
  
  for (const userId of userIds) {
    try {
      // Check if already member
      const existingMember = await executeQuery(
        `SELECT * FROM group_members WHERE group_id = ? AND user_id = ?`,
        [mysqlGroupId, userId]
      );

      if (existingMember.length > 0) {
        results.push({
          userId,
          status: 'already_member',
          error: 'User is already a member'
        });
        continue;
      }

      // Check for pending invitation
      const existingInvitation = await executeQuery(
        `SELECT * FROM group_invitations 
         WHERE group_id = ? AND invitee_id = ? AND status = 'pending'`,
        [mysqlGroupId, userId]
      );

      if (existingInvitation.length > 0) {
        results.push({
          userId,
          status: 'already_invited',
          error: 'Invitation already sent'
        });
        continue;
      }

      // Create invitation in MySQL
      const invitationResult = await executeQuery(
        `INSERT INTO group_invitations (group_id, inviter_id, invitee_id, status)
         VALUES (?, ?, ?, 'pending')`,
        [mysqlGroupId, inviterId, userId]
      );

      const invitationId = invitationResult.insertId;

      // Sync to Firebase for real-time
      const db = admin.firestore();
      await db.collection('group_invitations').add({
        invitation_id: invitationId,
        group_id: groupId, // Firestore ID
        inviter_id: inviterId,
        invitee_id: userId,
        status: 'pending',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      results.push({
        userId,
        status: 'invited',
        invitationId
      });

    } catch (err) {
      results.push({
        userId,
        status: 'error',
        error: err.message
      });
    }
  }

  // Summary
  const invited = results.filter(r => r.status === 'invited').length;
  const failed = results.filter(r => r.status === 'error').length;

  res.json({
    success: true,
    message: 'Invitations processed',
    data: {
      invited,
      failed,
      results
    }
  });
});
```

**Đặc điểm:**
- ✅ Bulk invite nhiều users cùng lúc
- ✅ Validate member status trước khi invite
- ✅ Ngăn duplicate invitations
- ✅ Sync MySQL → Firebase for real-time
- ✅ Detailed results cho từng user

#### 2.4.2. Chấp nhận lời mời (Implementation thực tế)

**File:** `backend/src/routes/invitations.js`

```javascript
router.post('/:invitationId/accept', async (req, res) => {
  const { invitationId } = req.params;
  const userId = req.user.uid;

  // 1. Lấy invitation từ MySQL
  const invitations = await executeQuery(
    `SELECT * FROM group_invitations 
     WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
    [invitationId, userId]
  );

  if (invitations.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Invitation not found or already processed'
    });
  }

  const invitation = invitations[0];

  // 2. Lấy Firestore group ID
  const mappings = await executeQuery(
    `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
    [invitation.group_id]
  );

  const firestoreGroupId = mappings[0].firestore_id;

  // 3. Thêm vào Firebase TRƯỚC (for real-time UI)
  try {
    const db = admin.firestore();
    
    // Lấy username từ Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userName = userDoc.exists 
      ? (userDoc.data().username || userDoc.data().displayName) 
      : 'Người dùng mới';
    
    // Kiểm tra group có yêu cầu approval không
    const groupDoc = await db.collection('groups').doc(firestoreGroupId).get();
    const requireApproval = groupDoc.data()?.requireMemberApproval || false;
    
    // Check inviter là admin không
    const inviterRole = await db.collection('group_members')
      .where('groupId', '==', firestoreGroupId)
      .where('userId', '==', invitation.inviter_id)
      .get();
    
    const isInviterAdmin = !inviterRole.empty && 
                          inviterRole.docs[0].data().role === 'admin';
    
    if (requireApproval && !isInviterAdmin) {
      // Thêm vào pending_members thay vì group_members
      await db.collection('pending_members').add({
        groupId: firestoreGroupId,
        userId: userId,
        invitedBy: invitation.inviter_id,
        invitedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });
      
      // Delete Firestore invitation
      const invitationsSnapshot = await db.collection('group_invitations')
        .where('invitation_id', '==', parseInt(invitationId))
        .where('invitee_id', '==', userId)
        .get();
      
      invitationsSnapshot.docs.forEach(doc => doc.ref.delete());
      
      // Update MySQL status
      await executeQuery(
        `UPDATE group_invitations SET status = 'accepted' WHERE id = ?`,
        [invitationId]
      );
      
      return res.json({
        success: true,
        message: 'Invitation accepted. Waiting for admin approval.',
        pending: true
      });
    }
    
    // Normal flow: Thêm trực tiếp vào group_members
    const membershipQuery = await db.collection('group_members')
      .where('groupId', '==', firestoreGroupId)
      .where('userId', '==', userId)
      .get();
    
    if (membershipQuery.empty) {
      await db.collection('group_members').add({
        groupId: firestoreGroupId,
        userId: userId,
        role: 'member',
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Tạo system message
    await db.collection('groups').doc(firestoreGroupId)
      .collection('messages').add({
        type: 'system',
        content: `${userName} đã tham gia nhóm`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId: userId,
        userName: userName,
        isSystemMessage: true
      });
    
    // Delete Firebase invitation
    const invitationsSnapshot = await db.collection('group_invitations')
      .where('invitation_id', '==', parseInt(invitationId))
      .where('invitee_id', '==', userId)
      .get();
    
    invitationsSnapshot.docs.forEach(doc => doc.ref.delete());
    
  } catch (firestoreError) {
    console.error('Firebase sync failed:', firestoreError);
    return res.status(500).json({
      success: false,
      error: 'Failed to add member to group'
    });
  }

  // 4. Update MySQL (sau khi Firebase thành công)
  await executeQuery(
    `INSERT INTO group_members (group_id, user_id, role) 
     VALUES (?, ?, 'member') 
     ON DUPLICATE KEY UPDATE role = role`,
    [invitation.group_id, userId]
  );

  await executeQuery(
    `UPDATE group_invitations SET status = 'accepted' WHERE id = ?`,
    [invitationId]
  );

  // 5. Get group info
  const groups = await executeQuery(
    `SELECT id, name, description FROM \`groups\` WHERE id = ?`,
    [invitation.group_id]
  );

  res.json({
    success: true,
    message: 'Invitation accepted successfully',
    data: {
      group: groups[0],
      invitation: invitation
    }
  });
});
```

**Đặc điểm quan trọng:**
- ✅ **Firebase first, MySQL second** - Ưu tiên real-time UX
- ✅ Hỗ trợ **pending approval** nếu group require approval
- ✅ Tạo system message khi join
- ✅ Rollback nếu Firebase fail
- ✅ Clean up Firebase invitation sau khi xử lý

#### 2.4.3. Từ chối lời mời

```javascript
router.post('/:invitationId/decline', async (req, res) => {
  const { invitationId } = req.params;
  const userId = req.user.uid;

  // Update MySQL
  await executeQuery(
    `UPDATE group_invitations 
     SET status = 'declined', updated_at = NOW() 
     WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
    [invitationId, userId]
  );

  // Delete Firebase invitation
  const db = admin.firestore();
  const invitationsSnapshot = await db.collection('group_invitations')
    .where('invitation_id', '==', parseInt(invitationId))
    .where('invitee_id', '==', userId)
    .get();
  
  invitationsSnapshot.docs.forEach(doc => doc.ref.delete());

  res.json({
    success: true,
    message: 'Invitation declined successfully'
  });
});
```

### 2.5. Frontend Implementation

#### 2.5.1. Gửi lời mời

**File:** `frontend/src/components/Chat/AddMemberModal.jsx`

```jsx
const AddMemberModal = ({ isOpen, onClose, groupId }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) return;

    setIsSending(true);
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(
        'http://localhost:5000/api/firebase-users/invite',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            groupId: groupId, // Firestore ID
            userIds: selectedUsers.map(u => u.uid)
          })
        }
      );

      if (!response.ok) throw new Error('Failed to send invitations');

      const data = await response.json();
      
      // Close modal
      onClose();
      
      // Show success notification
      showNotification(
        `Đã gửi lời mời đến ${selectedUsers.length} người dùng`
      );

    } catch (err) {
      console.error('Send invitation error:', err);
      setError('Không thể gửi lời mời');
    } finally {
      setIsSending(false);
    }
  };

  return (
    // UI với search, select users, và send button
  );
};
```

#### 2.5.2. Nhận và xử lý lời mời

**File:** `frontend/src/components/Chat/InvitationNotifications.jsx`

```jsx
const InvitationNotifications = () => {
  const [invitations, setInvitations] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  // Load invitations từ MySQL
  const loadInvitations = async () => {
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch(
      'http://localhost:5000/api/invitations/pending',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const data = await response.json();
    setInvitations(data.data || []);
  };

  // Real-time listener từ Firebase
  useEffect(() => {
    if (!auth.currentUser) return;

    // Initial load
    loadInvitations();
    
    // Firestore listener
    const db = getFirestore();
    const q = query(
      collection(db, 'group_invitations'),
      where('invitee_id', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          console.log('🔔 New invitation!');
          loadInvitations(); // Reload từ MySQL để có đầy đủ info
        }
        if (change.type === 'removed') {
          loadInvitations();
        }
      });
    });

    return () => unsubscribe();
  }, []);

  const handleAccept = async (invitationId) => {
    setProcessingId(invitationId);
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(
        `http://localhost:5000/api/invitations/${invitationId}/accept`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const result = await response.json();
      
      // Remove từ list ngay lập tức
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      if (result.pending) {
        showNotification('Đang chờ quản trị viên phê duyệt');
      } else {
        showNotification(`Đã tham gia nhóm "${result.data.group.name}"`);
      }
      
    } catch (err) {
      alert('Không thể chấp nhận lời mời');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId) => {
    // Similar to accept...
  };

  return (
    <div>
      {/* Bell icon với badge */}
      {invitations.length > 0 && (
        <span className="badge">{invitations.length}</span>
      )}
      
      {/* Dropdown list invitations */}
      {invitations.map(inv => (
        <div key={inv.id}>
          <p>{inv.group_name}</p>
          <button onClick={() => handleAccept(inv.id)}>Chấp nhận</button>
          <button onClick={() => handleDecline(inv.id)}>Từ chối</button>
        </div>
      ))}
    </div>
  );
};
```

**Đặc điểm:**
- ✅ Real-time notifications từ Firestore
- ✅ Load full data từ MySQL
- ✅ Instant UI update khi accept/decline
- ✅ Hỗ trợ pending approval status

### 2.6. Luồng hoàn chỉnh

```
1. Admin search users → Frontend search Firebase
                      ↓
2. Select users → Click "Gửi lời mời"
                      ↓
3. POST /api/firebase-users/invite
   → Create invitations in MySQL
   → Sync to Firebase
                      ↓
4. Invitee nhận real-time notification (Firestore listener)
                      ↓
5. Invitee click "Chấp nhận"
   → POST /api/invitations/:id/accept
                      ↓
6. Add to Firebase group_members (real-time)
   → Update MySQL group_members
   → Create system message
   → Delete invitation
                      ↓
7. UI auto-update (Firestore listeners)
```

### 2.7. Đặc điểm hệ thống

**Ưu điểm:**
- ✅ Real-time notifications và updates
- ✅ Dual-database đảm bảo reliability
- ✅ Firebase-first cho UX tốt
- ✅ MySQL cho data persistence
- ✅ Hỗ trợ pending approval workflow
- ✅ System messages tự động

**Phức tạp:**
- ⚠️ Cần sync 2 databases
- ⚠️ Có thể có data mismatch
- ⚠️ Logic phức tạp với approval flow

---

## 3. Tích hợp với Hệ thống

### 3.1. Group Mapping System
Do hệ thống dùng dual-database, cần mapping giữa MySQL và Firestore:

```sql
-- Bảng group_mapping
CREATE TABLE group_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firestore_id VARCHAR(128) UNIQUE NOT NULL,
    mysql_id INT NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (mysql_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    INDEX idx_firestore_id (firestore_id),
    INDEX idx_mysql_id (mysql_id)
);
```

**Mục đích:**
- Frontend dùng Firestore ID
- Backend operation dùng MySQL ID
- Cần lookup mapping khi xử lý invitations

### 3.2. Pending Approval System

**Collection Firebase:** `pending_members`
```javascript
{
  groupId: "firestore_id",
  userId: "firebase_uid",
  invitedBy: "firebase_uid",
  invitedAt: Timestamp,
  status: "pending"
}
```

**Workflow:**
1. Group có setting `requireMemberApproval = true`
2. Inviter không phải admin
3. Accept invitation → Vào `pending_members` thay vì `group_members`
4. Admin approve → Move sang `group_members`

### 3.3. Real-time Notifications

**Firestore Listeners:**
```javascript
// Listen to new invitations
const q = query(
  collection(db, 'group_invitations'),
  where('invitee_id', '==', currentUserId),
  where('status', '==', 'pending')
);

onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      // Show notification
      showNewInvitationBadge();
    }
    if (change.type === 'removed') {
      // Invitation processed
      updateInvitationsList();
    }
  });
});
```

### 3.4. System Messages

Khi user join group, tự động tạo system message:

```javascript
await db.collection('groups').doc(groupId)
  .collection('messages').add({
    type: 'system',
    content: `${userName} đã tham gia nhóm`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userId: userId,
    userName: userName,
    isSystemMessage: true
  });
```
