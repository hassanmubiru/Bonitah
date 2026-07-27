/**
 * Unit tests for the shared BFN zod schemas.
 *
 * These schemas are the validated boundary between the frontend and backend: the
 * backend applies them via a ZodValidationPipe so malformed input is rejected with
 * a 400 before any state mutation. These tests exercise both sides of that boundary
 * for representative payloads:
 *   - acceptance of well-formed values (Req 14.3: presence, type, and bounds pass)
 *   - rejection of malformed values (Req 14.4: invalid input is refused)
 *
 * Validates: Requirements 14.3, 14.4
 */

import {
  addressSchema,
  hashSchema,
  hexSchema,
  decimalStringSchema,
  roleSchema,
  chainIdSchema,
  contractNameSchema,
  provenanceSchema,
  nonceRequestSchema,
  nonceResponseSchema,
  verifyRequestSchema,
  verifyResponseSchema,
  userProfileResponseSchema,
  updateUserRequestSchema,
  ipfsDocMetaSchema,
  ipfsUploadRequestSchema,
  MAX_IPFS_DOCS,
  MAX_IPFS_DOC_BYTES,
  lessonSchema,
  courseSchema,
  lessonCompletionResponseSchema,
  certificateIssuedResponseSchema,
  transactionsQuerySchema,
  indexedEventSchema,
  transactionsResponseSchema,
  MAX_TX_PAGE_SIZE,
  portfolioSeriesResponseSchema,
  aiChatRequestSchema,
  aiChatResponseSchema,
  MAX_AI_QUESTION_CHARS,
  chainReadParamsSchema,
  chainReadResponseSchema,
  healthResponseSchema,
  apiErrorSchema,
} from './schemas.js';

// ---------------------------------------------------------------------------
// Representative fixtures
// ---------------------------------------------------------------------------

const VALID_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const VALID_HASH = `0x${'a'.repeat(64)}`;
const VALID_ISO = '2025-01-01T00:00:00.000Z';

const VALID_PROVENANCE = {
  contractAddress: VALID_ADDRESS,
  blockNumber: '123456',
  fetchedAt: VALID_ISO,
};

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

