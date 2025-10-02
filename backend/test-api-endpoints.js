// Test script for file upload API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test data
const testData = {
  fileName: 'test-document.pdf',
  fileSize: 1024000, // 1MB
  fileType: 'application/pdf',
  groupId: 'test-group-123',
  userId: 'test-user-456'
};

async function testHealthCheck() {
  try {
    console.log('🔍 Testing health check...');
    const response = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testSimpleEndpoint() {
  try {
    console.log('🔍 Testing simple endpoint...');
    const response = await axios.get(`${BASE_URL}/api/test`);
    console.log('✅ Simple endpoint successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Simple endpoint failed:', error.message);
    return false;
  }
}

async function testUploadSignature() {
  try {
    console.log('🔍 Testing upload signature endpoint...');
    const response = await axios.post(`${BASE_URL}/api/files/upload-signature`, {
      fileName: testData.fileName,
      fileSize: testData.fileSize,
      fileType: testData.fileType
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Upload signature successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Upload signature failed:', error.response?.data || error.message);
    return null;
  }
}

async function testSaveMetadata() {
  try {
    console.log('🔍 Testing save metadata endpoint...');
    const response = await axios.post(`${BASE_URL}/api/files/save-metadata`, {
      fileName: testData.fileName,
      fileSize: testData.fileSize,
      fileType: testData.fileType,
      cloudinaryUrl: 'https://res.cloudinary.com/test/image/upload/test.pdf',
      cloudinaryPublicId: 'test-public-id',
      groupId: testData.groupId,
      userId: testData.userId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Save metadata successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Save metadata failed:', error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting API tests...\n');
  
  // Test basic endpoints first
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('❌ Health check failed, stopping tests');
    return;
  }
  
  const simpleOk = await testSimpleEndpoint();
  if (!simpleOk) {
    console.log('❌ Simple endpoint failed, stopping tests');
    return;
  }
  
  console.log('\n📁 Testing file upload endpoints...');
  
  // Test upload signature
  const signatureResult = await testUploadSignature();
  
  // Test save metadata
  const metadataResult = await testSaveMetadata();
  
  console.log('\n📊 Test Summary:');
  console.log(`Health Check: ${healthOk ? '✅' : '❌'}`);
  console.log(`Simple Endpoint: ${simpleOk ? '✅' : '❌'}`);
  console.log(`Upload Signature: ${signatureResult ? '✅' : '❌'}`);
  console.log(`Save Metadata: ${metadataResult ? '✅' : '❌'}`);
}

// Handle server not running
process.on('unhandledRejection', (reason) => {
  if (reason.code === 'ECONNREFUSED') {
    console.error('❌ Cannot connect to server. Make sure the server is running on port 5000');
  }
});

runTests();