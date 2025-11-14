# Chức năng Rời nhóm - DocsShare

## Tổng quan
Phân tích chức năng rời nhóm (leave group) trong dự án DocsShare, dựa trên code thực tế đã được implement. Chức năng cho phép thành viên tự rời khỏi nhóm mà họ đang tham gia.

**Kiến trúc hệ thống:**
- Frontend: React + Firebase Firestore (Real-time)
- Backend: Node.js + MySQL (Persistent storage)
- Authentication: Firebase Authentication
- Dual-database: MySQL ↔ Firebase Firestore sync

**Đặc điểm chính:**
- ✅ Bất kỳ thành viên nào cũng có thể rời nhóm (self-leave)
- ✅ Creator không thể rời nhóm (phải xóa nhóm hoặc transfer ownership)
- ✅ **MySQL-first approach** (xóa MySQL trước, sync Firestore sau)
- ✅ Data integrity - MySQL là source of truth
- ✅ Real-time update cho các thành viên khác
- ✅ Confirmation modal với cảnh báo rõ ràng
- ✅ Tự động refresh danh sách nhóm sau khi rời
- ✅ Close sidebar và clear selected group

---

## 1. Quyền hạn và Ràng buộc

### 1.1. Ai có thể rời nhóm?

**Được phép:**
- ✅ **Bất kỳ thành viên nào** (member hoặc admin) - Ngoại trừ creator

**Không được phép:**
- ❌ **Creator của nhóm** - Phải xóa nhóm hoặc transfer ownership trước

### 1.2. Validation Logic

**File:** `backend/src/models/Group.js` (sử dụng `removeMember` method)

```javascript
static async removeMember(groupId, userId, removedBy) {
  try {
    return await executeTransaction(async (connection) => {
      // STEP 1: Check if user is leaving themselves
      // (userId === removedBy means self-leave)
      
      // STEP 2: Check if user is creator (cannot leave)
      const [creatorCheck] = await connection.execute(
        `SELECT creator_id FROM \`groups\` WHERE id = ?`,
        [groupId]
      );
      
      if (creatorCheck.length > 0 && creatorCheck[0].creator_id === userId) {
        throw new Error('Group creator cannot be removed. Transfer ownership first.');
      }
      
      // STEP 3: Delete member
      const [result] = await connection.execute(
        `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, userId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('User is not a member of this group');
      }
      
      return {
        success: true,
        message: 'Left group successfully'
      };
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: error.message };
  }
}
```

**Flow validation:**
```
1. User click "Rời nhóm"
         ↓
2. User là creator? → Nếu đúng: Error "Cannot leave, transfer ownership first"
         ↓ NO
3. User trong nhóm? → Nếu không: Error "Not a member"
         ↓ YES
4. Cho phép rời nhóm ✅
```

---

## 2. API Endpoint

### 2.1. Leave Group API

```
POST /api/groups/:groupId/leave
```

**File:** `backend/src/routes/groupsNew.js`

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Params:**
- `groupId` (string): Firestore group ID hoặc MySQL group ID

**Request Body:** Không có (userId lấy từ JWT token)

**Response Success (200):**
```json
{
  "success": true,
  "message": "Left group successfully"
}
```

**Response Error (400):**
```json
{
  "success": false,
  "error": "Group creator cannot be removed. Transfer ownership first."
}
```

**Response Error (404):**
```json
{
  "success": false,
  "error": "Group not found"
}
```

**Response Error (404):**
```json
{
  "success": false,
  "error": "User is not a member of this group"
}
```

**Response Error (500):**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

### 2.2. Route Implementation

**File:** `backend/src/routes/groupsNew.js`

```javascript
// Leave nhóm
router.post('/:groupId/leave', async (req, res) => {
  try {
    let { groupId } = req.params;
    const userId = req.user.id; // Lấy từ Firebase JWT token
    
    console.log(`🚪 Leave group request: groupId=${groupId}, userId=${userId}`);
    
    // STEP 1: Convert Firestore ID ↔ MySQL ID
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      // Firestore ID → MySQL ID
      const mapping = await executeQuery(
        `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      if (!mapping || mapping.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }
      
      mysqlGroupId = mapping[0].mysql_id;
      console.log(`✅ Mapped to MySQL group ${mysqlGroupId}`);
    } else {
      // MySQL ID → Firestore ID
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // STEP 2: Remove from MySQL FIRST (source of truth)
    console.log(`🗄️ Removing user ${userId} from MySQL group ${mysqlGroupId}...`);
    const result = await Group.removeMember(mysqlGroupId, userId, userId);
    
    if (!result.success) {
      console.error('❌ MySQL removal failed:', result.error);
      return res.status(400).json(result);
    }
    
    console.log(`✅ Removed user ${userId} from MySQL group ${mysqlGroupId}`);

    // STEP 3: Sync to Firebase Firestore (for real-time UI update)
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      // Query to find member document
      const memberSnapshot = await db.collection('group_members')
        .where('groupId', '==', firestoreGroupId)
        .where('userId', '==', userId)
        .get();
      
      if (!memberSnapshot.empty) {
        // Batch delete (có thể có nhiều documents)
        const batch = db.batch();
        memberSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        console.log(`✅ Synced removal to Firebase (${memberSnapshot.size} document(s))`);
      } else {
        console.log(`⚠️ No Firebase document found for user ${userId}`);
      }
    } catch (firebaseError) {
      console.error('❌ Failed to sync to Firebase (non-critical):', firebaseError);
      console.error('⚠️ DATA MISMATCH: Member removed from MySQL but still in Firebase!');
      // Don't fail the request - MySQL is source of truth
      // Background sync will fix this later
    }

    // Return success since MySQL (source of truth) succeeded
    res.json({
      success: true,
      message: 'Left group successfully'
    });
      });
    }
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

