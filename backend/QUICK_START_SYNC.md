# 🚀 Quick Start - Sync System

## Cài đặt trong 3 bước

### Bước 1: Chạy Migration
```bash
cd backend
node run-migration.js
```

**Kết quả mong đợi:**
```
✅ Migration completed successfully!
📊 Tables created: audit_log, sync_state, sync_errors
📊 Views created: v_recent_audit_logs, v_sync_statistics, v_failed_syncs
📊 Stored procedures created: log_audit_event, update_sync_state
```

### Bước 2: Test hệ thống
```bash
node test-sync-system.js
```

**Kết quả mong đợi:**
```
🎉 ALL TESTS PASSED!
✅ Sync system is ready to use
```

### Bước 3: Khởi động Server
```bash
npm start
```

**Kết quả mong đợi:**
```
🔄 Initializing Sync Service...
✅ Users listener setup complete
✅ Groups listener setup complete
✅ Group members listener setup complete
✅ Files listener setup complete
✅ Tags listener setup complete
✅ Sync Service initialized with 5 listeners
📡 Real-time sync: Firebase ↔️ MySQL is now active
🚀 DocsShare API đang chạy tại port 5000
```

## ✅ Verify hoạt động

### 1. Check Health
```bash
curl http://localhost:5000/api/sync/health
```

Kết quả tốt:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "listeners": 5,
    "lastSyncMinutesAgo": 2,
    "pendingErrors": 0
  }
}
```

### 2. View Dashboard
```bash
curl http://localhost:5000/api/sync/dashboard
```

### 3. Test Sync Flow

**A. Tạo user trong Firebase:**
```javascript
// Frontend code
await db.collection('users').add({
  email: 'test@example.com',
  displayName: 'Test User',
  tag: '1234'
});
```

**B. Verify trong MySQL:**
```sql
-- Trong 1-2 giây, record sẽ xuất hiện
SELECT * FROM users WHERE email = 'test@example.com';

-- Check audit log
SELECT * FROM audit_log 
WHERE table_name = 'users' 
ORDER BY timestamp DESC 
LIMIT 1;
```

Bạn sẽ thấy:
- ✅ User được tạo trong MySQL
- ✅ Audit log ghi lại với event_source = 'Firebase'
- ✅ Sync state được update

## 🎯 Các use cases thường gặp

### Use case 1: Upload file
Khi user upload file qua frontend:
1. File metadata được lưu vào Firestore
2. Listener tự động bắt sự kiện
3. Sync vào MySQL với transaction
4. Audit log ghi lại toàn bộ

### Use case 2: Update từ backend
Khi admin update data qua MySQL:
1. Thực hiện UPDATE trong MySQL
2. Call API manual sync
3. Data được đẩy lên Firebase
4. Frontend nhận realtime update

### Use case 3: Conflict
Khi có update đồng thời:
1. Hệ thống detect conflict
2. Apply Last-Write-Wins strategy
3. Log quyết định vào audit_log
4. Winner's data được sync

## 🔧 Configuration

Edit trong `src/config/syncService.js`:

```javascript
this.config = {
  // Chiến lược xử lý xung đột
  conflictStrategy: 'last-write-wins',
  
  // Auto retry khi fail
  enableAutoRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  
  // Logging
  enableLogging: true
};
```

## 📊 Monitoring

### Daily Health Check
```bash
# Add to crontab
0 9 * * * curl http://localhost:5000/api/sync/health
```

### View Recent Logs
```bash
curl "http://localhost:5000/api/sync/audit-log?limit=20"
```

### Get Statistics
```bash
curl "http://localhost:5000/api/sync/statistics?days=7"
```

### Check Errors
```bash
curl "http://localhost:5000/api/sync/errors?status=pending"
```

### Retry Failed Syncs
```bash
curl -X POST http://localhost:5000/api/sync/retry-failed
```

## 🐛 Troubleshooting

### Problem: Listeners không hoạt động
**Solution:**
```bash
# Check server logs
tail -f logs/server.log

# Check listeners count
curl http://localhost:5000/api/sync/status | grep listenersActive
# Should be: "listenersActive": 5
```

### Problem: Sync bị lag
**Solution:**
```bash
# Check dashboard
curl http://localhost:5000/api/sync/dashboard | grep averageLatency
# Should be < 1 second

# Check pending operations
curl http://localhost:5000/api/sync/errors?status=pending
```

### Problem: Database errors
**Solution:**
```sql
-- Check indexes
SHOW INDEX FROM audit_log;

-- Check table sizes
SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS "Size (MB)"
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
  AND table_name IN ('audit_log', 'sync_state', 'sync_errors');

-- If audit_log too large, clean old records
DELETE FROM audit_log WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## 📈 Performance Tips

1. **Index optimization:**
   - Audit log được index sẵn cho queries thường dùng
   - Thêm index custom nếu cần

2. **Log rotation:**
   - Auto-clean logs > 30 days
   - Keep sync_state lightweight

3. **Connection pooling:**
   - MySQL pool: 10 connections (default)
   - Tăng nếu có nhiều concurrent syncs

4. **Batch operations:**
   - Listeners process changes individually
   - Consider batching for bulk imports

## 🎓 Learning Path

1. **Day 1:** Setup và test basic sync
2. **Day 2:** Monitor dashboard và hiểu metrics
3. **Day 3:** Test conflict resolution
4. **Day 4:** Customize cho use cases riêng
5. **Day 5:** Production optimization

## 📚 Documentation

- **Full docs:** `SYNC_SYSTEM_README.md`
- **API Reference:** See `/api/sync/*` endpoints
- **Architecture:** See diagram in README

## 🆘 Support

Nếu gặp vấn đề:

1. Check `/api/sync/health`
2. View `/api/sync/dashboard`
3. Check logs: `tail -f logs/server.log`
4. Run test: `node test-sync-system.js`

---

**Happy Syncing! 🎉**
