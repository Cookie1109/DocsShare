// Quick test script for tags API
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api';

async function testTagsAPI() {
  try {
    console.log('🧪 Testing Firebase Groups Tags API...\n');
    
    // Test 1: Get tags for a Firebase group (should work even without auth for testing)
    console.log('📋 Test 1: GET /api/firebase-groups/test-group-id/tags');
    
    const response = await fetch(`${API_BASE_URL}/firebase-groups/test-group-id/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status:', response.status);
    const data = await response.text();
    console.log('Response:', data);
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testTagsAPI();