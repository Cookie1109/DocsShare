-- =================================================================
-- RESET AUDIT SYSTEM - Drop toàn bộ và tạo lại từ đầu
-- CẢNH BÁO: Mất toàn bộ audit history cũ!
-- Chỉ dùng trong development!
-- =================================================================

-- Drop các views trước (phụ thuộc vào tables)
DROP VIEW IF EXISTS v_failed_syncs;
DROP VIEW IF EXISTS v_sync_statistics;
DROP VIEW IF EXISTS v_recent_audit_logs;

-- Drop các stored procedures
DROP PROCEDURE IF EXISTS update_sync_state;
DROP PROCEDURE IF EXISTS log_audit_event;

-- Drop các tables (theo thứ tự dependency)
DROP TABLE IF EXISTS sync_errors;
DROP TABLE IF EXISTS sync_state;
DROP TABLE IF EXISTS audit_log;

-- Xác nhận drop thành công
SELECT 'All audit system tables/views/procedures dropped successfully!' AS status;
