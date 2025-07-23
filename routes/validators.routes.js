import express from 'express';
import { protect } from '../middlewares/auth.js';
import { validateGroupMatricNumbers } from '../controllers/validators.controller.js';

const validatorRouter = express.Router();

validatorRouter.use(protect);

validatorRouter.post('/matric-numbers', validateGroupMatricNumbers);

export default validatorRouter;