describe('primitive schemas', () => {
  describe('addressSchema', () => {
    it('accepts a 0x-prefixed 20-byte address', () => {
      expect(addressSchema.safeParse(VALID_ADDRESS).success).toBe(true);
    });

    it.each([
      ['missing 0x prefix', '1234567890abcdef1234567890abcdef12345678'],
      ['too short', '0x1234'],
      ['too long', `0x${'a'.repeat(41)}`],
      ['non-hex characters', `0x${'z'.repeat(40)}`],
      ['not a string', 42],
    ])('rejects %s', (_label, value) => {
      expect(addressSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('hashSchema', () => {
    it('accepts a 0x-prefixed 32-byte hash', () => {
      expect(hashSchema.safeParse(VALID_HASH).success).toBe(true);
    });

    it.each([
      ['a 20-byte address', VALID_ADDRESS],
      ['too short', '0xabc'],
      ['empty', ''],
    ])('rejects %s', (_label, value) => {
      expect(hashSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('hexSchema', () => {
    it('accepts an arbitrary-length hex string (e.g. a signature)', () => {
      expect(hexSchema.safeParse(`0x${'ab'.repeat(65)}`).success).toBe(true);
    });

    it('accepts the empty hex string 0x', () => {
      expect(hexSchema.safeParse('0x').success).toBe(true);
    });

    it.each([
      ['missing prefix', 'abcdef'],
      ['non-hex', '0xghij'],
    ])('rejects %s', (_label, value) => {
      expect(hexSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('decimalStringSchema', () => {
    it.each(['0', '1', '123456789012345678901234567890'])('accepts %s', (value) => {
      expect(decimalStringSchema.safeParse(value).success).toBe(true);
    });

    it.each([
      ['negative', '-1'],
      ['decimal point', '1.5'],
      ['hex', '0x1'],
      ['empty', ''],
      ['number type', 123],
    ])('rejects %s', (_label, value) => {
      expect(decimalStringSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('roleSchema', () => {
    it.each(['USER', 'VERIFIER', 'ADMIN'])('accepts %s', (value) => {
      expect(roleSchema.safeParse(value).success).toBe(true);
    });

    it.each(['user', 'SUPERADMIN', ''])('rejects %s', (value) => {
      expect(roleSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('chainIdSchema', () => {
    it('accepts the supported Base Sepolia chain id 84532', () => {
      expect(chainIdSchema.safeParse(84532).success).toBe(true);
    });

    it.each([
      ['an unsupported chain id', 1],
      ['a non-integer', 84532.5],
      ['a string', '84532'],
    ])('rejects %s', (_label, value) => {
      expect(chainIdSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('contractNameSchema', () => {
    it.each(['Registry', 'SavingsVault', 'CommunityTreasury', 'Education', 'Governance'])(
      'accepts %s',
      (value) => {
        expect(contractNameSchema.safeParse(value).success).toBe(true);
      },
    );

    it.each(['registry', 'Unknown', ''])('rejects %s', (value) => {
      expect(contractNameSchema.safeParse(value).success).toBe(false);
    });
  });

  describe('provenanceSchema', () => {
    it('accepts a well-formed provenance envelope', () => {
      expect(provenanceSchema.safeParse(VALID_PROVENANCE).success).toBe(true);
    });

    it('rejects a non-ISO fetchedAt', () => {
      expect(
        provenanceSchema.safeParse({ ...VALID_PROVENANCE, fetchedAt: 'yesterday' }).success,
      ).toBe(false);
    });

    it('rejects a non-decimal blockNumber', () => {
      expect(provenanceSchema.safeParse({ ...VALID_PROVENANCE, blockNumber: '0xff' }).success).toBe(
        false,
      );
    });

    it('rejects a missing contractAddress', () => {
      expect(provenanceSchema.safeParse({ blockNumber: '1', fetchedAt: VALID_ISO }).success).toBe(
        false,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Auth — SIWE
// ---------------------------------------------------------------------------

describe('auth schemas', () => {
  it('nonceRequestSchema accepts a valid address', () => {
    expect(nonceRequestSchema.safeParse({ address: VALID_ADDRESS }).success).toBe(true);
  });

  it('nonceRequestSchema rejects a bad address', () => {
    expect(nonceRequestSchema.safeParse({ address: 'nope' }).success).toBe(false);
  });

  it('nonceResponseSchema accepts a nonce of at least 8 chars', () => {
    expect(nonceResponseSchema.safeParse({ nonce: 'abcd1234' }).success).toBe(true);
  });

  it('nonceResponseSchema rejects a nonce shorter than 8 chars', () => {
    expect(nonceResponseSchema.safeParse({ nonce: 'short' }).success).toBe(false);
  });

  it('verifyRequestSchema accepts a message + hex signature', () => {
    expect(
      verifyRequestSchema.safeParse({ message: 'siwe message', signature: `0x${'a'.repeat(130)}` })
        .success,
    ).toBe(true);
  });

  it.each([
    ['empty message', { message: '', signature: '0xabc' }],
    ['non-hex signature', { message: 'm', signature: 'nothex' }],
  ])('verifyRequestSchema rejects %s', (_label, value) => {
    expect(verifyRequestSchema.safeParse(value).success).toBe(false);
  });

  it('verifyResponseSchema accepts a well-formed session', () => {
    expect(
      verifyResponseSchema.safeParse({
        jwt: 'header.payload.sig',
        address: VALID_ADDRESS,
        role: 'USER',
        expiresAt: VALID_ISO,
      }).success,
    ).toBe(true);
  });

  it('verifyResponseSchema rejects an invalid role', () => {
    expect(
      verifyResponseSchema.safeParse({
        jwt: 'x',
        address: VALID_ADDRESS,
        role: 'ROOT',
        expiresAt: VALID_ISO,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

describe('user schemas', () => {
  it('userProfileResponseSchema accepts a profile with a null displayName', () => {
    expect(
      userProfileResponseSchema.safeParse({
        address: VALID_ADDRESS,
        role: 'ADMIN',
        displayName: null,
        createdAt: VALID_ISO,
      }).success,
    ).toBe(true);
  });

  it('userProfileResponseSchema rejects a displayName over 80 chars', () => {
    expect(
      userProfileResponseSchema.safeParse({
        address: VALID_ADDRESS,
        role: 'ADMIN',
        displayName: 'a'.repeat(81),
        createdAt: VALID_ISO,
      }).success,
    ).toBe(false);
  });

  it('updateUserRequestSchema accepts an omitted displayName (all-optional)', () => {
    expect(updateUserRequestSchema.safeParse({}).success).toBe(true);
  });

  it('updateUserRequestSchema rejects an empty displayName', () => {
    expect(updateUserRequestSchema.safeParse({ displayName: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IPFS profile docs
// ---------------------------------------------------------------------------

describe('ipfs schemas', () => {
  const validDoc = { filename: 'id.pdf', sizeBytes: 1024, contentType: 'application/pdf' };

  it('ipfsDocMetaSchema accepts a doc at the max allowed size', () => {
    expect(
      ipfsDocMetaSchema.safeParse({ ...validDoc, sizeBytes: MAX_IPFS_DOC_BYTES }).success,
    ).toBe(true);
  });

  it.each([
    ['size over 10MB', { ...validDoc, sizeBytes: MAX_IPFS_DOC_BYTES + 1 }],
    ['zero size', { ...validDoc, sizeBytes: 0 }],
    ['empty filename', { ...validDoc, filename: '' }],
  ])('ipfsDocMetaSchema rejects %s', (_label, value) => {
    expect(ipfsDocMetaSchema.safeParse(value).success).toBe(false);
  });

  it('ipfsUploadRequestSchema accepts up to the max document count', () => {
    const documents = Array.from({ length: MAX_IPFS_DOCS }, () => validDoc);
    expect(ipfsUploadRequestSchema.safeParse({ documents }).success).toBe(true);
  });

  it('ipfsUploadRequestSchema rejects more than the max document count', () => {
    const documents = Array.from({ length: MAX_IPFS_DOCS + 1 }, () => validDoc);
    expect(ipfsUploadRequestSchema.safeParse({ documents }).success).toBe(false);
  });

  it('ipfsUploadRequestSchema rejects an empty document list', () => {
    expect(ipfsUploadRequestSchema.safeParse({ documents: [] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

describe('education schemas', () => {
  const validLesson = {
    id: 'l1',
    title: 'Intro',
    order: 0,
    contentType: 'article',
    contentUrl: 'https://example.com/lesson',
  };

  it('lessonSchema accepts a valid lesson', () => {
    expect(lessonSchema.safeParse(validLesson).success).toBe(true);
  });

  it.each([
    ['a bad content type', { ...validLesson, contentType: 'podcast' }],
    ['a non-url contentUrl', { ...validLesson, contentUrl: 'not-a-url' }],
    ['a negative order', { ...validLesson, order: -1 }],
  ])('lessonSchema rejects %s', (_label, value) => {
    expect(lessonSchema.safeParse(value).success).toBe(false);
  });

  it('courseSchema accepts a course with lessons and a 32-byte onChainId', () => {
    expect(
      courseSchema.safeParse({
        id: 'c1',
        title: 'Saving 101',
        onChainId: VALID_HASH,
        lessons: [validLesson],
      }).success,
    ).toBe(true);
  });

  it('courseSchema rejects an onChainId that is not a 32-byte hash', () => {
    expect(
      courseSchema.safeParse({
        id: 'c1',
        title: 'Saving 101',
        onChainId: VALID_ADDRESS,
        lessons: [],
      }).success,
    ).toBe(false);
  });

  it('lessonCompletionResponseSchema accepts a valid progress payload', () => {
    expect(
      lessonCompletionResponseSchema.safeParse({
        lessonId: 'l1',
        courseId: 'c1',
        completedLessons: 1,
        totalLessons: 5,
        currentStreak: 3,
      }).success,
    ).toBe(true);
  });

  it('lessonCompletionResponseSchema rejects a zero totalLessons (must be positive)', () => {
    expect(
      lessonCompletionResponseSchema.safeParse({
        lessonId: 'l1',
        courseId: 'c1',
        completedLessons: 0,
        totalLessons: 0,
        currentStreak: 0,
      }).success,
    ).toBe(false);
  });

  it('certificateIssuedResponseSchema accepts a txHash + cid', () => {
    expect(
      certificateIssuedResponseSchema.safeParse({ txHash: VALID_HASH, cid: 'bafyCID' }).success,
    ).toBe(true);
  });

  it('certificateIssuedResponseSchema rejects an empty cid', () => {
    expect(certificateIssuedResponseSchema.safeParse({ txHash: VALID_HASH, cid: '' }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Transactions & analytics
// ---------------------------------------------------------------------------

describe('transactions & analytics schemas', () => {
  it('transactionsQuerySchema defaults limit to the max page size when omitted', () => {
    const parsed = transactionsQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(MAX_TX_PAGE_SIZE);
    }
  });

  it('transactionsQuerySchema coerces a numeric-string limit within bounds', () => {
    const parsed = transactionsQuerySchema.safeParse({ limit: '25', cursor: '1000' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
    }
  });

  it.each([
    ['a limit over the max', { limit: String(MAX_TX_PAGE_SIZE + 1) }],
    ['a zero limit', { limit: '0' }],
    ['a non-decimal cursor', { cursor: 'xyz' }],
  ])('transactionsQuerySchema rejects %s', (_label, value) => {
    expect(transactionsQuerySchema.safeParse(value).success).toBe(false);
  });

  const validEvent = {
    contractAddress: VALID_ADDRESS,
    eventName: 'DepositMade',
    walletAddress: VALID_ADDRESS,
    transactionHash: VALID_HASH,
    blockNumber: '42',
    blockHash: VALID_HASH,
    logIndex: 0,
    payload: { amount: '100' },
  };

  it('indexedEventSchema accepts a valid event with a null walletAddress', () => {
    expect(indexedEventSchema.safeParse({ ...validEvent, walletAddress: null }).success).toBe(true);
  });

  it('indexedEventSchema rejects a negative logIndex', () => {
    expect(indexedEventSchema.safeParse({ ...validEvent, logIndex: -1 }).success).toBe(false);
  });

  it('transactionsResponseSchema accepts a page with a null nextCursor', () => {
    expect(
      transactionsResponseSchema.safeParse({ events: [validEvent], nextCursor: null }).success,
    ).toBe(true);
  });

  it('transactionsResponseSchema rejects a page exceeding the max size', () => {
    const events = Array.from({ length: MAX_TX_PAGE_SIZE + 1 }, () => validEvent);
    expect(transactionsResponseSchema.safeParse({ events, nextCursor: null }).success).toBe(false);
  });

  it('portfolioSeriesResponseSchema accepts a provenanced series', () => {
    expect(
      portfolioSeriesResponseSchema.safeParse({
        series: [{ value: '1000', provenance: VALID_PROVENANCE }],
      }).success,
    ).toBe(true);
  });

  it('portfolioSeriesResponseSchema rejects a point missing provenance', () => {
    expect(portfolioSeriesResponseSchema.safeParse({ series: [{ value: '1000' }] }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

describe('ai assistant schemas', () => {
  it('aiChatRequestSchema accepts a question at the max length', () => {
    expect(
      aiChatRequestSchema.safeParse({ question: 'a'.repeat(MAX_AI_QUESTION_CHARS) }).success,
    ).toBe(true);
  });

  it('aiChatRequestSchema accepts an optional conversationId', () => {
    expect(aiChatRequestSchema.safeParse({ question: 'hi', conversationId: 'conv1' }).success).toBe(
      true,
    );
  });

  it.each([
    ['an empty question', { question: '' }],
    ['a question over the max length', { question: 'a'.repeat(MAX_AI_QUESTION_CHARS + 1) }],
    ['an empty conversationId', { question: 'hi', conversationId: '' }],
  ])('aiChatRequestSchema rejects %s', (_label, value) => {
    expect(aiChatRequestSchema.safeParse(value).success).toBe(false);
  });

  it('aiChatResponseSchema accepts a conversationId + answer', () => {
    expect(
      aiChatResponseSchema.safeParse({ conversationId: 'c1', answer: 'save more' }).success,
    ).toBe(true);
  });

  it('aiChatResponseSchema rejects a missing conversationId', () => {
    expect(aiChatResponseSchema.safeParse({ answer: 'save more' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Chain read
// ---------------------------------------------------------------------------

describe('chain read schemas', () => {
  it('chainReadParamsSchema accepts a known contract + fn', () => {
    expect(
      chainReadParamsSchema.safeParse({ contract: 'SavingsVault', fn: 'availableBalance' }).success,
    ).toBe(true);
  });

  it.each([
    ['an unknown contract', { contract: 'Unknown', fn: 'x' }],
    ['an empty fn', { contract: 'Registry', fn: '' }],
  ])('chainReadParamsSchema rejects %s', (_label, value) => {
    expect(chainReadParamsSchema.safeParse(value).success).toBe(false);
  });

  it('chainReadResponseSchema accepts a value + provenance', () => {
    expect(
      chainReadResponseSchema.safeParse({ value: '5000', provenance: VALID_PROVENANCE }).success,
    ).toBe(true);
  });

  it('chainReadResponseSchema rejects a non-decimal value', () => {
    expect(
      chainReadResponseSchema.safeParse({ value: '5.0', provenance: VALID_PROVENANCE }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Health & errors
// ---------------------------------------------------------------------------

describe('health & error schemas', () => {
  it('healthResponseSchema accepts a status + checks map', () => {
    expect(
      healthResponseSchema.safeParse({ status: 'ok', checks: { db: 'up', redis: 'down' } }).success,
    ).toBe(true);
  });

  it('healthResponseSchema rejects an unknown status', () => {
    expect(healthResponseSchema.safeParse({ status: 'flaky', checks: {} }).success).toBe(false);
  });

  it('healthResponseSchema rejects an invalid check value', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok', checks: { db: 'maybe' } }).success).toBe(
      false,
    );
  });

  it('apiErrorSchema accepts a standard error envelope', () => {
    expect(
      apiErrorSchema.safeParse({ statusCode: 400, error: 'Bad Request', message: 'invalid input' })
        .success,
    ).toBe(true);
  });

  it('apiErrorSchema rejects a non-integer statusCode', () => {
    expect(
      apiErrorSchema.safeParse({ statusCode: 400.5, error: 'Bad Request', message: 'x' }).success,
    ).toBe(false);
  });
});
