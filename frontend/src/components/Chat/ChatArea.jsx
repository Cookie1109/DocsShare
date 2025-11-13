import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  File, 
  Download, 
  Users, 
  Settings, 
  Paperclip,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  Archive,
  MoreVertical,
  Search,
  Bell,
  ChevronDown,
  Plus,
  Send,
  Clock,
  Tag,
  Hash,
  X,
  Crown,
  Trash2,
  Check,
  Square,
  CheckSquare,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAuth } from 'firebase/auth';
import TagSelector from './TagSelector';
import GroupSidebar from './GroupSidebar';
import { useGroupFiles } from '../../hooks/useGroupFiles';
import tagsService from '../../services/tagsService';
import filesService from '../../services/filesService';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const ChatArea = ({ user, onBackClick, isMobileView }) => {
  // Get selectedGroup from AuthContext
  const { selectedGroup, userGroups, groupMembers } = useAuth();
  
  // Get current group object
  const currentGroup = userGroups.find(g => g.id === selectedGroup);
  
  // Chat messages state
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Tag management 
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Load tags function (can be called manually)
  const loadTags = useCallback(async () => {
    if (!selectedGroup) {
      setAvailableTags([]);
      return;
    }

    setLoadingTags(true);
    try {
      const tags = await tagsService.getGroupTags(selectedGroup);
      console.log('📥 Loaded tags from backend:', tags);
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
      setAvailableTags([]);
    } finally {
      setLoadingTags(false);
    }
  }, [selectedGroup]);

  // Use custom hook for file management - pass loadTags callback
  const { files, loading: filesLoading, error: filesError, uploadFiles, deleteFile, refreshFiles, setError } = useGroupFiles(selectedGroup, loadTags);

  // Load tags REAL-TIME (using Firestore listener)
  useEffect(() => {
    if (!selectedGroup) {
      setAvailableTags([]);
      return;
    }

    setLoadingTags(true);
    
    // Initial load from API
    tagsService.getGroupTags(selectedGroup).then(tags => {
      console.log('📥 Initial tags loaded:', tags);
      setAvailableTags(tags);
      setLoadingTags(false);
    }).catch(error => {
      console.error('Error loading initial tags:', error);
      setLoadingTags(false);
    });

    // Setup real-time listener for ALL tags (backend filters by group)
    const db = getFirestore();
    const tagsRef = collection(db, 'tags');
    
    const unsubscribe = onSnapshot(
      tagsRef,
      (snapshot) => {
        console.log('🔄 Tags collection changed, reloading...');
        // Reload tags when any tag changes
        tagsService.getGroupTags(selectedGroup).then(tags => {
          console.log('✅ Tags updated (real-time):', tags);
          setAvailableTags(tags);
        }).catch(error => {
          console.error('Error reloading tags:', error);
        });
      },
      (error) => {
        console.error('❌ Tags listener error:', error);
        console.log('💡 Check Firebase Security Rules - tags collection needs read permission');
      }
    );

    return () => unsubscribe();
  }, [selectedGroup]);

  // Load chat messages (real-time)
  useEffect(() => {
    if (!selectedGroup) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const db = getFirestore();
    const messagesRef = collection(db, 'groups', selectedGroup.toString(), 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      
      console.log('💬 Loaded messages:', loadedMessages.length);
      setMessages(loadedMessages);
      setLoadingMessages(false);
    }, (error) => {
      console.error('Error loading messages:', error);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedGroup]);

  // Auto scroll to bottom when files or messages change
  useEffect(() => {
    if (chatAreaRef.current && !filesLoading && !loadingMessages) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (chatAreaRef.current) {
          chatAreaRef.current.scrollTo({
            top: chatAreaRef.current.scrollHeight,
            behavior: 'instant' // Use instant for initial load
          });
          console.log('📍 Auto-scrolled to bottom');
        }
      }, 100);
    }
  }, [files, messages, filesLoading, loadingMessages, selectedGroup]);

  // UI State
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef(null);
  const chatAreaRef = useRef(null); // Ref cho scroll auto

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);

  // Upload progress state
  const [uploadingFiles, setUploadingFiles] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState({});

  // Search and sidebar state
  const [showGroupSidebar, setShowGroupSidebar] = useState(false);
  const [sidebarMode, setSidebarMode] = useState('none'); // 'none', 'groupInfo'
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);



  // Get documents for current group
  const getCurrentGroupDocuments = () => {
    const docs = files || [];
    
    // Double-check: Ensure files are sorted by upload time (chat order)
    const sortedDocs = [...docs].sort((a, b) => {
      return new Date(a.uploadedAt) - new Date(b.uploadedAt);
    });
    
    return sortedDocs;
  };

  // Merge messages and files, sorted by time
  const getCombinedChatItems = () => {
    const fileItems = (files || []).map(file => ({
      ...file,
      itemType: 'file',
      timestamp: new Date(file.uploadedAt)
    }));

    const messageItems = (messages || []).map(msg => ({
      ...msg,
      itemType: 'message',
      timestamp: msg.createdAt || new Date()
    }));

    // Combine and sort by timestamp
    const combined = [...fileItems, ...messageItems].sort((a, b) => {
      return a.timestamp - b.timestamp;
    });

    return combined;
  };



  // Only scroll to bottom when uploading new files (not when browsing)
  useEffect(() => {
    if (chatAreaRef.current && uploading) {
      // Only scroll when actively uploading to show the new file
      setTimeout(() => {
        if (chatAreaRef.current && uploading) {
          chatAreaRef.current.scrollTo({
            top: chatAreaRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [uploading]); // Only scroll when uploading, not when browsing files

  // Listen for scroll to bottom events
  useEffect(() => {
    const handleScrollToBottom = () => {
      if (chatAreaRef.current) {
        console.log('🔄 Auto-scrolling to bottom...');
        chatAreaRef.current.scrollTo({
          top: chatAreaRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    window.addEventListener('scrollToBottom', handleScrollToBottom);
    return () => window.removeEventListener('scrollToBottom', handleScrollToBottom);
  }, []);

  // Close sidebar on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowGroupSidebar(false);
        setIsSearchFocused(false);
        // Clear search when pressing ESC
        if (document.activeElement && document.activeElement.placeholder === 'Tìm kiếm file...') {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search functionality with priority: name > tag > type
  const handleSearch = (query) => {
    if (!query.trim()) {
      setFilteredDocuments([]);
      return;
    }

    const allDocs = getCurrentGroupDocuments();
    const searchLower = query.toLowerCase();
    
    // Filter and score documents
    const scoredDocs = allDocs.map(doc => {
      let score = 0;
      let matchType = '';
      
      // Priority 1: Name match (highest priority)
      if (doc.name.toLowerCase().includes(searchLower)) {
        score = 100;
        // Bonus if it starts with the search query
        if (doc.name.toLowerCase().startsWith(searchLower)) {
          score = 150;
        }
        matchType = 'name';
      }
      // Priority 2: Tag match
      else if (doc.tags?.some(tagId => {
        const tag = getTagInfo(tagId);
        return tag && tag.name.toLowerCase().includes(searchLower);
      })) {
        score = 50;
        matchType = 'tag';
      }
      // Priority 3: File type match
      else if (doc.type.toLowerCase().includes(searchLower)) {
        score = 30;
        matchType = 'type';
      }
      // Also check uploader name (lower priority than type)
      else if (doc.uploadedBy.toLowerCase().includes(searchLower)) {
        score = 20;
        matchType = 'uploader';
      }
      
      return { ...doc, searchScore: score, matchType };
    })
    .filter(doc => doc.searchScore > 0)
    .sort((a, b) => {
      // Sort by score (descending)
      if (b.searchScore !== a.searchScore) {
        return b.searchScore - a.searchScore;
      }
      // If same score, sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
    
    setFilteredDocuments(scoredDocs);
  };

  // Get tag info by ID
  const getTagInfo = (tagId) => {
    // Handle both string and number tag IDs
    const tag = availableTags.find(tag => tag.id == tagId); // Using == for loose comparison
    if (!tag) {
      console.warn(`⚠️ Tag not found for ID ${tagId} (type: ${typeof tagId}). Available tags:`, availableTags.map(t => ({id: t.id, type: typeof t.id, name: t.name})));
    }
    return tag;
  };

  // Add new tag
  const addNewTag = (tag) => {
    console.log('🆕 Adding new tag to availableTags:', tag);
    
    // Handle tag deletion signal
    if (tag._deleted) {
      setAvailableTags(prev => {
        const updated = prev.filter(t => t.id !== tag.id);
        console.log('🗑️ Tag deleted from availableTags:', tag.id);
        return updated;
      });
      return;
    }
    
    // Normal tag addition
    setAvailableTags(prev => {
      const updated = [...prev, tag];
      console.log('📋 Updated availableTags:', updated);
      return updated;
    });
    return tag.id;
  };

  // Handle file download
  const handleDownloadFile = async (doc) => {
    console.log('🔽 Downloading file:', doc.name);
    
    try {
      // Track download in backend (async - không chờ để không làm chậm download)
      filesService.trackDownload(doc.id).then(result => {
        if (result.success) {
          console.log(`✅ Download tracked: ${doc.name} - Count: ${result.data.downloadCount}`);
          // Update local state để hiển thị số lượt download mới
          refreshFiles();
        } else {
          console.warn('⚠️ Failed to track download:', result.error);
        }
      }).catch(err => {
        console.warn('⚠️ Track download error:', err);
      });

      // Fetch file as blob to bypass CORS download name restriction
      const response = await fetch(doc.url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.name; // This will work with blob URLs
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      console.log('✅ Download completed for:', doc.name);
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      setError('Không thể tải xuống file. Vui lòng thử lại.');
    }
  };

  // Handle navigate to file in chat
  const handleNavigateToFile = (doc) => {
    // Scroll to file in chat
    const fileElement = document.getElementById(`file-${doc.id}`);
    if (fileElement) {
      fileElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      // Add highlight effect
      fileElement.classList.add('ring-2', 'ring-emerald-500', 'ring-opacity-50');
      setTimeout(() => {
        fileElement.classList.remove('ring-2', 'ring-emerald-500', 'ring-opacity-50');
      }, 2000);
    }
    
    // Reset search
    setSearchQuery('');
    setFilteredDocuments([]);
    setIsSearchFocused(false);
  };

  const getFileIcon = (type) => {
    const iconProps = { className: "h-6 w-6" };
    
    switch (type?.toLowerCase()) {
      case 'pdf':
        return <FileText {...iconProps} />;
      case 'doc':
      case 'docx':
        return <FileText {...iconProps} />;
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet {...iconProps} />;
      case 'ppt':
      case 'pptx':
        return <FileImage {...iconProps} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive {...iconProps} />;
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'html':
      case 'css':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'sql':
        return <FileCode {...iconProps} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return <FileImage {...iconProps} />;
      default:
        return <File {...iconProps} />;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.abs(now - date) / 36e5;
    
    if (diffHours < 24) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOver(true);
      // Try multiple methods to bring browser to front and minimize file explorer
      try {
        window.focus();
        document.body.focus();
        // Force browser window to front
        if (window.parent !== window) {
          window.parent.focus();
        }
      } catch (err) {
        console.log('Could not focus window:', err);
      }
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    dragCounterRef.current = 0;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setPendingFiles(files);
      setShowUploadDialog(true);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setPendingFiles(files);
      setShowUploadDialog(true);
    }
    // Reset file input
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) {
      console.log('❌ No files to upload');
      return;
    }

    if (!selectedGroup) {
      console.log('❌ No group selected');
      return;
    }

    setUploading(true);
    
    try {
      // selectedTags is already array of tag IDs (numbers)
      const tagIds = selectedTags;
      
      // Track uploading files
      const fileNames = pendingFiles.map(file => file.name);
      setUploadingFiles(new Set(fileNames));
      
      // Initialize progress for each file
      const initialProgress = {};
      fileNames.forEach(name => {
        initialProgress[name] = 'uploading';
      });
      setUploadProgress(initialProgress);
      
      // Use the hook's upload function
      console.log('🚀 About to upload with tagIds:', tagIds);
      const result = await uploadFiles(pendingFiles, selectedGroup, tagIds);
      
      if (result.success) {
        console.log('✅ Upload successful:', result.message);
        
        // Reload tags FIRST to ensure newly created tags are in the list
        console.log('🔄 Reloading tags after upload...');
        await loadTags();
        
        // Small delay to ensure tags are loaded before files are rendered
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Mark all as completed
        const completedProgress = {};
        fileNames.forEach(name => {
          completedProgress[name] = 'completed';
        });
        setUploadProgress(completedProgress);
        
        // Reset states after a short delay to show completion
        setTimeout(() => {
          setShowUploadDialog(false);
          setPendingFiles([]);
          setSelectedTags([]);
          setUploadingFiles(new Set());
          setUploadProgress({});
        }, 1000);
      } else {
        console.error('❌ Upload failed:', result.message);
        // Mark all as failed
        const failedProgress = {};
        fileNames.forEach(name => {
          failedProgress[name] = 'failed';
        });
        setUploadProgress(failedProgress);
        
        // Reset uploading state
        setUploadingFiles(new Set());
      }
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      setError(error.message);
      setUploadingFiles(new Set());
      setUploadProgress({});
    } finally {
      setUploading(false);
    }
  };

  // Handle delete file
  const handleDeleteFile = (file) => {
    setFileToDelete(file);
    setShowDeleteDialog(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    
    setDeleting(true);
    
    try {
      const result = await deleteFile(fileToDelete.id);
      
      if (result.success) {
        console.log('✅ Delete successful:', result.message);
        setShowDeleteDialog(false);
        setFileToDelete(null);
      } else {
        console.error('❌ Delete failed:', result.message);
        // Keep dialog open on failure
      }
      
    } catch (error) {
      console.error('❌ Delete error:', error);
      setError(error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Multi-select functions
  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      
      // Exit multi-select mode if no files selected
      if (newSet.size === 0) {
        setIsMultiSelectMode(false);
      }
      
      return newSet;
    });
  };

  const enterMultiSelectMode = (fileId) => {
    setIsMultiSelectMode(true);
    setSelectedFiles(new Set([fileId]));
  };

  const exitMultiSelectMode = () => {
    setIsMultiSelectMode(false);
    setSelectedFiles(new Set());
  };



  // Delete multiple files
  const deleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;
    
    setDeletingMultiple(true);
    
    try {
      const fileIds = Array.from(selectedFiles);
      const promises = fileIds.map(fileId => deleteFile(fileId));
      
      const results = await Promise.allSettled(promises);
      
      let successCount = 0;
      let failCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`❌ Failed to delete file ${fileIds[index]}:`, result.reason || result.value?.message);
        }
      });
      
      console.log(`✅ Multi delete completed: ${successCount} success, ${failCount} failed`);
      
      if (failCount > 0) {
        setError(`Deleted ${successCount} files successfully. ${failCount} files failed to delete.`);
      }
      
    } catch (error) {
      console.error('❌ Multi delete error:', error);
      setError(error.message);
    } finally {
      setDeletingMultiple(false);
      exitMultiSelectMode();
    }
  };

  // If no group is selected
  if (!selectedGroup) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center p-8">
          <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-green-800 mb-2">
            Chọn một nhóm để bắt đầu
          </h2>
          <p className="text-green-600">
            Chọn một nhóm từ danh sách bên trái để xem và chia sẻ tài liệu
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-green-50 overflow-hidden relative">
      <div className={`${
        sidebarMode !== 'none' 
          ? 'w-full lg:w-[calc(100%-20rem)] xl:w-[calc(100%-24rem)]' 
          : 'w-full'
      } flex flex-col min-w-0 transition-all duration-300 ease-in-out`}>
      {/* Header - Professional Style */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 shadow-sm flex-shrink-0 relative z-40">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Back button (mobile) + Group Info */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            {/* Back button - Only on mobile (<640px) */}
            {isMobileView && onBackClick && (
              <button
                onClick={onBackClick}
                className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white overflow-hidden flex-shrink-0">
              {currentGroup?.groupPhotoUrl ? (
                <img src={currentGroup.groupPhotoUrl} alt={currentGroup.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-semibold text-xs sm:text-sm">
                  {currentGroup?.name?.charAt(0).toUpperCase() || 'G'}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <h3 className="font-semibold text-gray-800 truncate">
                  {currentGroup?.name || 'Chọn nhóm để bắt đầu'}
                </h3>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {groupMembers?.length || 0} thành viên
                </span>
              </div>
            </div>
          </div>

          {/* Right: Search and Menu */}
          <div className="flex items-center gap-3 relative z-50">
            {/* Search */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="h-4 w-4" />
              </div>
              
              <input
                type="text"
                placeholder="Tìm kiếm file..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  // Delay để cho phép click vào results, sau đó reset search
                  setTimeout(() => {
                    setIsSearchFocused(false);
                    setSearchQuery('');
                    setFilteredDocuments([]);
                  }, 200);
                }}
                className="w-36 sm:w-48 md:w-64 lg:w-96 pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none bg-gray-50 hover:bg-gray-100 focus:bg-white focus:text-gray-800 transition-all placeholder:text-gray-400 text-gray-700"
              />
              
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilteredDocuments([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Search Results Dropdown */}
              {isSearchFocused && searchQuery && (
                <div className="absolute top-full right-0 mt-2 mr-0 sm:mr-0 w-[calc(100vw-4rem)] sm:w-[360px] md:w-[400px] lg:w-[480px] xl:w-[530px] bg-white rounded-xl shadow-2xl border border-emerald-100 z-[9999] max-h-80 overflow-hidden">
                  {filteredDocuments.length > 0 ? (
                    <>
                      <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50">
                        <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          {filteredDocuments.length} kết quả cho "{searchQuery}"
                        </p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {filteredDocuments.map((doc, index) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-all duration-200 border-b border-gray-100 last:border-b-0 group"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                              <div className="text-emerald-600">
                                {getFileIcon(doc.type)}
                              </div>
                            </div>
                            <div 
                              className="flex-1 cursor-pointer hover:bg-emerald-50 rounded-lg p-1 -m-1 transition-colors"
                              onClick={() => handleNavigateToFile(doc)}
                            >
                              <p className="text-sm font-medium text-gray-900 break-words">{doc.name}</p>
                              <p className="text-xs text-gray-500">{doc.uploadedBy} • {doc.size}</p>
                              {/* Show tags if available */}
                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {doc.tags.slice(0, 2).map((tagId) => {
                                    const tag = getTagInfo(tagId);
                                    return tag ? (
                                      <span 
                                        key={tagId}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700"
                                      >
                                        <Hash className="h-2 w-2 mr-0.5" />
                                        {tag.name}
                                      </span>
                                    ) : null;
                                  })}
                                  {doc.tags.length > 2 && (
                                    <span className="text-xs text-gray-400">
                                      +{doc.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Download Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the file click
                                handleDownloadFile(doc);
                              }}
                              className="flex-shrink-0 p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Tải xuống file"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Không tìm thấy file nào</p>
                      <p className="text-xs text-gray-500">Thử tìm kiếm với từ khóa khác</p>
                    </div>
                  )}
                </div>
              )}
            </div>



            {/* Group Settings Toggle - only show if a group is selected */}
            {currentGroup && (
              <button
                onClick={() => setSidebarMode(sidebarMode === 'groupInfo' ? 'none' : 'groupInfo')}
                className={`p-2 rounded-full transition-all duration-200 ${
                  sidebarMode === 'groupInfo' 
                    ? 'text-emerald-600 bg-emerald-100' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
                title="Thông tin nhóm"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages Area - Zalo style - Scrollable */}
      <div 
        ref={chatAreaRef}
        data-chat-area
        className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Files display */}
        {filesError ? (
          // Error state
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <X className="w-12 h-12 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-red-800 mb-2">
                Lỗi tải file
              </h3>
              <p className="text-red-600 mb-4">
                {filesError}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  refreshFiles();
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : getCombinedChatItems().length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="w-24 h-24 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 overflow-hidden shadow-lg">
                {selectedGroup?.avatar ? (
                  <img src={selectedGroup.avatar} alt={selectedGroup.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-2xl">
                    {selectedGroup?.name?.charAt(0).toUpperCase() || 'G'}
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold text-orange-800 mb-3">
                Chào mừng đến với {currentGroup?.name || 'nhóm'}! 🎉
              </h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Nhóm này được tạo vào {currentGroup?.createdAt ? new Date(currentGroup.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : 'hôm nay'}
              </p>
              <div className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-200">
                <p className="text-orange-700 text-sm">
                  🎯 <strong>Vai trò của bạn:</strong> {currentGroup?.userRole === 'admin' ? 'Quản trị viên' : 'Thành viên'}<br/>
                  📚 <strong>Mục tiêu:</strong> Chia sẻ tài liệu học tập và làm việc hiệu quả<br/>
                  �️ <strong>Tính năng:</strong> Gắn tag để phân loại file dễ dàng hơn<br/>
                  �🌱 Bắt đầu chia sẻ file đầu tiên để khởi động cuộc trò chuyện!
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-200 shadow-lg font-medium"
              >
                <Paperclip className="h-5 w-5 mr-2" />
                📎 Chia sẻ file đầu tiên
              </button>
            </div>
          </div>
        ) : (
          /* Combined Chat Items: Messages and Files */
          getCombinedChatItems().map((item) => {
            // System Message (center aligned)
            if (item.itemType === 'message' && (item.type === 'system' || item.isSystemMessage)) {
              return (
                <div key={item.id} className="flex justify-center my-4">
                  <div className="bg-gray-100 px-4 py-2 rounded-full text-sm text-gray-600 flex items-center gap-2 shadow-sm">
                    <Users className="h-4 w-4" />
                    {item.content}
                  </div>
                </div>
              );
            }

            // Regular text message (future feature - for now just skip)
            if (item.itemType === 'message' && item.type !== 'system') {
              // TODO: Implement regular text messages later
              return null;
            }

            // File message (existing code)
            const doc = item;
            // uploadedBy already includes tag from realtime profile update
            const uploaderDisplayName = doc.uploadedBy;
            
            return (
              <div key={doc.id} id={`file-${doc.id}`} className="flex flex-col mb-3 group relative">
                {/* Message with Avatar */}
                <div className={`flex items-end gap-3 ${doc.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                {doc.uploaderAvatar ? (
                  <img 
                    src={doc.uploaderAvatar} 
                    alt={doc.uploadedBy}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {doc.uploadedBy?.charAt(0) || 'U'}
                  </div>
                )}
                
                {/* Message Content */}
                <div className="flex flex-col max-w-[90%] sm:max-w-md md:max-w-lg lg:max-w-xl">
                  {/* Sender name and time */}
                  {!doc.isOwn && (
                    <div className="flex items-center gap-2 mb-1 ml-2">
                      <span className="text-xs font-medium text-gray-700">{uploaderDisplayName}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{formatTime(doc.uploadedAt)}</span>
                    </div>
                  )}
                  
                  {/* File Message Bubble */}
                  <div 
                    className={`rounded-2xl p-3 shadow-md relative ${
                      doc.isOwn 
                        ? 'bg-white text-gray-800 border border-emerald-200' 
                        : 'bg-white text-gray-800 border border-orange-200'
                    } ${selectedFiles.has(doc.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${
                      isMultiSelectMode && doc.isOwn ? 'cursor-pointer hover:bg-blue-50' : ''
                    }`}
                    onClick={(e) => {
                      if (isMultiSelectMode && doc.isOwn) {
                        e.stopPropagation();
                        toggleFileSelection(doc.id);
                      }
                    }}
                  >
                    
                    {/* Multi-select checkbox */}
                    {(isMultiSelectMode || selectedFiles.has(doc.id)) && doc.isOwn && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFileSelection(doc.id);
                        }}
                        className="absolute -top-2 -left-2 p-1 rounded-full bg-white border-2 border-blue-500 text-blue-600 shadow-lg z-10 hover:bg-blue-50 transition-all duration-200"
                        title="Chọn file"
                      >
                        {selectedFiles.has(doc.id) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    
                    {/* Delete button - Discord style (top right corner of bubble) */}
                    {doc.isOwn && !isMultiSelectMode && (
                      <button 
                        onClick={() => handleDeleteFile(doc)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          enterMultiSelectMode(doc.id);
                        }}
                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-full bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white shadow-lg transform hover:scale-110 z-10"
                        title="Xóa file (Right-click = chọn nhiều)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    
                    {/* Chat bubble tail */}
                    <div className={`absolute bottom-2 w-3 h-3 ${
                      doc.isOwn 
                        ? '-right-1 bg-white border-r border-t border-emerald-200 transform rotate-45' 
                        : '-left-1 bg-white border-l border-b border-orange-200 transform rotate-45'
                    }`}></div>
                
                <div className="flex items-center space-x-3">
                  <div className={`flex-shrink-0 ${doc.isOwn ? 'text-emerald-600' : 'text-orange-500'}`}>
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${doc.isOwn ? 'text-gray-800' : 'text-gray-800'}`}>
                      {doc.name}
                    </p>
                    <p className={`text-xs ${doc.isOwn ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {doc.size}
                    </p>
                    
                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {doc.tags.map((tagId) => {
                          const tag = getTagInfo(tagId);
                          return tag ? (
                            <span 
                              key={tagId}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tag.color} text-white shadow-sm hover:shadow-md transition-shadow cursor-default`}
                              title={`Tag: ${tag.name}`}
                            >
                              <Hash className="h-3 w-3 mr-0.5" />
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadFile(doc);
                      }}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        doc.isOwn 
                          ? 'hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800' 
                          : 'hover:bg-orange-100 text-orange-600 hover:text-orange-800'
                      }`}
                      title="Tải xuống"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
                {/* File Stats - Right aligned for own files, with timestamp */}
                <div className={`flex items-center justify-between text-xs mt-2 ${
                  doc.isOwn ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <span className="flex items-center text-gray-500">
                    <Download className="h-3 w-3 mr-1" />
                    {doc.downloads}
                  </span>
                  {doc.isOwn && (
                    <span className="text-gray-400">{formatTime(doc.uploadedAt)}</span>
                  )}
                </div>
                  </div>
                </div>
              </div>
            </div>
            ); // Close file message return
          })
        )}



        {/* Drag overlay - Full screen */}
        {dragOver && (
          <div className="fixed inset-0 bg-emerald-500/90 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-3xl p-12 shadow-2xl border-4 border-emerald-300 animate-bounce">
              <Upload className="h-20 w-20 text-emerald-500 mx-auto mb-6" />
              <p className="text-2xl font-bold text-emerald-800 text-center">Thả file để tải lên</p>
            </div>
          </div>
        )}
      </div>

      {/* Multi-select toolbar */}
      {selectedFiles.size > 0 && (
        <div className="p-3 bg-red-50 border-t border-red-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-red-700">
                {selectedFiles.size} file được chọn
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={exitMultiSelectMode}
                className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={deleteSelectedFiles}
                disabled={deletingMultiple}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
              >
                {deletingMultiple ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Xóa tất cả</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Button - Fixed at bottom */}
      <div className="p-3 sm:p-4 bg-white border-t border-green-100 flex-shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center transition-colors group shadow-lg hover:shadow-xl"
            title="Tải lên file"
          >
            <Paperclip className="h-5 w-5 sm:h-6 sm:w-6 text-white group-hover:scale-110 transition-transform" />
          </button>
          
          <div className="flex-1 bg-gray-100 rounded-full px-3 sm:px-4 py-2 sm:py-2.5 text-gray-500 text-xs sm:text-sm truncate">
            <span className="hidden sm:inline">Kéo thả file hoặc nhấn nút để tải lên...</span>
            <span className="sm:hidden">Nhấn để tải file...</span>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      </div>

      {/* Sidebars */}


      {sidebarMode === 'groupInfo' && currentGroup && (
        <GroupSidebar 
          group={currentGroup}
          onClose={() => setSidebarMode('none')}
        />
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            dragCounterRef.current = 0;
            
            const newFiles = Array.from(e.dataTransfer.files);
            if (newFiles.length > 0) {
              // Add new files to existing pending files
              setPendingFiles(prev => [...prev, ...newFiles]);
              console.log(`✅ Added ${newFiles.length} more files to upload queue`);
            }
          }}
        >
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full h-[95vh] sm:h-[90vh] md:h-[85vh] flex flex-col overflow-hidden relative">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Tải lên file</h3>
                <button 
                  onClick={() => {
                    setShowUploadDialog(false);
                    setPendingFiles([]);
                    setSelectedTags([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              {/* File List */}
              <div className="mb-6 flex-shrink-0">
                <h4 className="text-sm font-medium text-gray-700 mb-3">File được chọn:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {pendingFiles.map((file, index) => {
                    const uploadStatus = uploadProgress[file.name];
                    const isUploading = uploadingFiles.has(file.name);
                    
                    return (
                      <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                        uploadStatus === 'completed' ? 'bg-green-50 border border-green-200' :
                        uploadStatus === 'failed' ? 'bg-red-50 border border-red-200' :
                        isUploading ? 'bg-blue-50 border border-blue-200' :
                        'bg-gray-50'
                      }`}>
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                          {getFileIcon(file.name.split('.').pop())}
                          {isUploading && (
                            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                            </div>
                          )}
                          {uploadStatus === 'completed' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                          {uploadStatus === 'failed' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                              <X className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                            {uploadStatus === 'uploading' && ' • Đang tải lên...'}
                            {uploadStatus === 'completed' && ' • Hoàn thành'}
                            {uploadStatus === 'failed' && ' • Thất bại'}
                          </p>
                        </div>
                        
                        {/* Remove button - only show if not uploading or completed */}
                        {!isUploading && uploadStatus !== 'completed' && (
                          <button
                            onClick={() => {
                              const newFiles = pendingFiles.filter((_, i) => i !== index);
                              setPendingFiles(newFiles);
                              console.log(`🗑️ Removed file: ${file.name}`);
                              
                              // Close dialog if no files left
                              if (newFiles.length === 0) {
                                setShowUploadDialog(false);
                                setSelectedTags([]);
                                console.log('✅ All files removed, closing dialog');
                              }
                            }}
                            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tag Selector with scroll */}
              <div className="flex-1 min-h-[300px]">
                <div className="h-full">
                  <TagSelector
                    availableTags={availableTags}
                    selectedTags={selectedTags}
                    onTagsChange={setSelectedTags}
                    onAddTag={addNewTag}
                    groupId={selectedGroup}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUploadDialog(false);
                    setPendingFiles([]);
                    setSelectedTags([]);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={`flex-1 px-6 py-3 text-white rounded-lg transition-colors font-medium flex items-center justify-center ${
                    uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Đang tải lên...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Tải lên ({pendingFiles.length})
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Drag overlay for adding more files */}
            {dragOver && (
              <div className="absolute inset-0 bg-emerald-500/95 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl sm:rounded-2xl">
                <div className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-emerald-300">
                  <Upload className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                  <p className="text-xl font-bold text-emerald-800 text-center">Thả file để tải lên</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && fileToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Xóa file</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setFileToDelete(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  Bạn có chắc chắn muốn xóa file này không?
                </p>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getFileIcon(fileToDelete.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{fileToDelete.name}</p>
                    <p className="text-xs text-gray-500">{fileToDelete.size}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-800 text-sm">
                  <strong>⚠️ Cảnh báo:</strong> Hành động này không thể hoàn tác. File sẽ bị xóa vĩnh viễn khỏi hệ thống.
                </p>
              </div>

              {/* Quick delete tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-blue-800 text-sm font-medium mb-2">💡 Mẹo sử dụng nhanh:</p>
                <ul className="text-blue-700 text-xs space-y-1">
                  <li>• <strong>Right-click</strong> nút xóa = Chọn nhiều file để xóa cùng lúc</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setFileToDelete(null);
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmDeleteFile}
                  disabled={deleting}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-400 transition-colors font-medium flex items-center justify-center"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Xóa file
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;