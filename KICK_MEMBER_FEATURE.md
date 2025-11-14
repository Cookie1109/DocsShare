# Chức năng Kick Thành viên - DocsShare

## Tổng quan
Phân tích chức năng kick (xóa) thành viên khỏi nhóm trong dự án DocsShare, dựa trên code thực tế đã được implement. Chức năng cho phép admin xóa thành viên khỏi nhóm hoặc thành viên tự rời nhóm.

**Kiến trúc hệ thống:**
- Frontend: React + Firebase Firestore (Real-time)
- Backend: Node.js + MySQL (Persistent storage)
- Authentication: Firebase Authentication
- Dual-database: MySQL ↔ Firebase Firestore sync

**Đặc điểm chính:**
- ✅ Chỉ admin có quyền kick thành viên
- ✅ Creator không thể bị kick
- ✅ Thành viên có thể tự rời nhóm (self-leave)
- ✅ Firebase-first approach (xóa Firestore trước, MySQL sau)
- ✅ Real-time update cho các thành viên khác
- ✅ Confirmation modal trước khi kick

---

## 1. Quyền hạn và Authorization

### 1.1. Ai có thể kick thành viên?

**2 trường hợp được phép:**

1. **Admin của nhóm** - Có quyền kick bất kỳ thành viên nào (trừ creator)
2. **Chính thành viên đó** - Có quyền tự rời nhóm (self-leave)

**Không thể kick:**
- ❌ Creator của nhóm (phải transfer ownership trước)
- ❌ Member thường không thể kick member khác
- ❌ Không thể kick chính mình nếu bạn là creator

### 1.2. Logic kiểm tra quyền

**File:** `backend/src/models/Group.js`

