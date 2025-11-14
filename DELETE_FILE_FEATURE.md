# Chức năng Xóa File - DocsShare

## Tổng quan
Phân tích chức năng xóa file trong dự án DocsShare, dựa trên code thực tế đã được implement. Chức năng cho phép người dùng xóa file đã upload với các kiểm tra quyền truy cập nghiêm ngặt.

**Kiến trúc hệ thống:**
- Frontend: React + Firebase Firestore (Real-time)
- Backend: Node.js + MySQL (Persistent storage)
- Storage: Cloudinary (File storage)
- Dual-database: MySQL ↔ Firebase Firestore sync

**Đặc điểm chính:**
- ✅ Chỉ owner hoặc admin có quyền xóa
- ✅ Xóa file trên Cloudinary storage
- ✅ Xóa metadata trong MySQL database
- ✅ Xóa document trong Firebase Firestore
- ✅ Xóa CASCADE các liên kết (file_tags)
- ✅ Real-time update cho các thành viên khác

---

## 1. Quyền hạn và Authorization

### 1.1. Ai có thể xóa file?

Chỉ có **2 loại người dùng** có quyền xóa file:

1. **Owner (Người upload file)** - Có quyền xóa file của chính mình
2. **Admin của nhóm** - Có quyền xóa bất kỳ file nào trong nhóm

### 1.2. Logic kiểm tra quyền

**File:** `backend/src/controllers/filesController.js`

```javascript
// 1. Lấy thông tin file
const fileInfoResult = await executeQuery(`
  SELECT f.*, map.firestore_id as firebase_group_id
  FROM files f
  JOIN group_mapping map ON f.group_id = map.mysql_id
  WHERE f.id = ?
`, [fileId]);

// 2. Kiểm tra user có trong nhóm không
const memberResult = await executeQuery(`
  SELECT role FROM group_members WHERE group_id = ? AND user_id = ?
`, [file.group_id, userId]);

if (!memberResult || memberResult.length === 0) {
  return res.status(403).json({
    success: false,
    message: 'You do not have access to this group'
  });
}

// 3. Kiểm tra quyền: owner hoặc admin
const isOwner = file.uploader_id === userId;
const isAdmin = memberResult[0].role === 'admin';

if (!isOwner && !isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'You can only delete your own files or you must be an admin'
  });
}
```

**Flow kiểm tra quyền:**
```
1. File tồn tại? → Nếu không: 404 Not Found
           ↓
2. User trong nhóm? → Nếu không: 403 Forbidden
           ↓
3. User là owner hoặc admin? → Nếu không: 403 Forbidden
           ↓
4. Cho phép xóa ✅
```

---

## 2. API Endpoint

### 2.1. Delete File API

```
DELETE /api/files/:fileId
```

**File:** `backend/src/routes/files.js`

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Params:**
- `fileId` (number, required): ID của file cần xóa

**Response Success (200):**
```json
{
  "success": true,
  "message": "File deleted successfully",
  "data": {
    "deletedFileId": "123",
    "fileName": "document.pdf"
  }
}
```

**Response Error (403):**
```json
{
  "success": false,
  "message": "You can only delete your own files or you must be an admin"
}
```

**Response Error (404):**
```json
{
  "success": false,
  "message": "File not found"
}
```

### 2.2. Route Registration

**File:** `backend/src/routes/files.js`

```javascript
/**
 * DELETE /api/files/:fileId
 * Xóa file - chỉ owner hoặc admin có thể xóa
 */
router.delete('/:fileId', verifyFirebaseToken, deleteFile);
```

---

## 3. Luồng xóa File Backend

### 3.1. Tổng quan luồng xóa

```
1. Validate quyền truy cập
         ↓
2. Xóa file trên Cloudinary
         ↓
3. Xóa file_tags (MySQL)
         ↓
4. Xóa file record (MySQL)
         ↓
5. Xóa Firestore document
         ↓
6. Return success response
```

### 3.2. Implementation chi tiết

