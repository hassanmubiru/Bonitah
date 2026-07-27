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
/** 0x-prefixed 20-byte Ethereum address. */
export declare const addressSchema: z.ZodString;
/** 0x-prefixed 32-byte transaction or block hash. */
export declare const hashSchema: z.ZodString;
/** Arbitrary-length 0x-prefixed hex string (e.g. a signature). */
export declare const hexSchema: z.ZodString;
/** Non-negative integer encoded as a decimal string (uint256-safe). */
export declare const decimalStringSchema: z.ZodString;
/** Off-chain authorization role. */
export declare const roleSchema: z.ZodEnum<["USER", "VERIFIER", "ADMIN"]>;
/** Supported chain ID (Base Sepolia only). */
export declare const chainIdSchema: z.ZodEffects<z.ZodNumber, number, number>;
/** BFN contract name. */
export declare const contractNameSchema: z.ZodEnum<["Registry", "SavingsVault", "CommunityTreasury", "Education", "Governance"]>;
/** Provenance envelope attached to derived financial values (Req 1.4, 12.2). */
export declare const provenanceSchema: z.ZodObject<{
    contractAddress: z.ZodString;
    blockNumber: z.ZodString;
    fetchedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    blockNumber: string;
    fetchedAt: string;
}, {
    contractAddress: string;
    blockNumber: string;
    fetchedAt: string;
}>;
/** POST /auth/nonce request. */
export declare const nonceRequestSchema: z.ZodObject<{
    address: z.ZodString;
}, "strip", z.ZodTypeAny, {
    address: string;
}, {
    address: string;
}>;
/** POST /auth/nonce response. */
export declare const nonceResponseSchema: z.ZodObject<{
    nonce: z.ZodString;
}, "strip", z.ZodTypeAny, {
    nonce: string;
}, {
    nonce: string;
}>;
/** POST /auth/verify request — the signed SIWE message and its signature. */
export declare const verifyRequestSchema: z.ZodObject<{
    message: z.ZodString;
    signature: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    signature: string;
}, {
    message: string;
    signature: string;
}>;
/** POST /auth/verify response — issued session (Req 2.7, 2.8). */
export declare const verifyResponseSchema: z.ZodObject<{
    jwt: z.ZodString;
    address: z.ZodString;
    role: z.ZodEnum<["USER", "VERIFIER", "ADMIN"]>;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    address: string;
    role: "USER" | "VERIFIER" | "ADMIN";
    jwt: string;
    expiresAt: string;
}, {
    address: string;
    role: "USER" | "VERIFIER" | "ADMIN";
    jwt: string;
    expiresAt: string;
}>;
/** GET /users/me response — off-chain profile metadata only. */
export declare const userProfileResponseSchema: z.ZodObject<{
    address: z.ZodString;
    role: z.ZodEnum<["USER", "VERIFIER", "ADMIN"]>;
    displayName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    address: string;
    role: "USER" | "VERIFIER" | "ADMIN";
    displayName: string | null;
    createdAt: string;
}, {
    address: string;
    role: "USER" | "VERIFIER" | "ADMIN";
    displayName: string | null;
    createdAt: string;
}>;
/** PATCH /users/me request. */
export declare const updateUserRequestSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    displayName?: string | undefined;
}, {
    displayName?: string | undefined;
}>;
/** Upload limits: at most 10 documents per request, 10 MB each (Req 3.5). */
export declare const MAX_IPFS_DOCS: 10;
export declare const MAX_IPFS_DOC_BYTES: number;
/** Metadata describing a single uploaded document (multipart handled separately). */
export declare const ipfsDocMetaSchema: z.ZodObject<{
    filename: z.ZodString;
    sizeBytes: z.ZodNumber;
    contentType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filename: string;
    sizeBytes: number;
    contentType: string;
}, {
    filename: string;
    sizeBytes: number;
    contentType: string;
}>;
/** POST /ipfs/profile-docs request metadata (Req 3.5). */
export declare const ipfsUploadRequestSchema: z.ZodObject<{
    documents: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        sizeBytes: z.ZodNumber;
        contentType: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        sizeBytes: number;
        contentType: string;
    }, {
        filename: string;
        sizeBytes: number;
        contentType: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    documents: {
        filename: string;
        sizeBytes: number;
        contentType: string;
    }[];
}, {
    documents: {
        filename: string;
        sizeBytes: number;
        contentType: string;
    }[];
}>;
/** POST /ipfs/profile-docs success response (Req 3.5). */
export declare const ipfsUploadResponseSchema: z.ZodObject<{
    cid: z.ZodString;
}, "strip", z.ZodTypeAny, {
    cid: string;
}, {
    cid: string;
}>;
export declare const lessonSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    order: z.ZodNumber;
    contentType: z.ZodEnum<["article", "video", "quiz"]>;
    contentUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    contentType: "article" | "video" | "quiz";
    title: string;
    order: number;
    contentUrl: string;
}, {
    id: string;
    contentType: "article" | "video" | "quiz";
    title: string;
    order: number;
    contentUrl: string;
}>;
/** GET /education/courses response element. */
export declare const courseSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    onChainId: z.ZodString;
    lessons: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        order: z.ZodNumber;
        contentType: z.ZodEnum<["article", "video", "quiz"]>;
        contentUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }, {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    onChainId: string;
    lessons: {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }[];
}, {
    id: string;
    title: string;
    onChainId: string;
    lessons: {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }[];
}>;
export declare const coursesResponseSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    onChainId: z.ZodString;
    lessons: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        order: z.ZodNumber;
        contentType: z.ZodEnum<["article", "video", "quiz"]>;
        contentUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }, {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    onChainId: string;
    lessons: {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }[];
}, {
    id: string;
    title: string;
    onChainId: string;
    lessons: {
        id: string;
        contentType: "article" | "video" | "quiz";
        title: string;
        order: number;
        contentUrl: string;
    }[];
}>, "many">;
/** POST /education/lessons/:id/complete response — progress + streak (Req 8.2). */
export declare const lessonCompletionResponseSchema: z.ZodObject<{
    lessonId: z.ZodString;
    courseId: z.ZodString;
    completedLessons: z.ZodNumber;
    totalLessons: z.ZodNumber;
    currentStreak: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    courseId: string;
    lessonId: string;
    completedLessons: number;
    totalLessons: number;
    currentStreak: number;
}, {
    courseId: string;
    lessonId: string;
    completedLessons: number;
    totalLessons: number;
    currentStreak: number;
}>;
/** POST /education/courses/:id/certificate response (Req 8.3, 8.4). */
export declare const certificateIssuedResponseSchema: z.ZodObject<{
    txHash: z.ZodString;
    cid: z.ZodString;
}, "strip", z.ZodTypeAny, {
    cid: string;
    txHash: string;
}, {
    cid: string;
    txHash: string;
}>;
/** Maximum events per transaction-history page (Req 12.3). */
export declare const MAX_TX_PAGE_SIZE: 100;
/** GET /transactions query params — own-wallet scope, paged (Req 12.3, 12.4). */
export declare const transactionsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
/** A single indexed event as returned over REST. */
export declare const indexedEventSchema: z.ZodObject<{
    contractAddress: z.ZodString;
    eventName: z.ZodString;
    walletAddress: z.ZodNullable<z.ZodString>;
    transactionHash: z.ZodString;
    blockNumber: z.ZodString;
    blockHash: z.ZodString;
    logIndex: z.ZodNumber;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    blockNumber: string;
    eventName: string;
    walletAddress: string | null;
    transactionHash: string;
    blockHash: string;
    logIndex: number;
    payload: Record<string, unknown>;
}, {
    contractAddress: string;
    blockNumber: string;
    eventName: string;
    walletAddress: string | null;
    transactionHash: string;
    blockHash: string;
    logIndex: number;
    payload: Record<string, unknown>;
}>;
/** GET /transactions response — descending page with optional next cursor. */
export declare const transactionsResponseSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        contractAddress: z.ZodString;
        eventName: z.ZodString;
        walletAddress: z.ZodNullable<z.ZodString>;
        transactionHash: z.ZodString;
        blockNumber: z.ZodString;
        blockHash: z.ZodString;
        logIndex: z.ZodNumber;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        contractAddress: string;
        blockNumber: string;
        eventName: string;
        walletAddress: string | null;
        transactionHash: string;
        blockHash: string;
        logIndex: number;
        payload: Record<string, unknown>;
    }, {
        contractAddress: string;
        blockNumber: string;
        eventName: string;
        walletAddress: string | null;
        transactionHash: string;
        blockHash: string;
        logIndex: number;
        payload: Record<string, unknown>;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    events: {
        contractAddress: string;
        blockNumber: string;
        eventName: string;
        walletAddress: string | null;
        transactionHash: string;
        blockHash: string;
        logIndex: number;
        payload: Record<string, unknown>;
    }[];
    nextCursor: string | null;
}, {
    events: {
        contractAddress: string;
        blockNumber: string;
        eventName: string;
        walletAddress: string | null;
        transactionHash: string;
        blockHash: string;
        logIndex: number;
        payload: Record<string, unknown>;
    }[];
    nextCursor: string | null;
}>;
/** A single provenanced point in a portfolio series (Req 11.1). */
export declare const portfolioPointSchema: z.ZodObject<{
    value: z.ZodString;
    provenance: z.ZodObject<{
        contractAddress: z.ZodString;
        blockNumber: z.ZodString;
        fetchedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    }, {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    value: string;
    provenance: {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    };
}, {
    value: string;
    provenance: {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    };
}>;
/** GET /analytics/portfolio response — provenanced series (Req 11.1). */
export declare const portfolioSeriesResponseSchema: z.ZodObject<{
    series: z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        provenance: z.ZodObject<{
            contractAddress: z.ZodString;
            blockNumber: z.ZodString;
            fetchedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            contractAddress: string;
            blockNumber: string;
            fetchedAt: string;
        }, {
            contractAddress: string;
            blockNumber: string;
            fetchedAt: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        provenance: {
            contractAddress: string;
            blockNumber: string;
            fetchedAt: string;
        };
    }, {
        value: string;
        provenance: {
            contractAddress: string;
            blockNumber: string;
            fetchedAt: string;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    series: {
        value: string;
        provenance: {
            contractAddress: string;
            blockNumber: string;
            fetchedAt: string;
        };
    }[];
}, {
    series: {
        value: string;
        provenance: {
            contractAddress: string;
            blockNumber: string;
            fetchedAt: string;
        };
    }[];
}>;
/** Maximum accepted AI question length (Req 10.7). */
export declare const MAX_AI_QUESTION_CHARS: 2000;
/** POST /ai/chat request — question bounded to 2000 chars (Req 10.1, 10.7). */
export declare const aiChatRequestSchema: z.ZodObject<{
    conversationId: z.ZodOptional<z.ZodString>;
    question: z.ZodString;
}, "strip", z.ZodTypeAny, {
    question: string;
    conversationId?: string | undefined;
}, {
    question: string;
    conversationId?: string | undefined;
}>;
/** POST /ai/chat response (Req 10.1). */
export declare const aiChatResponseSchema: z.ZodObject<{
    conversationId: z.ZodString;
    answer: z.ZodString;
}, "strip", z.ZodTypeAny, {
    conversationId: string;
    answer: string;
}, {
    conversationId: string;
    answer: string;
}>;
export declare const aiMessageSchema: z.ZodObject<{
    role: z.ZodEnum<["user", "assistant"]>;
    content: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: "user" | "assistant";
    createdAt: string;
    content: string;
}, {
    role: "user" | "assistant";
    createdAt: string;
    content: string;
}>;
export declare const aiConversationSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        content: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }, {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    messages: {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }[];
}, {
    id: string;
    createdAt: string;
    messages: {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }[];
}>;
/** GET /ai/conversations response (Req 10.4). */
export declare const aiConversationsResponseSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        content: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }, {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    messages: {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }[];
}, {
    id: string;
    createdAt: string;
    messages: {
        role: "user" | "assistant";
        createdAt: string;
        content: string;
    }[];
}>, "many">;
/** GET /chain/read/:contract/:fn path params. */
export declare const chainReadParamsSchema: z.ZodObject<{
    contract: z.ZodEnum<["Registry", "SavingsVault", "CommunityTreasury", "Education", "Governance"]>;
    fn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contract: "Registry" | "SavingsVault" | "CommunityTreasury" | "Education" | "Governance";
    fn: string;
}, {
    contract: "Registry" | "SavingsVault" | "CommunityTreasury" | "Education" | "Governance";
    fn: string;
}>;
/** GET /chain/read/:contract/:fn response — value + provenance (Req 1.4). */
export declare const chainReadResponseSchema: z.ZodObject<{
    value: z.ZodString;
    provenance: z.ZodObject<{
        contractAddress: z.ZodString;
        blockNumber: z.ZodString;
        fetchedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    }, {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    value: string;
    provenance: {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    };
}, {
    value: string;
    provenance: {
        contractAddress: string;
        blockNumber: string;
        fetchedAt: string;
    };
}>;
/** GET /health response. */
export declare const healthResponseSchema: z.ZodObject<{
    status: z.ZodEnum<["ok", "degraded", "down"]>;
    checks: z.ZodRecord<z.ZodString, z.ZodEnum<["up", "down"]>>;
}, "strip", z.ZodTypeAny, {
    status: "ok" | "degraded" | "down";
    checks: Record<string, "down" | "up">;
}, {
    status: "ok" | "degraded" | "down";
    checks: Record<string, "down" | "up">;
}>;
/** Standard error envelope returned by the API. */
export declare const apiErrorSchema: z.ZodObject<{
    statusCode: z.ZodNumber;
    error: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    message: string;
    statusCode: number;
}, {
    error: string;
    message: string;
    statusCode: number;
}>;
export type NonceRequest = z.infer<typeof nonceRequestSchema>;
export type NonceResponse = z.infer<typeof nonceResponseSchema>;
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;
export type VerifyResponse = z.infer<typeof verifyResponseSchema>;
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type IpfsDocMeta = z.infer<typeof ipfsDocMetaSchema>;
export type IpfsUploadRequest = z.infer<typeof ipfsUploadRequestSchema>;
export type IpfsUploadResponse = z.infer<typeof ipfsUploadResponseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Course = z.infer<typeof courseSchema>;
export type CoursesResponse = z.infer<typeof coursesResponseSchema>;
export type LessonCompletionResponse = z.infer<typeof lessonCompletionResponseSchema>;
export type CertificateIssuedResponse = z.infer<typeof certificateIssuedResponseSchema>;
export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
export type IndexedEventDto = z.infer<typeof indexedEventSchema>;
export type TransactionsResponse = z.infer<typeof transactionsResponseSchema>;
export type PortfolioPoint = z.infer<typeof portfolioPointSchema>;
export type PortfolioSeriesResponse = z.infer<typeof portfolioSeriesResponseSchema>;
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;
export type AiChatResponse = z.infer<typeof aiChatResponseSchema>;
export type AiMessage = z.infer<typeof aiMessageSchema>;
export type AiConversation = z.infer<typeof aiConversationSchema>;
export type AiConversationsResponse = z.infer<typeof aiConversationsResponseSchema>;
export type ChainReadParams = z.infer<typeof chainReadParamsSchema>;
export type ChainReadResponse = z.infer<typeof chainReadResponseSchema>;
/** DTO form of provenance (block number as a decimal string); domain form lives in ./types. */
export type ProvenanceDto = z.infer<typeof provenanceSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
//# sourceMappingURL=schemas.d.ts.map