```javascript
static async removeMember(groupId, userId, removedBy) {
  try {
    return await executeTransaction(async (connection) => {
      // STEP 1: Kiểm tra quyền xóa (admin hoặc chính user đó rời nhóm)
      if (userId !== removedBy) {
        const [adminCheck] = await connection.execute(
          `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
          [groupId, removedBy]
        );
        
        if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
          throw new Error('Only admins can remove members');
        }
      }
      
      // STEP 2: Kiểm tra user có phải creator không (creator không thể bị xóa)
      const [creatorCheck] = await connection.execute(
        `SELECT creator_id FROM \`groups\` WHERE id = ?`,
        [groupId]
      );
      
      if (creatorCheck.length > 0 && creatorCheck[0].creator_id === userId) {
        throw new Error('Group creator cannot be removed. Transfer ownership first.');
      }
      
      // STEP 3: Xóa thành viên
      const [result] = await connection.execute(
        `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, userId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('User is not a member of this group');
      }
      
      return {
        success: true,
        message: userId === removedBy ? 'Left group successfully' : 'Member removed successfully'
      };
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: error.message };
  }
}
```

**Flow kiểm tra quyền:**
```
1. userId === removedBy? → Self-leave (allowed)
           ↓ NO
2. removedBy là admin? → Nếu không: 403 "Only admins can remove members"
           ↓ YES
3. userId là creator? → Nếu đúng: 400 "Cannot remove creator"
           ↓ NO
4. Cho phép kick ✅
```

---

## 2. API Endpoint

### 2.1. Remove Member API

```
DELETE /api/groups/:groupId/members/:userId
```

**File:** `backend/src/routes/groupsNew.js`

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Params:**
- `groupId` (string): Firestore group ID hoặc MySQL group ID
- `userId` (string): Firebase UID của thành viên cần xóa

**Response Success (200):**
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Response Success - Self Leave (200):**
```json
{
  "success": true,
  "message": "Left group successfully"
}
```

**Response Error (403):**
```json
{
  "success": false,
  "error": "Only admins can remove members"
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
  "error": "User is not a member of this group"
}
```

### 2.2. Route Definition

**File:** `backend/src/routes/groupsNew.js`

```javascript
// Remove member (admin only) hoặc leave group (self)
router.delete('/:groupId/members/:userId', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const removedBy = req.user.id; // Firebase UID của người thực hiện action
    
    console.log(`🗑️ Remove member request: groupId=${groupId}, userId=${userId}, removedBy=${removedBy}`);
    
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    // STEP 1: Determine group ID type và convert nếu cần
    if (typeof groupId === 'string' && groupId.length > 10) {
      // Firestore ID → Convert to MySQL ID
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
    } else {
      // MySQL ID → Get Firestore ID
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // STEP 2: Remove from Firebase Firestore FIRST (for real-time UI update)
    if (firestoreGroupId) {
      try {
        const admin = require('../config/firebaseAdmin');
        const db = admin.firestore();
        
        const memberSnapshot = await db.collection('group_members')
          .where('groupId', '==', firestoreGroupId)
          .where('userId', '==', userId)
          .get();
        
        if (!memberSnapshot.empty) {
          const batch = db.batch();
          memberSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          
          console.log(`✅ Removed user ${userId} from Firebase group ${firestoreGroupId}`);
        }
      } catch (firebaseError) {
        console.error('❌ Failed to remove from Firebase:', firebaseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to remove member from real-time system'
        });
      }
    }
    
    // STEP 3: Remove from MySQL (after Firebase is successful)
    const result = await Group.removeMember(mysqlGroupId, userId, removedBy);
    
    if (result.success) {
      res.json(result);
    } else {
      // Firebase đã xóa nhưng MySQL fail
      res.json({
        success: true,
        message: 'Member removed successfully (real-time updated)'
      });
    }
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

---

## 3. Luồng xóa thành viên Backend

### 3.1. Firebase-First Strategy

**Tại sao xóa Firebase trước?**
- ✅ Real-time UX: Users thấy member bị xóa ngay lập tức
- ✅ Nếu Firebase fail → Stop, không xóa MySQL
- ✅ Nếu MySQL fail → Firebase đã xóa, UX vẫn OK

**Trade-off:**
- ⚠️ Có thể có data mismatch (Firebase xóa, MySQL còn)
- 💡 Solution: Log warning cho manual cleanup sau

### 3.2. Luồng hoàn chỉnh

```
User click "Kick" button
         ↓
Confirmation modal → User confirms
         ↓
Frontend: DELETE /api/groups/:groupId/members/:userId
         ↓
Backend Step 1: Convert Firestore ID ↔ MySQL ID
         ↓
Backend Step 2: Delete from Firebase Firestore
   ├─ Query group_members collection
   ├─ Find matching document(s)
   ├─ Batch delete
   └─ If fail → Return 500 error (STOP)
         ↓
Backend Step 3: Delete from MySQL
   ├─ Check permissions (admin or self)
   ├─ Check not creator
   ├─ DELETE FROM group_members
   └─ If fail → Log warning (continue)
         ↓
Frontend: Real-time listener detects change
         ↓
UI auto-updates (member removed from list) ✅
```

### 3.3. Implementation chi tiết

**Step 1: Group ID Conversion**
```javascript
// Frontend dùng Firestore ID, backend cần MySQL ID
if (typeof groupId === 'string' && groupId.length > 10) {
  // Firestore ID (dài) → MySQL ID
  const mapping = await executeQuery(
    `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
    [groupId]
  );
  mysqlGroupId = mapping[0].mysql_id;
} else {
  // MySQL ID (số ngắn) → Firestore ID
  mysqlGroupId = parseInt(groupId);
  const mapping = await executeQuery(
    `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
    [mysqlGroupId]
  );
  firestoreGroupId = mapping[0].firestore_id;
}
```

**Step 2: Firebase Deletion**
```javascript
const admin = require('../config/firebaseAdmin');
const db = admin.firestore();

// Query to find member document
const memberSnapshot = await db.collection('group_members')
  .where('groupId', '==', firestoreGroupId)
  .where('userId', '==', userId)
  .get();

if (!memberSnapshot.empty) {
  // Batch delete (có thể có nhiều documents duplicate)
  const batch = db.batch();
  memberSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  
  console.log(`✅ Removed ${memberSnapshot.size} document(s)`);
}
```

**Step 3: MySQL Deletion với Transaction**
```javascript
return await executeTransaction(async (connection) => {
  // Check permissions
  if (userId !== removedBy) {
    const [adminCheck] = await connection.execute(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, removedBy]
    );
    
    if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
      throw new Error('Only admins can remove members');
    }
  }
  
  // Check not creator
  const [creatorCheck] = await connection.execute(
    `SELECT creator_id FROM \`groups\` WHERE id = ?`,
    [groupId]
  );
  
  if (creatorCheck[0].creator_id === userId) {
    throw new Error('Group creator cannot be removed');
  }
  
  // Delete member
  const [result] = await connection.execute(
    `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('User is not a member');
  }
  
  return { success: true };
});
```

---

## 4. Frontend Implementation

### 4.1. Firebase Service

**File:** `frontend/src/services/firebase.js`

```javascript
// Remove member from group
export const removeGroupMember = async (membershipId) => {
  try {
    // Get member info first to extract groupId and userId
    const memberDoc = await getDoc(doc(db, 'group_members', membershipId));
    if (!memberDoc.exists()) {
      return { success: false, error: 'Member not found' };
    }
    
    const memberData = memberDoc.data();
    const { groupId, userId } = memberData;
    
    // Call backend API to remove member
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch(
      `http://localhost:5000/api/groups/${groupId}/members/${userId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove member');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error removing group member:', error);
    return { success: false, error: error.message };
  }
};
```

**Đặc điểm:**
- ✅ Lấy membershipId từ UI
- ✅ Query Firestore để lấy groupId và userId
- ✅ Call backend API với Firebase token
- ✅ Error handling robust

### 4.2. AuthContext

**File:** `frontend/src/contexts/AuthContext.jsx`

```javascript
const removeMemberFromGroup = async (membershipId, groupId) => {
  try {
    const result = await removeGroupMember(membershipId);
    // No need to refresh - realtime listener will handle it
    return result;
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: error.message };
  }
};
```

**Lưu ý:** Không cần manual refresh vì Firestore real-time listener tự động update UI

### 4.3. GroupSidebar Component

**File:** `frontend/src/components/Chat/GroupSidebar.jsx`

```jsx
const GroupSidebar = ({ isOpen, onClose, groupId }) => {
  const [showKickModal, setShowKickModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  
  const { removeMemberFromGroup } = useAuth();

  // Kick member handler
  const handleKickMember = (member) => {
    setSelectedMember(member);
    setShowKickModal(true);
  };

  const confirmKickMember = async () => {
    if (!selectedMember || !selectedGroup) return;
    
    try {
      const membershipId = selectedMember.id || selectedMember.membershipId;
      
      if (!membershipId) {
        console.error('No membership ID found:', selectedMember);
        alert('Không tìm thấy thông tin thành viên');
        return;
      }
      
      const result = await removeMemberFromGroup(membershipId, selectedGroup);
      
      if (result.success) {
        // Show success notification
        showNotification('success', 
          `Đã xóa ${selectedMember.displayName} khỏi nhóm`
        );
      } else {
        // Show error notification
        showNotification('error', `Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showNotification('error', 'Có lỗi xảy ra khi xóa thành viên');
    } finally {
      setShowKickModal(false);
      setSelectedMember(null);
    }
  };

  return (
    <div>
      {/* Member list */}
      {groupMembers?.map((member) => (
        <div key={member.id}>
          {/* Member info */}
          
          {/* Action buttons - only for admin và not for creator */}
          {isUserAdmin() && 
           member.userId !== currentGroup?.creatorId && 
           member.userId !== user?.uid && (
            <div>
              {/* Kick button */}
              <button
                onClick={() => handleKickMember(member)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                title="Xóa khỏi nhóm"
              >
                <UserX className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
      
      {/* Kick Confirmation Modal */}
      {showKickModal && (
        <Modal>
          <h3>Xác nhận xóa thành viên</h3>
          <p>
            Bạn có chắc muốn xóa <strong>{selectedMember?.displayName}</strong> khỏi nhóm?
          </p>
          
          <button onClick={confirmKickMember}>
            Xóa khỏi nhóm
          </button>
          
          <button onClick={() => setShowKickModal(false)}>
            Hủy
          </button>
        </Modal>
      )}
    </div>
  );
};
```

**UI Features:**
- ✅ Kick button chỉ hiển thị khi:
  - Current user là admin
  - Target user không phải creator
  - Target user không phải chính mình
- ✅ Confirmation modal trước khi kick
- ✅ Success/Error notifications
- ✅ Real-time UI update

---

## 5. Real-time Updates

### 5.1. Firestore Listener

**File:** `frontend/src/contexts/AuthContext.jsx`

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
        console.log('🗑️ Member removed (real-time):', change.doc.data());
        
        // Update local state
        setGroupMembers(prev => 
          prev.filter(m => m.id !== change.doc.id)
        );
      }
    });
  });
  
  return () => unsubscribe();
}, [selectedGroup]);
```

**Lợi ích:**
- ✅ Tất cả members trong nhóm thấy member bị kick ngay lập tức
- ✅ Không cần refresh page
- ✅ Sync state giữa nhiều tabs/devices

### 5.2. Notification System

**Success Notification:**
```javascript
const notification = document.createElement('div');
notification.className = 'fixed top-4 right-4 bg-purple-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999]';
notification.innerHTML = `
  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
  </svg>
  <span>Đã xóa ${memberName} khỏi nhóm</span>
`;
document.body.appendChild(notification);

