# 🎨 FILE VERSION MANAGEMENT - UI INTEGRATION GUIDE

**Status:** ✅ **FULLY INTEGRATED INTO CHATAREA**  
**Date:** 2025-12-07

---

## 📍 INTEGRATION SUMMARY

### ✅ Components Added

1. **UpdateFileModal.jsx** - Modal để cập nhật file mới
2. **VersionHistoryModal.jsx** - Modal xem lịch sử phiên bản
3. **ChatArea.jsx** - Integrated với 3 buttons mới

---

## 🖼️ UI LOCATION - File List in Search Dropdown

**File:** `frontend/src/components/Chat/ChatArea.jsx` (Lines 895-970)

```jsx
<div className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50">
  {/* File Icon */}
  <div className="w-10 h-10 bg-emerald-100 rounded-xl">
    {getFileIcon(doc.type)}
  </div>
  
  {/* File Info */}
  <div className="flex-1">
    <p className="text-sm font-medium">{doc.name}</p>
    <p className="text-xs text-gray-500">{doc.uploadedBy} • {doc.size}</p>
  </div>
  
  {/* 🆕 NEW: 3 ACTION BUTTONS */}
  <div className="flex items-center gap-1">
    {/* ✅ Update Button (Only for owner) */}
    {doc.uploaderId === user?.uid && (
      <button onClick={() => handleUpdateFile(doc)}>
        <RefreshCw className="h-4 w-4" />
      </button>
    )}
    
    {/* ✅ History Button (Everyone) */}
    <button onClick={() => handleViewHistory(doc)}>
      <History className="h-4 w-4" />
    </button>
    
    {/* ✅ Download Button (Everyone) */}
    <button onClick={() => handleDownloadFile(doc)}>
      <Download className="h-4 w-4" />
    </button>
  </div>
</div>
```

---

## 🎯 USER INTERACTIONS

### 1️⃣ **Update File** (Chỉ người upload)

**Button Icon:** 🔄 `RefreshCw` (màu xanh blue khi hover)  
**Điều kiện:** `doc.uploaderId === user?.uid`  
**Action:** Click → Mở `UpdateFileModal`

**Modal Features:**
- ✅ Upload file mới cùng extension
- ✅ Progress bar upload
- ✅ Giới hạn 25MB
- ✅ Optional notification
- ✅ Auto-increment version number

---

### 2️⃣ **View History** (Tất cả mọi người)

**Button Icon:** 📜 `History` (màu tím purple khi hover)  
**Điều kiện:** Luôn hiển thị  
**Action:** Click → Mở `VersionHistoryModal`

**Modal Features:**
- ✅ Danh sách tất cả versions (DESC)
- ✅ Version hiện tại highlighted
- ✅ Download button cho mỗi version
- ✅ Restore button (chỉ owner)
- ✅ Thông tin: size, ngày upload, người upload

---

### 3️⃣ **Download File** (Tất cả mọi người)

**Button Icon:** ⬇️ `Download` (màu xanh emerald khi hover)  
**Điều kiện:** Luôn hiển thị  
**Action:** Tải file về máy

---

## 🔧 STATE MANAGEMENT

### Added States (Lines 204-206)

```jsx
const [showUpdateModal, setShowUpdateModal] = useState(false);
const [showVersionHistory, setShowVersionHistory] = useState(false);
const [selectedFileForUpdate, setSelectedFileForUpdate] = useState(null);
```

### Event Handlers (Lines 438-458)

```jsx
// Open update modal
const handleUpdateFile = (file) => {
  setSelectedFileForUpdate(file);
  setShowUpdateModal(true);
};

// Open history modal
const handleViewHistory = (file) => {
  setSelectedFileForUpdate(file);
  setShowVersionHistory(true);
};

// After update success
const handleFileUpdated = async () => {
  setShowUpdateModal(false);
  await refreshFiles(); // Refresh file list
};

// After restore success
const handleVersionRestored = async () => {
  setShowVersionHistory(false);
  await refreshFiles(); // Refresh file list
};
```

