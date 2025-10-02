// Test Upload Flow với Mock Firebase Token
// Lưu ý: Đây là test để kiểm tra logic flow, không phải upload thực tế

console.log('🧪 Testing Upload File Flow with Mock Firebase Token\n');

async function testUploadFlow() {
  const BASE_URL = 'http://localhost:5000';
  
  try {
    console.log('🔐 Step 1: Testing with Mock Firebase Token...');
    
    // Simulate step 1: Get upload signature
    console.log('\n📝 Step 1: Getting upload signature...');
    const signatureResponse = await fetch(`${BASE_URL}/api/files/signature`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjljYzQ1MWEzMzVjMmY1Y2QwYTNjN2I4ZmI2NDMzOGQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZG9jc3NoYXJlLTM1YWRiIiwiYXVkIjoiZG9jc3NoYXJlLTM1YWRiIiwiYXV0aF90aW1lIjoxNzI3NzYxMjAwLCJ1c2VyX2lkIjoidGVzdC11c2VyLWlkIiwic3ViIjoidGVzdC11c2VyLWlkIiwiaWF0IjoxNzI3NzYxMjAwLCJleHAiOjk5OTk5OTk5OTksImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RAZXhhbXBsZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${signatureResponse.status}`);
    
    if (signatureResponse.ok) {
      const signatureData = await signatureResponse.json();
      console.log('   ✅ SUCCESS - Got upload signature');
      console.log(`   📋 Signature data:`, {
        success: signatureData.success,
        hasSignature: !!signatureData.data?.signature,
        hasApiKey: !!signatureData.data?.api_key,
        cloudName: signatureData.data?.cloud_name
      });
      
      // Step 2: Simulate metadata save
      console.log('\n💾 Step 2: Testing metadata save...');
      const metadataResponse = await fetch(`${BASE_URL}/api/files/metadata`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjljYzQ1MWEzMzVjMmY1Y2QwYTNjN2I4ZmI2NDMzOGQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZG9jc3NoYXJlLTM1YWRiIiwiYXVkIjoiZG9jc3NoYXJlLTM1YWRiIiwiYXV0aF90aW1lIjoxNzI3NzYxMjAwLCJ1c2VyX2lkIjoidGVzdC11c2VyLWlkIiwic3ViIjoidGVzdC11c2VyLWlkIiwiaWF0IjoxNzI3NzYxMjAwLCJleHAiOjk5OTk5OTk5OTksImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RAZXhhbXBsZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'test-document.pdf',
          url: 'https://res.cloudinary.com/dhxwabjan/image/upload/v1/docsshare/documents/test-file.pdf',
          size: 1048576, // 1MB
          mimeType: 'application/pdf',
          groupId: 1,
          tagIds: [1, 2]
        })
      });
      
      console.log(`   Status: ${metadataResponse.status}`);
      
      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json();
        console.log('   ✅ SUCCESS - Metadata saved');
        console.log(`   📋 Response:`, {
          success: metadataData.success,
          hasFileId: !!metadataData.data?.id,
          fileName: metadataData.data?.name
        });
      } else {
        const errorData = await metadataResponse.json();
        console.log('   ❌ FAILED - Metadata save failed');
        console.log(`   📋 Error:`, errorData);
      }
      
    } else {
      const errorData = await signatureResponse.json();
      console.log('   ❌ FAILED - Could not get signature');
      console.log(`   📋 Error:`, errorData);
    }
    
    console.log('\n' + '─'.repeat(50));
    console.log('🎯 Upload Flow Test Complete!');
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testUploadFlow();