---

## 3. Luồng rời nhóm Backend

### 3.1. MySQL-First Strategy

**Tại sao xóa MySQL trước?**
- ✅ Data Integrity: MySQL là source of truth
- ✅ Nếu MySQL fail → Stop, không có side effects
- ✅ Nếu Firestore fail → MySQL đã xóa (chính xác), background sync sẽ fix

**Trade-off:**
- ⚠️ Real-time update có thể bị delay nếu Firestore sync chậm
- 💡 Solution: Firestore sync là non-critical, log warning và continue

### 3.2. Luồng hoàn chỉnh

```
User click "Rời nhóm" button
         ↓
Confirmation modal → User confirms
         ↓
Frontend: POST /api/groups/:groupId/leave
         ↓
Backend Step 1: Determine group ID type
   ├─ Firestore ID (string) → Convert to MySQL ID
   └─ MySQL ID (number) → Get Firestore ID
         ↓
Backend Step 2: Delete from MySQL FIRST
   ├─ Check user is not creator
   ├─ DELETE FROM group_members
   ├─ If fail → Return 400/404 error (STOP)
   └─ MySQL removal successful ✅
         ↓
Backend Step 3: Sync to Firebase Firestore
   ├─ Query group_members collection
   ├─ where('groupId', '==', firestoreGroupId)
   ├─ where('userId', '==', userId)
   ├─ Batch delete all matched documents
   └─ If fail → Log warning (non-critical, continue)
         ↓
Backend Step 4: Return success
   └─ MySQL is source of truth
         ↓
Frontend Step 5: Handle response
   ├─ Refresh user groups list
   ├─ Clear selected group
   ├─ Close sidebar
   └─ Show success notification
         ↓
Real-time: Other members see user left ✅
```

### 3.3. Group ID Conversion

**Frontend dùng Firestore ID, Backend cần MySQL ID:**