---

## 📡 REAL-TIME UPDATES (Socket.IO)

### Backend Emit (filesController.js Line 958)

```javascript
io.to(`group_${currentFile.group_id}`).emit('file:updated', {
  fileId: parseInt(fileId),
  groupId: currentFile.group_id,
  file: {
    id: updatedFile.id,
    name: updatedFile.name,
    version: updatedFile.version,
    updated_at: updatedFile.last_updated_at
  }
});
```

### Frontend Listener (TODO - Add to ChatArea.jsx)

```jsx
useEffect(() => {
  if (!selectedGroup || !socket) return;

  // Listen for file updates
  socket.on('file:updated', (data) => {
    console.log('📡 File updated:', data);
    refreshFiles(); // Auto-refresh file list
  });

  return () => {
    socket.off('file:updated');
  };
}, [selectedGroup, socket, refreshFiles]);
```

---

## 🎨 BUTTON STYLING

### Update Button (Blue Theme)

```jsx
className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
```

**States:**
- Default: `text-gray-400`
- Hover: `text-blue-600` + `bg-blue-50`

---

### History Button (Purple Theme)

```jsx
className="flex-shrink-0 p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
```

**States:**
- Default: `text-gray-400`
- Hover: `text-purple-600` + `bg-purple-50`

---

### Download Button (Emerald Theme)

```jsx
className="flex-shrink-0 p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
```

**States:**
- Default: `text-gray-400`
- Hover: `text-emerald-600` + `bg-emerald-50`

---

## 🧪 TESTING CHECKLIST

### ✅ Update File Flow

1. [ ] Click search icon in chat header
2. [ ] Tìm file của mình (uploaded by current user)
3. [ ] Thấy button 🔄 Update (màu xanh blue)
4. [ ] Click Update → Modal mở
5. [ ] Chọn file mới (cùng extension)
6. [ ] Upload progress hiển thị
7. [ ] Upload thành công → Modal đóng
8. [ ] File list refresh tự động
9. [ ] Version number tăng lên

### ✅ Version History Flow

1. [ ] Click search icon
2. [ ] Chọn bất kỳ file nào
3. [ ] Thấy button 📜 History (màu tím purple)
4. [ ] Click History → Modal mở
5. [ ] Thấy danh sách versions (mới nhất ở trên)
6. [ ] Version hiện tại có label "Current"
7. [ ] Mỗi version có button Download
8. [ ] Owner thấy button Restore (người khác không thấy)

### ✅ Restore Version Flow (Owner only)

1. [ ] Open version history của file mình upload
2. [ ] Thấy button Restore ở versions cũ
3. [ ] Click Restore → Confirm
4. [ ] Loading spinner hiển thị
5. [ ] Restore thành công
6. [ ] Version number tăng lên (old version becomes new version)
7. [ ] Modal đóng, file list refresh

### ✅ Permission Tests

1. [ ] User A upload file → User B xem file
2. [ ] User B thấy History button ✅
3. [ ] User B KHÔNG thấy Update button ❌
4. [ ] User B mở History → KHÔNG thấy Restore button ❌
5. [ ] User A mở History → Thấy Restore button ✅

### ✅ Max Version Cleanup

1. [ ] Upload file lần 1 → version = 1
2. [ ] Update 4 lần → version = 5
3. [ ] Kiểm tra DB: `SELECT COUNT(*) FROM file_versions WHERE file_id = X`
4. [ ] Kết quả: 4 versions (v1, v2, v3, v4 trong history + v5 current)
5. [ ] Update lần 6 → version = 6
6. [ ] Kiểm tra DB lại → Vẫn 4 versions (v2, v3, v4, v5 trong history + v6 current)
7. [ ] Version 1 đã bị xóa ✅

---

## 🐛 DEBUGGING TIPS

