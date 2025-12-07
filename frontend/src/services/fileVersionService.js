import { getAuth } from 'firebase/auth';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Get Firebase auth token
 */
const getAuthToken = async () => {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  return await currentUser.getIdToken();
};

/**
 * File Version Service
 * API calls for file version management
 */

/**
 * Update file (chỉ owner)
 */
export const updateFile = async (fileId, cloudinaryUrl, size, mimeType, fileName) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/update`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cloudinaryUrl,
        size,
        mimeType,
        fileName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Get version history
 */
export const getFileVersions = async (fileId) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/versions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Restore old version (chỉ owner)
 */
export const restoreFileVersion = async (fileId, versionNumber) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/versions/${versionNumber}/restore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Upload file to Cloudinary với progress callback
 */
export const uploadFileToCloudinary = async (file, signatureData, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signatureData.api_key);
    formData.append('timestamp', signatureData.timestamp);
    formData.append('signature', signatureData.signature);
    formData.append('folder', signatureData.folder);

    const xhr = new XMLHttpRequest();

    // Progress tracking
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        if (onProgress) {
          onProgress({
            status: 'uploading',
            percent: percentComplete,
            loaded: e.loaded,
            total: e.total
          });
        }
      }
    });

    // Success
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    // Error
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    // Abort
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    // Send request
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/raw/upload`;
    xhr.open('POST', cloudinaryUrl);
    xhr.send(formData);
  });
};

export default {
  updateFile,
  getFileVersions,
  restoreFileVersion,
  uploadFileToCloudinary
};