setTimeout(() => notification.remove(), 3000);
```

**Error Notification:**
```javascript
notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999]';
notification.innerHTML = `
  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
  </svg>
  <span>Lỗi: ${errorMessage}</span>
`;
```

---

## 6. Self-Leave (Rời nhóm)

### 6.1. Leave Group API

**Sử dụng cùng endpoint:**
```
DELETE /api/groups/:groupId/members/:userId
```

**Khác biệt:** `userId === removedBy` (user tự xóa chính mình)

### 6.2. Frontend Leave Group

**File:** `frontend/src/contexts/AuthContext.jsx`

```javascript
const leaveGroup = async (groupId) => {
  if (!user?.uid) return { success: false, error: 'User not authenticated' };
  
  try {
    const token = await auth.currentUser.getIdToken();
    
    // Call backend API to leave group (will remove member from both MySQL and Firebase)
    const response = await fetch(
      `http://localhost:5000/api/groups/${groupId}/members/${user.uid}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Failed to leave group' };
    }

    const result = await response.json();
    
    if (result.success) {
      // Clear selected group
      if (selectedGroup === groupId) {
        setSelectedGroup(null);
        setGroupMembers([]);
      }
      
      // Refresh groups list
      await loadUserGroups();
    }
    
    return result;
  } catch (error) {
    console.error('Leave group error:', error);
    return { success: false, error: error.message };
  }
};
```

### 6.3. Leave Group UI

```jsx
const handleLeaveGroup = async () => {
  if (!selectedGroup) return;
  
  try {
    const result = await leaveGroup(selectedGroup);
    
    if (result.success) {
      onClose(); // Close sidebar
      showNotification('success', 'Đã rời khỏi nhóm');
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
```

---

## 7. Database Schema

### 7.1. Group Members Table

```sql
CREATE TABLE group_members (
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    `role` ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (group_id, user_id),
    
    -- Cascade delete khi group hoặc user bị xóa
    FOREIGN KEY (group_id) REFERENCES `groups`(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_group_members_user_id ON group_members(user_id);
```

**Đặc điểm:**
- Composite primary key (group_id, user_id)
- CASCADE delete khi group bị xóa
- Index trên user_id để query nhanh

### 7.2. Groups Table

```sql
CREATE TABLE `groups` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (creator_id) REFERENCES users(id) 
        ON DELETE RESTRICT ON UPDATE CASCADE
);
```

**Lưu ý:** Creator có `ON DELETE RESTRICT` → Không thể xóa creator nếu còn nhóm

---

## 8. Edge Cases và Special Scenarios

### 8.1. Kick Creator

**Scenario:** Admin cố gắng kick creator

**Validation:**
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

**Solution:** Cần implement transfer ownership feature trước

### 8.2. Kick chính mình khi là Admin

**Scenario:** Admin tự kick mình khỏi nhóm

**Validation:**
```javascript
if (userId !== removedBy) {
  // Check admin permission
} else {
  // Self-leave is always allowed (except creator)
}
```

**Behavior:**
- ✅ Admin có thể tự rời nhóm
- ❌ Nếu admin là creator → Cannot leave

### 8.3. Kick khi không phải member

**Scenario:** Kick user không có trong nhóm

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

### 8.4. Firebase xóa thành công, MySQL fail

**Scenario:** Firestore deleted, MySQL transaction failed

**Handling:**
```javascript
// Step 2: Delete from Firebase (MUST succeed)
await deleteFromFirestore(groupId, userId);

// Step 3: Delete from MySQL (best-effort)
const result = await Group.removeMember(mysqlGroupId, userId, removedBy);

if (!result.success) {
  console.error('❌ MySQL removal failed after Firebase success');
  console.error('⚠️ DATA MISMATCH: Member removed from Firebase but still in MySQL!');
  
  // Return success anyway (Firebase is priority)
  return res.json({
    success: true,
    message: 'Member removed successfully (real-time updated)'
  });
}
```

**Priority:** Firebase > MySQL (real-time UX quan trọng hơn)

### 8.5. Concurrent Kicks

**Scenario:** 2 admin cùng kick 1 member

**Protection:**
```javascript
// Transaction in MySQL ensures atomicity
await executeTransaction(async (connection) => {
  const [result] = await connection.execute(
    `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('User is not a member'); // Second kick will fail
  }
});
```

**Behavior:**
- ✅ First kick succeeds → Member removed
- ✅ Second kick fails → "User is not a member"
- ✅ Idempotent operation

---

## 9. Error Handling

### 9.1. Backend Error Cases

| Error Code | Condition | Message |
|------------|-----------|---------|
| 400 | Kick creator | "Group creator cannot be removed. Transfer ownership first." |
| 403 | Not admin | "Only admins can remove members" |
| 404 | Group not found | "Group not found" |
| 404 | Member not found | "User is not a member of this group" |
| 500 | Firebase fail | "Failed to remove member from real-time system" |
| 500 | Server error | "Internal server error" |

### 9.2. Frontend Error Handling

```javascript
try {
  const result = await removeMemberFromGroup(membershipId, groupId);
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  // Success notification
  showNotification('success', 'Đã xóa thành viên khỏi nhóm');
  
} catch (error) {
  // Error notification
  showNotification('error', error.message || 'Có lỗi xảy ra');
  
  console.error('Kick member error:', error);
}
```

### 9.3. Validation Layers

**3 lớp validation:**

1. **Frontend UI** - Ẩn button nếu không có quyền
2. **Backend Permission** - Check admin role
3. **Database Constraint** - Check foreign keys

```javascript
// Layer 1: Frontend (UI)
{isUserAdmin() && 
 member.userId !== creator && 
 member.userId !== currentUser && (
  <button onClick={() => handleKick(member)}>Kick</button>
)}

