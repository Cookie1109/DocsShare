// API service for file operations
import { getAuth } from 'firebase/auth';

const API_BASE_URL = 'http://localhost:5000/api';

class FilesService {
  // Get Firebase auth token
  async getAuthToken() {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  // Get upload signature from backend
  async getUploadSignature(fileName, fileSize, fileType) {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/files/signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        fileSize,
        fileType
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload signature: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to get upload signature');
    }

    return data.data;
  }

  // Upload file to Cloudinary
  async uploadToCloudinary(file, signatureData) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signatureData.signature);
    formData.append('timestamp', signatureData.timestamp);
    formData.append('api_key', signatureData.api_key);
    formData.append('folder', signatureData.folder);
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/auto/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // Save file metadata to backend
  async saveFileMetadata(fileData) {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/files/metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fileData)
    });

    if (!response.ok) {
      throw new Error(`Failed to save metadata: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to save metadata');
    }

    return data.data;
  }

  // Get files for a group
  async getGroupFiles(groupId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/files/group/${groupId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch group files: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch group files');
    }

    return data.data;
  }

  // Complete upload process
  async uploadFile(file, groupId, tagIds = []) {
    try {
      console.log(`📤 Starting upload for: ${file.name}`);
      
      // Step 1: Get upload signature
      const signatureData = await this.getUploadSignature(
        file.name, 
        file.size, 
        file.type
      );
      console.log('✅ Got upload signature');
      
      // Step 2: Upload to Cloudinary
      const cloudinaryData = await this.uploadToCloudinary(file, signatureData);
      console.log('✅ Uploaded to Cloudinary');
      
      // Step 3: Save metadata
      const metadata = await this.saveFileMetadata({
        name: file.name,
        url: cloudinaryData.secure_url,
        size: file.size,
        mimeType: file.type,
        groupId: groupId,
        tagIds: tagIds
      });
      console.log('✅ Saved metadata');
      
      return {
        success: true,
        data: metadata
      };
      
    } catch (error) {
      console.error(`❌ Upload failed for ${file.name}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete file
  async deleteFile(fileId) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete file: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete file');
      }

      return {
        success: true,
        data: data.data
      };
      
    } catch (error) {
      console.error(`❌ Delete failed for file ${fileId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new FilesService();