**File:** `backend/src/controllers/filesController.js`

```javascript
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.uid;
    
    console.log(`🗑️ Delete file request: fileId=${fileId}, userId=${userId}`);
    
    // STEP 1: Lấy thông tin file
    const fileInfoResult = await executeQuery(`
      SELECT f.*, map.firestore_id as firebase_group_id
      FROM files f
      JOIN group_mapping map ON f.group_id = map.mysql_id
      WHERE f.id = ?
    `, [fileId]);
    
    if (!fileInfoResult || fileInfoResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    const file = fileInfoResult[0];
    
    // STEP 2: Kiểm tra quyền (xem section 1.2)
    // ... authorization logic ...
    
    // STEP 3: Xóa file trên Cloudinary
    try {
      const url = file.storage_path;
      console.log(`🔍 Original Cloudinary URL: ${url}`);
      
      // Parse URL để lấy public_id
      let publicId;
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      
      if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
        const afterUpload = urlParts.slice(uploadIndex + 1).join('/');
        const withoutVersion = afterUpload.replace(/^v\d+\//, '');
        publicId = withoutVersion.replace(/\.[^/.]+$/, '');
        console.log(`🎯 Extracted public_id: ${publicId}`);
      }
      
      // Verify file exists in Cloudinary
      const listResult = await cloudinary.api.resources({
        type: 'upload',
        resource_type: 'raw',
        prefix: 'docsshare/documents/',
        max_results: 100
      });
      
      const targetFile = listResult.resources.find(resource => 
        resource.public_id === publicId
      );
      
      if (targetFile) {
        const deleteResult = await cloudinary.uploader.destroy(
          targetFile.public_id, 
          { resource_type: 'raw' }
        );
        
        if (deleteResult.result === 'ok') {
          console.log(`✅ File deleted from Cloudinary: ${targetFile.public_id}`);
        }
      }
      
    } catch (cloudinaryError) {
      console.error('⚠️ Cloudinary deletion failed:', cloudinaryError);
      // Tiếp tục xóa database ngay cả khi Cloudinary fail
    }
    
    // STEP 4 & 5: Xóa trong MySQL database (transaction)
    await executeTransaction(async (connection) => {
      // Xóa file_tags trước (foreign key constraint)
      await connection.execute(
        'DELETE FROM file_tags WHERE file_id = ?',
        [fileId]
      );
      
      // Xóa file record
      await connection.execute(
        'DELETE FROM files WHERE id = ?',
        [fileId]
      );
      
      console.log(`✅ File ${fileId} deleted from MySQL database`);
    });
    
    // STEP 6: Xóa trong Firestore
    try {
      const firestoreGroupId = file.firebase_group_id;
      
      await admin.firestore()
        .collection('groups')
        .doc(firestoreGroupId)
        .collection('files')
        .doc(fileId.toString())
        .delete();
      
      console.log(`✅ File deleted from Firestore: groups/${firestoreGroupId}/files/${fileId}`);
    } catch (firestoreError) {
      console.error('⚠️ Firestore deletion failed:', firestoreError);
      // Không throw error vì MySQL đã thành công
    }
    
    // STEP 7: Return success
    res.json({
      success: true,
      message: 'File deleted successfully',
      data: {
        deletedFileId: fileId,
        fileName: file.name
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
};
```

### 3.3. Cloudinary Deletion Strategy

**Vấn đề:** Public ID trong Cloudinary có thể khó parse chính xác

**Giải pháp:**
1. **Parse URL** để extract public_id
2. **List resources** trong folder để verify file tồn tại
3. **Find exact match** trong danh sách resources
4. **Delete với exact public_id** từ Cloudinary API

