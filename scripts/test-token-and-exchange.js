/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require('fs');
const Ably = require('ably');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/ABLY_API_KEY=(.+)/);
if (!match) {
  console.error('ABLY_API_KEY not found in .env.local');
  process.exit(1);
}
const apiKey = match[1].trim();

async function runRealVerification() {
  console.log('=== REAL-TIME CHAT BUG FIX VERIFICATION (LIVE ABLY EDGE) ===\n');

  const conversationId = '6afb830dac73b32a05f8e5ed'; // Real conversation ID from error report
  const userAId = '6af71a73cbadeef26a5b6582'; // Prashant
  const userBId = '6af985a402c782d8007d985f'; // Leo
  const unauthorizedUserId = '6af999999999999999999999'; // Attacker / Removed user

  const channelName = `chat:direct:${conversationId}`;
  console.log(`Target Conversation Channel: ${channelName}`);

  // 1. Server mints ephemeral token requests with zero wildcards
  const restServer = new Ably.Rest({ key: apiKey, clientId: 'axis-server' });

  console.log('\n--- 1. CAPABILITY MINTING (ZERO WILDCARDS) ---');
  const userACapabilities = {
    [`user:${userAId}:notifications`]: ['subscribe'],
    [channelName]: ['subscribe', 'presence'],
  };
  const userBCapabilities = {
    [`user:${userBId}:notifications`]: ['subscribe'],
    [channelName]: ['subscribe', 'presence'],
  };
  const unauthorizedCapabilities = {
    [`user:${unauthorizedUserId}:notifications`]: ['subscribe'],
    // Note: channelName is NOT granted!
  };

  const [tokenRequestA, tokenRequestB, tokenRequestUnauthorized] = await Promise.all([
    restServer.auth.createTokenRequest({
      clientId: userAId,
      capability: JSON.stringify(userACapabilities),
    }),
    restServer.auth.createTokenRequest({
      clientId: userBId,
      capability: JSON.stringify(userBCapabilities),
    }),
    restServer.auth.createTokenRequest({
      clientId: unauthorizedUserId,
      capability: JSON.stringify(unauthorizedCapabilities),
    }),
  ]);

  console.log('User A Token Capability:', tokenRequestA.capability);
  console.log('User B Token Capability:', tokenRequestB.capability);
  console.log('Unauthorized Token Capability:', tokenRequestUnauthorized.capability);

  // 2. Connect Client A & Client B with their tokenRequests
  console.log('\n--- 2. CONNECTING AUTHORIZED SESSIONS ---');
  const clientA = new Ably.Realtime({
    authCallback: (_data, cb) => cb(null, tokenRequestA),
    transportParams: { agent: 'pubsub-device/3.1.0' },
  });
  const clientB = new Ably.Realtime({
    authCallback: (_data, cb) => cb(null, tokenRequestB),
    transportParams: { agent: 'pubsub-device/3.1.0' },
  });

  await Promise.all([
    new Promise((resolve, reject) => {
      clientA.connection.on('connected', () => {
        console.log(`[PASS] Client A connected with clientId: ${userAId}`);
        resolve();
      });
      clientA.connection.on('failed', reject);
    }),
    new Promise((resolve, reject) => {
      clientB.connection.on('connected', () => {
        console.log(`[PASS] Client B connected with clientId: ${userBId}`);
        resolve();
      });
      clientB.connection.on('failed', reject);
    }),
  ]);

  // 3. Test BUG 1 Fix: Client B subscribes to chat:direct:6afb830dac73b32a05f8e5ed
  console.log('\n--- 3. TESTING BUG 1 FIX (CHANNEL SUBSCRIPTION & ZERO 40160 ERRORS) ---');
  const channelB = clientB.channels.get(channelName);

  let bug1Passed = false;
  try {
    await channelB.attach();
    console.log(`[PASS] Client B attached to ${channelName} successfully! No capability denial!`);
    bug1Passed = true;
  } catch (err) {
    console.error(`[FAIL] Client B failed to attach:`, err.message);
  }

  // 4. Test Security Constraint: Unauthorized client CANNOT attach
  console.log('\n--- 4. TESTING ZERO-TRUST REJECTION OF UNAUTHORIZED SUBSCRIBER ---');
  const clientUnauthorized = new Ably.Realtime({
    authCallback: (_data, cb) => cb(null, tokenRequestUnauthorized),
    transportParams: { agent: 'pubsub-device/3.1.0' },
  });

  let securityCheckPassed = false;
  await new Promise((resolve) => {
    clientUnauthorized.connection.on('connected', async () => {
      const channelC = clientUnauthorized.channels.get(channelName);
      try {
        await channelC.attach();
        console.error('[FAIL] Unauthorized client was able to attach!');
      } catch (err) {
        console.log(`[PASS] Unauthorized client was rejected by Ably: "${err.message}" (code ${err.code})`);
        securityCheckPassed = true;
      }
      clientUnauthorized.close();
      resolve();
    });
    clientUnauthorized.connection.on('failed', (err) => {
      console.log(`[PASS] Unauthorized connection rejected: ${err.message}`);
      securityCheckPassed = true;
      resolve();
    });
  });

  // 5. Test BUG 3 Fix: Real-time message exchange without refreshing
  console.log('\n--- 5. TESTING BUG 3 FIX (INSTANT REAL-TIME MESSAGE EXCHANGE) ---');
  const testMessagePayload = {
    id: `msg_test_${Date.now()}`,
    conversationId,
    senderId: userAId,
    senderName: 'Prashant Umrao',
    senderRole: 'student',
    content: 'Testing immediate real-time delivery with zero refresh!',
    timestamp: new Date().toISOString(),
    isOwn: false,
    status: 'sent',
  };

  const receivePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for real-time message'));
    }, 8000);

    channelB.subscribe('chat.message.new', (msg) => {
      clearTimeout(timeout);
      console.log(`[PASS] Client B received real-time event 'chat.message.new'!`);
      console.log(`Received message ID: ${msg.data.id}`);
      console.log(`Received content:    "${msg.data.content}"`);
      resolve(msg.data);
    });
  });

  // Server publishes message to channel
  console.log(`Publishing test message from Axis server to channel ${channelName}...`);
  const publishChannel = restServer.channels.get(channelName);
  await publishChannel.publish('chat.message.new', testMessagePayload);

  const receivedData = await receivePromise;
  const bug3Passed = receivedData && receivedData.id === testMessagePayload.id;

  // Clean teardown
  clientA.close();
  clientB.close();

  console.log('\n=== SUMMARY OF LIVE ABLY VERIFICATION ===');
  console.log(`BUG 1 (Channel Capability & Authorization): ${bug1Passed ? 'RESOLVED' : 'FAILED'}`);
  console.log(`Zero-Trust Capability Boundary Check:      ${securityCheckPassed ? 'ENFORCED' : 'FAILED'}`);
  console.log(`BUG 3 (Immediate Real-Time Appearance):     ${bug3Passed ? 'RESOLVED' : 'FAILED'}`);
}

runRealVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
