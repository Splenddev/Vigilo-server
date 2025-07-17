import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import uploadBanner from '../middlewares/bannerUpload.js';
import {
  approveJoinRequest,
  cancelJoinRequest,
  createGroup,
  deleteGroup,
  findGroupById,
  joinGroup,
  leaveGroup,
  rejectJoinRequest,
  searchGroup,
  transferLeadership,
} from '../controllers/group.controller.js';

const groupRoutes = express.Router();

// POST /api/groups — Create a new group
groupRoutes.use(protect);
groupRoutes.post(
  '/create',
  allowClassRepsOnly,
  uploadBanner.single('banner'),
  createGroup
);
groupRoutes.get('/find/:groupId', findGroupById);
groupRoutes.get('/search', searchGroup);
groupRoutes.post('/:groupId/join', joinGroup);
groupRoutes.delete('/:groupId/join', cancelJoinRequest);
groupRoutes.patch('/:groupId/approve-request/:studentId', approveJoinRequest);
groupRoutes.patch('/:groupId/reject-request/:studentId', rejectJoinRequest);
// groupRoutes.post('/assign-role', leaveGroup);
groupRoutes.post('/leave', leaveGroup);
groupRoutes.post('/transfer', transferLeadership);
groupRoutes.delete('/:groupId', allowClassRepsOnly, deleteGroup);

export default groupRoutes;
