# Hướng Dẫn Hoàn Thiện Chức Năng File Version

## ✅ Đã Hoàn Thành

- ✅ Backend: API endpoints, Socket.IO, auto-cleanup
- ✅ Frontend: UpdateFileModal, VersionHistoryModal, fileVersionService

## 📋 Còn Lại Cần Làm

### 1. Chạy Database Migration

```sql
-- Chạy file này trong MySQL/phpMyAdmin
-- File: backend/migrations/add_file_versions.sql

ALTER TABLE files 
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS file_versions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_id INT NOT NULL,
  version_number INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100),
  uploaded_by VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  INDEX idx_file_versions (file_id, version_number),
  INDEX idx_uploaded_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE files SET version = 1 WHERE version IS NULL OR version = 0;
```

### 2. Tích Hợp UI vào ChatArea.jsx

#### A. Import các components ở đầu file:

```javascript
// Thêm vào phần imports
import UpdateFileModal from './UpdateFileModal';
import VersionHistoryModal from './VersionHistoryModal';
import { History, RotateCcw } from 'lucide-react';
```

#### B. Thêm state cho modals:

```javascript
// Thêm vào phần state declarations (sau const [messages, setMessages] = useState([]))
const [showUpdateFileModal, setShowUpdateFileModal] = useState(false);
const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
const [selectedFileForAction, setSelectedFileForAction] = useState(null);
```

#### C. Thêm Socket.IO listener cho file updates:

```javascript
// Thêm useEffect này sau các useEffect hiện tại
useEffect(() => {
  if (!selectedGroup) return;

  // Socket listener for real-time file updates
  const socket = getSocket(); // Hoặc lấy từ context nếu có
  
  socket.on('file:updated', (data) => {
    console.log('📡 File updated via socket:', data);
    
    // Refresh files list
    refreshFiles();
    
    // Show notification
    alert(`File "${data.file.name}" đã được cập nhật lên v${data.file.version}`);
  });

  return () => {
    socket.off('file:updated');
  };
}, [selectedGroup, refreshFiles]);
```

#### D. Thêm handlers:

```javascript
// Thêm sau handleDownloadFile function
const handleUpdateFile = (doc) => {
  setSelectedFileForAction(doc);
  setShowUpdateFileModal(true);
};

const handleShowVersionHistory = (doc) => {
  setSelectedFileForAction(doc);
  setShowVersionHistoryModal(true);
};

const handleUpdateSuccess = (updatedFile) => {
  console.log('✅ File updated successfully:', updatedFile);
  refreshFiles();
};

const handleRestoreSuccess = (restoredData) => {
  console.log('✅ Version restored:', restoredData);
  refreshFiles();
};
```

#### E. Sửa phần render file card (dòng ~1150-1180):

```javascript
{/* Action Buttons */}
<div className="flex space-x-1">
  {/* Download Button */}
  <button 
    onClick={(e) => {
      e.stopPropagation();
      handleDownloadFile(doc);
    }}
    className={`p-2 rounded-lg transition-all duration-200 ${
      doc.isOwn 
        ? 'hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800' 
        : 'hover:bg-orange-100 text-orange-600 hover:text-orange-800'
    }`}
    title="Tải xuống"
  >
    <Download className="h-5 w-5" />
  </button>

  {/* Update Button - Chỉ hiện cho owner */}
  {doc.isOwn && (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        handleUpdateFile(doc);
      }}
      className="p-2 rounded-lg transition-all duration-200 hover:bg-blue-100 text-blue-600 hover:text-blue-800"
      title="Cập nhật file"
    >
      <RotateCcw className="h-5 w-5" />
    </button>
  )}

  {/* Version History Button - Hiện nếu có version > 1 */}
  {(doc.version || 1) > 1 && (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        handleShowVersionHistory(doc);
      }}
      className="p-2 rounded-lg transition-all duration-200 hover:bg-purple-100 text-purple-600 hover:text-purple-800"
      title="Xem lịch sử phiên bản"
    >
      <History className="h-5 w-5" />
    </button>
  )}
</div>
```

#### F. Thêm version badge vào file name:

```javascript
{/* Sửa dòng hiển thị tên file */}
<p className={`font-semibold text-sm truncate ${doc.isOwn ? 'text-gray-800' : 'text-gray-800'}`}>
  {doc.name}
  {/* Version Badge */}
  {(doc.version || 1) > 1 && (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
      v{doc.version}
    </span>
  )}
</p>
```

#### G. Thêm modals ở cuối component (trước closing div):

```javascript
{/* Thêm trước dòng cuối </div> của component */}

{/* Update File Modal */}
{showUpdateFileModal && selectedFileForAction && (
  <UpdateFileModal
    file={selectedFileForAction}
    groupId={selectedGroup}
    onClose={() => {
      setShowUpdateFileModal(false);
      setSelectedFileForAction(null);
    }}
    onSuccess={handleUpdateSuccess}
  />
)}

{/* Version History Modal */}
{showVersionHistoryModal && selectedFileForAction && (
  <VersionHistoryModal
    file={selectedFileForAction}
    onClose={() => {
      setShowVersionHistoryModal(false);
      setSelectedFileForAction(null);
    }}
    onRestore={handleRestoreSuccess}
  />
)}
```

### 3. Test Checklist

- [ ] Chạy migration thành công
- [ ] Restart backend server
- [ ] Upload file mới → version = 1
- [ ] Click "Cập nhật" → Upload file mới → Version tăng lên 2
- [ ] Badge "v2" hiển thị
- [ ] Button "Xem lịch sử" xuất hiện
- [ ] Click "Xem lịch sử" → Modal hiển thị 2 phiên bản
- [ ] Download phiên bản cũ → OK
- [ ] Restore phiên bản cũ → Version tăng lên 3
- [ ] Cập nhật 5 lần → Phiên bản cũ nhất tự động bị xóa
- [ ] User khác chỉ xem được lịch sử, không update/restore

### 4. Debugging

Nếu có lỗi, kiểm tra:

1. **Migration chưa chạy:**
   - Kiểm tra column `version` trong table `files`
   - Kiểm tra table `file_versions` đã tồn tại

2. **Socket.IO không hoạt động:**
   - Kiểm tra `req.app.get('io')` trong backend
   - Kiểm tra socket connection ở frontend

3. **Permission lỗi:**
   - Kiểm tra `doc.isOwn` trong frontend
   - Kiểm tra `file.uploader_id === userId` trong backend

4. **Upload lỗi:**
   - Kiểm tra Cloudinary signature
   - Kiểm tra file size < 25MB

## 🎯 Kết Quả Mong Đợi

- File card hiển thị badge `v{number}` nếu version > 1
- Owner thấy button "Cập nhật"
- Mọi người thấy button "Xem lịch sử" (nếu version > 1)
- Update file → Real-time update cho tất cả users
- Tối đa 5 phiên bản được giữ lại

Chúc bạn triển khai thành công! 🚀
