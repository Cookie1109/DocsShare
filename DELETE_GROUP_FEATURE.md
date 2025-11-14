# Chức năng Xóa Nhóm - DocsShare

## Mục lục
1. [Tổng quan](#1-tổng-quan)
2. [API Endpoint](#2-api-endpoint)
3. [Luồng xử lý Backend](#3-luồng-xử-lý-backend)
4. [Frontend Implementation](#4-frontend-implementation)
5. [Đồng bộ dữ liệu MySQL - Firebase](#5-đồng-bộ-dữ-liệu-mysql---firebase)
6. [Xử lý Database](#6-xử-lý-database)
7. [Quyền hạn và Bảo mật](#7-quyền-hạn-và-bảo-mật)
8. [UI/UX Components](#8-uiux-components)
9. [Error Handling](#9-error-handling)
10. [Testing Scenarios](#10-testing-scenarios)
11. [So sánh với chức năng Leave Group](#11-so-sánh-với-chức-năng-leave-group)
12. [Tóm tắt Implementation](#12-tóm-tắt-implementation)

---

## 1. Tổng quan

### 1.1. Mô tả chức năng

Chức năng **Xóa nhóm** cho phép **Trưởng nhóm (Creator)** hoặc **Admin** xóa hoàn toàn một nhóm cùng với:
- ✅ Tất cả thành viên
- ✅ Tất cả files đã upload
- ✅ Tất cả tags
- ✅ Tất cả tin nhắn
- ✅ Tất cả lời mời đang chờ (pending invitations)
- ✅ Dữ liệu trong cả MySQL và Firebase

### 1.2. Đặc điểm chính

| Đặc điểm | Giá trị |
|----------|---------|
| **Quyền thực hiện** | Chỉ Creator hoặc Admin |
| **Tính không thể hoàn tác** | ✅ Hành động không thể undo |
| **Xóa dữ liệu** | Cascade delete toàn bộ |
| **Đồng bộ** | Xóa song song MySQL + Firebase |
| **Confirmation** | Yêu cầu nhập tên nhóm để xác nhận |
| **UI Location** | Settings tab trong GroupSidebar |

### 1.3. Business Logic

```
┌─────────────────────────────────────────────────┐
│  Xóa nhóm = Xóa HOÀN TOÀN tất cả dữ liệu       │
│                                                 │
│  • Tất cả thành viên bị xóa khỏi nhóm          │
│  • Tất cả files metadata + Firestore data      │
│  • Tất cả tags của nhóm                        │
│  • Tất cả tin nhắn trong nhóm                  │
│  • Tất cả lời mời pending                      │
│  • Group mapping (MySQL ↔ Firestore)          │
│  • Group document trong Firestore              │
└─────────────────────────────────────────────────┘
```

---

## 2. API Endpoint

### 2.1. Delete Group API

```
DELETE /api/groups/:groupId
```

**File:** `backend/src/routes/groupsNew.js`

**Headers:**
```json
{
  "Authorization": "Bearer <firebase_id_token>"
}
```

**Params:**
- `groupId` (string | number): Firestore group ID (string) hoặc MySQL group ID (number)

**Response Success (200):**
```json
{
  "success": true,
  "message": "Group deleted successfully",
  "firebaseSyncSuccess": true
}
```

**Response Error (403):**
```json
{
  "success": false,
  "error": "Only group creator or admin can delete the group"
}
```

**Response Error (404):**
```json
{
  "success": false,
  "error": "Group not found"
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

**File:** `backend/src/routes/groupsNew.js` (lines 157-250+)

```javascript
// Xóa nhóm
router.delete('/:groupId', async (req, res) => {
  try {
    let { groupId } = req.params;
    const deletedBy = req.user.id; // Firebase UID từ token
    
    // STEP 1: Determine group ID type và convert
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      // groupId is Firestore ID (string) → Convert to MySQL ID
      console.log(`🔄 Converting Firestore ID ${groupId} to MySQL ID...`);
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
      // groupId is MySQL ID → Get Firestore ID
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // STEP 2: Delete from MySQL (includes permissions check)
    const result = await Group.delete(mysqlGroupId, deletedBy);
    
    if (result.success) {
      // STEP 3: Delete from Firebase Firestore
      try {
        const admin = require('../config/firebaseAdmin');
        const db = admin.firestore();
        const batch = db.batch();
        
        console.log(`🗑️ Deleting Firebase data for group ${firestoreGroupId}...`);
        
        // 3.1. Delete all group files (subcollection)
        const filesSnapshot = await db.collection('groups')
          .doc(firestoreGroupId)
          .collection('files')
          .get();
        
        filesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`✅ Queued ${filesSnapshot.size} files for deletion`);
        
        // 3.2. Delete all group tags (subcollection)
        const tagsSnapshot = await db.collection('groups')
          .doc(firestoreGroupId)
          .collection('tags')
          .get();
        
        tagsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`✅ Queued ${tagsSnapshot.size} tags for deletion`);
        
        // 3.3. Delete all group messages (subcollection)
        const messagesSnapshot = await db.collection('groups')
          .doc(firestoreGroupId)
          .collection('messages')
          .get();
        
        messagesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`✅ Queued ${messagesSnapshot.size} messages for deletion`);
        
        // 3.4. Delete all group members
        const membersSnapshot = await db.collection('group_members')
          .where('groupId', '==', firestoreGroupId)
          .get();
        
        membersSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`✅ Queued ${membersSnapshot.size} members for deletion`);
        
        // 3.5. Delete all pending members
        const pendingSnapshot = await db.collection('pending_members')
          .where('groupId', '==', firestoreGroupId)
          .get();
        
        pendingSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`✅ Queued ${pendingSnapshot.size} pending members for deletion`);
        
        // 3.6. Delete group document itself
        const groupRef = db.collection('groups').doc(firestoreGroupId);
        batch.delete(groupRef);
        
        // 3.7. Commit batch delete
        await batch.commit();
        console.log(`✅ Firebase batch delete committed successfully`);
        
        res.json({
          success: true,
          message: 'Group deleted successfully from both MySQL and Firebase'
        });
      } catch (firebaseError) {
        console.error('❌ Firebase delete failed:', firebaseError);
        res.json({
          success: true,
          message: 'Group deleted from MySQL but Firebase sync failed',
          firebaseSyncSuccess: false,
          warning: 'Manual cleanup may be required in Firebase'
        });
      }
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

---

## 3. Luồng xử lý Backend

### 3.1. Sequence Diagram

```
Client (Frontend)                Route Handler                Group Model              MySQL DB              Firebase
      │                                │                           │                      │                      │
      ├─ DELETE /api/groups/:groupId ─>│                           │                      │                      │
      │                                │                           │                      │                      │
      │                                ├─ 1. Verify Firebase token │                      │                      │
      │                                │   (middleware)            │                      │                      │
      │                                │                           │                      │                      │
      │                                ├─ 2. Determine ID type     │                      │                      │
      │                                │   (Firestore vs MySQL)    │                      │                      │
      │                                │                           │                      │                      │
      │                                ├─ 3. Query group_mapping ──┼─────────────────────>│                      │
      │                                │                           │<─────────────────────┤                      │
      │                                │                           │  (mysql_id/firestore_id)                    │
      │                                │                           │                      │                      │
      │                                ├─ 4. Call Group.delete() ─>│                      │                      │
      │                                │                           │                      │                      │
      │                                │                           ├─ 5. Check permissions ─>│                    │
      │                                │                           │  (creator or admin?) │                      │
      │                                │                           │<─────────────────────┤                      │
      │                                │                           │                      │                      │
      │                                │                           ├─ 6. Delete files ────>│                      │
      │                                │                           │<─────────────────────┤                      │
      │                                │                           │                      │                      │
      │                                │                           ├─ 7. Delete tags ─────>│                      │
      │                                │                           │<─────────────────────┤                      │
      │                                │                           │                      │                      │
      │                                │                           ├─ 8. Delete members ──>│                      │
      │                                │                           │<─────────────────────┤                      │
      │                                │                           │                      │                      │
      │                                │                           ├─ 9. Delete invites ──>│                      │
      │                                │                           │<─────────────────────┤                      │
      │                                │                           │                      │                      │
      │                                │                           ├─ 10. Delete group ───>│                      │
      │                                │                           │<─────────────────────┤                      │
      │                                │                           │                      │                      │
      │                                │                           ├─ 11. syncGroupDelete()┼────────────────────>│
      │                                │                           │                      │  (delete Firestore data)
      │                                │                           │                      │<─────────────────────┤
      │                                │                           │                      │                      │
      │                                │                           ├─ 12. Return success ─>│                      │
      │                                │<─ Result ─────────────────┤                      │                      │
      │                                │                           │                      │                      │
      │                                ├─ 13. Manual Firebase delete (Route level)        │                      │
      │                                │   (files, tags, messages, members, pending) ─────┼─────────────────────>│
      │                                │                           │                      │<─────────────────────┤
      │                                │                           │                      │                      │
      │<─ 200 OK (success) ────────────┤                           │                      │                      │
```

### 3.2. Luồng hoàn chỉnh

```
User clicks "Xóa nhóm" button
         ↓
Confirmation modal → User nhập tên nhóm để xác nhận
         ↓
Frontend: DELETE /api/groups/:groupId
         ↓
Backend Step 1: Verify Firebase Token
   ├─ Extract user.id (deletedBy)
   └─ If invalid → Return 401 Unauthorized
         ↓
Backend Step 2: Determine group ID type
   ├─ Firestore ID (string) → Query group_mapping for mysql_id
   └─ MySQL ID (number) → Query group_mapping for firestore_id
         ↓
Backend Step 3: Call Group.delete(mysqlGroupId, deletedBy)
         ↓
Backend Step 4: Check permissions (in Group Model)
   ├─ Query: SELECT creator_id FROM groups WHERE id = ?
   ├─ If deletedBy === creator_id → isCreator = true ✅
   ├─ Else → Query: SELECT role FROM group_members WHERE group_id = ? AND user_id = ?
   ├─ If role === 'admin' → isAdmin = true ✅
   └─ If !isCreator && !isAdmin → Throw error "Only group creator or admin can delete the group"
         ↓
Backend Step 5: Delete files in MySQL
   └─ DELETE FROM files WHERE group_id = ?
         ↓
Backend Step 6: Delete tags in MySQL
   └─ DELETE FROM tags WHERE group_id = ?
         ↓
Backend Step 7: Delete group members
   └─ DELETE FROM group_members WHERE group_id = ?
         ↓
Backend Step 8: Delete group invitations
   └─ DELETE FROM group_invitations WHERE group_id = ?
         ↓
Backend Step 9: Delete group in MySQL
   └─ DELETE FROM groups WHERE id = ?
         ↓
Backend Step 10: Sync delete to Firebase (syncGroupDelete)
   ├─ Query Firestore group_id from group_mapping
   ├─ Delete group_members (where groupId == firestoreGroupId)
   ├─ Delete files (where groupId == firestoreGroupId)
   ├─ Delete tags (where groupId == firestoreGroupId)
   ├─ Delete messages (subcollection: groups/{groupId}/messages)
   ├─ Delete group document
   └─ Delete group_mapping entry
         ↓
Backend Step 11: Manual Firebase cleanup in Route (additional)
   ├─ Delete groups/{groupId}/files (subcollection)
   ├─ Delete groups/{groupId}/tags (subcollection)
   ├─ Delete groups/{groupId}/messages (subcollection)
   ├─ Delete group_members (where groupId == firestoreGroupId)
   ├─ Delete pending_members (where groupId == firestoreGroupId)
   └─ Delete group document
         ↓
Backend Step 12: Return success to Frontend
   └─ { success: true, message: "Group deleted successfully" }
         ↓
Frontend Step 13: Handle response
   ├─ If success → Clear selectedGroup state
   ├─ Call loadUserGroups() to refresh list
   └─ Close sidebar and modals
```

---

## 4. Frontend Implementation

### 4.1. AuthContext - deleteGroup function

**File:** `frontend/src/contexts/AuthContext.jsx` (lines 665-705)

```javascript
const deleteGroup = async (groupId) => {
  if (!user?.uid) return { success: false, error: 'User not authenticated' };
  
  try {
    // Get token from Firebase Auth
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'No authenticated user found' };
    }
    
    const token = await currentUser.getIdToken();
    
    // Call backend API to delete group (will delete from both MySQL and Firebase)
    const response = await fetch(`http://localhost:5000/api/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Delete group failed:', errorData);
      return { success: false, error: errorData.error || 'Failed to delete group' };
    }

    const result = await response.json();
    
    if (result.success) {
      // Clear selected group first (before refreshing list)
      if (selectedGroup === groupId) {
        setSelectedGroup(null);
        setGroupMembers([]);
      }
      
      // Then refresh groups list
      await loadUserGroups();
    }
    
    return result;
  } catch (error) {
    console.error('Error deleting group:', error);
    return { success: false, error: error.message };
  }
};
```

### 4.2. GroupSettings Component

**File:** `frontend/src/components/Chat/GroupSidebar/GroupSettings.jsx` (lines 77-98)

```javascript
const handleDeleteGroup = async () => {
  if (deleteInput === group.name && !isDeleting) {
    setIsDeleting(true);
    try {
      const result = await deleteGroup(group.id);
      if (result.success) {
        onClose(); // Close sidebar
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  }
};
```

### 4.3. GroupSidebar Component (Alternative UI)

**File:** `frontend/src/components/Chat/GroupSidebar.jsx` (lines 398-428)

```javascript
// Group management functions
const handleDeleteGroup = async () => {
  if (!selectedGroup) return;
  
  try {
    const result = await deleteGroup(selectedGroup);
    if (result.success) {
      // Close modals first
      setShowDeleteGroupModal(false);
      // Close sidebar after state is updated
      setTimeout(() => {
        onClose();
      }, 100);
    } else {
      setShowDeleteGroupModal(false);
      alert(`Lỗi: ${result.error}`);
    }
  } catch (error) {
    console.error('Error deleting group:', error);
    setShowDeleteGroupModal(false);
    alert('Có lỗi xảy ra khi xóa nhóm');
  }
};
```

---

## 5. Đồng bộ dữ liệu MySQL - Firebase

### 5.1. SyncHelper.syncGroupDelete()

**File:** `backend/src/config/syncHelper.js` (lines 265-350)

```javascript
/**
 * Sync complete group deletion (xóa nhóm + tất cả related data trong Firebase)
 */
static async syncGroupDelete(groupId) {
  try {
    const { executeQuery } = require('./db');
    
    // Step 1: Get Firestore ID from mapping
    const [mapping] = await executeQuery(
      `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
      [groupId]
    );

    if (mapping.length === 0) {
      console.warn(`⚠️ No Firestore mapping for group ${groupId}`);
      return { success: false, error: 'No Firestore mapping' };
    }

    const firestoreGroupId = mapping[0].firestore_id;
    const admin = require('./firebaseAdmin');
    const db = admin.firestore();
    const batch = db.batch();

    console.log(`🗑️ Deleting group ${firestoreGroupId} and all related data from Firebase...`);

    // Step 2: Delete all group members
    const membersSnapshot = await db
      .collection('group_members')
      .where('groupId', '==', firestoreGroupId)
      .get();
    
    membersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    console.log(`✅ Deleted ${membersSnapshot.size} group members`);

    // Step 3: Delete all files in group
    const filesSnapshot = await db
      .collection('files')
      .where('groupId', '==', firestoreGroupId)
      .get();
    
    filesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    console.log(`✅ Deleted ${filesSnapshot.size} files`);

    // Step 4: Delete all tags in group
    const tagsSnapshot = await db
      .collection('tags')
      .where('groupId', '==', firestoreGroupId)
      .get();
    
    tagsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    console.log(`✅ Deleted ${tagsSnapshot.size} tags`);

    // Step 5: Delete all messages in group (subcollection)
    const groupRef = db.collection('groups').doc(firestoreGroupId);
    const messagesSnapshot = await groupRef.collection('messages').get();
    
    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    console.log(`✅ Deleted ${messagesSnapshot.size} messages`);

    // Step 6: Delete group document itself
    batch.delete(groupRef);

    // Step 7: Commit all deletes
    await batch.commit();
    console.log(`✅ Firebase batch delete committed`);

    // Step 8: Delete group mapping
    await executeQuery(
      `DELETE FROM group_mapping WHERE mysql_id = ?`,
      [groupId]
    );
    console.log(`✅ Deleted group mapping for group ${groupId}`);

    return { success: true };
  } catch (error) {
    console.error(`❌ Group delete sync failed:`, error);
    return { success: false, error: error.message };
  }
}
```

### 5.2. Đồng bộ hai chiều

```
┌─────────────────────────────────────────────────────────┐
│           MySQL (Source of Truth)                       │
│                                                         │
│  Step 1: Delete from MySQL                             │
│    ├─ files (metadata)                                 │
│    ├─ tags                                             │
│    ├─ group_members                                    │
│    ├─ group_invitations                                │
│    └─ groups                                           │
│                                                         │
│  Step 2: Call syncGroupDelete()                        │
│           ↓                                             │
└─────────────┼───────────────────────────────────────────┘
              │
              ↓
┌─────────────┴───────────────────────────────────────────┐
│           Firebase (Sync Target)                        │
│                                                         │
│  Step 3: Batch delete in Firestore                     │
│    ├─ group_members (where groupId == X)               │
│    ├─ files (where groupId == X)                       │
│    ├─ tags (where groupId == X)                        │
│    ├─ groups/{groupId}/messages (subcollection)        │
│    ├─ groups/{groupId}/files (subcollection)           │
│    ├─ groups/{groupId}/tags (subcollection)            │
│    ├─ pending_members (where groupId == X)             │
│    └─ groups/{groupId} (document)                      │
│                                                         │
│  Step 4: Delete group_mapping (MySQL)                  │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Xử lý Database

### 6.1. Group Model - delete() method

**File:** `backend/src/models/Group.js` (lines 320-400)

```javascript
/**
 * Xóa nhóm (xóa cả MySQL và Firebase, bao gồm files, tags, members)
 * @param {number} groupId - ID nhóm
 * @param {string} deletedBy - Firebase UID của người xóa
 * @returns {Promise<Object>} Kết quả xóa nhóm
 */
static async delete(groupId, deletedBy) {
  try {
    return await executeTransaction(async (connection) => {
      // Step 1: Kiểm tra nhóm có tồn tại và lấy thông tin creator
      const [groupInfo] = await connection.execute(
        `SELECT creator_id FROM \`groups\` WHERE id = ?`,
        [groupId]
      );
      
      if (groupInfo.length === 0) {
        throw new Error('Group not found');
      }
      
      const isCreator = groupInfo[0].creator_id === deletedBy;
      
      // Step 2: Kiểm tra role của user trong nhóm (nếu không phải creator)
      let isAdmin = false;
      if (!isCreator) {
        const [memberInfo] = await connection.execute(
          `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
          [groupId, deletedBy]
        );
        isAdmin = memberInfo.length > 0 && memberInfo[0].role === 'admin';
      }
      
      // Step 3: Authorization check
      if (!isCreator && !isAdmin) {
        throw new Error('Only group creator or admin can delete the group');
      }
      
      console.log(`🗑️ Deleting group ${groupId} from MySQL...`);
      
      // Step 4: Xóa files trong MySQL (CASCADE không xóa file từ storage)
      const [deletedFiles] = await connection.execute(
        `DELETE FROM files WHERE group_id = ?`,
        [groupId]
      );
      console.log(`✅ Deleted ${deletedFiles.affectedRows} files from MySQL`);
      
      // Step 5: Xóa tags trong MySQL
      const [deletedTags] = await connection.execute(
        `DELETE FROM tags WHERE group_id = ?`,
        [groupId]
      );
      console.log(`✅ Deleted ${deletedTags.affectedRows} tags from MySQL`);
      
      // Step 6: Xóa group members
      const [deletedMembers] = await connection.execute(
        `DELETE FROM group_members WHERE group_id = ?`,
        [groupId]
      );
      console.log(`✅ Deleted ${deletedMembers.affectedRows} members from MySQL`);
      
      // Step 7: Xóa group invitations
      const [deletedInvitations] = await connection.execute(
        `DELETE FROM group_invitations WHERE group_id = ?`,
        [groupId]
      );
      console.log(`✅ Deleted ${deletedInvitations.affectedRows} invitations from MySQL`);
      
      // Step 8: Xóa nhóm
      const [deletedGroup] = await connection.execute(
        `DELETE FROM \`groups\` WHERE id = ?`,
        [groupId]
      );
      console.log(`✅ Deleted group ${groupId} from MySQL`);
      
      // Step 9: Sync xóa sang Firebase (xóa group, members, files, tags)
      const syncResult = await syncGroupDelete(groupId);
      
      if (!syncResult.success) {
        console.warn(`⚠️ Firebase sync failed but MySQL delete succeeded`);
        console.warn(`❌ DATA MISMATCH: Group ${groupId} deleted in MySQL but may still exist in Firebase`);
      }
      
      return {
        success: true,
        message: 'Group deleted successfully',
        firebaseSyncSuccess: syncResult.success
      };
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    return { success: false, error: error.message };
  }
}
```

### 6.2. Database Schema - CASCADE Delete

**File:** `backend/migrations/docsshare_db.sql`

```sql
-- Bảng group_members với CASCADE delete
CREATE TABLE group_members (
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    `role` ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    
    -- Nếu một nhóm bị xóa, tất cả các bản ghi thành viên của nhóm đó sẽ tự động bị xóa theo
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bảng files với CASCADE delete
CREATE TABLE files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    cloudinary_public_id VARCHAR(512),
    mime_type VARCHAR(100),
    size_bytes BIGINT NOT NULL,
    group_id INT NOT NULL,
    uploader_id VARCHAR(128) NOT NULL,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Nếu một nhóm bị xóa, tất cả file trong đó cũng sẽ bị xóa theo
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Bảng tags với CASCADE delete
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    group_id INT NOT NULL,
    creator_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_tag_in_group` (`name`, `group_id`),
    
    -- Nếu một nhóm bị xóa, tất cả tag của nhóm đó cũng sẽ bị xóa theo
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Bảng group_invitations với CASCADE delete
CREATE TABLE IF NOT EXISTS group_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  inviter_id VARCHAR(255) NOT NULL,
  invitee_id VARCHAR(255) NOT NULL,
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);
```

---

## 7. Quyền hạn và Bảo mật

### 7.1. Quyền xóa nhóm

| Vai trò | Được phép xóa nhóm? | Lý do |
|---------|---------------------|-------|
| **Creator (Người tạo)** | ✅ Có | Chủ sở hữu nhóm |
| **Admin** | ✅ Có | Quản trị viên nhóm |
| **Member** | ❌ Không | Thành viên thường |
| **Non-member** | ❌ Không | Không phải thành viên |

### 7.2. Luồng kiểm tra quyền

```javascript
// Step 1: Kiểm tra user có phải creator không
const [groupInfo] = await connection.execute(
  `SELECT creator_id FROM \`groups\` WHERE id = ?`,
  [groupId]
);

const isCreator = groupInfo[0].creator_id === deletedBy;

// Step 2: Nếu không phải creator, kiểm tra có phải admin không
if (!isCreator) {
  const [memberInfo] = await connection.execute(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, deletedBy]
  );
  isAdmin = memberInfo.length > 0 && memberInfo[0].role === 'admin';
}

// Step 3: Reject nếu không phải creator và không phải admin
if (!isCreator && !isAdmin) {
  throw new Error('Only group creator or admin can delete the group');
}
```

### 7.3. Security Measures

| Measure | Implementation |
|---------|----------------|
| **Authentication** | Firebase Token verification (middleware) |
| **Authorization** | Creator or Admin check in Group Model |
| **Confirmation** | User must type group name exactly |
| **Audit Log** | Delete actions logged in audit_log table |
| **Transaction** | All deletes in MySQL transaction |
| **Idempotency** | Prevent duplicate delete requests |

---

## 8. UI/UX Components

### 8.1. GroupSettings - Delete Section

**File:** `frontend/src/components/Chat/GroupSidebar/GroupSettings.jsx` (lines 248-300)

```jsx
{/* Delete Group (Trưởng nhóm Only) */}
{isAdmin && (
  <div className="space-y-3">
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h5 className="text-sm font-medium text-red-800">
            Xóa nhóm vĩnh viễn
          </h5>
          <p className="text-xs text-red-700 mt-1">
            Tất cả tin nhắn, file và thành viên sẽ bị xóa. Hành động này không thể hoàn tác.
          </p>
        </div>
      </div>

      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
        >
          Xóa nhóm
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-sm text-red-800 mb-2">
              Nhập tên nhóm "<strong>{group.name}</strong>" để xác nhận:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={group.name}
              className="w-full px-3 py-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleDeleteGroup}
              disabled={deleteInput !== group.name || isDeleting}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </button>
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteInput('');
              }}
              disabled={isDeleting}
              className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

### 8.2. GroupSidebar - Delete Modal (Alternative)

**File:** `frontend/src/components/Chat/GroupSidebar.jsx` (lines 770-810)

```jsx
{/* Delete Group Modal */}
{showDeleteGroupModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Xóa nhóm</h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          Bạn có chắc chắn muốn xóa nhóm <strong>{currentGroup?.name}</strong> không?
          Tất cả thành viên sẽ bị xóa khỏi nhóm và không thể khôi phục.
        </p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowDeleteGroupModal(false)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleDeleteGroup}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Xóa nhóm
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 8.3. UI States

| State | Description | Visual Indicator |
|-------|-------------|------------------|
| **Initial** | Button "Xóa nhóm" hiển thị | Red background, Trash icon |
| **Confirming** | Input field để nhập tên nhóm | Text input with validation |
| **Deleting** | Đang xử lý request | "Đang xóa...", disabled button |
| **Success** | Xóa thành công | Close sidebar, refresh groups list |
| **Error** | Có lỗi xảy ra | Alert with error message |

---

## 9. Error Handling

### 9.1. Backend Errors

| Error Code | Error Message | Cause | Solution |
|------------|---------------|-------|----------|
| **403** | Only group creator or admin can delete the group | User không phải creator/admin | Kiểm tra quyền trước khi hiển thị UI |
| **404** | Group not found | Group không tồn tại hoặc đã bị xóa | Refresh groups list |
| **500** | Internal server error | Lỗi database hoặc Firebase | Retry hoặc báo admin |

### 9.2. Frontend Error Handling

```javascript
const handleDeleteGroup = async () => {
  if (deleteInput !== group.name) {
    // Validation: Tên nhóm không khớp
    return;
  }
  
  setIsDeleting(true);
  try {
    const result = await deleteGroup(group.id);
    
    if (result.success) {
      // Success: Close sidebar and refresh
      onClose();
    } else {
      // Backend error
      alert(`Lỗi: ${result.error}`);
    }
  } catch (error) {
    // Network or unexpected error
    console.error('Error deleting group:', error);
    alert(`Lỗi: ${error.message}`);
  } finally {
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    setDeleteInput('');
  }
};
```

### 9.3. Rollback Strategy

```
Nếu MySQL delete thành công nhưng Firebase sync fail:
  ├─ MySQL: Group đã bị xóa ✅
  ├─ Firebase: Group vẫn tồn tại ❌
  ├─ Warning: "Group deleted from MySQL but Firebase sync failed"
  └─ Action: Manual cleanup required in Firebase

Nếu MySQL delete fail:
  ├─ MySQL: Transaction rollback ✅
  ├─ Firebase: Không thay đổi ✅
  └─ Error: Return error to frontend
```

---

## 10. Testing Scenarios

### 10.1. Happy Path

```
✅ Test Case 1: Creator xóa nhóm thành công
   ├─ User: Creator của nhóm
   ├─ Action: Click "Xóa nhóm" → Nhập tên nhóm → Confirm
   ├─ Expected: 
   │   ├─ MySQL: Group, members, files, tags deleted
   │   ├─ Firebase: All related data deleted
   │   ├─ Frontend: Sidebar closed, groups list refreshed
   └─ Result: ✅ Pass

✅ Test Case 2: Admin xóa nhóm thành công
   ├─ User: Admin (không phải creator)
   ├─ Action: Click "Xóa nhóm" → Nhập tên nhóm → Confirm
   ├─ Expected: Same as Test Case 1
   └─ Result: ✅ Pass
```

### 10.2. Negative Cases

```
❌ Test Case 3: Member cố gắng xóa nhóm
   ├─ User: Member (không phải admin/creator)
   ├─ Action: Không có button "Xóa nhóm" trong UI
   ├─ Expected: 
   │   ├─ UI: Button không hiển thị (isAdmin = false)
   │   ├─ Backend: Nếu bypass UI → 403 Forbidden
   └─ Result: ✅ Pass

❌ Test Case 4: Nhập sai tên nhóm
   ├─ User: Creator/Admin
   ├─ Action: Nhập tên nhóm sai → Click "Xóa vĩnh viễn"
   ├─ Expected: Button disabled, không gọi API
   └─ Result: ✅ Pass

❌ Test Case 5: Group không tồn tại
   ├─ User: Có quyền
   ├─ Action: Xóa group đã bị xóa hoặc không tồn tại
   ├─ Expected: 404 Not Found
   └─ Result: ✅ Pass
```

### 10.3. Edge Cases

```
⚠️ Test Case 6: Firebase sync fail
   ├─ Setup: Disable Firebase connection
   ├─ Action: Xóa nhóm
   ├─ Expected:
   │   ├─ MySQL: Group deleted
   │   ├─ Firebase: Sync failed
   │   ├─ Response: success=true, firebaseSyncSuccess=false
   │   ├─ Warning logged
   └─ Result: ⚠️ Partial success (manual cleanup needed)

⚠️ Test Case 7: Network error giữa chừng
   ├─ Setup: Disconnect network sau khi MySQL delete
   ├─ Action: Xóa nhóm
   ├─ Expected:
   │   ├─ MySQL: Transaction rollback hoặc committed
   │   ├─ Frontend: Error message
   └─ Result: ⚠️ Depends on when network fails
```

### 10.4. Load Testing

```
🔥 Test Case 8: Nhóm có nhiều members, files, tags
   ├─ Setup: Group với 100 members, 500 files, 50 tags
   ├─ Action: Xóa nhóm
   ├─ Expected:
   │   ├─ All data deleted successfully
   │   ├─ Performance: < 5 seconds
   │   ├─ No database deadlock
   └─ Result: Measure performance
```

---

## 11. So sánh với chức năng Leave Group

| Aspect | Delete Group | Leave Group |
|--------|-------------|-------------|
| **Quyền thực hiện** | Creator hoặc Admin | Bất kỳ thành viên nào (trừ creator) |
| **Tác động** | Xóa toàn bộ nhóm | Chỉ xóa bản thân khỏi nhóm |
| **Dữ liệu bị ảnh hưởng** | Group + all members + files + tags | Chỉ 1 record trong group_members |
| **Confirmation** | Phải nhập tên nhóm | Chỉ cần confirm Yes/No |
| **Không thể hoàn tác** | ✅ Hoàn toàn không thể | ⚠️ Có thể được mời lại |
| **API Endpoint** | `DELETE /api/groups/:groupId` | `POST /api/groups/:groupId/leave` |
| **Model Method** | `Group.delete()` | `Group.removeMember()` |
| **Firebase Sync** | `syncGroupDelete()` | Xóa document trong `group_members` |
| **UI Location** | Settings tab (Admin only) | Settings tab (All members) |
| **Visual Indicator** | Red danger zone | Yellow warning zone |

### 11.1. Code Comparison

**Delete Group:**
```javascript
// Backend
const result = await Group.delete(mysqlGroupId, deletedBy);

// Frontend
const result = await deleteGroup(groupId);
```

**Leave Group:**
```javascript
// Backend
const result = await Group.removeMember(mysqlGroupId, userId, userId);

// Frontend
const result = await leaveGroup(groupId);
```

---

## 12. Tóm tắt Implementation

### 12.1. Key Features

✅ **Cascade Delete**: Tự động xóa tất cả dữ liệu liên quan
✅ **Dual Database Sync**: Đồng bộ xóa giữa MySQL và Firebase
✅ **Permission Check**: Chỉ Creator/Admin mới có quyền
✅ **Confirmation Required**: Phải nhập chính xác tên nhóm
✅ **Transaction Safety**: Sử dụng MySQL transaction
✅ **Error Handling**: Xử lý lỗi gracefully
✅ **Audit Logging**: Ghi log mọi hành động xóa

### 12.2. Key Files

**Backend:**
- `backend/src/routes/groupsNew.js` - Route `DELETE /:groupId`
- `backend/src/models/Group.js` - `delete()` method
- `backend/src/config/syncHelper.js` - `syncGroupDelete()` method
- `backend/migrations/docsshare_db.sql` - Database schema with CASCADE

**Frontend:**
- `frontend/src/contexts/AuthContext.jsx` - `deleteGroup()` function
- `frontend/src/components/Chat/GroupSidebar.jsx` - Delete modal UI
- `frontend/src/components/Chat/GroupSidebar/GroupSettings.jsx` - Settings UI

### 12.3. Data Flow Summary

```
User Action (Frontend)
   ↓
DELETE /api/groups/:groupId
   ↓
Firebase Token Verification (Middleware)
   ↓
Group.delete(mysqlGroupId, deletedBy)
   ├─ Check permissions (creator or admin?)
   ├─ Delete files (MySQL)
   ├─ Delete tags (MySQL)
   ├─ Delete members (MySQL)
   ├─ Delete invitations (MySQL)
   ├─ Delete group (MySQL)
   └─ syncGroupDelete(groupId) → Firebase cleanup
   ↓
Response { success: true }
   ↓
Frontend: Refresh groups list + Close sidebar
```

### 12.4. Best Practices Applied

1. **Transaction Management**: Sử dụng `executeTransaction()` để đảm bảo consistency
2. **Idempotency**: Kiểm tra group existence trước khi xóa
3. **Logging**: Console log chi tiết mọi bước xóa
4. **Error Recovery**: Warn nếu Firebase sync fail nhưng MySQL succeed
5. **User Confirmation**: Yêu cầu nhập tên nhóm để tránh xóa nhầm
6. **UI/UX**: Visual indicators rõ ràng (red danger zone)
7. **Authorization**: Kiểm tra quyền ở cả frontend và backend

---

## Kết luận

Chức năng **Xóa nhóm** trong DocsShare được thiết kế với mục tiêu:
- **Bảo mật**: Chỉ Creator/Admin mới có quyền xóa
- **An toàn**: Yêu cầu confirmation để tránh xóa nhầm
- **Đồng bộ**: Đảm bảo consistency giữa MySQL và Firebase
- **Hoàn chỉnh**: Cascade delete tất cả dữ liệu liên quan
- **Auditable**: Ghi log mọi hành động để truy vết

Đây là một chức năng **critical** và **không thể hoàn tác**, vì vậy cần được implement cẩn thận với nhiều lớp validation và confirmation.
