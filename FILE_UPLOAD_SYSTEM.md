# Phân Tích Chức Năng Upload File - DocsShare

## 📋 Tổng Quan

Hệ thống upload file trong DocsShare cho phép người dùng tải lên và chia sẻ tài liệu trong nhóm. Hệ thống sử dụng **Cloudinary** làm storage backend với **signed upload** để đảm bảo bảo mật, kết hợp MySQL để lưu metadata và Firestore để realtime sync.

### Đặc Điểm Nổi Bật

- ✅ **Signed Upload**: Backend tạo signature an toàn cho Cloudinary
- ✅ **Multi-file Upload**: Upload nhiều files cùng lúc
- ✅ **Tag System**: Gắn tags vào files để phân loại
- ✅ **Realtime Sync**: Firestore listener cập nhật ngay lập tức
- ✅ **Progress Tracking**: Theo dõi tiến trình upload từng file
- ✅ **Validation**: Kiểm tra file type, size, permissions
- ✅ **Download Tracking**: Đếm số lượt tải xuống
- ✅ **Auto Metadata**: Tự động trích xuất thông tin file

---

## 🏗️ Kiến Trúc Tổng Thể

```
┌────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ChatArea Component (Main Upload UI)                    │  │
│  │  - File drag & drop                                      │  │
│  │  - File picker dialog                                    │  │
│  │  - Tag selection                                         │  │
│  │  - Upload progress UI                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  useGroupFiles Hook                                      │  │
│  │  - uploadFiles(files, groupId, tagIds)                   │  │
│  │  - Progress state management                             │  │
│  │  - Firestore realtime listener                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  FilesService                                            │  │
│  │  1. getUploadSignature()                                 │  │
│  │  2. uploadToCloudinary(file, signature)                  │  │
│  │  3. saveFileMetadata(fileData)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                           ↓
              Authorization: Bearer <Firebase_ID_Token>
                           ↓
┌────────────────────────────────────────────────────────────────┐
│                        BACKEND                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  POST /api/files/signature                               │  │
│  │  - Verify Firebase token                                 │  │
│  │  - Generate Cloudinary signature                         │  │
│  │  - Return: signature, timestamp, api_key, cloud_name     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CLOUDINARY UPLOAD (Direct from Frontend)                │  │
│  │  - Upload file với signature                             │  │
│  │  - Return: secure_url, public_id, size, format           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  POST /api/files/metadata                                │  │
│  │  Step 1: Map Firestore group ID → MySQL group ID        │  │
│  │  Step 2: Verify user membership                          │  │
│  │  Step 3: Insert file into MySQL `files` table           │  │
│  │  Step 4: Link tags in `file_tags` table                 │  │
│  │  Step 5: Log activity in `activity_logs`                │  │
│  │  Step 6: Sync to Firestore for realtime                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────┐
│                    STORAGE & DATABASE                           │
│                                                                  │
│  MySQL: files, file_tags, activity_logs                        │
│  Firestore: groups/{groupId}/files/{fileId}                    │
│  Cloudinary: docsshare/documents/{filename}                    │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Luồng Upload Chi Tiết

### Phase 1: Frontend - User Interaction

#### 1.1. File Selection (ChatArea.jsx)

**Phương thức upload:**
1. **Drag & Drop**: Kéo thả file vào chat area
2. **File Picker**: Click nút 📎 chọn file từ máy tính
3. **Multi-select**: Chọn nhiều files cùng lúc

**Code Implementation:**

```jsx
// File: frontend/src/components/Chat/ChatArea.jsx

const handleFileSelect = (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    setPendingFiles(files);      // Lưu files vào state
    setShowUploadDialog(true);   // Hiển thị dialog chọn tags
  }
  // Reset file input
  e.target.value = '';
};

