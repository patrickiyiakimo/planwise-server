const express = require('express');
const router = express.Router();
const courseController = require('../controllers/course.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// All course routes require authentication
router.use(authenticateToken);

// IMPORTANT: Specific routes must come before dynamic routes
router.get('/stats', courseController.getCourseStats);
router.get('/', courseController.getCourses);
router.get('/:id', courseController.getCourseById);
router.post('/', courseController.createCourse);
router.put('/:id', courseController.updateCourse);
router.delete('/:id', courseController.deleteCourse);

// Assignment routes
router.post('/:courseId/assignments/:assignmentId/submit', courseController.submitAssignment);

module.exports = router;