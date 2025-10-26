# 📋 FILES CẦN UPDATE ĐỂ TÍCH HỢP SYNC

## ✅ ĐÃ TẠO
1. `src/config/syncHelper.js` - Helper functions cho sync

## 🔄 CẦN UPDATE (Thêm sync calls)

### 1. User Model (`src/models/User.js`)
**Methods cần thêm sync:**
- `create()` - Sau khi INSERT, sync lên Firebase
- `updateProfile()` - Sau khi UPDATE, sync lên Firebase  
- `delete()` (if exists) - Sync DELETE

**How to add:**
```javascript
const SyncHelper = require('../config/syncHelper');

// Sau khi MySQL operation success:
await SyncHelper.syncUser(userId, 'CREATE', {
  email, display_name, tag, avatar_url
});
```

### 2. Group Model (`src/models/Group.js`)
**Methods cần thêm sync:**
- `create()` - Sync group và membership
- `update()` - Sync group data
- `addMember()` - Sync membership
- `removeMember()` - Sync member removal
- `updateMemberRole()` - Sync role change
- `delete()` - Sync deletion

**How to add:**
```javascript
const SyncHelper = require('../config/syncHelper');

// Sync group
await SyncHelper.syncGroup(groupId, 'CREATE', groupData);

// Sync membership
await SyncHelper.syncGroupMember(groupId, userId, 'CREATE', { role: 'admin' });
```

### 3. File Model (`src/models/File.js`)
**Methods cần thêm sync:**
- `create()` - Sync file metadata
- `updateTags()` - Sync tag changes
- `delete()` - Sync file deletion

**How to add:**
```javascript
const SyncHelper = require('../config/syncHelper');

await SyncHelper.syncFile(fileId, groupId, 'CREATE', {
  name, storage_path, mime_type, size_bytes, uploader_id, tags
});
```

### 4. Tag Model (`src/models/Tag.js`)
**Methods cần thêm sync:**
- `create()` - Sync tag creation
- `update()` - Sync tag name change
- `delete()` - Sync tag deletion

**How to add:**
```javascript
const SyncHelper = require('../config/syncHelper');

await SyncHelper.syncTag(tagId, groupId, 'CREATE', {
  name, creator_id
});
```

## 🎯 PATTERN ĐỀ XUẤT

```javascript
static async someOperation(params) {
  try {
    return await executeTransaction(async (connection) => {
      // 1. Thực hiện MySQL operations
      const [result] = await connection.execute('...');
      const entityId = result.insertId;
      
      // 2. Log vào activity_logs (nếu cần)
      await connection.execute('INSERT INTO activity_logs ...');
      
      // 3. SYNC TO FIREBASE (trong transaction callback để đảm bảo MySQL success)
      // Nhưng sử dụng try-catch riêng để không fail transaction
      try {
        await SyncHelper.syncXxx(entityId, 'CREATE', data);
      } catch (syncError) {
        console.error('⚠️ Firebase sync failed:', syncError);
        // Log to sync_errors for retry - KHÔNG throw error
      }
      
      return {
        success: true,
        data: { id: entityId, ...otherData }
      };
    });
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
}
```

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Sync TRONG transaction callback** nhưng với try-catch riêng
2. **KHÔNG throw error** nếu sync fail (để không rollback MySQL)
3. **Log sync errors** để retry sau
4. **Sync SYNC thì async** - không block MySQL operation
5. **Kiểm tra mapping** group_mapping trước khi sync

## 🧪 TESTING

Sau khi update, test từng operation:

```bash
# Test user create
POST /api/users -> Check MySQL + Firebase

# Test group create  
POST /api/groups -> Check MySQL + Firebase + mapping

# Test file upload
POST /api/files -> Check MySQL + Firebase (nested collection)

# Test tag create
POST /api/tags -> Check MySQL + Firebase
```

## 📊 MONITORING

Monitor sync qua dashboard:
```bash
curl http://localhost:5000/api/sync/dashboard
curl http://localhost:5000/api/sync/errors
```

---

**Bạn có muốn tôi update từng model một không?** 

Tôi có thể:
1. ✅ Update User.js với sync integration
2. ✅ Update Group.js với sync integration  
3. ✅ Update File.js với sync integration
4. ✅ Update Tag.js với sync integration

Hoặc bạn muốn tôi tạo một script migration tool để tự động thêm sync calls vào code hiện tại?