// Drag & Drop handlers
const handleDrop = (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    setPendingFiles(files);
    setShowUploadDialog(true);
  }
};
```

**Upload Dialog:**
```jsx
{showUploadDialog && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 max-w-md w-full">
      <h3 className="text-lg font-semibold mb-4">
        Upload {pendingFiles.length} file(s)
      </h3>
      
      {/* File list */}
      <div className="mb-4 space-y-2">
        {pendingFiles.map((file, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <FileIcon />
            <span className="text-sm truncate">{file.name}</span>
            <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
          </div>
        ))}
      </div>
      
      {/* Tag selection */}
      <TagSelector 
        selectedTags={selectedTags}
        onTagSelect={handleTagSelect}
      />
      
      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button onClick={handleCancelUpload}>Hủy</button>
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Đang tải...' : 'Upload'}
        </button>
      </div>
    </div>
  </div>
)}
```

---

### Phase 2: Frontend - Upload Process

#### 2.1. useGroupFiles Hook

**File:** `frontend/src/hooks/useGroupFiles.js`

```javascript
const uploadFiles = useCallback(async (files, groupId, tagIds = []) => {
  if (!files || files.length === 0) return { success: false };
  
  console.log(`📤 Starting upload: ${files.length} files, tags: ${tagIds}`);
  
  const results = [];
  const errors = [];
  
  // Upload files sequentially to avoid overwhelming server
  for (const file of files) {
    try {
      // Call FilesService
      const result = await filesService.uploadFile(file, groupId, tagIds);
      
      if (result.success) {
        results.push(result.data);
        console.log(`✅ Uploaded: ${file.name}`);
      } else {
        errors.push({ file: file.name, error: result.error });
        console.error(`❌ Failed: ${file.name} - ${result.error}`);
      }
    } catch (error) {
      errors.push({ file: file.name, error: error.message });
      console.error(`❌ Upload error for ${file.name}:`, error);
    }
  }
  
  // Refresh file list after all uploads
  if (results.length > 0) {
    await fetchFiles(groupId);
  }
  
  return {
    success: errors.length === 0,
    uploaded: results.length,
    failed: errors.length,
    errors: errors
  };
}, [fetchFiles]);
```

---

#### 2.2. FilesService - Upload Flow

**File:** `frontend/src/services/filesService.js`

**Step 1: Get Upload Signature**

```javascript
async getUploadSignature(fileName, fileSize, fileType) {
  const token = await this.getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}/files/signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName,
      fileSize,
      fileType
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get upload signature: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data; // { signature, timestamp, api_key, cloud_name, folder }
}
```

**Step 2: Upload to Cloudinary**

```javascript
async uploadToCloudinary(file, signatureData) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('signature', signatureData.signature);
  formData.append('timestamp', signatureData.timestamp);
  formData.append('api_key', signatureData.api_key);
  formData.append('folder', signatureData.folder);
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/auto/upload`,
    {
      method: 'POST',
      body: formData
    }
  );
  
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed: ${response.statusText}`);
  }
  
  return await response.json();
  // Returns: { secure_url, public_id, width, height, format, resource_type, ... }
}
```

**Step 3: Save File Metadata**

```javascript
async saveFileMetadata(fileData) {
  const token = await this.getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}/files/metadata`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fileData)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save metadata: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data;
}
```

**Complete Upload Process:**

```javascript
async uploadFile(file, groupId, tagIds = []) {
  try {
    console.log(`📤 Starting upload for: ${file.name}`);
    
    // Step 1: Get upload signature
    const signatureData = await this.getUploadSignature(
      file.name, 
      file.size, 
      file.type
    );
    console.log('✅ Got upload signature');
    
    // Step 2: Upload to Cloudinary
    const cloudinaryData = await this.uploadToCloudinary(file, signatureData);
    console.log('✅ Uploaded to Cloudinary');
    
    // Step 3: Save metadata
    const metadata = await this.saveFileMetadata({
      name: file.name,
      url: cloudinaryData.secure_url,
      size: file.size,
      mimeType: file.type,
      groupId: groupId,
      tagIds: tagIds
    });
    console.log('✅ Saved metadata');
    
    return {
      success: true,
      data: metadata
    };
    
  } catch (error) {
    console.error(`❌ Upload failed for ${file.name}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### Phase 3: Backend - Signature Generation

#### 3.1. POST /api/files/signature

**File:** `backend/src/routes/files.js`

```javascript
router.post('/signature', verifyFirebaseToken, createUploadSignature);
```

**Controller Implementation:**

**File:** `backend/src/controllers/filesController.js`

```javascript
const createUploadSignature = async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(`✅ Creating upload signature for user: ${req.user.email}`);
    
    // Tạo timestamp cho signature
    const timestamp = Math.round(Date.now() / 1000);
    
    // Cấu hình upload parameters
    const uploadParams = {
      timestamp: timestamp,
      folder: 'docsshare/documents'
    };
    
    // Tạo signature sử dụng Cloudinary utils
    const signature = cloudinary.utils.api_sign_request(
      uploadParams,
      process.env.CLOUDINARY_API_SECRET
    );
    
    // Trả về signature và thông tin cần thiết
    res.json({
      success: true,
      data: {
        signature: signature,
        timestamp: timestamp,
        api_key: process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        folder: uploadParams.folder,
        resource_type: 'auto'
      },
      message: 'Upload signature created successfully'
    });
    
    console.log(`✅ Upload signature created for user ${userId}`);
    
  } catch (error) {
    console.error('❌ Error creating upload signature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create upload signature',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
```