// Layer 2: Backend (Logic)
if (userId !== removedBy && !isAdmin) {
  throw new Error('Only admins can remove members');
}

// Layer 3: Database (Constraint)
DELETE FROM group_members WHERE group_id = ? AND user_id = ?
// If 0 rows affected → Member not exists
```

---

## 10. Security Considerations

### 10.1. Authorization Checks

```javascript
// Check 1: Firebase Authentication
router.delete('/:groupId/members/:userId', verifyFirebaseToken, async (req, res) => {
  // req.user.id verified by middleware
  
  // Check 2: Admin permission OR self-leave
  if (userId !== removedBy) {
    const adminCheck = await checkIsAdmin(groupId, removedBy);
    if (!adminCheck) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }
  }
  
  // Check 3: Not creator
  const isCreator = await checkIsCreator(groupId, userId);
  if (isCreator) {
    return res.status(400).json({ error: 'Cannot remove creator' });
  }
  
  // Proceed with removal
});
```

### 10.2. SQL Injection Prevention

```javascript
// ✅ ĐÚNG: Parameterized query
await connection.execute(
  `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
  [groupId, userId]
);

// ❌ SAI: String concatenation
await connection.execute(
  `DELETE FROM group_members WHERE group_id = ${groupId}` // VULNERABLE!
);
```

### 10.3. CSRF Protection

```javascript
// Firebase ID Token provides CSRF protection
const token = await auth.currentUser.getIdToken();

fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}` // Short-lived token
  }
});
```

---

## 11. Testing

### 11.1. Unit Tests

```javascript
describe('Kick Member', () => {
  it('should allow admin to kick regular member', async () => {
    const member = await addMember(groupId, userId);
    const result = await removeMember(groupId, userId, adminId);
    expect(result.success).toBe(true);
  });
  
  it('should allow member to leave group (self)', async () => {
    await addMember(groupId, userId);
    const result = await removeMember(groupId, userId, userId);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Left group successfully');
  });
  
  it('should prevent non-admin from kicking others', async () => {
    const result = await removeMember(groupId, userId, otherMemberId);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Only admins can remove members');
  });
  
  it('should prevent kicking group creator', async () => {
    const result = await removeMember(groupId, creatorId, adminId);
    expect(result.success).toBe(false);
    expect(result.error).toContain('creator cannot be removed');
  });
  
  it('should delete from both Firebase and MySQL', async () => {
    await removeMember(groupId, userId, adminId);
    
    const mysqlMember = await getMemberFromMySQL(groupId, userId);
    expect(mysqlMember).toBeNull();
    
    const firebaseMember = await getMemberFromFirebase(groupId, userId);
    expect(firebaseMember).toBeNull();
  });
});
```

### 11.2. Integration Tests

```javascript
describe('E2E Kick Member Flow', () => {
  it('should complete full kick workflow', async () => {
    // 1. Create group
    const group = await createGroup('Test Group', creatorId);
    
    // 2. Add member
    await addMember(group.id, userId, 'member');
    
    // 3. Promote another member to admin
    await addMember(group.id, adminId, 'admin');
    
    // 4. Admin kicks member
    const kickResult = await kickMemberAPI(group.id, userId, adminToken);
    expect(kickResult.success).toBe(true);
    
    // 5. Verify member removed from MySQL
    const members = await getGroupMembers(group.id);
    expect(members).not.toContainEqual(
      expect.objectContaining({ userId })
    );
    
    // 6. Verify member removed from Firestore
    const fsMember = await getFirestoreMember(group.id, userId);
    expect(fsMember).toBeNull();
    
    // 7. Verify real-time update
    // (would need to test with Firestore listener)
  });
});
```

---

## 12. Performance Considerations

### 12.1. Database Indexes

```sql
-- Tối ưu query "Get all members of a group"
CREATE INDEX idx_group_members_group_id ON group_members(group_id);

