# 📖 Sync System - Examples

## Example 1: Tạo User mới

### Frontend (Firebase)
```javascript
// Create user in Firebase
const db = getFirestore();
await db.collection('users').add({
  email: 'john@example.com',
  displayName: 'John Doe',
  tag: '1234',
  avatar: 'https://example.com/avatar.jpg',
  createdAt: serverTimestamp()
});
```

### Backend - Tự động sync
```
🔄 Firebase listener detects new user
✅ User synced to MySQL
📋 Audit log created:
   - event_source: Firebase
   - action: CREATE
   - new_value: {email: 'john@example.com', ...}
```

### Verify
```sql
-- Check MySQL
SELECT * FROM users WHERE email = 'john@example.com';

-- Check audit log
SELECT * FROM audit_log 
WHERE table_name = 'users' 
  AND record_id = 'john@example.com'
ORDER BY timestamp DESC LIMIT 1;
```

---

## Example 2: Update User từ Backend

### Backend (MySQL)
```sql
UPDATE users 
SET display_name = 'John Smith', 
    avatar_url = 'https://newavatar.com/john.jpg'
WHERE email = 'john@example.com';
```

### Trigger sync to Firebase
```bash
curl -X POST http://localhost:5000/api/sync/manual-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "entityType": "users",
    "entityId": "user-uid-here",
    "direction": "MySQL->Firebase"
  }'
```

### Frontend - Nhận update realtime
```javascript
// Frontend tự động nhận update qua Firestore listener
onSnapshot(doc(db, 'users', userId), (doc) => {
  console.log('User updated:', doc.data());
  // displayName = 'John Smith'
  // avatar = 'https://newavatar.com/john.jpg'
});
```

---

## Example 3: Upload File với Tags

### Frontend
```javascript
// 1. Upload file to Cloudinary
const formData = new FormData();
formData.append('file', file);

const uploadResponse = await fetch(
  `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
  {
    method: 'POST',
    body: formData
  }
);
const { secure_url, public_id } = await uploadResponse.json();

// 2. Save metadata to Firestore
const fileRef = await db
  .collection('groups')
  .doc(groupId)
  .collection('files')
  .add({
    name: file.name,
    url: secure_url,
    publicId: public_id,
    size: file.size,
    mimeType: file.type,
    uploaderId: currentUser.uid,
    groupId: groupId,
    tags: ['important', 'report'],
    createdAt: serverTimestamp()
  });
```

### Backend - Auto sync
```
🔄 Files listener detects new file
📊 Mapping Firestore group ID to MySQL ID
✅ File synced to MySQL files table
🏷️ Tags created/linked in tags & file_tags tables
📋 Audit log created
```

### Result in MySQL
```sql
-- File record
SELECT * FROM files WHERE name = 'report.pdf';
-- id: 123, name: report.pdf, group_id: 5

-- Tags
SELECT t.* FROM tags t
JOIN file_tags ft ON t.id = ft.tag_id
WHERE ft.file_id = 123;
-- important, report

-- Audit log
SELECT * FROM audit_log 
WHERE table_name = 'files' AND record_id = '123'
ORDER BY timestamp DESC;
```

---

## Example 4: Conflict Resolution

### Scenario
- User A updates user profile in Firebase at 10:00:00
- User B updates same profile in MySQL at 10:00:01

### What happens
```javascript
// 1. Firebase update (10:00:00)
await db.collection('users').doc(userId).update({
  displayName: 'Name from Firebase',
  updatedAt: serverTimestamp()
});

// 2. MySQL update (10:00:01)
UPDATE users 
SET display_name = 'Name from MySQL'
WHERE id = 'userId';

// 3. Conflict detected
// Last-Write-Wins: MySQL wins (newer timestamp)
```

### Audit Log shows
```sql
SELECT * FROM audit_log 
WHERE table_name = 'users' 
  AND record_id = 'userId'
  AND conflict_resolved = TRUE;

-- Result:
-- old_value: {displayName: 'Name from Firebase'}
-- new_value: {displayName: 'Name from MySQL'}
-- conflict_strategy: 'last-write-wins'
-- winner: 'MySQL' (timestamp: 10:00:01)
```

---

## Example 5: Error Handling & Retry

### Scenario: Network failure during sync

```javascript
// 1. Firebase creates group
await db.collection('groups').add({
  name: 'New Group',
  creatorId: userId
});