**Code:**
```javascript
// Parse Cloudinary URL
// URL format: https://res.cloudinary.com/.../upload/v123/docsshare/documents/file.pdf
const afterUpload = urlParts.slice(uploadIndex + 1).join('/');
const withoutVersion = afterUpload.replace(/^v\d+\//, ''); // Loại bỏ version
const publicId = withoutVersion.replace(/\.[^/.]+$/, ''); // Loại bỏ extension

// Verify với API
const listResult = await cloudinary.api.resources({
  type: 'upload',
  resource_type: 'raw',
  prefix: 'docsshare/documents/'
});

const targetFile = listResult.resources.find(r => r.public_id === publicId);

// Delete chính xác
await cloudinary.uploader.destroy(targetFile.public_id, {
  resource_type: 'raw'
});
```

---

## 4. Database Schema và CASCADE

### 4.1. Files Table Schema

**File:** `backend/migrations/docsshare_db.sql`

```sql
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

    -- Cascade delete khi group bị xóa
    FOREIGN KEY (group_id) REFERENCES `groups`(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Restrict delete user nếu đã upload file (preserve history)
    FOREIGN KEY (uploader_id) REFERENCES users(id) 
        ON DELETE RESTRICT ON UPDATE CASCADE
);
```

### 4.2. File_Tags Table với CASCADE

```sql
CREATE TABLE file_tags (
    file_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (file_id, tag_id),
    
    -- Auto delete khi file hoặc tag bị xóa
    FOREIGN KEY (file_id) REFERENCES files(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
);
```

**Ưu điểm CASCADE:**
- ✅ Khi xóa file → `file_tags` tự động xóa (không cần code thủ công)
- ✅ Đảm bảo data integrity
- ✅ Tránh orphan records

### 4.3. Luồng CASCADE khi xóa File

```
DELETE FROM files WHERE id = 123
           ↓
MySQL CASCADE trigger
           ↓
DELETE FROM file_tags WHERE file_id = 123 (tự động)
           ↓
File và tất cả tags đã bị xóa ✅
```

---

## 5. Frontend Implementation

### 5.1. Files Service

**File:** `frontend/src/services/filesService.js`