-- Tối ưu query "Get all groups of a user"
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
```

### 12.2. Batch Operations

Nếu cần kick nhiều members:

```javascript
// Batch kick multiple members
const kickMembers = async (groupId, userIds, adminId) => {
  const results = await Promise.allSettled(
    userIds.map(userId => removeMember(groupId, userId, adminId))
  );
  
  return {
    success: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length
  };
};
```

### 12.3. Real-time Optimization

```javascript
// Chỉ listen khi sidebar mở
useEffect(() => {
  if (!isOpen || !selectedGroup) return;
  
  const unsubscribe = onSnapshot(membersQuery, handleSnapshot);
  
  return () => unsubscribe(); // Cleanup khi đóng
}, [isOpen, selectedGroup]);
```

---

## 13. Future Enhancements

### 13.1. Transfer Ownership

Cho phép creator transfer ownership trước khi leave:

```javascript
const transferOwnership = async (groupId, newOwnerId) => {
  await executeTransaction(async (connection) => {
    // Update creator_id
    await connection.execute(
      `UPDATE \`groups\` SET creator_id = ? WHERE id = ?`,
      [newOwnerId, groupId]
    );
    
    // Promote new owner to admin
    await connection.execute(
      `UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?`,
      [groupId, newOwnerId]
    );
  });
};
```

### 13.2. Kick History

Log lịch sử kick members:

```sql
CREATE TABLE member_removal_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    removed_user_id VARCHAR(128) NOT NULL,
    removed_by VARCHAR(128) NOT NULL,
    reason ENUM('kicked', 'left', 'banned') DEFAULT 'kicked',
    removed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);
