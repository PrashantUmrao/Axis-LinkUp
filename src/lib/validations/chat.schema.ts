import { z } from 'zod';
import { objectIdSchema } from './common-schemas';

export const createDirectChatSchema = z.object({
  recipientId: objectIdSchema,
});

export const academicContextSchema = z.object({
  courseCode: z.string().trim().min(2).max(20).optional(),
  courseName: z.string().trim().min(2).max(100).optional(),
  semester: z.number().int().min(1).max(12).optional(),
  section: z.string().trim().min(1).max(10).toUpperCase().optional(),
  batchYear: z.number().int().min(2000).max(2100).optional(),
});

export const createGroupChatSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Group name must be at least 3 characters long.')
    .max(100, 'Group name cannot exceed 100 characters.'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters.')
    .optional(),
  departmentId: objectIdSchema.optional(),
  academicContext: academicContextSchema.optional(),
  groupPolicy: z.enum(['broadcast_only', 'open_discussion']).default('open_discussion'),
  initialMemberIds: z.array(objectIdSchema).max(200, 'Cannot add more than 200 initial members.').optional(),
});

export const updateGroupChatSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Group name must be at least 3 characters long.')
      .max(100, 'Group name cannot exceed 100 characters.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters.')
      .optional(),
    groupPolicy: z.enum(['broadcast_only', 'open_discussion']).optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.groupPolicy !== undefined ||
      data.isArchived !== undefined,
    { message: 'At least one field must be provided for update.' }
  );

export const manageGroupMembersSchema = z.object({
  action: z.enum(['add', 'remove']),
  userIds: z
    .array(objectIdSchema)
    .min(1, 'At least one user ID must be provided.')
    .max(100, 'Cannot manage more than 100 members in a single request.'),
});

export const chatAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(255),
  url: z.string().url('Attachment must be a valid URL.'),
  size: z.number().positive('File size must be positive.'),
  type: z.string().trim().min(1).max(100),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(5000, 'Message cannot exceed 5000 characters.'),
  attachments: z.array(chatAttachmentSchema).max(10, 'Maximum 10 attachments allowed.').optional(),
});

export const messagePaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const conversationQuerySchema = z.object({
  type: z.enum(['direct', 'group']).optional(),
  search: z.string().trim().optional(),
  departmentId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateDirectChatInput = z.infer<typeof createDirectChatSchema>;
export type CreateGroupChatInput = z.infer<typeof createGroupChatSchema>;
export type UpdateGroupChatInput = z.infer<typeof updateGroupChatSchema>;
export type ManageGroupMembersInput = z.infer<typeof manageGroupMembersSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessagePaginationQueryInput = z.infer<typeof messagePaginationQuerySchema>;
export type ConversationQueryInput = z.infer<typeof conversationQuerySchema>;
