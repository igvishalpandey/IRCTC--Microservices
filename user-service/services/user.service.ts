import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { enqueueEvent, TOPICS } from '../utils/kafkaPublisher';
import { AppError } from '../utils/errors';
import type { CreateUserDto, UpdateUserDto, ListUsersQuery } from '../validators/user.validator';
import { MESSAGES } from '../constants/messages';

// Map unique-constraint violations to a domain error; relying on the DB constraint
// (instead of a read-then-write check) is race-free.
const rethrowUniqueEmail = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw AppError.conflict(MESSAGES.USER.EMAIL_EXISTS);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw AppError.notFound(MESSAGES.USER.NOT_FOUND);
  }
  throw err;
};

export const userService = {
  async findAll({ page, limit }: ListUsersQuery) {
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count(),
    ]);
    return { items, total, page, limit };
  },

  async findById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw AppError.notFound(MESSAGES.USER.NOT_FOUND);
    return user;
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async create(data: CreateUserDto) {
    return prisma
      .$transaction(async (tx) => {
        const user = await tx.user.create({ data });
        await enqueueEvent(tx, TOPICS.USER_CREATED, { userId: user.id, email: user.email }, user.id);
        return user;
      })
      .catch(rethrowUniqueEmail);
  },

  async update(id: string, data: UpdateUserDto) {
    return prisma
      .$transaction(async (tx) => {
        const user = await tx.user.update({ where: { id }, data });
        await enqueueEvent(tx, TOPICS.USER_UPDATED, { userId: user.id, email: user.email }, user.id);
        return user;
      })
      .catch(rethrowUniqueEmail);
  },

  async delete(id: string) {
    return prisma
      .$transaction(async (tx) => {
        const user = await tx.user.delete({ where: { id } });
        await enqueueEvent(tx, TOPICS.USER_DELETED, { userId: user.id, email: user.email }, user.id);
        return user;
      })
      .catch(rethrowUniqueEmail);
  },
};