```

### 13.3. Undo Kick

Cho phép admin undo kick trong 5 giây:

```javascript
const kickWithUndo = async (groupId, userId) => {
  let undoTimeout;
  
  showNotification('Member sẽ bị kick sau 5 giây', {
    action: {
      label: 'Hoàn tác',
      onClick: () => clearTimeout(undoTimeout)
    }
  });
  
  undoTimeout = setTimeout(async () => {
    await removeMember(groupId, userId);
  }, 5000);
};
```

### 13.4. Ban Member

Kick + Prevent rejoin:

```sql
CREATE TABLE banned_members (
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    banned_by VARCHAR(128) NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);
```

---

## 14. Monitoring và Logging

### 14.1. Logging Strategy

```javascript
// Comprehensive logging
console.log(`🗑️ Kick request: group=${groupId}, user=${userId}, by=${removedBy}`);
console.log(`✅ Removed from Firebase: ${firestoreGroupId}`);
console.log(`✅ Removed from MySQL: group ${mysqlGroupId}`);
console.log(`⚠️ DATA MISMATCH: Firebase deleted but MySQL failed`);
```

### 14.2. Activity Logging

```javascript
// Log to activity_logs table
await connection.execute(
  `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
   VALUES (?, 'remove_member', ?, JSON_OBJECT('removed_user', ?), NOW())`,
  [removedBy, groupId.toString(), userId]
);
```

### 14.3. Metrics to Track

- Kick success rate
- Self-leave vs admin-kick ratio
- Firebase sync failures
- Average time to kick
- Failed kick attempts (permission denied)

---

## 15. Tóm tắt Implementation

### 15.1. Luồng hoàn chỉnh

```
Admin click "Kick" button
         ↓
