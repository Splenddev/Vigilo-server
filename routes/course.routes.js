import express from 'express';
import {
  addCourse,
  deleteCourse,
  editCourse,
  getCourses,
} from '../controllers/course.controller.js';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import upload from '../middlewares/upload.js';

const courseRouter = express.Router();

courseRouter.use(protect);

courseRouter.get('/my-courses', getCourses);

courseRouter.post(
  '/add',
  allowClassRepsOnly,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'instructorImage', maxCount: 1 },
  ]),
  addCourse
);

courseRouter.put('/edit/:courseCode', allowClassRepsOnly, editCourse);

courseRouter.delete('/delete/:courseCode', allowClassRepsOnly, deleteCourse);

export default courseRouter;
