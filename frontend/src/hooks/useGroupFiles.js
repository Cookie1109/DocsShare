import { useState, useEffect, useCallback, useMemo } from 'react';
import filesService from '../services/filesService';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 KB';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  // Convert to KB first if size is in bytes
  if (size < 1024) {
    return `${size} B`;
  }
  
  // Start from KB
  size = size / 1024;
  unitIndex = 1;
  
  // Keep converting to larger units if >= 1024
  while (size >= 1024 && unitIndex < units.length - 1) {
    size = size / 1024;
    unitIndex++;
  }
  
  // Format with appropriate decimal places
  const formatted = unitIndex === 1 
    ? Math.round(size) // KB: no decimals
    : size.toFixed(1);  // MB, GB, TB: 1 decimal
  
  return `${formatted} ${units[unitIndex]}`;
};

// Custom hook for managing group files
export const useGroupFiles = (selectedGroup) => {
  const [rawGroupFiles, setRawGroupFiles] = useState({}); // Store raw API data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userProfiles, setUserProfiles] = useState({}); // Cache for user profiles

  // Get current user ID
  const getCurrentUserId = () => {
    const auth = getAuth();
    return auth.currentUser?.uid;
  };

  // Transform files with current user profiles - memoized
  const groupFiles = useMemo(() => {
    const result = {};
    
    Object.keys(rawGroupFiles).forEach(groupId => {
      const files = rawGroupFiles[groupId] || [];
      
      result[groupId] = files.map(apiFile => {
        // Get user profile from cache (realtime updated)
        const uploaderProfile = userProfiles[apiFile.uploader.uid];
        
        // Extract tag IDs
        const tagIds = apiFile.tagIds || [];
        
        return {
          id: apiFile.id,
          name: apiFile.name,
          size: formatFileSize(apiFile.size),
          type: apiFile.name.split('.').pop() || 'unknown',
          // Use cached profile if available, otherwise use API data
          uploadedBy: uploaderProfile?.username || apiFile.uploader.name || apiFile.uploader.email.split('@')[0],
          uploaderTag: uploaderProfile?.userTag || apiFile.uploader.tag,
          uploaderAvatar: uploaderProfile?.avatar || apiFile.uploader.avatar,
          uploaderUid: apiFile.uploader.uid,
          uploadedAt: apiFile.createdAt,
          downloads: apiFile.downloadCount || 0,
          views: 0,
          isOwn: apiFile.uploader.uid === getCurrentUserId(),
          tags: tagIds,
          url: apiFile.url,
          versionCount: apiFile.versionCount || 0
        };
      });
    });
    
    return result;
  }, [rawGroupFiles, userProfiles]);

  // Fetch files for a specific group - MUST be defined before useEffect hooks
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
      
      // Force sort by upload time (oldest first, newest last - like chat)
      const sortedFiles = apiFiles.sort((a, b) => {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      
      // Store raw API data
      setRawGroupFiles(prev => ({
        ...prev,
        [groupId]: sortedFiles
      }));
      
      console.log(`✅ Loaded ${apiFiles.length} files for group ${groupId}`);
      
    } catch (err) {
      console.error('❌ Error fetching files:', err);
      console.error('❌ Full error object:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup realtime listeners for user profiles
  useEffect(() => {
    if (!selectedGroup) return;

    const db = getFirestore();
    const files = rawGroupFiles[selectedGroup] || [];
    
    // Get unique uploader UIDs from current files
    const uploaderUids = [...new Set(files.map(f => f.uploader?.uid).filter(Boolean))];
    
    if (uploaderUids.length === 0) return;

    console.log(`👥 Setting up realtime listeners for ${uploaderUids.length} uploaders`);
    
    // Create listeners for each uploader
    const unsubscribers = uploaderUids.map(uid => {
      const userRef = doc(db, 'users', uid);
      
      return onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          
          // Update user profile cache - this will trigger re-render via useMemo
          setUserProfiles(prev => {
            const updated = {
              ...prev,
              [uid]: {
                username: userData.username || `${userData.displayName}#${userData.userTag}`,
                displayName: userData.displayName,
                userTag: userData.userTag,
                avatar: userData.avatar,
                uid: uid
              }
            };
            console.log(`✅ Realtime update: ${uid} -> ${updated[uid].username}`);
            return updated;
          });
        } else {
          console.warn(`⚠️ User ${uid} not found in Firestore`);
        }
      }, (error) => {
        console.error(`❌ Error listening to user ${uid}:`, error);
      });
    });

    // Cleanup listeners on unmount or when group changes
    return () => {
      console.log('🧹 Cleaning up user profile listeners');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [selectedGroup, rawGroupFiles]);

  // Setup Firestore listener for realtime file uploads
  useEffect(() => {
    if (!selectedGroup) return;

    const db = getFirestore();
    // Listen to groups/{groupId}/files collection
    const filesCollectionRef = collection(db, 'groups', selectedGroup, 'files');
    // Order by createdAt which exists in Firestore docs
    const filesQuery = query(filesCollectionRef, orderBy('createdAt', 'asc'));

    console.log(`🔥 Setting up Firestore listener for file uploads in group ${selectedGroup}`);

    const unsubscribe = onSnapshot(filesQuery, 
      (snapshot) => {
        // Skip initial load (already handled by fetchFiles)
        if (snapshot.metadata.hasPendingWrites) {
          console.log('⏳ Pending writes, skipping...');
          return;
        }

        console.log(`📄 Firestore file collection update: ${snapshot.size} files`);
        
        // Check for new files or changes
        const changes = snapshot.docChanges();
        if (changes.length > 0) {
          const hasNewFile = changes.some(change => change.type === 'added');
          const hasRemovedFile = changes.some(change => change.type === 'removed');
          
          if (hasNewFile || hasRemovedFile) {
            // New file added or file removed - fetch full list
            console.log('🆕 File added/removed, refreshing file list...');
            fetchFiles(selectedGroup);
          } else {
            // Only modifications (e.g., downloadCount update) - update specific fields
            changes.forEach(change => {
              if (change.type === 'modified') {
                const firestoreData = change.doc.data();
                const docId = change.doc.id; // Firestore document ID
                
                console.log(`✏️ File ${docId} modified in Firestore:`, firestoreData);
                
                // Update download count and version count in local state without full refetch
                setRawGroupFiles(prev => {
                  const groupFiles = prev[selectedGroup] || [];
                  const updatedFiles = groupFiles.map(file => {
                    // Match by file.id (MySQL ID) === Firestore document ID
                    if (file.id.toString() === docId) {
                      const updates = {};
                      
                      // Update download count if changed
                      if (firestoreData.downloadCount !== undefined) {
                        console.log(`📊 Updating download count for ${file.name}: ${file.downloadCount || 0} → ${firestoreData.downloadCount}`);
                        updates.downloadCount = firestoreData.downloadCount;
                      }
                      
                      // Update version count if changed (when file is updated)
                      if (firestoreData.versionCount !== undefined) {
                        console.log(`🔄 Updating version count for ${file.name}: ${file.versionCount || 0} → ${firestoreData.versionCount}`);
                        updates.versionCount = firestoreData.versionCount;
                      }
                      
                      // Update file info if file was replaced
                      if (firestoreData.name && firestoreData.name !== file.name) {
                        console.log(`📝 Updating file name: ${file.name} → ${firestoreData.name}`);
                        updates.name = firestoreData.name;
                      }
                      
                      if (firestoreData.url && firestoreData.url !== file.url) {
                        console.log(`🔗 Updating file URL`);
                        updates.url = firestoreData.url;
                      }
                      
                      if (firestoreData.size !== undefined && firestoreData.size !== file.size) {
                        console.log(`📦 Updating file size: ${file.size} → ${firestoreData.size}`);
                        updates.size = firestoreData.size;
                      }
                      
                      if (firestoreData.mimeType && firestoreData.mimeType !== file.mimeType) {
                        console.log(`📄 Updating file type: ${file.mimeType} → ${firestoreData.mimeType}`);
                        updates.mimeType = firestoreData.mimeType;
                      }
                      
                      return {
                        ...file,
                        ...updates
                      };
                    }
                    return file;
                  });
                  
                  return {
                    ...prev,
                    [selectedGroup]: updatedFiles
                  };
                });
              }
            });
          }
        }
      },
      (error) => {
        console.error('❌ Error in file listener:', error);
      }
    );

    return () => {
      console.log('🧹 Cleaning up file upload listener');
      unsubscribe();
    };
  }, [selectedGroup, fetchFiles]);

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
  }, [fetchFiles]);

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
        
        // Update local state - remove file from current group's raw data
        if (selectedGroup && rawGroupFiles[selectedGroup]) {
          setRawGroupFiles(prev => ({
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
  }, [selectedGroup, rawGroupFiles]);

  // Real-time listener for files - DISABLED (using API-based approach with realtime user profiles)
  // useEffect(() => {
  //   if (!selectedGroup) {
  //     return;
  //   }
  //   ... Firestore realtime listener code ...
  // }, [selectedGroup]);

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