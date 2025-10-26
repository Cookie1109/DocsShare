import { useState, useEffect, useCallback } from 'react';
import filesService from '../services/filesService';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// Custom hook for managing group files
export const useGroupFiles = (selectedGroup, onTagsNeedReload = null) => {
  const [groupFiles, setGroupFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Transform API data to UI format
  const transformFileData = useCallback((apiFile) => {
    // Extract tag IDs from apiFile
    // Backend returns tagIds array containing the tag IDs
    const tagIds = apiFile.tagIds || [];
    
    return {
      id: apiFile.id,
      name: apiFile.name,
      size: `${(apiFile.size / 1024 / 1024).toFixed(1)} MB`,
      type: apiFile.name.split('.').pop() || 'unknown',
      uploadedBy: apiFile.uploader.name || apiFile.uploader.email.split('@')[0],
      uploadedAt: apiFile.createdAt,
      downloads: apiFile.downloadCount || 0,
      views: 0,
      isOwn: apiFile.uploader.uid === getCurrentUserId(),
      tags: tagIds, // Array of tag IDs (numbers)
      url: apiFile.url
    };
  }, []);

  // Get current user ID
  const getCurrentUserId = () => {
    const auth = getAuth();
    return auth.currentUser?.uid;
  };

  // Fetch files for a specific group
  const fetchFiles = useCallback(async (groupId) => {
    if (!groupId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`📥 Fetching files for group: ${groupId}`);
      
      // Check if user is authenticated
      const auth = getAuth();
      const currentUser = auth.currentUser;
      console.log('🔐 Current user:', currentUser ? currentUser.email : 'Not authenticated');
      
      const apiFiles = await filesService.getGroupFiles(groupId);
      const transformedFiles = apiFiles.map(transformFileData);
      
      // Force sort by upload time (oldest first, newest last - like chat)
      const sortedFiles = transformedFiles.sort((a, b) => {
        return new Date(a.uploadedAt) - new Date(b.uploadedAt);
      });
      

      
      setGroupFiles(prev => ({
        ...prev,
        [groupId]: sortedFiles
      }));
      
      console.log(`✅ Loaded ${transformedFiles.length} files for group ${groupId}`);
      
    } catch (err) {
      console.error('❌ Error fetching files:', err);
      console.error('❌ Full error object:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [transformFileData]);

  // Upload files to current group
  const uploadFiles = useCallback(async (files, groupId, tagIds = []) => {
    if (!files || files.length === 0) return { success: false, message: 'No files selected' };
    
    setLoading(true);
    setError(null);
    
    const results = [];
    
    try {
      // Upload files sequentially to avoid overwhelming the server
      for (const file of files) {
        const result = await filesService.uploadFile(file, groupId, tagIds);
        results.push(result);
      }
      
      // Count successful uploads
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (successCount > 0) {
        // Reload tags first if callback provided
        if (onTagsNeedReload) {
          console.log('🏷️ Reloading tags before files...');
          await onTagsNeedReload();
          // Small delay to ensure tags are ready
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Refresh files for the group
        await fetchFiles(groupId);
        console.log(`✅ Successfully uploaded ${successCount} file(s)`);
        
        // Auto-scroll to bottom after successful upload
        setTimeout(() => {
          // Trigger custom event for scroll
          window.dispatchEvent(new CustomEvent('scrollToBottom'));
        }, 300); // Reduced delay
      }
      
      return {
        success: successCount > 0,
        successCount,
        failCount,
        message: failCount > 0 ? 
          `${successCount} uploaded successfully, ${failCount} failed` :
          `${successCount} file(s) uploaded successfully`
      };
      
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [fetchFiles, onTagsNeedReload]);

  // Auto-fetch files when selectedGroup changes
  useEffect(() => {
    if (selectedGroup) {
      // Add small delay to ensure Firebase auth is ready
      const timer = setTimeout(() => {
        fetchFiles(selectedGroup);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedGroup, fetchFiles]);

  // Get files for current group
  const getCurrentGroupFiles = useCallback(() => {
    return selectedGroup ? groupFiles[selectedGroup] || [] : [];
  }, [selectedGroup, groupFiles]);

  // Delete file
  const deleteFile = useCallback(async (fileId) => {
    if (!fileId) return { success: false, message: 'File ID is required' };
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🗑️ Deleting file: ${fileId}`);
      
      const result = await filesService.deleteFile(fileId);
      
      if (result.success) {
        console.log(`✅ File ${fileId} deleted successfully`);
        
        // Update local state - remove file from current group
        if (selectedGroup && groupFiles[selectedGroup]) {
          setGroupFiles(prev => ({
            ...prev,
            [selectedGroup]: prev[selectedGroup].filter(file => file.id !== parseInt(fileId))
          }));
        }
        
        return {
          success: true,
          message: 'File deleted successfully'
        };
      } else {
        console.error('❌ Delete failed:', result.error);
        setError(result.error);
        return {
          success: false,
          message: result.error
        };
      }
      
    } catch (err) {
      console.error('❌ Delete error:', err);
      setError(err.message);
      return {
        success: false,
        message: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, groupFiles]);

  // Real-time listener for files
  useEffect(() => {
    if (!selectedGroup) {
      setGroupFiles(prev => ({ ...prev, [selectedGroup]: [] }));
      return;
    }

    console.log(`🔥 Setting up real-time listener for group: ${selectedGroup}`);
    setLoading(true);

    const db = getFirestore();
    const filesRef = collection(db, 'groups', selectedGroup.toString(), 'files');
    const q = query(filesRef, orderBy('uploadedAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedFiles = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.id || doc.id,
          name: data.name,
          size: `${(data.size / 1024 / 1024).toFixed(1)} MB`,
          type: data.name.split('.').pop() || 'unknown',
          uploadedBy: data.uploaderName || data.uploaderEmail?.split('@')[0],
          uploadedAt: data.uploadedAt?.toDate?.() || new Date(),
          downloads: data.downloadCount || 0,
          views: 0,
          isOwn: data.uploaderId === getCurrentUserId(),
          tags: data.tagIds || [],
          url: data.url
        };
      });

      console.log(`✅ Real-time: Loaded ${loadedFiles.length} files for group ${selectedGroup}`);
      
      setGroupFiles(prev => ({
        ...prev,
        [selectedGroup]: loadedFiles
      }));
      
      setLoading(false);
    }, (error) => {
      console.error('❌ Real-time listener error:', error);
      setError(error.message);
      setLoading(false);
    });

    return () => {
      console.log(`🔥 Cleaning up real-time listener for group: ${selectedGroup}`);
      unsubscribe();
    };
  }, [selectedGroup]);

  return {
    files: getCurrentGroupFiles(),
    loading,
    error,
    uploadFiles,
    deleteFile,
    refreshFiles: () => fetchFiles(selectedGroup),
    setError
  };
};