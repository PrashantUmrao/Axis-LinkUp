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

async function testAblyExchange() {
  console.log('Connecting to Ably Edge with configured ABLY_API_KEY...');

  const userAId = '6af71a73cbadeef26a5b6582'; // Prashant
  const userBId = '6af97658b80eb71c9a3a93d1'; // Nisha

  // Compute canonical direct channel name (alphabetical sorting of user IDs)
  const channelKey = [userAId, userBId].sort().join(':');
  const channelName = `chat:direct:${channelKey}`;

  console.log(`Channel Name: ${channelName}`);

  const clientA = new Ably.Realtime({
    key: apiKey,
    clientId: userAId,
    transportParams: { agent: 'pubsub-device/3.1.0' },
  });
  const clientB = new Ably.Realtime({
    key: apiKey,
    clientId: userBId,
    transportParams: { agent: 'pubsub-device/3.1.0' },
  });

  await Promise.all([
    new Promise((resolve, reject) => {
      clientA.connection.on('connected', () => {
        console.log(`Client A (${userAId}) connected to Ably.`);
        resolve();
      });
      clientA.connection.on('failed', reject);
    }),
    new Promise((resolve, reject) => {
      clientB.connection.on('connected', () => {
        console.log(`Client B (${userBId}) connected to Ably.`);
        resolve();
      });
      clientB.connection.on('failed', reject);
    }),
  ]);

  const channelB = clientB.channels.get(channelName);
  const channelA = clientA.channels.get(channelName);

  const receivedMessagePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for Ably message'));
    }, 10000);

    channelB.subscribe('chat.message.new', (msg) => {
      clearTimeout(timeout);
      console.log('Client B successfully received message from Ably in real-time!');
      console.log('Message payload:', JSON.stringify(msg.data, null, 2));
      resolve(msg.data);
    });
  });

  // Attach channel B
  await channelB.attach();
  console.log('Client B attached to channel and listening...');

  // Client A publishes real message
  const testPayload = {
    id: `msg_test_${Date.now()}`,
    conversationId: `conv_${channelKey}`,
    senderId: userAId,
    senderName: 'Prashant Umrao',
    senderRole: 'student',
    content: 'Hello Nisha, verifying real collegiate message delivery via Ably Pub/Sub!',
    timestamp: new Date().toISOString(),
    isOwn: false,
    status: 'sent',
  };

  console.log('Client A publishing message to Ably...');
  await channelA.publish('chat.message.new', testPayload);

  const received = await receivedMessagePromise;

  console.log('\n--- REALTIME VERIFICATION RESULT ---');
  console.log(`Sent Content:     "${testPayload.content}"`);
  console.log(`Received Content: "${received.content}"`);
  console.log(`Sender ID match:  ${received.senderId === userAId}`);
  console.log(`Content match:    ${received.content === testPayload.content}`);

  // Clean teardown
  clientA.close();
  clientB.close();

  if (received.content === testPayload.content) {
    console.log('\nSUCCESS: Real-time Ably delivery between two real collegiate accounts VERIFIED!');
    process.exit(0);
  } else {
    console.error('Payload mismatch');
    process.exit(1);
  }
}

testAblyExchange().catch((err) => {
  console.error('Ably test error:', err);
  process.exit(1);
});