**Signature Security:**
- ✅ **Server-side only**: API secret không bao giờ gửi đến client
- ✅ **Timestamp**: Signature có thời hạn (thường 1 giờ)
- ✅ **Folder restriction**: Chỉ upload vào folder `docsshare/documents`
- ✅ **Authentication required**: Phải có Firebase token hợp lệ

---

### Phase 4: Backend - Save Metadata

#### 4.1. POST /api/files/metadata

**File:** `backend/src/controllers/filesController.js`

```javascript
const saveFileMetadata = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, url, size, mimeType, groupId, tagIds = [] } = req.body;
    
    // === VALIDATION ===
    if (!name || !url || !size || !mimeType || !groupId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, url, size, mimeType, groupId'
      });
    }
    
    console.log(`✅ Saving file metadata for user: ${req.user.email}, file: ${name}`);
    console.log(`📊 Processing upload for userId: ${userId}, firestoreGroupId: ${groupId}`);
    
    // === MYSQL TRANSACTION ===
    const result = await executeTransaction(async (connection) => {
      
      // STEP 1: Tự động tạo user nếu chưa tồn tại
      await connection.execute(
        `INSERT IGNORE INTO users (id, email, display_name, tag) 
         VALUES (?, ?, ?, ?)`,
        [userId, req.user.email, req.user.displayName || req.user.email.split('@')[0], '0001']
      );
      
      // STEP 2: Map Firestore group ID to MySQL group ID
      const [groupMapping] = await connection.execute(
        `SELECT mysql_id, group_name FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      let mysqlGroupId, groupName;
      
      if (groupMapping.length === 0) {
        // Auto-create new mapping for unknown Firestore group ID
        console.log(`⚠️ No mapping found for ${groupId}, creating new mapping...`);
        
        const [maxIdResult] = await connection.execute(
          `SELECT COALESCE(MAX(mysql_id), 0) + 1 as next_id FROM group_mapping`
        );
        mysqlGroupId = maxIdResult[0].next_id;
        groupName = `Auto Group ${mysqlGroupId}`;
        
        await connection.execute(
          `INSERT INTO group_mapping (firestore_id, mysql_id, group_name, created_at) 
           VALUES (?, ?, ?, NOW())`,
          [groupId, mysqlGroupId, groupName]
        );
        
        console.log(`✅ Created new mapping: ${groupId} -> MySQL ID ${mysqlGroupId}`);
      } else {
        mysqlGroupId = groupMapping[0].mysql_id;
        groupName = groupMapping[0].group_name;
        console.log(`📍 Mapped Firestore ID ${groupId} -> MySQL ID ${mysqlGroupId}`);
      }
      
      // STEP 3: Kiểm tra/tạo group trong MySQL
      const [existingGroup] = await connection.execute(
        `SELECT id FROM \`groups\` WHERE id = ?`,
        [mysqlGroupId]
      );
      
      if (existingGroup.length === 0) {
        console.log(`⚠️ Group ${mysqlGroupId} not found, auto-creating...`);
        await connection.execute(
          `INSERT INTO \`groups\` (id, name, description, creator_id) 
           VALUES (?, ?, ?, ?)`,
          [mysqlGroupId, groupName, 'Auto-created group', userId]
        );
      }
      
      // STEP 4: Kiểm tra/tạo membership
      const [memberCheck] = await connection.execute(
        `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
        [mysqlGroupId, userId]
      );
      
      if (memberCheck.length === 0) {
        console.log(`⚠️ User not in group ${mysqlGroupId}, auto-adding as admin...`);
        await connection.execute(
          `INSERT INTO group_members (group_id, user_id, role) 
           VALUES (?, ?, 'admin')`,
          [mysqlGroupId, userId]
        );
      }
      
      // STEP 5: Insert file vào bảng files
      const [fileResult] = await connection.execute(
        `INSERT INTO files (name, storage_path, mime_type, size_bytes, group_id, uploader_id, download_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
        [name, url, mimeType, size, mysqlGroupId, userId]
      );
      
      const newFileId = fileResult.insertId;
      
      // STEP 6: Xử lý tags
      const assignedTags = [];
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          if (typeof tagId === 'number' && tagId > 0) {
            // Kiểm tra tag có tồn tại
            const [tagCheck] = await connection.execute(
              `SELECT id, name FROM tags WHERE id = ? AND group_id = ?`,
              [tagId, mysqlGroupId]
            );
            
            if (tagCheck.length > 0) {
              // Insert vào file_tags
              await connection.execute(
                `INSERT IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)`,
                [newFileId, tagId]
              );
              
              assignedTags.push({
                id: tagCheck[0].id,
                name: tagCheck[0].name
              });
            }
          }
        }
      }
      
      // STEP 7: Log activity
      await connection.execute(
        `INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
         VALUES (?, 'upload', ?, JSON_OBJECT('file_name', ?, 'file_size', ?), NOW())`,
        [userId, newFileId.toString(), name, size]
      );
      
      return {
        fileId: newFileId,
        assignedTags: assignedTags
      };
    });
    
    // === FIRESTORE SYNC ===
    try {
      const tagsMap = {};
      result.assignedTags.forEach(tag => {
        tagsMap[tag.id.toString()] = tag.name;
      });
      
      const fileDoc = {
        id: result.fileId,
        name: name,
        url: url,
        size: size,
        mimeType: mimeType,
        uploaderId: userId,
        uploaderEmail: req.user.email,
        uploaderName: req.user.displayName || req.user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        downloadCount: 0,
        tags: tagsMap,
        tagIds: tagIds || []
      };
      
      // Save to Firestore: groups/{groupId}/files/{fileId}
      await admin.firestore()
        .collection('groups')
        .doc(groupId.toString())
        .collection('files')
        .doc(result.fileId.toString())
        .set(fileDoc);
      
      console.log(`✅ File metadata saved to Firestore`);
      
    } catch (firestoreError) {
      console.error('⚠️ Firestore update failed:', firestoreError);
      // Không throw error vì MySQL đã thành công
    }
    
    // === RESPONSE ===
    res.json({
      success: true,
      data: {
        id: result.fileId,
        name: name,
        url: url,
        size: size,
        mimeType: mimeType,
        groupId: groupId,
        uploader: {
          uid: userId,
          name: req.user.displayName || req.user.email.split('@')[0],
          email: req.user.email
        },
        tags: result.assignedTags || [],
        downloadCount: 0,
        createdAt: new Date().toISOString()
      },
      message: 'File metadata saved successfully'
    });
    
    console.log(`✅ File metadata saved successfully - File ID: ${result.fileId}`);
    
  } catch (error) {
    console.error('❌ Error saving file metadata:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save file metadata'
    });
  }
};
```

---

## 📊 Database Schema

### MySQL Tables

#### 1. `files` Table
```sql
CREATE TABLE `files` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `storage_path` TEXT NOT NULL,              -- Cloudinary URL
  `cloudinary_public_id` VARCHAR(255),       -- Cloudinary public ID
  `mime_type` VARCHAR(100),
  `size_bytes` BIGINT,
  `group_id` INT NOT NULL,
  `uploader_id` VARCHAR(128) NOT NULL,       -- Firebase UID
  `download_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES users(id),
  INDEX idx_group_files (group_id, created_at),
  INDEX idx_uploader (uploader_id)
);
```

