async function testAPI() {
  try {
    console.log('🧪 Testing DocsShare API endpoints...\n');
    
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:5000/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check successful:', healthData.status);
    
    // Test 2: Signature endpoint (should fail without proper token)
    console.log('\n2️⃣ Testing signature endpoint...');
    try {
      const signatureResponse = await fetch('http://localhost:5000/api/files/signature', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      const signatureData = await signatureResponse.json();
      console.log('✅ Signature endpoint response:', signatureData);
    } catch (error) {
      console.log('❌ Signature endpoint error (expected):', error.message);
    }
    
    // Test 3: Metadata endpoint (should fail without proper token)
    console.log('\n3️⃣ Testing metadata endpoint...');
    try {
      const metadataResponse = await fetch('http://localhost:5000/api/files/metadata', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'test.pdf',
          url: 'https://example.com/test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          groupId: 1
        })
      });
      const metadataData = await metadataResponse.json();
      console.log('✅ Metadata endpoint response:', metadataData);
    } catch (error) {
      console.log('❌ Metadata endpoint error (expected):', error.message);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run tests
testAPI();