// API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Fetch Firebase configuration from backend
 * @returns {Promise<Object>} Firebase configuration object
 */
export const getFirebaseConfig = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/config/firebase`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get Firebase configuration');
    }

    return result.data;
  } catch (error) {
    console.error('Error fetching Firebase config:', error);
    throw error;
  }
};

/**
 * Cache for Firebase config to avoid repeated API calls
 */
let cachedFirebaseConfig = null;

/**
 * Get Firebase config with caching
 * @returns {Promise<Object>} Firebase configuration object
 */
export const getCachedFirebaseConfig = async () => {
  if (cachedFirebaseConfig) {
    return cachedFirebaseConfig;
  }
  
  cachedFirebaseConfig = await getFirebaseConfig();
  return cachedFirebaseConfig;
};