import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import upload from '../middlewares/bannerUpload.js';
import {
  createGroup,
  findGroupById,
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
groupRoutes.get('/search', searchGroup);
groupRoutes.get('/:groupId/join', protect, findGroupById);

export default groupRoutes;