// 2. Network fails during MySQL sync
// Error logged to sync_errors table
```

### Check errors
```bash
curl http://localhost:5000/api/sync/errors
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "entity_type": "groups",
      "entity_id": "firestore-group-id",
      "error_type": "NETWORK_ERROR",
      "error_message": "Connection timeout",
      "retry_count": 0,
      "status": "pending"
    }
  ]
}
```

### Retry
```bash
curl -X POST http://localhost:5000/api/sync/retry-failed
```

Result:
```
🔄 Retrying 1 failed syncs...
✅ Retry successful for groups/firestore-group-id
```

---

## Example 6: Monitoring Dashboard

### Get dashboard data
```bash
curl http://localhost:5000/api/sync/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_operations": 5234,
      "successful": 5230,
      "failed": 4,
      "success_rate": 99.92
    },
    "hourlyActivity": [
      {
        "hour": "2025-10-26 10:00:00",
        "count": 234,
        "successful": 234,
        "failed": 0
      }
    ],
    "topTables": [
      {
        "table_name": "files",
        "operations": 2341,
        "successful": 2341,
        "failed": 0
      }
    ],
    "recentErrors": [],
    "averageLatency": 0.45,
    "listeners": 5
  }
}
```

---

## Example 7: Manual Sync for Bulk Import

### Scenario: Import 1000 users from CSV to MySQL

```sql
-- 1. Bulk insert to MySQL
LOAD DATA INFILE 'users.csv'
INTO TABLE users
FIELDS TERMINATED BY ','
(id, email, display_name, tag);

-- 1000 rows inserted
```

### Sync to Firebase
```javascript
// Script to sync all
const users = await executeQuery('SELECT * FROM users WHERE created_at > NOW() - INTERVAL 1 HOUR');

for (const user of users) {
  await syncService.syncUserToFirebase(user.id, user, 'CREATE');
}

console.log(`✅ Synced ${users.length} users to Firebase`);
```

---

## Example 8: Delete with Cascade

### Frontend: Delete group
```javascript
await db.collection('groups').doc(groupId).delete();
```

### Backend - Auto cascade
```
🔄 Groups listener detects deletion
📋 Finding MySQL group ID from mapping
🗑️ DELETE from groups WHERE id = mysql_group_id
   ↳ CASCADE deletes:
     - group_members
     - files (in this group)
     - file_tags (for those files)
     - tags (group-specific)
📋 Audit log created for each deletion
```

### Verify
```sql
-- All related data deleted
SELECT COUNT(*) FROM group_members WHERE group_id = ?; -- 0
SELECT COUNT(*) FROM files WHERE group_id = ?; -- 0
SELECT COUNT(*) FROM tags WHERE group_id = ?; -- 0

-- Audit trail preserved
SELECT * FROM audit_log WHERE table_name = 'groups' AND action = 'DELETE';
```

---

## Example 9: Search Audit Logs

### Find all failed operations today
```bash
curl "http://localhost:5000/api/sync/audit-log?success=false&limit=50"
```

### Find all Firebase sync events
```bash
curl "http://localhost:5000/api/sync/audit-log?event_source=Firebase&limit=100"
```

### Find all user updates
```bash
curl "http://localhost:5000/api/sync/audit-log?table_name=users&action=UPDATE"
```

---

## Example 10: Health Monitoring

### Setup monitoring script
```bash
#!/bin/bash
# monitor-sync.sh

HEALTH=$(curl -s http://localhost:5000/api/sync/health)
STATUS=$(echo $HEALTH | jq -r '.data.status')

if [ "$STATUS" != "healthy" ]; then
  echo "⚠️ ALERT: Sync service unhealthy!"
  echo $HEALTH | jq '.'
  
  # Send alert
  curl -X POST https://hooks.slack.com/... \
    -d "{\"text\": \"Sync service is $STATUS\"}"
fi
```

### Run every 5 minutes
```bash
*/5 * * * * /path/to/monitor-sync.sh
```

---

## Tips & Best Practices

### 1. Always check audit logs
```sql
SELECT * FROM audit_log 
WHERE success = FALSE 
ORDER BY timestamp DESC 
LIMIT 20;
```

### 2. Monitor pending errors
```bash
# Daily check
curl http://localhost:5000/api/sync/errors?status=pending
```

### 3. Regular maintenance
```bash
# Weekly cleanup
curl -X DELETE "http://localhost:5000/api/sync/clear-old-logs?days=30"
```

### 4. Performance monitoring
```bash
# Check latency
curl http://localhost:5000/api/sync/dashboard | jq '.data.averageLatency'
```

### 5. Backup audit logs
```bash
# Monthly backup
mysqldump -u user -p database audit_log > audit_log_backup_$(date +%Y%m).sql
```

---

**More examples?** Check the full documentation in `SYNC_SYSTEM_README.md`
