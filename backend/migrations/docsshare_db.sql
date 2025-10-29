-- =================================================================
-- SCHEMA HOÀN CHỈNH CHO DỰ ÁN CHIA SẺ TÀI LIỆU
-- Người tạo: Gemini Expert & Bạn
-- Phiên bản: 1.0 (Bao gồm hệ thống tag cục bộ)
-- =================================================================

-- -----------------------------------------------------------------
-- Bảng `users`: Nguồn dữ liệu chính cho thông tin người dùng.
-- -----------------------------------------------------------------
CREATE TABLE users (
    -- Dùng VARCHAR để lưu UID từ Firebase Authentication, là khóa liên kết chính.
    id VARCHAR(128) PRIMARY KEY,
    
    -- Email là duy nhất và bắt buộc, dùng để định danh và liên lạc.
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Tên hiển thị của người dùng (phần trước dấu #).
    display_name VARCHAR(100) NOT NULL,
    
    -- Tag 4-6 số của người dùng (phần sau dấu #).
    `tag` VARCHAR(10) NOT NULL,
    
    avatar_url VARCHAR(2048),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,

    -- Ràng buộc quan trọng: Đảm bảo không có 2 người dùng nào trùng cả Name và Tag.
    -- Đây là business logic chính cho hệ thống định danh người dùng.
    UNIQUE KEY `unique_name_tag` (`display_name`, `tag`)
);

-- -----------------------------------------------------------------
-- Bảng `groups`: Lưu thông tin chi tiết của các nhóm.
-- -----------------------------------------------------------------
CREATE TABLE `groups` (
    -- Dùng số nguyên tự tăng làm khóa chính để các thao tác join nội bộ hiệu quả hơn.
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_photo_url VARCHAR(2048),
    creator_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc khóa ngoại đến người tạo nhóm.
    -- ON DELETE RESTRICT: Ngăn không cho xóa một user nếu họ đã tạo một nhóm nào đó.
    -- Điều này giúp tránh tình trạng nhóm "mồ côi" không có người tạo.
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `group_members`: Bảng trung gian cho quan hệ Nhiều-Nhiều giữa Users và Groups.
-- -----------------------------------------------------------------
CREATE TABLE group_members (
    group_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    `role` ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Khóa chính phức hợp: Đảm bảo một người dùng chỉ có thể tham gia một nhóm một lần duy nhất.
    PRIMARY KEY (group_id, user_id),
    
    -- ON DELETE CASCADE: Nếu một nhóm bị xóa, tất cả các bản ghi thành viên của nhóm đó sẽ tự động bị xóa theo.
    -- Tương tự, nếu một user bị xóa, họ cũng sẽ tự động rời khỏi tất cả các nhóm.
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `group_mapping`: Ánh xạ giữa Firestore Group IDs và MySQL Group IDs.
-- Cần thiết cho việc tích hợp frontend (sử dụng Firestore) với backend (sử dụng MySQL).
-- -----------------------------------------------------------------
CREATE TABLE group_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    -- Firestore Group ID (chuỗi ký tự)
    firestore_id VARCHAR(128) UNIQUE NOT NULL,
    -- MySQL Group ID (số nguyên)
    mysql_id INT NOT NULL,
    -- Tên nhóm để debug và quản lý
    group_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ràng buộc khóa ngoại đến bảng groups
    FOREIGN KEY (mysql_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Index để tối ưu tìm kiếm theo Firestore ID
    INDEX idx_firestore_id (firestore_id),
    INDEX idx_mysql_id (mysql_id)
);

-- -----------------------------------------------------------------
-- Bảng `files`: Lưu trữ metadata của tất cả các file.
-- -----------------------------------------------------------------
CREATE TABLE files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    -- URL Cloudinary của file được upload.
    storage_path VARCHAR(1024) NOT NULL,
    -- Public ID của file trong Cloudinary để quản lý và xóa.
    cloudinary_public_id VARCHAR(512),
    mime_type VARCHAR(100),
    -- Dùng BIGINT để hỗ trợ các file có dung lượng rất lớn.
    size_bytes BIGINT NOT NULL,
    group_id INT NOT NULL,
    uploader_id VARCHAR(128) NOT NULL,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Nếu một nhóm bị xóa, tất cả file trong đó cũng sẽ bị xóa theo.
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    -- Ngăn không cho xóa user nếu họ đã từng upload file, để giữ lại lịch sử.
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `tags`: Quản lý các tag. Được thiết kế theo mô hình "cục bộ" theo nhóm.
-- -----------------------------------------------------------------
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    -- Cột này xác định tag này thuộc về nhóm nào.
    group_id INT NOT NULL,
    creator_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc UNIQUE phức hợp: Cho phép các nhóm khác nhau có tag trùng tên,
    -- nhưng trong CÙNG một nhóm, mỗi tên tag là duy nhất.
    UNIQUE KEY `unique_tag_in_group` (`name`, `group_id`),

    -- Nếu một nhóm bị xóa, tất cả tag của nhóm đó cũng sẽ bị xóa theo.
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `file_tags`: Bảng trung gian cho quan hệ Nhiều-Nhiều giữa Files và Tags.
-- -----------------------------------------------------------------
CREATE TABLE file_tags (
    file_id INT NOT NULL,
    tag_id INT NOT NULL,
    -- Khóa chính phức hợp: Ngăn một file bị gắn cùng một tag nhiều lần.
    PRIMARY KEY (file_id, tag_id),
    -- Nếu file hoặc tag bị xóa, liên kết này cũng sẽ tự động bị xóa.
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------------------
-- Bảng `activity_logs`: Ghi lại lịch sử hoạt động để kiểm tra và phân tích.
-- -----------------------------------------------------------------
CREATE TABLE activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    action_type ENUM('upload', 'download', 'delete_file', 'create_group', 'join_group', 'create_tag') NOT NULL,
    target_id VARCHAR(255),
    -- Dùng JSON để lưu các thông tin phụ trợ một cách linh hoạt.
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- =================================================================
-- INDEXES: Tối ưu hóa hiệu năng truy vấn.
-- =================================================================
-- Tăng tốc tìm kiếm tất cả các nhóm mà một người dùng tham gia.
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
-- Tăng tốc liệt kê tất cả các file trong một nhóm.
CREATE INDEX idx_files_group_id ON files(group_id);
-- Tăng tốc tìm kiếm tất cả các file mà một người dùng đã upload.
CREATE INDEX idx_files_uploader_id ON files(uploader_id);

-- Xóa cột avatar_url và group_photo_url vì chỉ lưu trong Firebase
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE `groups` DROP COLUMN group_photo_url;

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

-- Xóa hết hình ảnh trong MySQL vì chỉ lưu trong Firebase
UPDATE users SET avatar_url = NULL;
UPDATE `groups` SET group_photo_url = NULL;

-- Đổi column thành VARCHAR ngắn
ALTER TABLE users MODIFY COLUMN avatar_url VARCHAR(255) NULL COMMENT 'Stored in Firebase only';
ALTER TABLE `groups` MODIFY COLUMN group_photo_url VARCHAR(255) NULL COMMENT 'Stored in Firebase only';


-- Migration: Create group_invitations table
-- Date: 2025-10-19

CREATE TABLE IF NOT EXISTS group_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  inviter_id VARCHAR(255) NOT NULL COMMENT 'Firebase UID of person who sent invitation',
  invitee_id VARCHAR(255) NOT NULL COMMENT 'Firebase UID of person being invited',
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  
  -- Prevent duplicate pending invitations
  UNIQUE KEY unique_pending_invitation (group_id, invitee_id, status),
  
  INDEX idx_invitee (invitee_id, status),
  INDEX idx_group (group_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comments
ALTER TABLE group_invitations 
  COMMENT = 'Stores group invitations and their status';


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
END 

DELIMITER ;

-- =================================================================
-- DONE! Run this migration to create audit infrastructure
-- =================================================================

SELECT '✅ Audit log infrastructure created successfully!' as message;
