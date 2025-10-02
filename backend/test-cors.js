// Test CORS Configuration
console.log('🧪 Testing CORS Configuration...\n');

async function testCORS() {
  try {
    // Test preflight request
    console.log('1️⃣ Testing CORS Preflight (OPTIONS)...');
    const preflightResponse = await fetch('http://localhost:5000/api/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    
    console.log('   Preflight Status:', preflightResponse.status);
    console.log('   Access-Control-Allow-Origin:', preflightResponse.headers.get('Access-Control-Allow-Origin'));
    console.log('   Access-Control-Allow-Methods:', preflightResponse.headers.get('Access-Control-Allow-Methods'));
    
    // Test actual request
    console.log('\n2️⃣ Testing Actual API Request...');
    const apiResponse = await fetch('http://localhost:5000/api/health', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:5173',
        'Content-Type': 'application/json'
      }
    });
    
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      console.log('   ✅ API Request Success:', data.status);
    } else {
      console.log('   ❌ API Request Failed:', apiResponse.status);
    }
    
    console.log('\n🎉 CORS Configuration Test Complete!');
    
  } catch (error) {
    console.error('❌ CORS Test Error:', error.message);
  }
}

testCORS();