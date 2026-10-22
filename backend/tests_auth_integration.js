// Using native fetch in Node 18+ (no external dependencies required)
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- Starting Auth & Google OAuth Integration Verification Tests ---');

  // Test 1: Health / Protected route without token
  try {
    const res = await fetch(`${BASE_URL}/auth/me`);
    if (res.status === 401) {
      console.log('✅ Test 1 PASSED: /api/auth/me correctly rejected unauthorized request (401)');
    } else {
      console.error(`❌ Test 1 FAILED: Expected 401, got ${res.status}`);
    }
  } catch (err) {
    console.error('❌ Test 1 network error:', err.message);
  }

  // Test 2: Standard email/password login with bad credentials
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrongpassword' }),
    });
    if (res.status === 401) {
      console.log('✅ Test 2 PASSED: Email/password login correctly rejects bad credentials (401)');
    } else {
      console.error(`❌ Test 2 FAILED: Expected 401, got ${res.status}`);
    }
  } catch (err) {
    console.error('❌ Test 2 network error:', err.message);
  }

  // Test 3: Google Auth route - missing ID token
  try {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.status === 400) {
      console.log('✅ Test 3 PASSED: /api/auth/google correctly requires idToken (400)');
    } else {
      console.error(`❌ Test 3 FAILED: Expected 400, got ${res.status}`);
    }
  } catch (err) {
    console.error('❌ Test 3 network error:', err.message);
  }

  // Test 4: Google Auth route - invalid fake token
  try {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'fake.jwt.token' }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 500) {
      console.log(`✅ Test 4 PASSED: /api/auth/google rejected fake token (${res.status}: ${data.message})`);
    } else {
      console.error(`❌ Test 4 FAILED: Expected 401 or 500, got ${res.status}`);
    }
  } catch (err) {
    console.error('❌ Test 4 network error:', err.message);
  }

  console.log('--- Verification Tests Completed ---');
}

runTests();
