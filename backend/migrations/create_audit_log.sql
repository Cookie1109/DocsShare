-- =================================================================
-- AUDIT LOG TABLE - Hệ thống theo dõi đầy đủ mọi thay đổi
-- Mục đích: Đảm bảo tính minh bạch và khả năng phục hồi dữ liệu
-- =================================================================

-- Xóa bảng cũ nếu tồn tại (cẩn thận trong production!)
DROP TABLE IF EXISTS audit_log;

-- Tạo bảng audit_log mới với đầy đủ thông tin
CREATE TABLE audit_log (
    -- ID tự tăng cho mỗi event
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Nguồn sự kiện: 'Firebase' hoặc 'MySQL'
    event_source ENUM('Firebase', 'MySQL') NOT NULL,
    
    -- Bảng bị ảnh hưởng
    table_name VARCHAR(100) NOT NULL,
    
    -- ID của record bị thay đổi (có thể là số hoặc chuỗi)
    record_id VARCHAR(255) NOT NULL,
    
    -- Loại hành động
    action ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    
    -- Giá trị trước khi thay đổi (JSON)
    old_value JSON NULL,
    
    -- Giá trị sau khi thay đổi (JSON)
    new_value JSON NULL,
    
    -- Thời gian xảy ra sự kiện
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- User thực hiện (Firebase UID)
    user_id VARCHAR(128) NULL,
    
    -- Trạng thái đồng bộ
    success BOOLEAN DEFAULT TRUE,
    
    -- Thông báo lỗi nếu có
    error_message TEXT NULL,
    
    -- Sync status để tránh duplicate
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'synced',
    
    -- Idempotence key để tránh duplicate khi retry
    idempotence_key VARCHAR(255) NULL UNIQUE,
    
    -- Conflict resolution info
    conflict_resolved BOOLEAN DEFAULT FALSE,
    conflict_strategy VARCHAR(50) NULL,
    
    -- Indexes để tối ưu query
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_event_source (event_source),
    INDEX idx_user_id (user_id),
    INDEX idx_sync_status (sync_status),
    INDEX idx_idempotence_key (idempotence_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- SYNC STATE TABLE - Theo dõi trạng thái đồng bộ
-- =================================================================

CREATE TABLE IF NOT EXISTS sync_state (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Loại entity: 'users', 'groups', 'files', etc.
    entity_type VARCHAR(50) NOT NULL,
    
    -- ID của entity
    entity_id VARCHAR(255) NOT NULL,
    
    -- Version/timestamp để conflict resolution
    mysql_version TIMESTAMP NULL,
    firebase_version TIMESTAMP NULL,
    
    -- Last sync time
    last_synced_at TIMESTAMP NULL,
    
    -- Sync direction của lần cuối
    last_sync_direction ENUM('MySQL->Firebase', 'Firebase->MySQL', 'Both') NULL,
    
    -- Hash của data để detect changes
    data_hash VARCHAR(64) NULL,
    
    UNIQUE KEY unique_entity (entity_type, entity_id),
    INDEX idx_entity_type (entity_type),
    INDEX idx_last_synced (last_synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- SYNC ERRORS TABLE - Log các lỗi đồng bộ để xử lý
-- =================================================================

CREATE TABLE IF NOT EXISTS sync_errors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT NULL,
    
    -- Dữ liệu gây lỗi
    failed_data JSON NULL,
    
    -- Số lần retry
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    -- Trạng thái
    status ENUM('pending', 'retrying', 'resolved', 'ignored') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    
    INDEX idx_status (status),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =================================================================
-- Insert initial sync state for existing records
-- =================================================================

-- Sync state cho users
INSERT INTO sync_state (entity_type, entity_id, mysql_version, last_synced_at, data_hash)
SELECT 
    'users' as entity_type,
    id as entity_id,
    created_at as mysql_version,
    NOW() as last_synced_at,
    MD5(CONCAT(id, email, display_name, tag)) as data_hash
FROM users;

-- Sync state cho groups
INSERT INTO sync_state (entity_type, entity_id, mysql_version, last_synced_at, data_hash)
SELECT 
    'groups' as entity_type,
    id as entity_id,
    created_at as mysql_version,
    NOW() as last_synced_at,
    MD5(CONCAT(id, name, IFNULL(description, ''))) as data_hash
FROM `groups`;

-- Sync state cho files
INSERT INTO sync_state (entity_type, entity_id, mysql_version, last_synced_at, data_hash)
SELECT 
    'files' as entity_type,
    id as entity_id,
    created_at as mysql_version,
    NOW() as last_synced_at,
    MD5(CONCAT(id, name, storage_path)) as data_hash
FROM files;

-- =================================================================
-- Views để monitoring dễ dàng
-- =================================================================

-- View: Recent audit logs
CREATE OR REPLACE VIEW v_recent_audit_logs AS
SELECT 
    al.*,
    u.display_name as user_name,
    u.email as user_email
FROM audit_log al
LEFT JOIN users u ON al.user_id COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
ORDER BY al.timestamp DESC
LIMIT 100;

-- View: Sync statistics
CREATE OR REPLACE VIEW v_sync_statistics AS
SELECT 
    table_name,
    action,
    event_source,
    success,
    COUNT(*) as count,
    DATE(timestamp) as date
FROM audit_log
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY table_name, action, event_source, success, DATE(timestamp)
ORDER BY date DESC, count DESC;

-- View: Failed syncs requiring attention
CREATE OR REPLACE VIEW v_failed_syncs AS
SELECT 
    al.*,
    se.retry_count,
    se.status as error_status
FROM audit_log al
LEFT JOIN sync_errors se ON al.table_name = se.entity_type AND al.record_id = se.entity_id
WHERE al.success = FALSE
ORDER BY al.timestamp DESC;

-- =================================================================
-- Stored procedures để đơn giản hóa operations
-- =================================================================

DELIMITER //

-- Log audit event
CREATE PROCEDURE log_audit_event(
    IN p_event_source VARCHAR(20),
    IN p_table_name VARCHAR(100),
    IN p_record_id VARCHAR(255),
    IN p_action VARCHAR(10),
    IN p_old_value JSON,
    IN p_new_value JSON,
    IN p_user_id VARCHAR(128),
    IN p_success BOOLEAN,
    IN p_error_message TEXT,
    IN p_idempotence_key VARCHAR(255)
)
BEGIN
    -- Check if idempotence key already exists
    IF p_idempotence_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM audit_log WHERE idempotence_key = p_idempotence_key) THEN
            -- Already processed, skip
            SELECT 'DUPLICATE' as status;
            LEAVE;
        END IF;
    END IF;
    
    INSERT INTO audit_log (
        event_source, table_name, record_id, action,
        old_value, new_value, user_id, success, error_message, idempotence_key
    ) VALUES (
        p_event_source, p_table_name, p_record_id, p_action,
        p_old_value, p_new_value, p_user_id, p_success, p_error_message, p_idempotence_key
    );
    
    SELECT 'SUCCESS' as status, LAST_INSERT_ID() as audit_id;
END //

-- Update sync state
CREATE PROCEDURE update_sync_state(
    IN p_entity_type VARCHAR(50),
    IN p_entity_id VARCHAR(255),
    IN p_data_hash VARCHAR(64),
    IN p_sync_direction VARCHAR(30)
)
BEGIN
    INSERT INTO sync_state (
        entity_type, entity_id, mysql_version, firebase_version,
        last_synced_at, last_sync_direction, data_hash
    ) VALUES (
        p_entity_type, p_entity_id, NOW(), NOW(),
        NOW(), p_sync_direction, p_data_hash
    )
    ON DUPLICATE KEY UPDATE
        mysql_version = IF(p_sync_direction LIKE 'MySQL%', NOW(), mysql_version),
        firebase_version = IF(p_sync_direction LIKE 'Firebase%', NOW(), firebase_version),
        last_synced_at = NOW(),
        last_sync_direction = p_sync_direction,
        data_hash = p_data_hash;
END //

DELIMITER ;

-- =================================================================
-- DONE! Run this migration to create audit infrastructure
-- =================================================================

SELECT '✅ Audit log infrastructure created successfully!' as message;