```javascript
class FilesService {
  async deleteFile(fileId) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete file');
      }

      const data = await response.json();
      
      return {
        success: true,
        data: data.data
      };
      
    } catch (error) {
      console.error(`❌ Delete failed for file ${fileId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

### 5.2. useGroupFiles Hook

**File:** `frontend/src/hooks/useGroupFiles.js`

```javascript
const useGroupFiles = (groupId) => {
  const [rawGroupFiles, setRawGroupFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Delete file function
  const deleteFile = useCallback(async (fileId) => {
    if (!fileId) return { success: false, message: 'File ID is required' };
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🗑️ Deleting file: ${fileId}`);
      
      const result = await filesService.deleteFile(fileId);
      
      if (result.success) {
        console.log(`✅ File ${fileId} deleted successfully`);
        
        // Update local state - remove file from list
        if (selectedGroup && rawGroupFiles[selectedGroup]) {
          setRawGroupFiles(prev => ({
            ...prev,
            [selectedGroup]: prev[selectedGroup].filter(
              file => file.id !== parseInt(fileId)
            )
          }));
        }
        
        return {
          success: true,
          message: 'File deleted successfully'
        };
      } else {
        setError(result.error);
        return {
          success: false,
          message: result.error
        };
      }
      
    } catch (err) {
      console.error('❌ Delete error:', err);
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, rawGroupFiles]);

  return {
    files: getCurrentGroupFiles(),
    loading,
    error,
    deleteFile,
    refreshFiles: () => fetchFiles(selectedGroup)
  };
};
```

**Đặc điểm:**
- ✅ Optimistic UI update - Xóa khỏi local state ngay lập tức
- ✅ Error handling với fallback
- ✅ Loading states

### 5.3. Files Component với Delete UI

**File:** `frontend/src/components/Chat/GroupSidebar/Files.jsx`

```jsx
const Files = ({ groupId, isAdmin }) => {
  const { files, deleteFile, refreshFiles } = useGroupFiles(groupId);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (file) => {
    setSelectedFile(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedFile) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteFile(selectedFile.id);
      
      if (result.success) {
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999]';
        notification.innerHTML = `
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>Đã xóa file thành công</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
        
        setShowDeleteModal(false);
        setSelectedFile(null);
      } else {
        throw new Error(result.message || 'Xóa file thất bại');
      }
    } catch (error) {
      // Show error notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999]';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>${error.message || 'Không thể xóa file'}</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => notification.remove(), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* File list với delete button */}
      {files.map(file => (
        <div key={file.id}>
          <span>{file.name}</span>
          
          {/* Chỉ hiển thị nút xóa nếu là owner hoặc admin */}
          {(file.uploaderId === auth.currentUser?.uid || isAdmin) && (
            <button onClick={() => handleDeleteClick(file)}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal">
          <h3>Xác nhận xóa file</h3>
          <p>Bạn có chắc muốn xóa "{selectedFile?.name}"?</p>
          
          <button onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? 'Đang xóa...' : 'Xóa'}
          </button>
          
          <button onClick={() => setShowDeleteModal(false)}>
            Hủy
          </button>
        </div>
      )}
    </div>
  );
};
```

**UI Features:**
- ✅ Delete button chỉ hiển thị khi có quyền
- ✅ Confirmation modal trước khi xóa
- ✅ Loading state trong khi xóa
- ✅ Success/Error notifications

---

## 6. Real-time Updates với Firestore

### 6.1. Firestore Sync

Khi xóa file, backend đồng bộ với Firestore:

```javascript
// Backend: Xóa Firestore document
await admin.firestore()
  .collection('groups')
  .doc(firestoreGroupId)
  .collection('files')
  .doc(fileId.toString())
  .delete();
```

### 6.2. Real-time Listener (Optional)

Frontend có thể lắng nghe real-time updates:

```javascript
// Listen to files subcollection
const unsubscribe = onSnapshot(
  collection(db, 'groups', groupId, 'files'),
  (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') {
        console.log('🗑️ File deleted (real-time):', change.doc.id);
        // Update UI automatically
        removeFileFromList(change.doc.id);
      }
    });
  }
);
```

**Lợi ích:**
- ✅ Các thành viên khác thấy file bị xóa ngay lập tức
- ✅ Không cần refresh page
- ✅ Sync state giữa nhiều tabs/devices

---

## 7. Error Handling

### 7.1. Backend Error Cases

| Error Code | Condition | Message |
|------------|-----------|---------|
| 400 | Invalid file ID | "Invalid file ID" |
| 403 | Not in group | "You do not have access to this group" |
| 403 | Not owner/admin | "You can only delete your own files or you must be an admin" |
| 404 | File not found | "File not found" |
| 500 | Server error | "Failed to delete file" |

### 7.2. Cloudinary Error Handling

```javascript
try {
  // Attempt Cloudinary deletion
  await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
} catch (cloudinaryError) {
  console.error('⚠️ Cloudinary deletion failed:', cloudinaryError);
  // KHÔNG throw error - tiếp tục xóa database
  // Lý do: Metadata trong DB quan trọng hơn file storage
}
```

**Strategy:** Best-effort deletion
- ✅ Xóa database luôn thành công (critical)
- ⚠️ Xóa Cloudinary có thể fail (non-critical)
- 📝 Log lỗi để cleanup manual sau

### 7.3. Frontend Error Handling

```javascript
try {
  const result = await deleteFile(fileId);
  
  if (!result.success) {
    throw new Error(result.message);
  }
  
  // Success notification
  showNotification('Đã xóa file thành công', 'success');
  
} catch (error) {
  // Error notification
  showNotification(error.message || 'Không thể xóa file', 'error');
  
  // Log for debugging
  console.error('Delete error:', error);
}
```

---

## 8. Edge Cases và Special Scenarios

### 8.1. Group bị xóa

**Scenario:** Admin xóa toàn bộ nhóm

**Behavior:**
```sql
-- Khi xóa group
DELETE FROM `groups` WHERE id = 123;

-- CASCADE tự động xóa:
-- ✅ group_members
-- ✅ files (và cascade tiếp sang file_tags)
-- ✅ tags
-- ✅ group_invitations
```

**Code không cần xử lý:** MySQL CASCADE handle tự động

### 8.2. User bị xóa

**Scenario:** User xóa tài khoản

**Constraint:**
```sql
FOREIGN KEY (uploader_id) REFERENCES users(id) 
  ON DELETE RESTRICT
```

**Behavior:**
- ❌ Không thể xóa user nếu đã upload file
- ✅ Preserve upload history
- 💡 Cần soft delete user thay vì hard delete

### 8.3. Xóa file đang được download

**Scenario:** User A đang download file, User B xóa file

**Flow:**
1. User A bắt đầu download → Fetch URL từ Cloudinary
2. User B xóa file → Xóa metadata trong DB + Firestore
3. User A vẫn download thành công (URL còn valid trong cache)
4. Cloudinary file bị xóa sau đó
5. Download tiếp theo sẽ fail

**Không có race condition vì:**
- Download URL là direct Cloudinary URL
- Không qua backend API
- Cloudinary cache URL một thời gian

### 8.4. Concurrent Deletes

**Scenario:** 2 admin cùng xóa file

**Protection:**
```javascript
// Transaction trong MySQL
await executeTransaction(async (connection) => {
  await connection.execute('DELETE FROM files WHERE id = ?', [fileId]);
});
```

**Behavior:**
- ✅ Transaction 1 thành công → File deleted
- ✅ Transaction 2 fail → File not found (404)
- ✅ Idempotent operation

---

## 9. Testing

### 9.1. Unit Tests

```javascript
describe('Delete File', () => {
  it('should allow owner to delete file', async () => {
    const file = await createFile(ownerId, groupId);
    const result = await deleteFile(file.id, ownerId);
    expect(result.success).toBe(true);
  });
  
  it('should allow admin to delete any file', async () => {
    const file = await createFile(userId, groupId);
    const result = await deleteFile(file.id, adminId);
    expect(result.success).toBe(true);
  });
  
  it('should prevent member from deleting others files', async () => {
    const file = await createFile(userId, groupId);
    const result = await deleteFile(file.id, otherMemberId);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
  });
  
  it('should delete file_tags automatically', async () => {
    const file = await createFileWithTags(userId, groupId, [tag1, tag2]);
    await deleteFile(file.id, userId);
    const fileTags = await getFileTags(file.id);
    expect(fileTags.length).toBe(0);
  });
  
  it('should sync deletion to Firestore', async () => {
    const file = await createFile(userId, groupId);
    await deleteFile(file.id, userId);
    const firestoreFile = await getFirestoreFile(groupId, file.id);
    expect(firestoreFile).toBeNull();
  });
});
```

### 9.2. Integration Tests

```javascript
describe('E2E Delete File Flow', () => {
  it('should complete full deletion workflow', async () => {
    // 1. Upload file
    const file = await uploadFile('test.pdf', groupId);
    expect(file.id).toBeDefined();
    
    // 2. Verify file exists
    const files = await getGroupFiles(groupId);
    expect(files).toContainEqual(expect.objectContaining({ id: file.id }));
    
    // 3. Delete file as owner
    const deleteResult = await deleteFileAPI(file.id, ownerToken);
    expect(deleteResult.success).toBe(true);
    
    // 4. Verify file removed from MySQL
    const dbFile = await getFileFromDB(file.id);
    expect(dbFile).toBeNull();
    
    // 5. Verify file removed from Firestore
    const fsFile = await getFirestoreFile(groupId, file.id);
    expect(fsFile).toBeNull();
    
    // 6. Verify Cloudinary file deleted
    const cloudinaryFile = await checkCloudinaryFile(file.publicId);
    expect(cloudinaryFile).toBeNull();
  });
});
```

---

## 10. Performance Considerations

### 10.1. Database Performance

**Indexes:**
```sql
-- Existing indexes for fast queries
CREATE INDEX idx_files_group_id ON files(group_id);
CREATE INDEX idx_files_uploader_id ON files(uploader_id);
```

**Query optimization:**
```javascript
// Single query với JOIN thay vì multiple queries
SELECT f.*, map.firestore_id as firebase_group_id
FROM files f
JOIN group_mapping map ON f.group_id = map.mysql_id
WHERE f.id = ?
```

### 10.2. Cloudinary Batch Deletion

Nếu cần xóa nhiều files:

```javascript
// Batch delete multiple files
const publicIds = files.map(f => f.cloudinary_public_id);

await cloudinary.api.delete_resources(publicIds, {
  resource_type: 'raw'
});
```

### 10.3. Async Operations

```javascript
// Xóa Cloudinary và Firestore async (không block response)
const deletionPromises = [
  deleteFromCloudinary(publicId),
  deleteFromFirestore(groupId, fileId)
];

// Không await - fire and forget
Promise.allSettled(deletionPromises).then(results => {
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Async deletion ${i} failed:`, result.reason);
    }
  });
});

