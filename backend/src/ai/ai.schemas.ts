import { z } from 'zod';

/**
 * AI Assistant request/response schemas for validation.
 *
 * Implements validation for:
 * - Question length limits (≤2000 characters, Req 10.7)
 * - Request structure validation (Req 14.3, 14.4)
 * - Response type safety
 */

// Chat request schema (Req 10.7: ≤2000 characters)
export const chatRequestSchema = z.object({
  question: z
    .string()
    .min(1, 'Question cannot be empty')
    .max(2000, 'Question cannot exceed 2000 characters'),
});

export type ChatRequestDto = z.infer<typeof chatRequestSchema>;

// Chat response schema
export const chatResponseSchema = z.object({
  answer: z.string(),
  conversationId: z.string(),
});

export type ChatResponseDto = z.infer<typeof chatResponseSchema>;

// Conversation summary for listing
export const conversationSummarySchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  messageCount: z.number(),
  lastMessage: z.string().nullable(),
  lastMessageAt: z.date(),
});

export type ConversationSummaryDto = z.infer<typeof conversationSummarySchema>;

// Conversations list response
export const conversationsResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema),
});

export type ConversationsResponseDto = z.infer<typeof conversationsResponseSchema>;

// Message schema for conversation details
export const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.date(),
});

export type MessageDto = z.infer<typeof messageSchema>;

// Full conversation details
export const conversationDetailsSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  messages: z.array(messageSchema),
});

export type ConversationDetailsDto = z.infer<typeof conversationDetailsSchema>;

// Conversation response wrapper
export const conversationResponseSchema = z.object({
  conversation: conversationDetailsSchema,
});

export type ConversationResponseDto = z.infer<typeof conversationResponseSchema>;
