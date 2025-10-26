# ✅ SYNC SYSTEM - INSTALLATION CHECKLIST

## Pre-Installation

- [ ] MySQL server đang chạy
- [ ] Firebase credentials file tồn tại: `docsshare-35adb-firebase-adminsdk-fbsvc-5409f13b9a.json`
- [ ] `.env` file có đầy đủ database credentials
- [ ] Node.js dependencies đã cài: `npm install`

## Installation Steps

### Step 1: Run Migration
- [ ] Chạy: `node run-migration.js`
- [ ] Thấy message: "✅ Migration completed successfully!"
- [ ] Verify tables created:
  - [ ] `audit_log`
  - [ ] `sync_state`
  - [ ] `sync_errors`
- [ ] Verify views created:
  - [ ] `v_recent_audit_logs`
  - [ ] `v_sync_statistics`
  - [ ] `v_failed_syncs`
- [ ] Verify stored procedures created:
  - [ ] `log_audit_event`
  - [ ] `update_sync_state`

### Step 2: Test System
- [ ] Chạy: `node test-sync-system.js`
- [ ] All tests pass (10/10)
- [ ] Thấy message: "🎉 ALL TESTS PASSED!"
- [ ] No errors in output

### Step 3: Start Server
- [ ] Chạy: `npm start`
- [ ] Thấy message: "🔄 Initializing Sync Service..."
- [ ] Thấy message: "✅ Sync Service initialized with 5 listeners"
- [ ] Server running on port 5000
- [ ] No startup errors

## Verification

### Health Check
- [ ] Run: `curl http://localhost:5000/api/sync/health`
- [ ] Response status: "healthy"
- [ ] Listeners count: 5
- [ ] No pending errors

### Dashboard Check
- [ ] Access: `http://localhost:5000/api/sync/dashboard`
- [ ] Data loads successfully
- [ ] No errors in response

### Audit Log Check
- [ ] Access: `http://localhost:5000/api/sync/audit-log`
- [ ] Can query logs
- [ ] Pagination works

## Functional Testing

### Test 1: Firebase → MySQL Sync
- [ ] Create a test user in Firebase:
  ```javascript
  await db.collection('users').add({
    email: 'test@sync.com',
    displayName: 'Test Sync',
    tag: '9999'
  });
  ```
- [ ] Check MySQL: `SELECT * FROM users WHERE email = 'test@sync.com'`
- [ ] User exists in MySQL ✅
- [ ] Check audit log: `SELECT * FROM audit_log WHERE table_name = 'users' ORDER BY timestamp DESC LIMIT 1`
- [ ] Audit log shows CREATE event ✅

### Test 2: Audit Trail
- [ ] Verify audit log has:
  - [ ] `event_source` = 'Firebase'
  - [ ] `action` = 'CREATE'
  - [ ] `new_value` contains user data
  - [ ] `success` = TRUE
  - [ ] `timestamp` is recent

### Test 3: Manual Sync
- [ ] Update user in MySQL: `UPDATE users SET display_name = 'Updated' WHERE email = 'test@sync.com'`
- [ ] Trigger manual sync via API
- [ ] Verify update in Firebase
- [ ] Check audit log for MySQL → Firebase sync

### Test 4: Error Handling
- [ ] Check for any pending errors: `curl http://localhost:5000/api/sync/errors`
- [ ] No critical errors
- [ ] If errors exist, they can be retried

### Test 5: Performance
- [ ] Check dashboard average latency
- [ ] Latency < 1 second ✅
- [ ] Success rate > 99% ✅

## Monitoring Setup

- [ ] Health check endpoint accessible
- [ ] Dashboard provides useful metrics
- [ ] Audit logs can be filtered and searched
- [ ] Error tracking is working

## Optional: Advanced Setup

- [ ] Setup cron job for health monitoring
- [ ] Setup log cleanup schedule
- [ ] Configure alerts for failures
- [ ] Setup backup for audit logs

## Documentation Review

- [ ] Read `SYNC_SYSTEM_README.md`
- [ ] Read `QUICK_START_SYNC.md`
- [ ] Review `EXAMPLES.md` for use cases
- [ ] Understand API endpoints

## Troubleshooting (If Issues)

### Migration Failed
- [ ] Check MySQL credentials in `.env`
- [ ] Verify MySQL server is running
- [ ] Check migration SQL file exists
- [ ] Review error message

### Test Failed
- [ ] Check Firebase credentials
- [ ] Verify database connection
- [ ] Check all tables exist
- [ ] Review test output for specific failure

### Server Won't Start
- [ ] Check port 5000 is available
- [ ] Verify all dependencies installed
- [ ] Check for syntax errors in logs
- [ ] Review console output

### Sync Not Working
- [ ] Verify listeners count = 5
- [ ] Check Firebase connection
- [ ] Review `/api/sync/errors` for issues
- [ ] Check audit logs

## Sign-Off

Installation completed by: ___________________

Date: ___________________

Verified by: ___________________

Notes:
_____________________________________________
_____________________________________________
_____________________________________________

---

## Quick Reference

### Important Commands
```bash
# Migration
node run-migration.js

# Test
node test-sync-system.js

# Start
npm start

# Health
curl http://localhost:5000/api/sync/health

# Dashboard
curl http://localhost:5000/api/sync/dashboard

# Errors
curl http://localhost:5000/api/sync/errors

# Retry
curl -X POST http://localhost:5000/api/sync/retry-failed
```

### Important Files
- Config: `src/config/syncService.js`
- Routes: `src/routes/sync.js`
- Migration: `migrations/create_audit_log.sql`
- Docs: `SYNC_SYSTEM_README.md`

### Database Tables
- `audit_log` - Complete sync history
- `sync_state` - Version tracking
- `sync_errors` - Error management

### API Endpoints
- `/api/sync/health` - Health check
- `/api/sync/status` - Quick status
- `/api/sync/dashboard` - Full dashboard
- `/api/sync/audit-log` - Query logs
- `/api/sync/errors` - Error list
- `/api/sync/retry-failed` - Retry errors

---

**Status:** [ ] Not Started  [ ] In Progress  [ ] Completed  [ ] Verified

**Issues:** _________________________________________________

**Resolution:** _____________________________________________