```javascript
// Detect ID type
if (isNaN(groupId)) {
  // Firestore ID (long string like "abc123...")
  const mapping = await executeQuery(
    `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
    [groupId]
  );
  mysqlGroupId = mapping[0].mysql_id;
} else {
  // MySQL ID (integer like 1, 2, 3)
  mysqlGroupId = parseInt(groupId);
  const mapping = await executeQuery(
    `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
    [mysqlGroupId]
  );
  firestoreGroupId = mapping[0].firestore_id;
}
```

### 3.4. Firebase Deletion

```javascript
const admin = require('../config/firebaseAdmin');
const db = admin.firestore();

// Query member document(s)
const memberSnapshot = await db.collection('group_members')
  .where('groupId', '==', firestoreGroupId)
  .where('userId', '==', userId)
  .get();

if (!memberSnapshot.empty) {
  // Batch delete (handle multiple documents gracefully)
  const batch = db.batch();
  memberSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  
  console.log(`✅ Deleted ${memberSnapshot.size} document(s)`);
}
```

**Lưu ý:** Có thể có duplicate documents do previous bugs → Batch delete all

### 3.5. MySQL Deletion với Creator Check

```javascript
// Reuse removeMember method (với userId === removedBy)
const result = await Group.removeMember(mysqlGroupId, userId, userId);

// Inside removeMember:
// 1. userId === removedBy → Self-leave (skip admin check)
// 2. Check creator_id !== userId
// 3. DELETE FROM group_members
```

---

## 4. Frontend Implementation

### 4.1. AuthContext - Leave Group

**File:** `frontend/src/contexts/AuthContext.jsx`

```javascript
const leaveGroup = async (groupId) => {
  if (!user?.uid) {
    return { success: false, error: 'User not authenticated' };
  }
  
  try {
    // Get Firebase token
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'No authenticated user found' };
    }
    
    const token = await currentUser.getIdToken();
    
    // Call backend API to leave group
    const response = await fetch(
      `http://localhost:5000/api/groups/${groupId}/leave`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      // Refresh groups list
      await loadUserGroups();
      
      // Clear selected group if it was the one we left
      if (selectedGroup === groupId) {
        setSelectedGroup(null);
        setGroupMembers([]);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error leaving group:', error);
    return { success: false, error: error.message };
  }
};
```

**Đặc điểm:**
- ✅ Validate user authentication
- ✅ Get fresh Firebase token
- ✅ Call backend API
- ✅ Refresh groups list on success
- ✅ Clear selected group state
- ✅ Error handling robust

### 4.2. GroupSidebar Component

**File:** `frontend/src/components/Chat/GroupSidebar.jsx`

```jsx
const GroupSidebar = ({ isOpen, onClose, groupId }) => {
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const { leaveGroup, selectedGroup } = useAuth();

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      const result = await leaveGroup(selectedGroup);
      
      if (result.success) {
        onClose(); // Close sidebar immediately
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Error leaving group:', error);
      alert('Có lỗi xảy ra khi rời nhóm');
    } finally {
      setShowLeaveGroupModal(false);
    }
  };

  return (
    <div>
      {/* Settings tab - Leave button */}
      <button onClick={() => setShowLeaveGroupModal(true)}>
        <LogOut className="h-4 w-4" />
        Rời nhóm
      </button>
      
      {/* Leave Confirmation Modal */}
      {showLeaveGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <LogOut className="h-5 w-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold">Rời nhóm</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Bạn có chắc chắn muốn rời khỏi nhóm <strong>{currentGroup?.name}</strong> không?
              Bạn sẽ không thể truy cập nhóm này nữa trừ khi được mời lại.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLeaveGroupModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleLeaveGroup}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Rời nhóm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 4.3. GroupSettings Component

**File:** `frontend/src/components/Chat/GroupSidebar/GroupSettings.jsx`

```jsx
const GroupSettings = ({ group, isAdmin, onClose }) => {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { leaveGroup } = useAuth();

  const handleLeaveGroup = async () => {
    if (isLeaving) return; // Prevent double-click
    
    setIsLeaving(true);
    try {
      const result = await leaveGroup(group.id);
      
      if (result.success) {
        onClose(); // Close sidebar
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div className="p-4">
      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Vùng nguy hiểm
        </h4>

        {/* Leave Group */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-3">
          <div className="flex items-start gap-3">
            <LogOut className="h-5 w-5 text-yellow-600" />
            <div>
              <h5 className="text-sm font-medium text-yellow-800">
                Rời khỏi nhóm
              </h5>
              <p className="text-xs text-yellow-700 mt-1">
                Bạn sẽ không còn thấy tin nhắn và file trong nhóm này
              </p>
            </div>
          </div>
          
          {!showLeaveConfirm ? (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Rời nhóm
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-yellow-800">
                Bạn có chắc muốn rời khỏi nhóm "{group.name}"?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleLeaveGroup}
                  disabled={isLeaving}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md disabled:opacity-50"
                >
                  {isLeaving ? 'Đang rời...' : 'Xác nhận rời'}
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  disabled={isLeaving}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

**UI Features:**
- ✅ 2 confirmation steps (button → confirm)
- ✅ Loading state khi đang rời
- ✅ Disable buttons khi processing
- ✅ Clear warning message
- ✅ Color coding (yellow for caution)

---

## 5. Real-time Updates

### 5.1. Firestore Listener

**Các thành viên khác trong nhóm:**

```javascript
// Real-time listener for group members
useEffect(() => {
  if (!selectedGroup) return;
  
  const db = getFirestore();
  const membersQuery = query(
    collection(db, 'group_members'),
    where('groupId', '==', selectedGroup)
  );
  
  const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') {
        const memberData = change.doc.data();
        console.log(`👋 ${memberData.displayName} đã rời nhóm`);
        
        // Update local state
        setGroupMembers(prev => 
          prev.filter(m => m.userId !== memberData.userId)
        );
        
        // Optional: Show notification
        showNotification(`${memberData.displayName} đã rời khỏi nhóm`);
      }
    });
  });
  
  return () => unsubscribe();
}, [selectedGroup]);
```

**Người rời nhóm:**

```javascript
// Listener for user's own groups
useEffect(() => {
  if (!user?.uid) return;
  
  const db = getFirestore();
  const userGroupsQuery = query(
    collection(db, 'group_members'),
    where('userId', '==', user.uid)
  );
  
  const unsubscribe = onSnapshot(userGroupsQuery, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') {
        const groupId = change.doc.data().groupId;
        console.log(`🚪 Bạn đã rời khỏi nhóm ${groupId}`);
        
        // Remove từ local groups list
        setUserGroups(prev => prev.filter(g => g.id !== groupId));
        
        // Clear selected nếu đang xem group này
        if (selectedGroup === groupId) {
          setSelectedGroup(null);
        }
      }
    });
  });
  
  return () => unsubscribe();
}, [user?.uid]);
```

**Lợi ích:**
- ✅ Members khác thấy user rời ngay lập tức
- ✅ Member count tự động giảm
- ✅ User rời thấy group biến mất khỏi list ngay
- ✅ Không cần refresh page

---

## 6. UI/UX Design

### 6.1. Leave Button Location

**2 nơi có thể rời nhóm:**

1. **GroupSidebar → Settings Tab**
   - Location: Tab "Cài đặt" trong sidebar
   - Style: Nút "Rời nhóm" trong danger zone
   - Modal: Full-screen overlay với confirmation

2. **GroupSettings Component**
   - Location: Dedicated settings page
   - Style: Yellow warning box với 2-step confirmation
   - No modal: Inline confirmation

### 6.2. Warning Messages

**Confirmation Modal:**
```
Rời nhóm