#### 2. `file_tags` Table
```sql
CREATE TABLE `file_tags` (
  `file_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  
  PRIMARY KEY (file_id, tag_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

#### 3. `group_mapping` Table
```sql
CREATE TABLE `group_mapping` (
  `firestore_id` VARCHAR(255) PRIMARY KEY,   -- Firestore group ID
  `mysql_id` INT NOT NULL UNIQUE,            -- MySQL group ID
  `group_name` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_mysql_id (mysql_id)
);
```

#### 4. `activity_logs` Table
```sql
CREATE TABLE `activity_logs` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` VARCHAR(128) NOT NULL,
  `action_type` VARCHAR(50) NOT NULL,        -- 'upload', 'download', 'delete'
  `target_id` VARCHAR(50),                    -- File ID
  `details` JSON,                             -- { file_name, file_size }
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_activity (user_id, created_at),
  INDEX idx_action_type (action_type)
);
```

### Firestore Collections

#### 1. `groups/{groupId}/files` Subcollection
```javascript
// Document ID: File ID (string)
{
  id: 123,                           // MySQL file ID
  name: "document.pdf",
  url: "https://res.cloudinary.com/...",
  size: 1024000,                     // Bytes
  mimeType: "application/pdf",
  uploaderId: "firebase_uid_123",
  uploaderEmail: "user@example.com",
  uploaderName: "Nhân#6039",
  createdAt: Timestamp,
  uploadedAt: Timestamp,             // Deprecated, use createdAt
  downloadCount: 5,
  tags: {                            // Map of tag ID -> tag name
    "1": "Báo Cáo",
    "5": "Quan Trọng"
  },
  tagIds: [1, 5]                     // Array of tag IDs
}
```

---

## 🔐 Security & Validation

### Frontend Validation

#### 1. File Type Validation
```javascript
const allowedFileTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-rar-compressed'
];

if (!allowedFileTypes.includes(file.type)) {
  setError('Loại file không được hỗ trợ');
  return;
}
```

#### 2. File Size Validation
```javascript
const maxFileSize = 25 * 1024 * 1024; // 25MB

