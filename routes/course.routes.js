import express from 'express';
import {
  addCourse,
  deleteCourse,
  editCourse,
  getCourses,
} from '../controllers/course.controller.js';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';

const courseRouter = express.Router();

courseRouter.use(protect);
courseRouter.use(allowClassRepsOnly);

courseRouter.get('/my-courses', getCourses);
courseRouter.post('/add', addCourse);
courseRouter.put('/edit/:courseCode', editCourse);
courseRouter.delete('/delete/:courseCode', deleteCourse);

export default courseRouter;