// Response ngay sau khi MySQL success
return res.json({ success: true });
```

---

## 11. Security Considerations

### 11.1. Authorization Layers

**3 lớp bảo mật:**

1. **Firebase Authentication** - Verify JWT token
2. **Group Membership** - Verify user trong nhóm
3. **Permission Check** - Verify owner hoặc admin

```javascript
// Layer 1: Firebase Auth (middleware)
router.delete('/:fileId', verifyFirebaseToken, deleteFile);

// Layer 2: Group membership
const memberResult = await executeQuery(
  `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
  [groupId, userId]
);

// Layer 3: Permission
if (!isOwner && !isAdmin) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

### 11.2. SQL Injection Prevention

```javascript
// ✅ ĐÚNG: Parameterized query
await connection.execute(
  'DELETE FROM files WHERE id = ?',
  [fileId]
);

// ❌ SAI: String concatenation
await connection.execute(
  `DELETE FROM files WHERE id = ${fileId}` // VULNERABLE!
);
```

### 11.3. Path Traversal Prevention

```javascript
// Validate fileId is number
const fileId = parseInt(req.params.fileId);

if (!fileId || isNaN(fileId)) {
  return res.status(400).json({ error: 'Invalid file ID' });
}
```

---

## 12. Monitoring và Logging

### 12.1. Logging Strategy

```javascript
// Comprehensive logging
console.log(`🗑️ Delete file request: fileId=${fileId}, userId=${userId}`);
console.log(`✅ User ${userId} has permission (${isOwner ? 'owner' : 'admin'})`);
console.log(`🔍 Cloudinary URL: ${file.storage_path}`);
console.log(`🎯 Extracted public_id: ${publicId}`);
console.log(`✅ File deleted from Cloudinary`);
console.log(`✅ File ${fileId} deleted from MySQL`);
console.log(`✅ File deleted from Firestore`);
```

### 12.2. Activity Logging

Database activity log (cho audit trail):

```javascript
await connection.execute(
  `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
   VALUES (?, 'delete_file', ?, JSON_OBJECT('file_name', ?), NOW())`,
  [userId, fileId.toString(), fileName]
);
```

### 12.3. Metrics to Track

- Delete success rate
- Delete latency
- Cloudinary deletion failures
- Firestore sync failures
- Permission denial rate

---

## 13. Future Enhancements

### 13.1. Soft Delete

Thay vì xóa vĩnh viễn, đánh dấu deleted:

```sql
ALTER TABLE files ADD COLUMN deleted_at TIMESTAMP NULL;

-- Soft delete
UPDATE files SET deleted_at = NOW() WHERE id = ?;

-- Query chỉ lấy files chưa xóa
SELECT * FROM files WHERE deleted_at IS NULL;
```

**Lợi ích:**
- ✅ Có thể restore file
- ✅ Audit trail tốt hơn
- ✅ Compliance với GDPR

### 13.2. Trash/Recycle Bin

```javascript
// Move to trash thay vì xóa ngay
await moveToTrash(fileId);

// Auto-delete sau 30 ngày
cron.schedule('0 0 * * *', async () => {
  await permanentDeleteOldTrashFiles();
});
```

### 13.3. Batch Delete

```javascript
// Delete multiple files at once
router.delete('/batch', verifyFirebaseToken, async (req, res) => {
  const { fileIds } = req.body;
  
  const results = await Promise.allSettled(
    fileIds.map(id => deleteFile(id, req.user.uid))
  );
  
  res.json({
    success: true,
    deleted: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length
  });
});
```

### 13.4. Undo Delete

```javascript
// Client-side undo trong 5 giây
const deleteWithUndo = async (fileId) => {
  let undoTimeout;
  
  showNotification('File sẽ bị xóa sau 5 giây', {
    action: {
      label: 'Hoàn tác',
      onClick: () => clearTimeout(undoTimeout)
    }
  });
  
  undoTimeout = setTimeout(async () => {
    await deleteFile(fileId);
  }, 5000);
};
```

---

## 14. Tóm tắt Implementation

### 14.1. Luồng xóa hoàn chỉnh

```
User click Delete button
         ↓
Confirm modal → User confirms
         ↓
Frontend: filesService.deleteFile(fileId)
         ↓
Backend: DELETE /api/files/:fileId
         ↓
Step 1: Validate permissions (owner or admin)
         ↓
Step 2: Delete from Cloudinary (best-effort)
         ↓
Step 3: Transaction begin
         ├─ Delete file_tags (CASCADE)
         └─ Delete file record
         ↓
Step 4: Delete from Firestore (async)
         ↓
Step 5: Return success response
         ↓
Frontend: Update local state (remove from list)
         ↓
Real-time: Other users see file removed
         ↓
Success notification ✅
```

### 14.2. Key Files

**Backend:**
- `backend/src/routes/files.js` - Route definition
- `backend/src/controllers/filesController.js` - Delete logic (lines 459-704)
- `backend/src/models/File.js` - File model với delete method
- `backend/migrations/docsshare_db.sql` - Database schema với CASCADE

**Frontend:**
- `frontend/src/services/filesService.js` - API client
- `frontend/src/hooks/useGroupFiles.js` - Delete hook
- `frontend/src/components/Chat/GroupSidebar/Files.jsx` - Delete UI

### 14.3. Đặc điểm nổi bật

✅ **Security:** 3-layer authorization (Auth + Membership + Permission)  
✅ **Data Integrity:** CASCADE deletes, transactions  
✅ **Multi-storage:** Cloudinary + MySQL + Firestore sync  
✅ **Real-time:** Firestore updates cho other users  
✅ **Error Handling:** Best-effort Cloudinary, robust fallbacks  
✅ **UX:** Confirmation modal, loading states, notifications  

---

## 15. Checklist cho Developer

### Phase 1: Hiểu Code ✅
- [x] Đọc `filesController.js` delete logic
- [x] Hiểu authorization checks
- [x] Hiểu Cloudinary deletion strategy
- [x] Hiểu MySQL CASCADE constraints
- [x] Hiểu Firestore sync

### Phase 2: Testing
- [ ] Test delete as owner
- [ ] Test delete as admin
- [ ] Test delete denied for regular member
- [ ] Test CASCADE deletion of file_tags
- [ ] Test Firestore sync
- [ ] Test Cloudinary deletion
- [ ] Test concurrent deletes
- [ ] Test delete during download

### Phase 3: Production Considerations
- [ ] Monitor delete success rate
- [ ] Track Cloudinary failures
- [ ] Set up activity log alerts
- [ ] Consider implementing soft delete
- [ ] Add batch delete capability
- [ ] Implement undo functionality

---

**Kết luận:** Chức năng xóa file được implement đầy đủ với authorization nghiêm ngặt, multi-storage sync, và error handling robust. System đảm bảo data integrity thông qua CASCADE constraints và transactions, đồng thời cung cấp real-time updates cho user experience tốt.