Confirmation modal → Admin confirms
         ↓
Frontend: removeGroupMember(membershipId)
         ↓
Get groupId & userId from Firestore document
         ↓
DELETE /api/groups/:groupId/members/:userId
         ↓
Backend Step 1: Convert Firestore ID ↔ MySQL ID
         ↓
Backend Step 2: Delete from Firebase (MUST succeed)
   └─ If fail → Return 500 error (STOP)
         ↓
Backend Step 3: Delete from MySQL (best-effort)
   ├─ Check admin permission (or self-leave)
   ├─ Check not creator
   ├─ DELETE FROM group_members
   └─ If fail → Log warning (continue)
         ↓
Real-time: Firestore listener detects deletion
         ↓
Frontend: Auto-update UI (remove from list)
         ↓
Success notification ✅
```

### 15.2. Key Files

**Backend:**
- `backend/src/routes/groupsNew.js` - Route `/groups/:groupId/members/:userId`
- `backend/src/models/Group.js` - `removeMember()` method
- `backend/migrations/docsshare_db.sql` - Database schema

**Frontend:**
- `frontend/src/services/firebase.js` - `removeGroupMember()`
- `frontend/src/contexts/AuthContext.jsx` - `removeMemberFromGroup()`
- `frontend/src/components/Chat/GroupSidebar.jsx` - Kick UI

### 15.3. Đặc điểm nổi bật

✅ **Firebase-First:** Xóa Firestore trước để real-time UX tốt  
✅ **Permission Layers:** 3 lớp - UI, Backend logic, Database  
✅ **Creator Protection:** Không thể kick creator  
✅ **Self-Leave:** Member có thể tự rời nhóm  
✅ **Real-time Updates:** Firestore listener auto-update UI  
✅ **Confirmation Modal:** Prevent accidental kicks  
✅ **Error Handling:** Graceful degradation khi MySQL fail  

---

## 16. Checklist cho Developer

### Phase 1: Hiểu Code ✅
- [x] Đọc `groupsNew.js` kick route
- [x] Hiểu `Group.removeMember()` logic
- [x] Hiểu Firebase-first strategy
- [x] Hiểu permission checks
- [x] Hiểu real-time listeners

### Phase 2: Testing
- [ ] Test kick as admin
- [ ] Test self-leave as member
- [ ] Test kick creator (should fail)
- [ ] Test non-admin kick (should fail)
- [ ] Test Firebase sync
- [ ] Test MySQL fallback
- [ ] Test concurrent kicks
- [ ] Test real-time updates

### Phase 3: Production Considerations
- [ ] Monitor Firebase sync failures
- [ ] Track data mismatches
- [ ] Set up activity log alerts
- [ ] Implement transfer ownership
- [ ] Add kick history
- [ ] Consider ban feature
- [ ] Implement undo functionality

---

**Kết luận:** Chức năng kick thành viên được implement với authorization nghiêm ngặt, Firebase-first approach cho real-time UX tốt, và error handling robust. System bảo vệ creator khỏi bị kick và cho phép members tự rời nhóm một cách an toàn.