Bạn có chắc chắn muốn rời khỏi nhóm "[Tên nhóm]" không?
Bạn sẽ không thể truy cập nhóm này nữa trừ khi được mời lại.

[Hủy]  [Rời nhóm]
```

**Inline Confirmation:**
```
⚠️ Rời khỏi nhóm
Bạn sẽ không còn thấy tin nhắn và file trong nhóm này

[Rời nhóm] → Click
↓
Bạn có chắc muốn rời khỏi nhóm "[Tên nhóm]"?
[Xác nhận rời]  [Hủy]
```

### 6.3. States và Feedback

**Loading State:**
```jsx
<button disabled={isLeaving}>
  {isLeaving ? 'Đang rời...' : 'Rời nhóm'}
</button>
```

**Success State:**
- Close sidebar immediately
- Redirect to groups list or home
- Group disappears from sidebar

**Error State:**
```jsx
if (!result.success) {
  alert(`Lỗi: ${result.error}`);
  // Keep modal open
  // Keep user in group
}
```

---

## 7. Edge Cases và Special Scenarios

### 7.1. Creator cố rời nhóm

**Scenario:** Creator click "Rời nhóm"

**Backend Validation:**
```javascript
const [creatorCheck] = await connection.execute(
  `SELECT creator_id FROM \`groups\` WHERE id = ?`,
  [groupId]
);

