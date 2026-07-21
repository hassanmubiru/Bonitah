import { SiweMessage } from 'siwe';
import { privateKeyToAccount } from 'viem/accounts';
import { verifyMessage } from 'viem';

// Test private key placeholder - replace with actual test key at runtime
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '0x' + 'sample'.repeat(12) + 'f'.repeat(4);
const account = privateKeyToAccount(TEST_PRIVATE_KEY);

const siwe = new SiweMessage({
  domain: 'localhost',
  address: account.address,
  statement: 'Sign in to BFN',
  uri: 'http://localhost:3000',
  version: '1',
  chainId: 84532,
  nonce: 'abcd1234efgh5678',
  issuedAt: new Date().toISOString(),
});

const prepared = siwe.prepareMessage();
const signature = await account.signMessage({ message: prepared });

// Re-parse (simulating the server receiving the raw message string)
const parsed = new SiweMessage(prepared);
const ok = await verifyMessage({
  address: parsed.address,
  message: parsed.prepareMessage(),
  signature,
});

console.warn('address matches:', parsed.address === account.address);
console.warn('nonce:', parsed.nonce);
console.warn('signature valid:', ok);

// Negative case: tampered signature should fail
const bad = await verifyMessage({
  address: parsed.address,
  message: parsed.prepareMessage(),
  signature: signature.slice(0, -2) + (signature.endsWith('ff') ? '00' : 'ff'),
});
console.warn('tampered signature valid (should be false):', bad);
