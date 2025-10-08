// API service for tags operations
import { getAuth } from 'firebase/auth';

const API_BASE_URL = 'http://localhost:5000/api';

class TagsService {
  // Get Firebase auth token
  async getAuthToken() {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  // Get all tags for a specific group (using Firebase group ID)
  async getGroupTags(firebaseGroupId) {
    try {
      console.log(`🏷️ Fetching tags for group: ${firebaseGroupId}`);
      const token = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/firebase-groups/${firebaseGroupId}/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch tags: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Received tags:`, data.data);
      return data.data || [];
    } catch (error) {
      console.error('❌ Error fetching group tags:', error);
      throw error;
    }
  }

  // Create a new tag in a group
  async createTag(firebaseGroupId, tagData) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/firebase-groups/${firebaseGroupId}/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: tagData.name.trim(),
          color: tagData.color || '#3B82F6'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create tag: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create tag');
      }

      return data.data;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  // Get tag colors for display
  getTagColors() {
    return [
      'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500',
      'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500',
      'bg-teal-500', 'bg-cyan-500'
    ];
  }

  // Get quick tag suggestions for Vietnamese education context
  getQuickSuggestions() {
    return [
      { name: 'Bài tập', color: 'bg-red-500' },
      { name: 'Đồ án', color: 'bg-blue-500' },
      { name: 'Slide bài giảng', color: 'bg-green-500' },
      { name: 'Tài liệu tham khảo', color: 'bg-yellow-500' },
      { name: 'Code mẫu', color: 'bg-purple-500' },
      { name: 'Ôn tập', color: 'bg-pink-500' }
    ];
  }
}

// Export singleton instance
const tagsService = new TagsService();
export default tagsService;