if (creatorCheck[0].creator_id === userId) {
  throw new Error('Group creator cannot be removed. Transfer ownership first.');
}
```

**Response:**
```json
{
  "success": false,
  "error": "Group creator cannot be removed. Transfer ownership first."
}
```

**UI Behavior:**
```jsx
// Option 1: Hide leave button for creator
{!isGroupCreator() && (
  <button onClick={handleLeave}>Rời nhóm</button>
)}

// Option 2: Show with disabled state
<button 
  disabled={isGroupCreator()}
  title={isGroupCreator() ? 'Creator không thể rời nhóm' : 'Rời nhóm'}
>
  Rời nhóm
</button>
```

### 7.2. Last admin rời nhóm

**Scenario:** Admin cuối cùng (không phải creator) rời nhóm

**Current Behavior:**
- ✅ Allowed - Admin có thể rời
- ⚠️ Group có thể không còn admin nào (chỉ còn members)

**Potential Issue:**
- Không ai có quyền quản lý group
- Chỉ creator có thể promote admin mới

**Future Enhancement:**
```javascript
// Check if last admin
const [adminCount] = await connection.execute(
  `SELECT COUNT(*) as count FROM group_members 
   WHERE group_id = ? AND role = 'admin'`,
  [groupId]
);

if (adminCount[0].count === 1 && userRole === 'admin') {
  // Warn or prevent
  throw new Error('Bạn là admin cuối cùng. Hãy chỉ định admin mới trước khi rời.');
}
```

### 7.3. Rời nhóm khi không phải member

**Scenario:** User cố rời nhóm mà không thuộc về

**Validation:**
```javascript
const [result] = await connection.execute(
  `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
  [groupId, userId]
);

if (result.affectedRows === 0) {
  throw new Error('User is not a member of this group');
}
```

**Response:**
```json
{
  "success": false,
  "error": "User is not a member of this group"
}
```

### 7.4. MySQL xóa thành công, Firestore sync fail

**Scenario:** MySQL deleted, Firestore sync failed

**Handling:**
```javascript
// Step 2: Delete from MySQL FIRST (source of truth)
const result = await Group.removeMember(mysqlGroupId, userId, userId);

if (!result.success) {
  return res.status(400).json(result);
}

// Step 3: Sync to Firestore (best-effort)
try {
  await syncToFirestore(groupId, userId);
} catch (firebaseError) {
  console.error('❌ Firestore sync failed after MySQL success');
  console.error('⚠️ DATA MISMATCH: Removed from MySQL but still in Firestore!');
  
  // Return success anyway (MySQL is source of truth)
  // Background sync will fix this later
}

return res.json({
  success: true,
  message: 'Left group successfully'
});
```

**Impact:**
- ✅ MySQL đã xóa (source of truth chính xác)
- ✅ Request trả về success
- ⚠️ Firestore vẫn còn record (real-time có thể sai tạm thời)
- 💡 Background sync job sẽ fix data mismatch

### 7.5. Double-click Leave Button

**Scenario:** User click "Rời nhóm" 2 lần nhanh

**Protection:**
```jsx
const [isLeaving, setIsLeaving] = useState(false);

const handleLeaveGroup = async () => {
  if (isLeaving) return; // Prevent double-click
  
  setIsLeaving(true);
  try {
    await leaveGroup(groupId);
  } finally {
    setIsLeaving(false);
  }
};

<button disabled={isLeaving}>
  {isLeaving ? 'Đang rời...' : 'Rời nhóm'}
</button>
```

### 7.6. Network Error khi rời

**Scenario:** Network bị disconnect giữa chừng

**Handling:**
```javascript
try {
  const response = await fetch(url, { method: 'POST' });
  // ...
} catch (error) {
  if (error.message.includes('fetch')) {
    return {
      success: false,
      error: 'Mất kết nối. Vui lòng kiểm tra internet và thử lại.'
    };
  }
  
  return {
    success: false,
    error: error.message
  };
}
```

---

## 8. Database Schema

### 8.1. Group Members Table

```sql
CREATE TABLE group_members (
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    `role` ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (group_id, user_id),
    
    -- CASCADE delete khi group bị xóa
    FOREIGN KEY (group_id) REFERENCES `groups`(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- CASCADE delete khi user bị xóa
    FOREIGN KEY (user_id) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
```

### 8.2. Groups Table

```sql
CREATE TABLE `groups` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Creator RESTRICT: Không thể xóa creator nếu còn group
    FOREIGN KEY (creator_id) REFERENCES users(id) 
        ON DELETE RESTRICT ON UPDATE CASCADE
);
```

**Constraint quan trọng:**
- Creator có `ON DELETE RESTRICT`
- Creator không thể rời nhóm
- Creator phải xóa group hoặc transfer ownership

---

## 9. Testing

### 9.1. Unit Tests

```javascript
describe('Leave Group', () => {
  it('should allow regular member to leave', async () => {
    await addMember(groupId, userId, 'member');
    const result = await leaveGroup(groupId, userId);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Left group successfully');
  });
  
  it('should allow admin to leave', async () => {
    await addMember(groupId, adminId, 'admin');
    const result = await leaveGroup(groupId, adminId);
    expect(result.success).toBe(true);
  });
  
  it('should prevent creator from leaving', async () => {
    const result = await leaveGroup(groupId, creatorId);
    expect(result.success).toBe(false);
    expect(result.error).toContain('creator cannot be removed');
  });
  
  it('should prevent non-member from leaving', async () => {
    const result = await leaveGroup(groupId, nonMemberId);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a member');
  });
  
  it('should delete from both Firebase and MySQL', async () => {
    await addMember(groupId, userId);
    await leaveGroup(groupId, userId);
    
    const mysqlMember = await getMemberFromMySQL(groupId, userId);
    expect(mysqlMember).toBeNull();
    
    const firebaseMember = await getMemberFromFirebase(groupId, userId);
    expect(firebaseMember).toBeNull();
  });
  
  it('should clear selected group on leave', async () => {
    const { result } = renderHook(() => useAuth());
    
    await result.current.selectGroup(groupId);
    expect(result.current.selectedGroup).toBe(groupId);
    
    await result.current.leaveGroup(groupId);
    expect(result.current.selectedGroup).toBeNull();
  });
});
```

### 9.2. Integration Tests

```javascript
describe('E2E Leave Group Flow', () => {
  it('should complete full leave workflow', async () => {
    // 1. Create group and add member
    const group = await createGroup('Test Group', creatorId);
    await addMember(group.id, userId, 'member');
    
    // 2. Verify member exists
    const members = await getGroupMembers(group.id);
    expect(members).toContainEqual(
      expect.objectContaining({ userId })
    );
    
    // 3. Leave group via API
    const leaveResult = await leaveGroupAPI(group.id, userToken);
    expect(leaveResult.success).toBe(true);
    
    // 4. Verify member removed from MySQL
    const updatedMembers = await getGroupMembers(group.id);
    expect(updatedMembers).not.toContainEqual(
      expect.objectContaining({ userId })
    );
    
    // 5. Verify member removed from Firestore
    const fsMember = await getFirestoreMember(group.id, userId);
    expect(fsMember).toBeNull();
    
    // 6. Verify user groups updated
    const userGroups = await getUserGroups(userId);
    expect(userGroups).not.toContainEqual(
      expect.objectContaining({ id: group.id })
    );
  });
});
```

---

## 10. Security Considerations

### 10.1. Authentication

```javascript
// Firebase JWT token required
router.post('/:groupId/leave', verifyFirebaseToken, async (req, res) => {
  const userId = req.user.id; // Verified by middleware
  // Cannot fake userId
});
```

### 10.2. Authorization

```javascript
// Only the user themselves can leave (not others)
// userId comes from JWT token, cannot be manipulated
const userId = req.user.id; // From verified token
await Group.removeMember(groupId, userId, userId); // userId === removedBy
```

### 10.3. SQL Injection Prevention

```javascript
// ✅ ĐÚNG: Parameterized queries
await connection.execute(
  `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
  [groupId, userId]
);

