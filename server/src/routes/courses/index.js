import { Router } from 'express';
import { courseBuilderRouter } from './builder.js';
import { courseLearningRouter } from './learning.js';
import { courseRatingsRouter } from './ratings.js';
import { courseCatalogRouter } from './catalog.js';
import { courseExtrasRouter } from './extras.js';

export const coursesRouter=Router();
coursesRouter.use(courseBuilderRouter);
coursesRouter.use(courseLearningRouter);
coursesRouter.use(courseRatingsRouter);
coursesRouter.use(courseExtrasRouter);
coursesRouter.use(courseCatalogRouter);