if (file.size > maxFileSize) {
  setError('File quá lớn. Kích thước tối đa là 25MB');
  return;
}
```

### Backend Security

#### 1. Authentication
```javascript
// Middleware: verifyFirebaseToken
router.post('/signature', verifyFirebaseToken, createUploadSignature);
router.post('/metadata', verifyFirebaseToken, saveFileMetadata);
```

#### 2. Signature Security
```javascript
// Signature chỉ hợp lệ trong 1 giờ
const timestamp = Math.round(Date.now() / 1000);

// Cloudinary sẽ reject nếu timestamp quá cũ
const signature = cloudinary.utils.api_sign_request(
  { timestamp, folder: 'docsshare/documents' },
  process.env.CLOUDINARY_API_SECRET
);
```

#### 3. Group Membership Check
```javascript
// Kiểm tra user có trong nhóm không
const [memberCheck] = await connection.execute(
  `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
  [mysqlGroupId, userId]
);

if (memberCheck.length === 0) {
  // Auto-add as admin or throw error
}
```

#### 4. Input Sanitization
```javascript
// Validate required fields
if (!name || !url || !size || !mimeType || !groupId) {
  return res.status(400).json({
    success: false,
    message: 'Missing required fields'
  });
}

// Validate URL format
if (!url.startsWith('https://res.cloudinary.com/')) {
  return res.status(400).json({
    success: false,
    message: 'Invalid Cloudinary URL'
  });
}
```

---

## 🔄 Realtime Sync Mechanism

### Firestore Listener

**File:** `frontend/src/hooks/useGroupFiles.js`

```javascript
// Setup Firestore listener for realtime file uploads
useEffect(() => {
  if (!selectedGroup) return;
  
  const db = getFirestore();
  const filesCollectionRef = collection(db, 'groups', selectedGroup, 'files');
  const filesQuery = query(filesCollectionRef, orderBy('createdAt', 'asc'));
  
  console.log(`🔥 Setting up Firestore listener for group ${selectedGroup}`);
  
  const unsubscribe = onSnapshot(filesQuery, 
    (snapshot) => {
      // Skip pending writes
      if (snapshot.metadata.hasPendingWrites) {
        console.log('⏳ Pending writes, skipping...');
        return;
      }
      
      console.log(`📄 Firestore update: ${snapshot.size} files`);
      
      // Check for changes
      const changes = snapshot.docChanges();
      if (changes.length > 0) {
        const hasNewFile = changes.some(change => change.type === 'added');
        const hasRemovedFile = changes.some(change => change.type === 'removed');
        
        if (hasNewFile || hasRemovedFile) {
          // Refresh full list
          console.log('🆕 File added/removed, refreshing...');
          fetchFiles(selectedGroup);
        } else {
          // Only update modified fields (e.g., downloadCount)
          changes.forEach(change => {
            if (change.type === 'modified') {
              const firestoreData = change.doc.data();
              updateFileInState(firestoreData);
            }
          });
        }
      }
    },
    (error) => {
      console.error('❌ Error in file listener:', error);
    }
  );
  
  return () => {
    console.log('🧹 Cleaning up file upload listener');
    unsubscribe();
  };
}, [selectedGroup, fetchFiles]);
```

**Real-time Updates:**
- ✅ **New file upload**: Ngay lập tức hiển thị trong UI
- ✅ **File delete**: Tự động xóa khỏi list
- ✅ **Download count**: Cập nhật số lượt tải
- ✅ **Multi-user**: Tất cả members thấy cùng lúc

---

## 🎨 UI/UX Features

### Upload Dialog Design

```
┌─────────────────────────────────────────┐
│  Upload Files                      ✕    │
├─────────────────────────────────────────┤
│                                          │
│  📄 document.pdf (1.2 MB)                │
│  📊 presentation.pptx (3.5 MB)           │
│  📝 report.docx (850 KB)                 │
│                                          │
│  Select Tags (optional):                 │
│  ┌────────────────────────────────────┐ │
│  │  ✓ Báo Cáo    ✓ Quan Trọng        │ │
│  │  ○ Tài Liệu   ○ Đề Thi            │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌─────────┐  ┌──────────────────────┐ │
│  │  Hủy    │  │  📤 Upload (3 files) │ │
│  └─────────┘  └──────────────────────┘ │
└─────────────────────────────────────────┘
```

### Upload Progress UI

```
┌─────────────────────────────────────────┐
│  Uploading Files...                     │
├─────────────────────────────────────────┤
│                                          │
│  ✅ document.pdf (1.2 MB)                │
│     [████████████████████] 100%         │
│                                          │
│  ⏳ presentation.pptx (3.5 MB)           │
│     [█████████░░░░░░░░░░░] 45%          │
│                                          │
│  ⏳ report.docx (850 KB)                 │
│     [░░░░░░░░░░░░░░░░░░░░] 0%           │
│                                          │
│  2 of 3 files uploaded                   │
└─────────────────────────────────────────┘
```

### File List Display

```
┌─────────────────────────────────────────────────────────┐
│  📂 Files                                    🔍 Search   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 📄 document.pdf                              1.2MB │ │
│  │ Nhân#6039 • 2 giờ trước • 5 downloads              │ │
│  │ 🏷️ Báo Cáo, Quan Trọng                             │ │
│  │ [👁️ View]  [⬇️ Download]  [🗑️ Delete]              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 📊 presentation.pptx                         3.5MB │ │
│  │ Mai#1234 • 1 ngày trước • 12 downloads             │ │
│  │ 🏷️ Tài Liệu                                        │ │
│  │ [👁️ View]  [⬇️ Download]                           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### States

**1. Idle State**
- Empty file list: "Chưa có file nào"
- Upload button active

**2. Uploading State**
- Progress bars for each file
- Cancel button
- Disable new uploads

**3. Success State**
- Green checkmark ✅
- "Upload thành công"
- Auto-close after 2s

**4. Error State**
- Red X ❌
- Error message
- Retry button

---

## 📈 Performance Optimizations

### 1. Sequential Upload
```javascript
// Upload files one by one để tránh overwhelm server
for (const file of files) {
  await uploadFile(file, groupId, tagIds);
}
```

### 2. Cloudinary Direct Upload
```javascript
// Upload trực tiếp từ frontend → Cloudinary
// Không qua backend → giảm tải server
const response = await fetch(
  `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
  { method: 'POST', body: formData }
);
```

### 3. Firestore Batch Updates
```javascript
// Chỉ update khi có thay đổi thực sự
const changes = snapshot.docChanges();
if (changes.length === 0) return;

// Batch update thay vì update từng file
changes.forEach(change => {
  if (change.type === 'modified') {
    updateFileInState(change.doc.data());
  }
});
```

### 4. Memoization
```javascript
// Cache formatted file list
const groupFiles = useMemo(() => {
  return transformFiles(rawGroupFiles);
}, [rawGroupFiles, userProfiles]);
```

### 5. Lazy Loading
```javascript
// Chỉ load files khi user click vào tab Files
useEffect(() => {
  if (activeTab === 'files' && !filesLoaded) {
    fetchFiles(groupId);
  }
}, [activeTab, groupId, filesLoaded]);
```

---

## 🐛 Error Handling

### Frontend Error Cases

#### 1. Network Errors
```javascript
try {
  const result = await uploadFile(file, groupId, tagIds);
} catch (error) {
  if (error.message === 'Failed to fetch') {
    setError('Không thể kết nối đến server. Kiểm tra mạng.');
  } else if (error.message.includes('timeout')) {
    setError('Upload quá lâu. Vui lòng thử lại.');
  } else {
    setError(error.message);
  }
}
```

#### 2. Cloudinary Errors
```javascript
if (!response.ok) {
  if (response.status === 413) {
    throw new Error('File quá lớn. Cloudinary limit exceeded.');
  } else if (response.status === 401) {
    throw new Error('Signature không hợp lệ hoặc đã hết hạn.');
  } else {
    throw new Error(`Cloudinary upload failed: ${response.statusText}`);
  }
}
```

#### 3. Validation Errors
```javascript
// File type
if (!allowedTypes.includes(file.type)) {
  setError('Loại file không được hỗ trợ. Chỉ chấp nhận: PDF, DOC, PPT, XLS, ZIP');
  return;
}

// File size
if (file.size > maxFileSize) {
  setError('File quá lớn. Kích thước tối đa là 25MB');
  return;
}

// Group selected
if (!selectedGroup) {
  setError('Vui lòng chọn nhóm trước khi upload');
  return;
}
```

### Backend Error Handling

#### 1. Authentication Errors
```javascript
// Middleware: verifyFirebaseToken
if (!token) {
  return res.status(401).json({
    success: false,
    message: 'No authentication token provided'
  });
}

const decodedToken = await admin.auth().verifyIdToken(token);
req.user = decodedToken;
```

#### 2. Database Errors
```javascript
try {
  const result = await executeTransaction(async (connection) => {
    // ... transaction logic
  });
} catch (error) {
  console.error('❌ Transaction error:', error);
  
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'File already exists'
    });
  } else if (error.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      success: false,
      message: 'Invalid group or user reference'
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'Database error'
  });
}
```

#### 3. Firestore Errors
```javascript
try {
  await admin.firestore()
    .collection('groups')
    .doc(groupId)
    .collection('files')
    .doc(fileId)
    .set(fileDoc);
} catch (firestoreError) {
  console.error('⚠️ Firestore sync failed:', firestoreError);
  // Không throw error vì MySQL đã thành công
  // Firestore chỉ là bonus cho realtime
}
```

---

## 🧪 Testing Scenarios

### Unit Tests

#### Frontend Tests
```javascript
describe('FilesService', () => {
  it('should get upload signature', async () => {
    const signature = await filesService.getUploadSignature(
      'test.pdf', 
      1024, 
      'application/pdf'
    );
    
    expect(signature).toHaveProperty('signature');
    expect(signature).toHaveProperty('timestamp');
    expect(signature).toHaveProperty('api_key');
  });
  
  it('should upload to Cloudinary', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const signature = { signature: 'abc', timestamp: 123, api_key: 'key', cloud_name: 'cloud' };
    
    const result = await filesService.uploadToCloudinary(file, signature);
    
    expect(result).toHaveProperty('secure_url');
  });
  
  it('should save metadata', async () => {
    const metadata = {
      name: 'test.pdf',
      url: 'https://cloudinary.com/test.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      groupId: 'group123',
      tagIds: [1, 2]
    };
    
    const result = await filesService.saveFileMetadata(metadata);
    
    expect(result).toHaveProperty('id');
    expect(result.name).toBe('test.pdf');
  });
});
```

#### Backend Tests
```javascript
describe('POST /api/files/signature', () => {
  it('should create upload signature', async () => {
    const res = await request(app)
      .post('/api/files/signature')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('signature');
  });
  
  it('should reject unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/files/signature');
    
    expect(res.status).toBe(401);
  });
});

describe('POST /api/files/metadata', () => {
  it('should save file metadata', async () => {
    const res = await request(app)
      .post('/api/files/metadata')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'test.pdf',
        url: 'https://cloudinary.com/test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        groupId: 'group123',
        tagIds: [1]
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });
  
  it('should reject if user not in group', async () => {
    // Mock user not in group
    const res = await request(app)
      .post('/api/files/metadata')
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .send({ /* ... */ });
    
    expect(res.status).toBe(403);
  });
});
```

### Integration Tests

```javascript
describe('File Upload E2E', () => {
  it('should complete full upload flow', async () => {
    // 1. Get signature
    const signatureRes = await getUploadSignature();
    expect(signatureRes.signature).toBeDefined();
    
    // 2. Upload to Cloudinary
    const file = new File(['test'], 'test.pdf');
    const cloudinaryRes = await uploadToCloudinary(file, signatureRes);
    expect(cloudinaryRes.secure_url).toBeDefined();
    
    // 3. Save metadata
    const metadataRes = await saveFileMetadata({
      name: 'test.pdf',
      url: cloudinaryRes.secure_url,
      size: file.size,
      mimeType: file.type,
      groupId: testGroupId,
      tagIds: []
    });
    expect(metadataRes.id).toBeDefined();
    
    // 4. Verify in database
    const fileInDb = await getFileById(metadataRes.id);
    expect(fileInDb.name).toBe('test.pdf');
    
    // 5. Verify in Firestore
    const fileInFirestore = await getFirestoreFile(testGroupId, metadataRes.id);
    expect(fileInFirestore.name).toBe('test.pdf');
  });
});
```

---

## 📊 Monitoring & Logging

### Backend Logs

```javascript
// Success logs
console.log(`✅ Upload signature created for user ${userId}`);
console.log(`✅ File metadata saved successfully - File ID: ${fileId}`);
console.log(`✅ Uploaded to Cloudinary: ${cloudinaryData.secure_url}`);
console.log(`✅ Firestore sync complete`);

// Progress logs
console.log(`📊 Processing upload for userId: ${userId}, firestoreGroupId: ${groupId}`);
console.log(`📍 Mapped Firestore ID ${groupId} -> MySQL ID ${mysqlGroupId}`);
console.log(`🏷️ Assigned ${assignedTags.length} tags to file`);

// Warning logs
console.log(`⚠️ No mapping found for ${groupId}, creating new mapping...`);
console.log(`⚠️ Group ${mysqlGroupId} not found, auto-creating...`);
console.log(`⚠️ Firestore sync failed, but MySQL succeeded`);

// Error logs
console.error('❌ Error creating upload signature:', error);
console.error('❌ Error saving file metadata:', error);
console.error('❌ Transaction failed:', error);
```

### Activity Tracking

```sql
-- Log every upload
INSERT INTO activity_logs 
  (user_id, action_type, target_id, details, created_at)
VALUES 
  ('user_123', 'upload', '456', '{"file_name":"document.pdf","file_size":1024000}', NOW());

-- Query upload statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as uploads,
  SUM(JSON_EXTRACT(details, '$.file_size')) as total_bytes
FROM activity_logs
WHERE action_type = 'upload'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at);
```

---

## 🔮 Future Enhancements

### 1. Resumable Uploads
```javascript
// Sử dụng Cloudinary chunked upload API
const uploadLargeFile = async (file) => {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  const chunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    await uploadChunk(chunk, i, chunks);
    updateProgress((i + 1) / chunks * 100);
  }
};
```

### 2. Drag & Drop Multiple Files
```javascript
// Cải thiện drag & drop experience
const handleDrop = (e) => {
  e.preventDefault();
  
  const items = e.dataTransfer.items;
  const files = [];
  
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (validateFile(file)) {
        files.push(file);
      }
    }
  }
  
  setPendingFiles(files);
  setShowUploadDialog(true);
};
```

### 3. File Preview
```javascript
// Preview trước khi upload
const generatePreview = async (file) => {
  if (file.type.startsWith('image/')) {
    return await readFileAsDataURL(file);
  } else if (file.type === 'application/pdf') {
    return await generatePDFThumbnail(file);
  }
  return getFileTypeIcon(file.type);
};
```

### 4. Upload Queue Management
```javascript
// Hàng đợi upload với retry
class UploadQueue {
  constructor() {
    this.queue = [];
    this.concurrency = 3; // Upload tối đa 3 files đồng thời
  }
  
  async add(file, groupId, tagIds) {
    const task = { file, groupId, tagIds, retries: 0 };
    this.queue.push(task);
    return this.process();
  }
  
  async process() {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      
      const results = await Promise.allSettled(
        batch.map(task => this.uploadWithRetry(task))
      );
      
      // Handle failed uploads
      results.forEach((result, index) => {
        if (result.status === 'rejected' && batch[index].retries < 3) {
          batch[index].retries++;
          this.queue.push(batch[index]); // Re-queue
        }
      });
    }
  }
}
```

### 5. Virus Scanning
```javascript
// Scan file trước khi lưu metadata
const scanFile = async (cloudinaryUrl) => {
  const response = await fetch(VIRUS_SCAN_API, {
    method: 'POST',
    body: JSON.stringify({ url: cloudinaryUrl })
  });
  
  const result = await response.json();
  
  if (result.infected) {
    // Xóa file từ Cloudinary
    await cloudinary.uploader.destroy(publicId);
    throw new Error('File contains malware');
  }
};
```

### 6. Compression
```javascript
// Nén file trước khi upload (images only)
const compressImage = async (file) => {
  if (!file.type.startsWith('image/')) return file;
  
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  };
  
  return await imageCompression(file, options);
};
```

---

## 📚 Code References

### Frontend Files
- **Upload UI:** `frontend/src/components/Chat/ChatArea.jsx`
- **File Display:** `frontend/src/components/Chat/GroupSidebar/Files.jsx`
- **Upload Hook:** `frontend/src/hooks/useGroupFiles.js`
- **Files Service:** `frontend/src/services/filesService.js`

### Backend Files
- **Routes:** `backend/src/routes/files.js`
- **Controller:** `backend/src/controllers/filesController.js`
- **Model:** `backend/src/models/File.js`
- **Middleware:** `backend/src/middleware/firebaseAuth.js`

### Database
- **MySQL Tables:** `files`, `file_tags`, `group_mapping`, `activity_logs`
- **Firestore:** `groups/{groupId}/files/{fileId}`
- **Cloudinary:** `docsshare/documents/{filename}`

---

## 🎓 Best Practices

### ✅ DO
1. **Validate cả frontend và backend** - Double validation đảm bảo an toàn
2. **Use signed uploads** - Bảo vệ Cloudinary API secret
3. **Track file activities** - Log uploads, downloads, deletes
4. **Implement retries** - Network có thể fail, cần retry logic
5. **Optimize file size** - Compress images, limit max size
6. **Show progress feedback** - User cần biết upload đang diễn ra
7. **Clean up on errors** - Xóa files nếu metadata save failed

### ❌ DON'T
1. **Không upload qua backend** - Direct upload giảm tải server
2. **Không hardcode credentials** - Dùng environment variables
3. **Không skip validation** - Luôn validate file type, size
4. **Không block UI** - Dùng async/await, progress bars
5. **Không quên cleanup** - Unsubscribe listeners khi unmount
6. **Không expose API keys** - Signature system bảo mật

---

**Ngày cập nhật:** 14/11/2025  
**Version:** 1.0  
**Tác giả:** DocsShare Development Team
