/**
 * Zod schemas for the BFN REST API request/response contracts (design "REST API").
 *
 * These schemas are the single validated boundary between the frontend and backend.
 * The backend applies them via a ZodValidationPipe so malformed input is rejected
 * with a 400 before any state mutation (Req 14.3, 14.4). The frontend imports the
 * inferred types for end-to-end type safety.
 *
 * Financial values are transported as decimal strings (not JS numbers) to preserve
 * on-chain `uint256` precision; block numbers likewise. On-chain state remains the
 * source of truth (Req 1.3) — these payloads only carry provenanced, derived copies.
 */
import { z } from 'zod';
import { SUPPORTED_CHAIN_IDS } from './networks.js';
import { CONTRACT_NAMES } from './types.js';
// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------
/** 0x-prefixed 20-byte Ethereum address. */
export const addressSchema = z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte address');
/** 0x-prefixed 32-byte transaction or block hash. */
export const hashSchema = z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hash');
/** Arbitrary-length 0x-prefixed hex string (e.g. a signature). */
export const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, 'must be a 0x-prefixed hex string');
/** Non-negative integer encoded as a decimal string (uint256-safe). */
export const decimalStringSchema = z
    .string()
    .regex(/^\d+$/, 'must be a non-negative integer string');
/** Off-chain authorization role. */
export const roleSchema = z.enum(['USER', 'VERIFIER', 'ADMIN']);
/** Supported chain ID (Base Sepolia only). */
export const chainIdSchema = z
    .number()
    .int()
    .refine((id) => SUPPORTED_CHAIN_IDS.includes(id), {
    message: 'unsupported chain id',
});
/** BFN contract name. */
export const contractNameSchema = z.enum(CONTRACT_NAMES);
/** Provenance envelope attached to derived financial values (Req 1.4, 12.2). */
export const provenanceSchema = z.object({
    contractAddress: addressSchema,
    blockNumber: decimalStringSchema,
    fetchedAt: z.string().datetime(),
});
// ---------------------------------------------------------------------------
// Auth — SIWE (Req 2.4, 2.6–2.10)
// ---------------------------------------------------------------------------
/** POST /auth/nonce request. */
export const nonceRequestSchema = z.object({
    address: addressSchema,
});
/** POST /auth/nonce response. */
export const nonceResponseSchema = z.object({
    nonce: z.string().min(8),
});
/** POST /auth/verify request — the signed SIWE message and its signature. */
export const verifyRequestSchema = z.object({
    message: z.string().min(1),
    signature: hexSchema,
});
/** POST /auth/verify response — issued session (Req 2.7, 2.8). */
export const verifyResponseSchema = z.object({
    jwt: z.string().min(1),
    address: addressSchema,
    role: roleSchema,
    expiresAt: z.string().datetime(),
});
// ---------------------------------------------------------------------------
// Users (Req 2.10, 3)
// ---------------------------------------------------------------------------
/** GET /users/me response — off-chain profile metadata only. */
export const userProfileResponseSchema = z.object({
    address: addressSchema,
    role: roleSchema,
    displayName: z.string().max(80).nullable(),
    createdAt: z.string().datetime(),
});
/** PATCH /users/me request. */
export const updateUserRequestSchema = z.object({
    displayName: z.string().min(1).max(80).optional(),
});
// ---------------------------------------------------------------------------
// IPFS profile docs (Req 3.5, 3.8, 3.9)
// ---------------------------------------------------------------------------
/** Upload limits: at most 10 documents per request, 10 MB each (Req 3.5). */
export const MAX_IPFS_DOCS = 10;
export const MAX_IPFS_DOC_BYTES = 10 * 1024 * 1024; // 10 MB per document
/** Metadata describing a single uploaded document (multipart handled separately). */
export const ipfsDocMetaSchema = z.object({
    filename: z.string().min(1).max(255),
    sizeBytes: z.number().int().positive().max(MAX_IPFS_DOC_BYTES),
    contentType: z.string().min(1),
});
/** POST /ipfs/profile-docs request metadata (Req 3.5). */
export const ipfsUploadRequestSchema = z.object({
    documents: z.array(ipfsDocMetaSchema).min(1).max(MAX_IPFS_DOCS),
});
/** POST /ipfs/profile-docs success response (Req 3.5). */
export const ipfsUploadResponseSchema = z.object({
    cid: z.string().min(1),
});
// ---------------------------------------------------------------------------
// Education (Req 8.1, 8.2, 8.3, 8.4, 8.8)
// ---------------------------------------------------------------------------
export const lessonSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    order: z.number().int().nonnegative(),
    contentType: z.enum(['article', 'video', 'quiz']),
    contentUrl: z.string().url(),
});
/** GET /education/courses response element. */
export const courseSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    onChainId: hashSchema,
    lessons: z.array(lessonSchema),
});
export const coursesResponseSchema = z.array(courseSchema);
/** POST /education/lessons/:id/complete response — progress + streak (Req 8.2). */
export const lessonCompletionResponseSchema = z.object({
    lessonId: z.string().min(1),
    courseId: z.string().min(1),
    completedLessons: z.number().int().nonnegative(),
    totalLessons: z.number().int().positive(),
    currentStreak: z.number().int().nonnegative(),
});
/** POST /education/courses/:id/certificate response (Req 8.3, 8.4). */
export const certificateIssuedResponseSchema = z.object({
    txHash: hashSchema,
    cid: z.string().min(1),
});
// ---------------------------------------------------------------------------
// Transactions & analytics (Req 11.1, 12.3, 12.4)
// ---------------------------------------------------------------------------
/** Maximum events per transaction-history page (Req 12.3). */
export const MAX_TX_PAGE_SIZE = 100;
/** GET /transactions query params — own-wallet scope, paged (Req 12.3, 12.4). */
export const transactionsQuerySchema = z.object({
    cursor: decimalStringSchema.optional(), // block number cursor for desc paging
    limit: z.coerce.number().int().positive().max(MAX_TX_PAGE_SIZE).default(MAX_TX_PAGE_SIZE),
});
/** A single indexed event as returned over REST. */
export const indexedEventSchema = z.object({
    contractAddress: addressSchema,
    eventName: z.string().min(1),
    walletAddress: addressSchema.nullable(),
    transactionHash: hashSchema,
    blockNumber: decimalStringSchema,
    blockHash: hashSchema,
    logIndex: z.number().int().nonnegative(),
    payload: z.record(z.unknown()),
});
/** GET /transactions response — descending page with optional next cursor. */
export const transactionsResponseSchema = z.object({
    events: z.array(indexedEventSchema).max(MAX_TX_PAGE_SIZE),
    nextCursor: decimalStringSchema.nullable(),
});
/** A single provenanced point in a portfolio series (Req 11.1). */
export const portfolioPointSchema = z.object({
    value: decimalStringSchema,
    provenance: provenanceSchema,
});
/** GET /analytics/portfolio response — provenanced series (Req 11.1). */
export const portfolioSeriesResponseSchema = z.object({
    series: z.array(portfolioPointSchema),
});
// ---------------------------------------------------------------------------
// AI assistant (Req 10.1, 10.4, 10.7)
// ---------------------------------------------------------------------------
/** Maximum accepted AI question length (Req 10.7). */
export const MAX_AI_QUESTION_CHARS = 2000;
/** POST /ai/chat request — question bounded to 2000 chars (Req 10.1, 10.7). */
export const aiChatRequestSchema = z.object({
    conversationId: z.string().min(1).optional(),
    question: z.string().min(1).max(MAX_AI_QUESTION_CHARS),
});
/** POST /ai/chat response (Req 10.1). */
export const aiChatResponseSchema = z.object({
    conversationId: z.string().min(1),
    answer: z.string(),
});
export const aiMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    createdAt: z.string().datetime(),
});
export const aiConversationSchema = z.object({
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    messages: z.array(aiMessageSchema),
});
/** GET /ai/conversations response (Req 10.4). */
export const aiConversationsResponseSchema = z.array(aiConversationSchema);
// ---------------------------------------------------------------------------
// Chain read (Req 1.4, 1.5)
// ---------------------------------------------------------------------------
/** GET /chain/read/:contract/:fn path params. */
export const chainReadParamsSchema = z.object({
    contract: contractNameSchema,
    fn: z.string().min(1),
});
/** GET /chain/read/:contract/:fn response — value + provenance (Req 1.4). */
export const chainReadResponseSchema = z.object({
    value: decimalStringSchema,
    provenance: provenanceSchema,
});
// ---------------------------------------------------------------------------
// Health & errors
// ---------------------------------------------------------------------------
/** GET /health response. */
export const healthResponseSchema = z.object({
    status: z.enum(['ok', 'degraded', 'down']),
    checks: z.record(z.enum(['up', 'down'])),
});
/** Standard error envelope returned by the API. */
export const apiErrorSchema = z.object({
    statusCode: z.number().int(),
    error: z.string(),
    message: z.string(),
});
//# sourceMappingURL=schemas.js.map