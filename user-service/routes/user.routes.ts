import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { validate } from '../middleware/validate.middleware';
import { createUserBody, updateUserBody, userIdParams, listUsersQuery } from '../validators/user.validator';

const router = Router();

// GET /api/users?page=&limit=
router.get('/', validate({ query: listUsersQuery }), userController.getAll);

// GET /api/users/:id
router.get('/:id', validate({ params: userIdParams }), userController.getById);

// POST /api/users
router.post('/', validate({ body: createUserBody }), userController.create);

// PATCH /api/users/:id
router.patch('/:id', validate({ params: userIdParams, body: updateUserBody }), userController.update);

// DELETE /api/users/:id
router.delete('/:id', validate({ params: userIdParams }), userController.remove);

export default router;