// ❌ SAI: String concatenation
await connection.execute(
  `DELETE FROM group_members WHERE group_id = ${groupId}` // VULNERABLE!
);
```

---

## 11. Performance Optimization

### 11.1. Database Indexes

```sql
-- Optimize "Get all groups of a user"
CREATE INDEX idx_group_members_user_id ON group_members(user_id);

-- Optimize "Get all members of a group"
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
```

### 11.2. Minimize API Calls

```javascript
// After leave, refresh groups once
const result = await leaveGroup(groupId);

if (result.success) {
  await loadUserGroups(); // Single API call
  
  // Don't make individual calls:
  // ❌ await getGroup(groupId);
  // ❌ await getMembers(groupId);
}
```

### 11.3. Real-time Listener Optimization

```javascript
// Only listen when sidebar is open
useEffect(() => {
  if (!isOpen || !selectedGroup) return;
  
  const unsubscribe = onSnapshot(query, handleSnapshot);
  
  return () => unsubscribe(); // Cleanup
}, [isOpen, selectedGroup]);
```

---

## 12. Future Enhancements

### 12.1. Transfer Ownership Before Leave

```javascript
// Cho phép creator transfer ownership trước khi leave
const transferAndLeave = async (groupId, newOwnerId) => {
  // Step 1: Transfer ownership
  await transferOwnership(groupId, newOwnerId);
  
  // Step 2: Leave group
  await leaveGroup(groupId);
};
```

### 12.2. Leave History

```sql
CREATE TABLE group_leave_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    left_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason ENUM('self_leave', 'kicked', 'banned') DEFAULT 'self_leave',
    
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);
```

### 12.3. Rejoin Cooldown

```javascript
// Prevent spam rejoin after leave
const canRejoin = async (groupId, userId) => {
  const lastLeave = await getLastLeaveTime(groupId, userId);
  const cooldownHours = 24;
  
  if (Date.now() - lastLeave < cooldownHours * 3600 * 1000) {
    return {
      allowed: false,
      error: `Bạn cần đợi ${cooldownHours} giờ sau khi rời mới có thể tham gia lại`
    };
  }
  
  return { allowed: true };
};
```

### 12.4. Exit Survey

```jsx
const LeaveModal = () => {
  const [reason, setReason] = useState('');
  
  const handleLeave = async () => {
    await leaveGroup(groupId, { reason });
    // Track why users leave for analytics
  };
  
  return (
    <div>
      <p>Tại sao bạn rời nhóm?</p>
      <select value={reason} onChange={e => setReason(e.target.value)}>
        <option value="not_active">Nhóm không hoạt động</option>
        <option value="not_relevant">Nội dung không phù hợp</option>
        <option value="too_many_messages">Quá nhiều tin nhắn</option>
        <option value="other">Lý do khác</option>
      </select>
    </div>
  );
};
```

---

## 13. Monitoring và Logging

### 13.1. Backend Logging

```javascript
console.log(`🚪 Leave group request: groupId=${groupId}, userId=${userId}`);
console.log(`✅ Mapped Firestore ${firestoreGroupId} → MySQL ${mysqlGroupId}`);
console.log(`🗄️ Removing user from MySQL group ${mysqlGroupId}...`);
console.log(`✅ Removed from MySQL successfully`);
console.log(`✅ Synced to Firestore: ${memberSnapshot.size} document(s)`);
console.error(`❌ MySQL removal failed: ${error.message}`);
console.error(`⚠️ Firestore sync failed (non-critical): ${error.message}`);
console.error(`⚠️ DATA MISMATCH: Member removed from MySQL but still in Firestore!`);
```

### 13.2. Activity Logging

```javascript
// Log to activity_logs table
await connection.execute(
  `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
   VALUES (?, 'leave_group', ?, JSON_OBJECT('group_name', ?), NOW())`,
  [userId, groupId.toString(), groupName]
);
```

### 13.3. Metrics to Track

- Leave rate per group
- Average membership duration
- Leave reasons (if survey implemented)
- Time of day when most leaves happen
- Creator leave attempts (should be 0)

---

## 14. Tóm tắt Implementation

### 14.1. Luồng hoàn chỉnh

```
User click "Rời nhóm" button
         ↓
