-- =================================================================
-- SIMPLIFIED AUDIT SYSTEM - For Development
-- Bỏ qua stored procedures phức tạp, chỉ giữ tables cần thiết
-- =================================================================

-- Drop existing
DROP TABLE IF EXISTS sync_errors;
DROP TABLE IF EXISTS sync_state;
DROP TABLE IF EXISTS audit_log;

-- Bảng audit_log - Đơn giản hóa
CREATE TABLE audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_source ENUM('Firebase', 'MySQL') NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(255) NOT NULL,
    action ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    old_value JSON NULL,
    new_value JSON NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(128) NULL COLLATE utf8mb4_unicode_ci,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT NULL,
    idempotence_key VARCHAR(255) NULL UNIQUE,
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng sync_state - Tracking sync version
CREATE TABLE sync_state (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    sync_version INT DEFAULT 1,
    last_sync_hash VARCHAR(255) NULL,
    sync_direction ENUM('Firebase->MySQL', 'MySQL->Firebase', 'Bidirectional') DEFAULT 'Bidirectional',
    UNIQUE KEY unique_entity (entity_type, entity_id),
    INDEX idx_entity_type (entity_type),
    INDEX idx_last_synced (last_synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng sync_errors - Tracking errors
CREATE TABLE sync_errors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NULL,
    failed_data JSON NULL,
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_resolved (resolved),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stored Procedure đơn giản: log_audit_event
DELIMITER //
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
    -- Kiểm tra idempotence key đã tồn tại chưa
    DECLARE v_exists INT DEFAULT 0;
    
    IF p_idempotence_key IS NOT NULL THEN
        SELECT COUNT(*) INTO v_exists FROM audit_log WHERE idempotence_key = p_idempotence_key;
        IF v_exists > 0 THEN
            -- Đã xử lý rồi, skip
            SELECT 'DUPLICATE' as result;
        ELSE
            -- Insert audit log
            INSERT INTO audit_log (
                event_source,
                table_name,
                record_id,
                action,
                old_value,
                new_value,
                user_id,
                success,
                error_message,
                idempotence_key
            ) VALUES (
                p_event_source,
                p_table_name,
                p_record_id,
                p_action,
                p_old_value,
                p_new_value,
                p_user_id,
                p_success,
                p_error_message,
                p_idempotence_key
            );
            SELECT 'SUCCESS' as result;
        END IF;
    ELSE
        -- No idempotence key, direct insert
        INSERT INTO audit_log (
            event_source,
            table_name,
            record_id,
            action,
            old_value,
            new_value,
            user_id,
            success,
            error_message,
            idempotence_key
        ) VALUES (
            p_event_source,
            p_table_name,
            p_record_id,
            p_action,
            p_old_value,
            p_new_value,
            p_user_id,
            p_success,
            p_error_message,
            p_idempotence_key
        );
        SELECT 'SUCCESS' as result;
    END IF;
END//
DELIMITER ;

-- Stored Procedure: update_sync_state
DELIMITER //
CREATE PROCEDURE update_sync_state(
    IN p_entity_type VARCHAR(50),
    IN p_entity_id VARCHAR(255),
    IN p_sync_hash VARCHAR(255),
    IN p_sync_direction VARCHAR(50)
)
BEGIN
    INSERT INTO sync_state (
        entity_type,
        entity_id,
        last_sync_hash,
        sync_direction,
        sync_version
    ) VALUES (
        p_entity_type,
        p_entity_id,
        p_sync_hash,
        p_sync_direction,
        1
    )
    ON DUPLICATE KEY UPDATE
        last_synced_at = CURRENT_TIMESTAMP,
        sync_version = sync_version + 1,
        last_sync_hash = p_sync_hash,
        sync_direction = p_sync_direction;
        
    SELECT 'SUCCESS' as result;
END//
DELIMITER ;

-- Simple View: Recent audit logs
CREATE OR REPLACE VIEW v_recent_audit_logs AS
SELECT 
    al.*,
    u.display_name as user_name,
    u.email as user_email
FROM audit_log al
LEFT JOIN users u ON CAST(al.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci = u.id
ORDER BY al.timestamp DESC
LIMIT 100;

-- View: Sync statistics
CREATE OR REPLACE VIEW v_sync_statistics AS
SELECT 
    entity_type,
    COUNT(*) as total_entities,
    MAX(last_synced_at) as last_sync_time,
    AVG(sync_version) as avg_sync_version
FROM sync_state
GROUP BY entity_type;

-- View: Failed syncs
CREATE OR REPLACE VIEW v_failed_syncs AS
SELECT 
    se.*,
    TIMESTAMPDIFF(MINUTE, se.created_at, NOW()) as minutes_since_error
FROM sync_errors se
WHERE se.resolved = FALSE
ORDER BY se.created_at DESC;

SELECT '✅ Simplified audit system created successfully!' AS status;