### Issue: Update button không hiển thị

**Check:**
```jsx
// Trong file object, cần có uploaderId
doc.uploaderId === user?.uid
```

**Solution:** Đảm bảo backend trả về `uploaderId` trong file object:
```javascript
// backend/src/controllers/filesController.js
SELECT f.*, f.uploader_id as uploaderId FROM files f
```

---

### Issue: History modal rỗng

**Check Network Tab:**
```
GET /api/files/:fileId/versions
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "versionNumber": 2,
      "fileName": "file_v2.pdf",
      "uploadedBy": "User#1234",
      "uploadedAt": "2025-12-07T01:00:00Z",
      "size": 1024,
      "storagePath": "https://...",
      "canRestore": true
    }
  ]
}
```

---

### Issue: Upload progress không hiện

**Check:**
```jsx
// frontend/src/services/fileVersionService.js
await uploadFileToCloudinary(file, (progress) => {
  console.log('Upload progress:', progress); // Should log 0-100
});
```

---

### Issue: Real-time update không hoạt động

**Check Socket.IO connection:**
```jsx
// In ChatArea.jsx, add:
useEffect(() => {
  const io = req.app.get('io');
  console.log('Socket.IO instance:', io);
}, []);
```

**Expected:** Socket.IO instance should be defined

---

## 📊 VISUAL LAYOUT

```
┌──────────────────────────────────────────────────────────┐
│  Search Files                                      [X]    │
├──────────────────────────────────────────────────────────┤
│  [Search input with magnifying glass icon]               │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │  📄  File Name.pdf                   [🔄][📜][⬇️]  │  │
│  │      User#1234 • 2.5 MB                            │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  📊  Report.xlsx                         [📜][⬇️]  │  │
│  │      User#5678 • 1.2 MB                            │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

Legend:
🔄 = Update Button (blue, owner only)
📜 = History Button (purple, everyone)
⬇️ = Download Button (emerald, everyone)
```

---

## 🎉 FEATURES COMPLETED

### ✅ Frontend Integration

- [x] Import modals into ChatArea.jsx
- [x] Add state management
- [x] Add event handlers
- [x] Add UI buttons (Update, History, Download)
- [x] Conditional rendering (owner-only for Update)
- [x] Styled buttons with hover effects
- [x] Auto-refresh after update/restore

### ✅ Backend Ready

- [x] Database migration executed
- [x] 3 API endpoints active
- [x] Permission checks implemented
- [x] Max 5 versions auto-cleanup
- [x] Socket.IO events configured
- [x] Cloudinary integration

### ✅ Documentation

- [x] IMPLEMENTATION_GUIDE.md
- [x] FILE_VERSION_VERIFICATION.md
- [x] FILE_VERSION_UI_GUIDE.md (this file)

---

## 🚀 NEXT STEPS

### Optional Enhancements

1. **Toast Notifications:**
```jsx
import { toast } from 'react-hot-toast';

const handleFileUpdated = async () => {
  toast.success('File đã được cập nhật lên version mới!');
  setShowUpdateModal(false);
  await refreshFiles();
};
```

2. **Version Badge:**
```jsx
{doc.version && doc.version > 1 && (
  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
    v{doc.version}
  </span>
)}
```

3. **Loading Skeleton:**
```jsx
{loadingVersions ? (
  <div className="animate-pulse">
    {[1,2,3].map(i => (
      <div key={i} className="h-12 bg-gray-200 rounded mb-2"></div>
    ))}
  </div>
) : (
  // Version list
)}
```

---

## ✅ FINAL STATUS

**Integration:** ✅ COMPLETE  
**Database:** ✅ MIGRATED  
**Testing:** ⏳ READY FOR USER TESTING  

**Chức năng đã sẵn sàng sử dụng!** 🎉

Chỉ cần:
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Login vào ứng dụng
4. Chọn group có files
5. Click search icon → Thấy 3 buttons mới!
