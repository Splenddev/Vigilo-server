import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import upload from '../middlewares/bannerUpload.js';
import { createGroup } from '../controllers/group.controller.js';

const groupRoutes = express.Router();

// POST /api/groups — Create a new group
groupRoutes.post(
  '/create',
  protect,
  allowClassRepsOnly,
  upload.single('bannerUrl'),
  createGroup
);

export default groupRoutes;
