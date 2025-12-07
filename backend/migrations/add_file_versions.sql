-- Migration: Add File Version Management
-- Date: 2025-12-07
-- Description: Add version tracking to files and create file_versions table

-- Step 1: Add version columns to files table
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(255) NULL;

-- Step 2: Create file_versions table to store version history
CREATE TABLE IF NOT EXISTS file_versions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_id INT NOT NULL,
  version_number INT NOT NULL,
  
  -- File metadata for this version
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100),
  
  -- User who uploaded this version
  uploaded_by VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key to files table
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  
  -- Index for faster queries
  INDEX idx_file_versions (file_id, version_number),
  INDEX idx_uploaded_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Update existing files to have version = 1
UPDATE files SET version = 1 WHERE version IS NULL OR version = 0;

-- Verify migration
SELECT 
  'files' as table_name,
  COUNT(*) as total_files,
  SUM(CASE WHEN version >= 1 THEN 1 ELSE 0 END) as versioned_files
FROM files;

SELECT 
  'file_versions' as table_name,
  COUNT(*) as total_versions
FROM file_versions;
