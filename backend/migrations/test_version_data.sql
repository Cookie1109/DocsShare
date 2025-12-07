-- Test Data for File Version Management
-- Run this to create sample version history for testing

USE docsshare;

-- Test 1: Insert a version history for file ID 16
INSERT INTO file_versions (file_id, version_number, file_name, storage_path, size_bytes, mime_type, uploaded_by, uploaded_at)
VALUES (
  16,
  1,
  'Dàn ý Báo cáo ?? án.docx',
  'https://res.cloudinary.com/sample/raw/upload/v1/old_version_1.docx',
  15234,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'Gj8TcGPUUSPqgyW1dvnz7bMdUc92',
  DATE_SUB(NOW(), INTERVAL 5 DAY)
);

-- Test 2: Simulate file update to version 2
UPDATE files 
SET version = 2,
    last_updated_at = DATE_SUB(NOW(), INTERVAL 2 DAY),
    last_updated_by = 'Gj8TcGPUUSPqgyW1dvnz7bMdUc92'
WHERE id = 16;

-- Test 3: Add version 2 to history
INSERT INTO file_versions (file_id, version_number, file_name, storage_path, size_bytes, mime_type, uploaded_by, uploaded_at)
VALUES (
  16,
  2,
  'Dàn ý Báo cáo ?? án v2.docx',
  'https://res.cloudinary.com/sample/raw/upload/v1/old_version_2.docx',
  18456,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'Gj8TcGPUUSPqgyW1dvnz7bMdUc92',
  DATE_SUB(NOW(), INTERVAL 2 DAY)
);

-- Test 4: Update to version 3 (current)
UPDATE files 
SET version = 3,
    last_updated_at = NOW(),
    last_updated_by = 'Gj8TcGPUUSPqgyW1dvnz7bMdUc92'
WHERE id = 16;

-- Verify test data
SELECT 'Current file version' AS Test;
SELECT id, name, version, last_updated_at, last_updated_by 
FROM files 
WHERE id = 16;

SELECT 'Version history' AS Test;
SELECT id, file_id, version_number, file_name, uploaded_by, uploaded_at 
FROM file_versions 
WHERE file_id = 16 
ORDER BY version_number DESC;

SELECT 'Test data created successfully!' AS Status;
