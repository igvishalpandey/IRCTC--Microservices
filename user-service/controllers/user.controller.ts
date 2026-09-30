import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import type { CreateUserDto, UpdateUserDto, ListUsersQuery } from '../validators/user.validator';
import { MESSAGES } from '../constants/messages';

export const userController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const query = req.validated?.query as ListUsersQuery;
    const { items, ...pagination } = await userService.findAll(query);
    sendPaginated(res, items, pagination, MESSAGES.USER.LIST_SUCCESS);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = await userService.findById(req.params.id as string);
    sendSuccess(res, user, MESSAGES.USER.FETCH_SUCCESS);
  },

  async create(req: Request, res: Response): Promise<void> {
    const body = req.validated?.body as CreateUserDto;
    const user = await userService.create(body);
    sendSuccess(res, user, MESSAGES.USER.CREATED, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    const body = req.validated?.body as UpdateUserDto;
    const user = await userService.update(req.params.id as string, body);
    sendSuccess(res, user, MESSAGES.USER.UPDATED);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = await userService.delete(req.params.id as string);
    sendSuccess(res, user, MESSAGES.USER.DELETED);
  },
};
