import { z } from 'zod';
import { MESSAGES } from '../constants/messages';

const email = z.string().trim().toLowerCase().email().max(254);
const name = z.string().trim().min(1).max(100);

export const userIdParams = z.object({ id: z.string().uuid() });

export const createUserBody = z.object({ email, name }).strict();

export const updateUserBody = z
  .object({ email: email.optional(), name: name.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: MESSAGES.VALIDATION.AT_LEAST_ONE_FIELD });

export const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserDto = z.infer<typeof createUserBody>;
export type UpdateUserDto = z.infer<typeof updateUserBody>;
export type ListUsersQuery = z.infer<typeof listUsersQuery>;
