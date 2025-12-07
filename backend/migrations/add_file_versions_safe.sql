-- Migration: Add File Version Management (Safe Version)
-- Date: 2025-12-07
-- Description: Add version tracking to files and create file_versions table
-- Uses PROCEDURE to check column existence before adding

USE docsshare;

-- Drop procedure if exists
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- Create procedure to safely add columns
DELIMITER $$
CREATE PROCEDURE AddColumnIfNotExists()
BEGIN
    -- Check and add version column
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'docsshare' 
        AND TABLE_NAME = 'files' 
        AND COLUMN_NAME = 'version'
    ) THEN
        ALTER TABLE files ADD COLUMN version INT DEFAULT 1;
    END IF;
    
    -- Check and add last_updated_at column
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'docsshare' 
        AND TABLE_NAME = 'files' 
        AND COLUMN_NAME = 'last_updated_at'
    ) THEN
        ALTER TABLE files ADD COLUMN last_updated_at TIMESTAMP NULL;
    END IF;
    
    -- Check and add last_updated_by column (VARCHAR(128) to match uploader_id)
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'docsshare' 
        AND TABLE_NAME = 'files' 
        AND COLUMN_NAME = 'last_updated_by'
    ) THEN
        ALTER TABLE files ADD COLUMN last_updated_by VARCHAR(128) NULL;
    END IF;
END$$
DELIMITER ;

-- Call procedure to add columns
CALL AddColumnIfNotExists();

-- Drop procedure after use
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- Create file_versions table
CREATE TABLE IF NOT EXISTS file_versions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_id INT NOT NULL,
  version_number INT NOT NULL,
  
  -- File metadata for this version
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Track who uploaded this version
  uploaded_by VARCHAR(128) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for better performance
  INDEX idx_file_version (file_id, version_number),
  INDEX idx_uploaded_at (uploaded_at),
  
  -- Foreign key to files table (cascade delete when file is deleted)
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  
  -- Unique constraint: one version number per file
  UNIQUE KEY unique_file_version (file_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Success message
SELECT 'Migration completed successfully!' AS Status;
