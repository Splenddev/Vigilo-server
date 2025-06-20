import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import upload from '../middlewares/bannerUpload.js';
import {
  cancelJoinRequest,
  createGroup,
  findGroupById,
  joinGroup,
  searchGroup,
} from '../controllers/group.controller.js';

const groupRoutes = express.Router();

// POST /api/groups — Create a new group
groupRoutes.post(
  '/create',
  protect,
  allowClassRepsOnly,
  upload.single('banner'),
  createGroup
);
groupRoutes.get('/find/:groupId', protect, findGroupById);
groupRoutes.get('/search', protect, searchGroup);
groupRoutes.post('/:groupId/join', protect, joinGroup);
groupRoutes.delete('/:groupId/join', protect, cancelJoinRequest);

export default groupRoutes;