Confirmation modal with warning
         ↓
User clicks "Xác nhận"
         ↓
Frontend: leaveGroup(groupId)
         ↓
Get Firebase token
         ↓
POST /api/groups/:groupId/leave
         ↓
Backend: Convert Firestore ID ↔ MySQL ID
         ↓
Delete from Firebase Firestore (MUST succeed)
   └─ If fail → Return 500 error (STOP)
         ↓
Delete from MySQL (best-effort)
   ├─ Check user is not creator
   ├─ DELETE FROM group_members
   └─ If fail → Log warning (continue)
         ↓
Return success response
         ↓
Frontend: Refresh groups list
         ↓
Clear selected group
         ↓
Close sidebar
         ↓
Real-time: Other members see user left ✅
```

### 14.2. Key Files

**Backend:**
- `backend/src/routes/groupsNew.js` - Route `POST /:groupId/leave`
- `backend/src/models/Group.js` - `removeMember()` method
- `backend/migrations/docsshare_db.sql` - Database schema

**Frontend:**
- `frontend/src/contexts/AuthContext.jsx` - `leaveGroup()` function
- `frontend/src/components/Chat/GroupSidebar.jsx` - Leave modal UI
- `frontend/src/components/Chat/GroupSidebar/GroupSettings.jsx` - Settings UI

### 14.3. Đặc điểm nổi bật

✅ **MySQL-First:** Xóa MySQL trước (source of truth), sync Firestore sau  
✅ **Creator Protection:** Creator không thể rời nhóm  
✅ **Self-Service:** Bất kỳ member nào cũng có thể tự rời  
✅ **Confirmation Required:** 2-step confirmation để tránh nhầm lẫn  
✅ **Real-time Updates:** Firestore listener auto-update UI  
✅ **Auto Cleanup:** Clear selected group và refresh list  
✅ **Error Handling:** Graceful degradation khi MySQL fail  

---

## 15. Checklist cho Developer

### Phase 1: Hiểu Code ✅
- [x] Đọc `groupsNew.js` leave route
- [x] Hiểu `Group.removeMember()` với self-leave
- [x] Hiểu MySQL-first strategy (data integrity)
- [x] Hiểu creator protection
- [x] Hiểu UI/UX flow

### Phase 2: Testing
- [ ] Test leave as regular member
- [ ] Test leave as admin
- [ ] Test creator leave (should fail)
- [ ] Test non-member leave (should fail)
- [ ] Test Firebase sync
- [ ] Test MySQL fallback
- [ ] Test double-click prevention
- [ ] Test real-time updates
- [ ] Test selected group cleanup

### Phase 3: Production Considerations
- [ ] Monitor leave rate
- [ ] Track Firebase sync failures
- [ ] Implement transfer ownership
- [ ] Add leave history
- [ ] Consider rejoin cooldown
- [ ] Add exit survey for analytics
- [ ] Monitor data mismatches

---

**Kết luận:** Chức năng rời nhóm được implement với MySQL-first approach để đảm bảo data integrity, creator protection để tránh orphan groups, và comprehensive error handling. System đảm bảo MySQL là source of truth với Firestore sync cho real-time updates, auto-cleanup selected group và real-time updates cho tất cả members.
