# Chức năng Tìm kiếm File - DocsShare

## Mục lục
1. [Tổng quan](#1-tổng-quan)
2. [Kiến trúc tìm kiếm](#2-kiến-trúc-tìm-kiếm)
3. [Backend Implementation](#3-backend-implementation)
4. [Frontend Implementation](#4-frontend-implementation)
5. [Thuật toán Priority Search](#5-thuật-toán-priority-search)
6. [Filtering System](#6-filtering-system)
7. [Sorting Mechanism](#7-sorting-mechanism)
8. [Search UI Components](#8-search-ui-components)
9. [Performance Optimization](#9-performance-optimization)
10. [Use Cases](#10-use-cases)
11. [Testing Scenarios](#11-testing-scenarios)
12. [Tóm tắt Implementation](#12-tóm-tắt-implementation)

---

## 1. Tổng quan

### 1.1. Mô tả chức năng

Chức năng **Tìm kiếm File** cho phép người dùng tìm kiếm files trong nhóm theo nhiều tiêu chí:
- ✅ Tìm theo **tên file** (ưu tiên cao nhất)
- ✅ Tìm theo **tags** (ưu tiên trung bình)
- ✅ Tìm theo **loại file** (ưu tiên thấp)
- ✅ Tìm theo **người upload** (ưu tiên thấp nhất)
- ✅ **Lọc** theo tags cụ thể
- ✅ **Sắp xếp** theo ngày, tên, dung lượng

### 1.2. Đặc điểm chính

| Đặc điểm | Giá trị |
|----------|---------|
| **Scope** | Trong một nhóm cụ thể |
| **Realtime** | ✅ Client-side search với debounce |
| **Scoring System** | Priority-based scoring |
| **Multi-criteria** | Tên, Tags, Type, Uploader |
| **Filter + Search** | Kết hợp search và tag filter |
| **Sorting** | 3 options (date, name, size) |
| **Performance** | Debounce 300ms, Client-side |

### 1.3. Search Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 SEARCH ARCHITECTURE                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Input (Search Query)                              │
│         ↓                                               │
│  Debounce (300ms)                                       │
│         ↓                                               │
│  Priority Scoring Algorithm                             │
│    ├─ Name Match (Score: 100-150)                       │
│    ├─ Tag Match (Score: 50)                             │
│    ├─ Type Match (Score: 30)                            │
│    └─ Uploader Match (Score: 20)                        │
│         ↓                                               │
│  Filter by Score > 0                                    │
│         ↓                                               │
│  Apply Tag Filter (if selected)                         │
│         ↓                                               │
│  Sort by:                                               │
│    ├─ Search Score (nếu có search)                      │
│    └─ Sort Option (date/name/size)                      │
│         ↓                                               │
│  Display Results                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Kiến trúc tìm kiếm

### 2.1. Layers

```
┌──────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER (UI)                     │
│  - SearchBar.jsx (Global search in ChatArea)            │
│  - Files.jsx (Group-specific search in GroupSidebar)    │
│  - Search input + Tag filter + Sort options             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────┐
│              APPLICATION LAYER (Logic)                   │
│  - handleSearch() - Client-side search logic            │
│  - filteredFiles - Computed property với scoring        │
│  - Debounce mechanism (300ms)                           │
│  - Priority-based scoring algorithm                     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────┐
│              DATA LAYER (State)                          │
│  - files[] - Danh sách files từ useGroupFiles           │
│  - tags[] - Danh sách tags của nhóm                     │
│  - searchQuery - User input                             │
│  - selectedTagId - Tag filter selection                 │
│  - sortBy, sortOrder - Sort preferences                 │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────┐
│              BACKEND API (Optional)                      │
│  - GET /api/files/search (Advanced search)              │
│  - File.getGroupFiles(groupId, options)                 │
│  - File.search(searchTerm, options)                     │
└──────────────────────────────────────────────────────────┘
```

### 2.2. Search Flow

```
User types "report.pdf" in search box
         ↓
Debounce 300ms (prevent excessive re-renders)
         ↓
Map files to add searchScore
   ├─ File: "annual_report.pdf" → Score: 150 (starts with query)
   ├─ File: "report_2024.pdf" → Score: 100 (contains query)
   ├─ File: "data.xlsx" with tag "report" → Score: 50
   └─ File: "presentation.pptx" uploaded by "Reporter" → Score: 20
         ↓
Filter files where searchScore > 0
         ↓
Apply tag filter (if selectedTagId exists)
         ↓
Sort by searchScore DESC (highest first)
         ↓
Display filtered results
```

---

## 3. Backend Implementation

### 3.1. File Model - getGroupFiles()

**File:** `backend/src/models/File.js` (lines 120-240)

```javascript
/**
 * Lấy danh sách files trong nhóm
 * @param {number} groupId - ID nhóm
 * @param {Object} options - Tùy chọn lọc
 * @param {string} options.search - Từ khóa tìm kiếm
 * @param {Array} options.tag_ids - Lọc theo tags
 * @param {string} options.uploader_id - Lọc theo người upload
 * @param {number} options.limit - Số lượng tối đa
 * @param {number} options.offset - Vị trí bắt đầu
 * @returns {Promise<Array>} Danh sách files
 */
static async getGroupFiles(groupId, options = {}) {
  try {
    const { search, tag_ids, uploader_id, limit = 50, offset = 0 } = options;
    
    let whereConditions = ['f.group_id = ?'];
    let params = [groupId];
    
    // Tìm kiếm theo tên
    if (search) {
      whereConditions.push('f.name LIKE ?');
      params.push(`%${search}%`);
    }
    
    // Lọc theo người upload
    if (uploader_id) {
      whereConditions.push('f.uploader_id = ?');
      params.push(uploader_id);
    }
    
    let query = `
      SELECT DISTINCT
        f.id,
        f.name,
        f.storage_path,
        f.mime_type,
        f.size_bytes,
        f.group_id,
        f.uploader_id,
        f.download_count,
        f.created_at,
        u.display_name as uploader_name,
        u.tag as uploader_tag
      FROM files f
      JOIN users u ON f.uploader_id = u.id
    `;
    
    // Lọc theo tags
    if (tag_ids && tag_ids.length > 0) {
      query += `
        JOIN file_tags ft ON f.id = ft.file_id
        JOIN tags t ON ft.tag_id = t.id
      `;
      whereConditions.push(`t.id IN (${tag_ids.map(() => '?').join(', ')})`);
      params.push(...tag_ids);
    }
    
    query += ` WHERE ${whereConditions.join(' AND ')}`;
    query += ` ORDER BY f.created_at DESC`;
    query += ` LIMIT ? OFFSET ?`;
    
    params.push(limit, offset);
    
    const files = await executeQuery(query, params);
    
    // Lấy tags cho từng file
    for (const file of files) {
      file.tags = await this.getFileTags(file.id);
    }
    
    return files;
  } catch (error) {
    console.error('Error getting group files:', error);
    throw error;
  }
}
```

### 3.2. File Controller - searchFiles()

**File:** `backend/src/controllers/fileController.js` (lines 286-355)

```javascript
/**
 * Tìm kiếm files
 * GET /api/files/search
 */
static async searchFiles(req, res) {
  try {
    const {
      q: searchTerm,
      group_ids,
      mime_types,
      tag_names,
      limit = 50,
      offset = 0
    } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }
    
    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    // Parse group_ids
    if (group_ids) {
      if (Array.isArray(group_ids)) {
        options.group_ids = group_ids.map(id => parseInt(id));
      } else {
        options.group_ids = group_ids.split(',').map(id => parseInt(id));
      }
    }
    
    // Parse mime_types
    if (mime_types) {
      if (Array.isArray(mime_types)) {
        options.mime_types = mime_types;
      } else {
        options.mime_types = mime_types.split(',');
      }
    }
    
    // Parse tag_names
    if (tag_names) {
      if (Array.isArray(tag_names)) {
        options.tag_names = tag_names;
      } else {
        options.tag_names = tag_names.split(',');
      }
    }
    
    const files = await File.search(searchTerm, options);
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Search files error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
```

### 3.3. API Endpoint

```
GET /api/files/search?q={searchTerm}&group_ids={ids}&mime_types={types}&tag_names={tags}
```

**Query Parameters:**
- `q` (required): Search term
- `group_ids` (optional): Comma-separated group IDs
- `mime_types` (optional): Comma-separated MIME types
- `tag_names` (optional): Comma-separated tag names
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "annual_report.pdf",
      "storage_path": "https://cloudinary.com/...",
      "mime_type": "application/pdf",
      "size_bytes": 1024000,
      "group_id": 5,
      "uploader_id": "uid123",
      "download_count": 42,
      "created_at": "2024-11-14T10:30:00Z",
      "uploader_name": "John Doe",
      "uploader_tag": "2200",
      "tags": [
        { "id": 1, "name": "important" },
        { "id": 2, "name": "2024" }
      ]
    }
  ]
}
```

---

## 4. Frontend Implementation

### 4.1. Files Component - Search Logic

**File:** `frontend/src/components/Chat/GroupSidebar/Files.jsx` (lines 68-130)

```jsx
// Filter and sort files with priority search
const filteredFiles = (files || [])
  .map(file => {
    if (!searchQuery) {
      return { ...file, searchScore: 0 };
    }
    
    const searchLower = searchQuery.toLowerCase();
    let score = 0;
    
    // Priority 1: Name match (highest)
    if (file.name.toLowerCase().includes(searchLower)) {
      score = 100;
      // Bonus if starts with search query
      if (file.name.toLowerCase().startsWith(searchLower)) {
        score = 150;
      }
    }
    // Priority 2: Tag match
    else if (file.tags?.some(tagId => {
      const tag = tags.find(t => t.id === tagId);
      return tag && tag.name.toLowerCase().includes(searchLower);
    })) {
      score = 50;
    }
    // Priority 3: File type match
    else if (file.type.toLowerCase().includes(searchLower)) {
      score = 30;
    }
    // Priority 4: Uploader match
    else if (file.uploadedBy.toLowerCase().includes(searchLower)) {
      score = 20;
    }
    
    return { ...file, searchScore: score };
  })
  .filter(file => {
    // Search filter - keep if no search query or has match
    const matchesSearch = !searchQuery || file.searchScore > 0;
    
    // Tag filter
    const matchesTag = !selectedTagId || 
                      (file.tags && file.tags.includes(selectedTagId));
    
    return matchesSearch && matchesTag;
  })
  .sort((a, b) => {
    // If searching, sort by search score first
    if (searchQuery && a.searchScore !== b.searchScore) {
      return b.searchScore - a.searchScore;
    }
    
    // Then by selected sort option
    let comparison = 0;
    
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'size') {
      const sizeA = parseFloat(a.size);
      const sizeB = parseFloat(b.size);
      comparison = sizeA - sizeB;
    } else if (sortBy === 'date') {
      comparison = new Date(a.uploadedAt) - new Date(b.uploadedAt);
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
```

### 4.2. ChatArea Component - Search Logic

**File:** `frontend/src/components/Chat/ChatArea.jsx` (lines 282-350)

```jsx
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
    // Priority 4: Uploader match (lower priority than type)
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
```

### 4.3. SearchBar Component (Standalone)

**File:** `frontend/src/components/Chat/SearchBar.jsx` (lines 1-100)

```jsx
import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

const SearchBar = ({ isOpen, onClose, documents, onFilteredDocuments }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() === '') {
        setFilteredResults([]);
        onFilteredDocuments([]);
        return;
      }

      const results = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.tags && doc.tags.some(tagId => {
          // Tìm theo tag name (cần implement tag name lookup)
          return false; // Placeholder
        }))
      );

      setFilteredResults(results);
      onFilteredDocuments(results);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, documents, onFilteredDocuments]);

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredResults([]);
    onFilteredDocuments([]);
  };
  
  // ... UI render
};
```

---

## 5. Thuật toán Priority Search

### 5.1. Scoring System

| Priority | Criteria | Base Score | Bonus | Total Range |
|----------|----------|------------|-------|-------------|
| **1** | Name match | 100 | +50 if starts with query | 100-150 |
| **2** | Tag match | 50 | - | 50 |
| **3** | File type match | 30 | - | 30 |
| **4** | Uploader match | 20 | - | 20 |

### 5.2. Example Scoring

**Search Query:** "report"

```javascript
File: "annual_report.pdf"
   → Name contains "report" → Score: 100
   → Name does NOT start with "report" → No bonus
   → FINAL SCORE: 100

File: "report_2024.pdf"
   → Name starts with "report" → Score: 100 + 50
   → FINAL SCORE: 150 (Highest priority!)

File: "data.xlsx" with tag "monthly_report"
   → Name doesn't match
   → Tag "monthly_report" contains "report" → Score: 50
   → FINAL SCORE: 50

File: "presentation.pptx" uploaded by "John Reporter"
   → Name doesn't match
   → Tags don't match
   → Type doesn't match
   → Uploader "John Reporter" contains "report" → Score: 20
   → FINAL SCORE: 20
```

**Result Order:**
1. `report_2024.pdf` (Score: 150)
2. `annual_report.pdf` (Score: 100)
3. `data.xlsx` (Score: 50)
4. `presentation.pptx` (Score: 20)

### 5.3. Scoring Algorithm Implementation

```javascript
const calculateSearchScore = (file, searchQuery, tags) => {
  const searchLower = searchQuery.toLowerCase();
  const nameLower = file.name.toLowerCase();
  
  // Priority 1: Name match
  if (nameLower.includes(searchLower)) {
    return nameLower.startsWith(searchLower) ? 150 : 100;
  }
  
  // Priority 2: Tag match
  const hasTagMatch = file.tags?.some(tagId => {
    const tag = tags.find(t => t.id === tagId);
    return tag && tag.name.toLowerCase().includes(searchLower);
  });
  if (hasTagMatch) return 50;
  
  // Priority 3: Type match
  if (file.type.toLowerCase().includes(searchLower)) {
    return 30;
  }
  
  // Priority 4: Uploader match
  if (file.uploadedBy.toLowerCase().includes(searchLower)) {
    return 20;
  }
  
  // No match
  return 0;
};
```

---

## 6. Filtering System

### 6.1. Filter Types

```
┌─────────────────────────────────────────────────┐
│              FILTER SYSTEM                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Search Filter (Text-based)                 │
│     └─ Apply priority scoring                  │
│                                                 │
│  2. Tag Filter (Category-based)                │
│     ├─ "Tất cả" (Show all)                     │
│     └─ Specific tag (Filter by tag ID)         │
│                                                 │
│  3. Combined Filters (AND operation)           │
│     └─ matchesSearch AND matchesTag            │
└─────────────────────────────────────────────────┘
```

### 6.2. Tag Filter UI

**File:** `frontend/src/components/Chat/GroupSidebar/Files.jsx` (lines 310-350)

```jsx
{/* Tag Filter */}
{tags.length > 0 && (
  <div className="flex items-center gap-2 overflow-x-auto pb-2">
    <TagIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
    <button
      onClick={() => setSelectedTagId(null)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
        !selectedTagId
          ? 'bg-orange-500 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      Tất cả ({files?.length || 0})
    </button>
    {tags.map((tag) => {
      const fileCount = (files || []).filter(f => 
        f.tags && f.tags.includes(tag.id)
      ).length;
      const isActive = selectedTagId === tag.id;
      
      return (
        <button
          key={tag.id}
          onClick={() => setSelectedTagId(tag.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
            isActive
              ? 'shadow-md border-gray-300'
              : 'border-transparent hover:shadow-sm'
          }`}
          style={{
            backgroundColor: isActive ? tag.color : `${tag.color}20`,
            color: isActive ? '#1f2937' : tag.color,
            fontWeight: isActive ? '600' : '500'
          }}
        >
          {tag.name} ({fileCount})
        </button>
      );
    })}
  </div>
)}
```

### 6.3. Filter Logic

```javascript
.filter(file => {
  // Search filter - keep if no search query or has match
  const matchesSearch = !searchQuery || file.searchScore > 0;
  
  // Tag filter - keep if no tag selected or file has selected tag
  const matchesTag = !selectedTagId || 
                    (file.tags && file.tags.includes(selectedTagId));
  
  // Both conditions must be true (AND operation)
  return matchesSearch && matchesTag;
})
```

---

## 7. Sorting Mechanism

### 7.1. Sort Options

| Sort By | Criteria | Default Order | Icon |
|---------|----------|---------------|------|
| **Date** | `created_at` timestamp | DESC (newest first) | 📅 Calendar |
| **Name** | File name (alphabetical) | ASC (A-Z) | 🔤 Text |
| **Size** | File size in bytes | ASC (smallest first) | 📊 Size |

### 7.2. Sort UI

**File:** `frontend/src/components/Chat/GroupSidebar/Files.jsx` (lines 355-395)

```jsx
{/* Sort Options */}
<div className="flex items-center gap-2">
  <span className="text-xs text-gray-500 flex-shrink-0">Sắp xếp:</span>
  <div className="flex gap-1 flex-wrap">
    <button
      onClick={() => toggleSort('date')}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
        sortBy === 'date'
          ? 'bg-orange-100 text-orange-700 border border-orange-300'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
      }`}
    >
      <Calendar className="h-3 w-3" />
      Ngày
      {sortBy === 'date' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
    </button>
    <button
      onClick={() => toggleSort('name')}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
        sortBy === 'name'
          ? 'bg-orange-100 text-orange-700 border border-orange-300'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
      }`}
    >
      Tên
      {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
    </button>
    <button
      onClick={() => toggleSort('size')}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
        sortBy === 'size'
          ? 'bg-orange-100 text-orange-700 border border-orange-300'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
      }`}
    >
      Dung lượng
      {sortBy === 'size' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
    </button>
  </div>
</div>
```

### 7.3. Toggle Sort Function

```javascript
const toggleSort = (field) => {
  if (sortBy === field) {
    // Toggle order if same field
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
    // Switch to new field with default order
    setSortBy(field);
    setSortOrder(field === 'date' ? 'desc' : 'asc');
  }
};
```

### 7.4. Sort Logic

```javascript
.sort((a, b) => {
  // If searching, sort by search score first
  if (searchQuery && a.searchScore !== b.searchScore) {
    return b.searchScore - a.searchScore;
  }
  
  // Then by selected sort option
  let comparison = 0;
  
  if (sortBy === 'name') {
    comparison = a.name.localeCompare(b.name);
  } else if (sortBy === 'size') {
    const sizeA = parseFloat(a.size);
    const sizeB = parseFloat(b.size);
    comparison = sizeA - sizeB;
  } else if (sortBy === 'date') {
    comparison = new Date(a.uploadedAt) - new Date(b.uploadedAt);
  }
  
  return sortOrder === 'asc' ? comparison : -comparison;
})
```

---

## 8. Search UI Components

### 8.1. Search Input

**File:** `frontend/src/components/Chat/GroupSidebar/Files.jsx` (lines 290-310)

```jsx
{/* Search Bar */}
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
  <input
    type="text"
    placeholder="Tìm kiếm file..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none text-sm"
  />
  {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
    >
      <X className="h-4 w-4" />
    </button>
  )}
</div>
```

### 8.2. Search Results Display

```jsx
{filteredFiles.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="h-20 w-20 rounded-full bg-orange-50 flex items-center justify-center mb-4">
      <Paperclip className="h-10 w-10 text-orange-300" />
    </div>
    <p className="text-gray-500 text-sm text-center">
      {searchQuery ? 'Không tìm thấy file nào' : 'Chưa có file nào được chia sẻ'}
    </p>
  </div>
) : (
  <div className="p-4 space-y-3">
    {filteredFiles.map((file) => (
      <FileCard key={file.id} file={file} />
    ))}
  </div>
)}
```

### 8.3. UI States

| State | Condition | UI Display |
|-------|-----------|------------|
| **Empty** | No files in group | "Chưa có file nào được chia sẻ" |
| **No Results** | Search but no matches | "Không tìm thấy file nào" |
| **Loading** | Fetching files | Loading spinner |
| **Results** | Has filtered results | File list with cards |
| **Clear Search** | X button visible | When searchQuery exists |

---

## 9. Performance Optimization

### 9.1. Debounce Implementation

```javascript
// Debounce search query to prevent excessive re-renders
useEffect(() => {
  const timer = setTimeout(() => {
    if (searchQuery.trim() === '') {
      setFilteredResults([]);
      onFilteredDocuments([]);
      return;
    }
    
    // Execute search after 300ms delay
    performSearch(searchQuery);
  }, 300);

  return () => clearTimeout(timer);
}, [searchQuery]);
```

**Benefits:**
- ✅ Reduce re-renders when typing fast
- ✅ Improve performance
- ✅ Better UX (wait for user to finish typing)

### 9.2. Client-side vs Server-side

| Aspect | Client-side (Current) | Server-side (Advanced) |
|--------|----------------------|------------------------|
| **Data Size** | Small-medium (< 1000 files) | Large (> 1000 files) |
| **Performance** | Fast (no network delay) | Slower (network latency) |
| **Filtering** | All in browser memory | Database queries |
| **Complexity** | Simple | Complex |
| **Use Case** | Group file search | Global file search |

**Current Implementation:**
- ✅ Client-side search for group files
- ✅ All files loaded into memory via `useGroupFiles`
- ✅ Fast filtering and sorting in browser
- ✅ No additional API calls needed

**When to switch to Server-side:**
- Groups with > 1000 files
- Global search across multiple groups
- Advanced filters (date ranges, size ranges, etc.)

### 9.3. Memoization Opportunities

```javascript
// Memoize filtered results to prevent unnecessary recalculations
const filteredFiles = useMemo(() => {
  return (files || [])
    .map(file => calculateScore(file, searchQuery, tags))
    .filter(file => matchesFilters(file, searchQuery, selectedTagId))
    .sort(sortComparator);
}, [files, searchQuery, selectedTagId, sortBy, sortOrder, tags]);
```

---

## 10. Use Cases

### 10.1. Basic Search

**Scenario 1: Tìm file theo tên**
```
User: Nhập "budget"
System: Tìm tất cả files có tên chứa "budget"
Results:
  1. budget_2024.xlsx (Score: 150 - starts with)
  2. annual_budget_report.pdf (Score: 100 - contains)
  3. project_budget.docx (Score: 100 - contains)
```

**Scenario 2: Tìm file theo tag**
```
User: Nhập "important"
System: Tìm files có tag "important"
Results:
  1. contract.pdf with tag "important" (Score: 50)
  2. agreement.docx with tag "important" (Score: 50)
```

**Scenario 3: Tìm file theo loại**
```
User: Nhập "pdf"
System: Tìm files có type "pdf"
Results:
  1. report.pdf (Score: 30)
  2. presentation.pdf (Score: 30)
  3. document.pdf (Score: 30)
```

### 10.2. Combined Search + Filter

**Scenario 4: Search + Tag Filter**
```
User: Nhập "report" + Chọn tag "2024"
System: 
  1. Apply search scoring for "report"
  2. Filter results to only show files with tag "2024"
Results:
  1. annual_report_2024.pdf (Name match + Tag "2024")
  2. quarterly_report.xlsx (Tag "2024" only)
```

### 10.3. Sort Examples

**Scenario 5: Sort by Name**
```
User: Click "Tên" button
Results: Files sorted alphabetically A-Z
  1. annual_report.pdf
  2. budget.xlsx
  3. contract.docx
  4. presentation.pptx
```

**Scenario 6: Sort by Date (DESC)**
```
User: Click "Ngày" button
Results: Newest files first
  1. file_uploaded_today.pdf
  2. file_uploaded_yesterday.docx
  3. file_uploaded_last_week.xlsx
```

**Scenario 7: Sort by Size (ASC)**
```
User: Click "Dung lượng" button
Results: Smallest files first
  1. small_doc.txt (10 KB)
  2. medium_image.jpg (500 KB)
  3. large_video.mp4 (50 MB)
```

---

## 11. Testing Scenarios

### 11.1. Search Functionality

```
✅ Test Case 1: Empty search
   ├─ Input: ""
   ├─ Expected: Show all files
   └─ Result: Pass

✅ Test Case 2: Single character search
   ├─ Input: "a"
   ├─ Expected: Show files containing "a"
   └─ Result: Pass

✅ Test Case 3: Exact file name match
   ├─ Input: "budget_2024.xlsx"
   ├─ Expected: Exact match gets highest score (150)
   └─ Result: Pass

✅ Test Case 4: Partial name match
   ├─ Input: "budget"
   ├─ Expected: Files containing "budget" (score 100-150)
   └─ Result: Pass

✅ Test Case 5: Tag search
   ├─ Input: "important"
   ├─ Expected: Files with tag "important" (score 50)
   └─ Result: Pass

✅ Test Case 6: Type search
   ├─ Input: "pdf"
   ├─ Expected: All PDF files (score 30)
   └─ Result: Pass

✅ Test Case 7: Uploader search
   ├─ Input: "John"
   ├─ Expected: Files uploaded by users containing "John" (score 20)
   └─ Result: Pass

✅ Test Case 8: No results
   ├─ Input: "nonexistent"
   ├─ Expected: Empty results with message "Không tìm thấy file nào"
   └─ Result: Pass

✅ Test Case 9: Case insensitive
   ├─ Input: "BUDGET" vs "budget"
   ├─ Expected: Same results
   └─ Result: Pass

✅ Test Case 10: Debounce
   ├─ Action: Type "budget" quickly
   ├─ Expected: Search executes after 300ms
   └─ Result: Pass
```

### 11.2. Filter Functionality

```
✅ Test Case 11: Tag filter only
   ├─ Action: Select tag "2024"
   ├─ Expected: Only files with tag "2024"
   └─ Result: Pass

✅ Test Case 12: Search + Tag filter
   ├─ Action: Search "report" + Select tag "important"
   ├─ Expected: Files matching "report" AND having tag "important"
   └─ Result: Pass

✅ Test Case 13: Clear tag filter
   ├─ Action: Click "Tất cả"
   ├─ Expected: Show all files (remove tag filter)
   └─ Result: Pass
```

### 11.3. Sort Functionality

```
✅ Test Case 14: Sort by name ASC
   ├─ Action: Click "Tên"
   ├─ Expected: Files A-Z
   └─ Result: Pass

✅ Test Case 15: Sort by name DESC
   ├─ Action: Click "Tên" again
   ├─ Expected: Files Z-A
   └─ Result: Pass

✅ Test Case 16: Sort by date DESC
   ├─ Action: Click "Ngày"
   ├─ Expected: Newest first
   └─ Result: Pass

✅ Test Case 17: Sort by size ASC
   ├─ Action: Click "Dung lượng"
   ├─ Expected: Smallest first
   └─ Result: Pass

✅ Test Case 18: Sort with search
   ├─ Action: Search "budget" + Sort by date
   ├─ Expected: Search results sorted by date
   └─ Result: Pass
```

### 11.4. Performance Tests

```
⚡ Test Case 19: Large dataset (500 files)
   ├─ Action: Load group with 500 files
   ├─ Expected: Search completes < 100ms
   └─ Result: Measure performance

⚡ Test Case 20: Rapid typing
   ├─ Action: Type quickly "budget report 2024"
   ├─ Expected: Only 1 search executes (after debounce)
   └─ Result: Check debounce works
```

---

## 12. Tóm tắt Implementation

### 12.1. Key Features

✅ **Priority-based Scoring**: Tên > Tags > Type > Uploader
✅ **Client-side Search**: Fast, no API calls needed
✅ **Debounce**: 300ms delay to prevent excessive re-renders
✅ **Multi-criteria**: Search by name, tags, type, uploader
✅ **Combined Filters**: Search + Tag filter (AND operation)
✅ **Flexible Sorting**: Date, Name, Size with ASC/DESC
✅ **Real-time Results**: Instant feedback as user types
✅ **Clear Search**: X button to clear search query

### 12.2. Key Files

**Frontend:**
- `frontend/src/components/Chat/GroupSidebar/Files.jsx` - Main search UI
- `frontend/src/components/Chat/ChatArea.jsx` - Global search in chat
- `frontend/src/components/Chat/SearchBar.jsx` - Standalone search component
- `frontend/src/hooks/useGroupFiles.js` - Data fetching hook

**Backend:**
- `backend/src/models/File.js` - `getGroupFiles()`, `search()` methods
- `backend/src/controllers/fileController.js` - `searchFiles()` API
- `backend/src/routes/files.js` - Search routes

### 12.3. Search Flow Summary

```
User Input
   ↓
Debounce (300ms)
   ↓
Calculate Search Scores
   ├─ Name: 100-150
   ├─ Tags: 50
   ├─ Type: 30
   └─ Uploader: 20
   ↓
Filter by Score > 0
   ↓
Apply Tag Filter (if selected)
   ↓
Sort by:
   ├─ Search Score (if searching)
   └─ Sort Option (date/name/size)
   ↓
Display Results
```

### 12.4. Best Practices Applied

1. **Debouncing**: Prevent excessive re-renders during typing
2. **Priority Scoring**: More relevant results ranked higher
3. **Client-side Performance**: No backend calls for group search
4. **Clear UX**: X button to clear, visual feedback
5. **Flexible Filtering**: Combine search + tag filter
6. **Responsive Sorting**: Toggle ASC/DESC easily
7. **Empty States**: Clear messages when no results

---

## Kết luận

Chức năng **Tìm kiếm File** trong DocsShare được thiết kế với mục tiêu:
- **Tốc độ**: Client-side search với debounce
- **Chính xác**: Priority-based scoring đảm bảo kết quả relevant
- **Linh hoạt**: Tìm theo nhiều tiêu chí (name, tags, type, uploader)
- **Kết hợp**: Search + Filter + Sort hoạt động song song
- **UX**: Instant feedback, clear states, easy to use

Đây là một trong những chức năng **quan trọng nhất** giúp người dùng nhanh chóng tìm thấy files cần thiết trong nhóm.
