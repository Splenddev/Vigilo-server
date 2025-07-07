import User from '../models/userModel.js';
import { errorResponse } from '../utils/errorResponses.js';

export const getCourses = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return errorResponse(res, 'UNAUTHORIZED', 'User not authenticated.', 401);
    }

    const user = await User.findById(userId).select('courses role');

    if (!user) {
      return errorResponse(res, 'USER_NOT_FOUND', 'User does not exist.', 404);
    }

    if (!user.courses || user.courses.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No courses found for this user.',
        courses: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: `${user.role} courses retrieved.`,
      courses: user.courses,
    });
  } catch (err) {
    console.error('Error fetching courses:', err);
    return errorResponse(
      res,
      err.code || 'FETCH_COURSES_FAILED',
      err.message || 'Failed to retrieve courses.',
      err.status || 500
    );
  }
};

export const addCourse = async (req, res) => {
  try {
    const userId = req.user?._id;
    let incoming = req.body;

    // If body is { courses: [...] } (from FormData JSON) unwrap it
    if (Array.isArray(req.body.courses)) incoming = req.body.courses;
    // If body itself is an array (raw JSON), leave it
    if (!Array.isArray(incoming)) incoming = [incoming];

    if (incoming.length === 0)
      return errorResponse(
        res,
        'EMPTY_PAYLOAD',
        'No course data received.',
        400
      );

    const user = await User.findById(userId);
    if (!user)
      return errorResponse(res, 'USER_NOT_FOUND', 'User not found.', 404);

    const added = [];

    for (const draft of incoming) {
      const { courseCode, courseTitle, unit, lecturer = {} } = draft;

      if (!courseCode || !unit)
        return errorResponse(
          res,
          'MISSING_FIELDS',
          'Course code and unit are required.',
          400
        );

      const code = courseCode.trim().toUpperCase();
      const title = (courseTitle || '').trim();

      const duplicate = user.courses.some(
        (c) =>
          c.courseCode === code ||
          c.courseTitle.toLowerCase() === title.toLowerCase()
      );
      if (duplicate)
        return errorResponse(
          res,
          'COURSE_ALREADY_EXISTS',
          `Course ${code} already exists.`,
          400
        );

      user.courses.push({
        courseCode: code,
        courseTitle: title,
        unit: Number(unit),
        lecturer: {
          name: lecturer.name?.trim() || '',
          email: lecturer.email?.trim() || '',
        },
      });

      added.push(code);
    }

    await user.save();

    return res.status(201).json({
      success: true,
      message: `Added ${added.length} course${added.length > 1 ? 's' : ''}.`,
      courses: user.courses,
    });
  } catch (err) {
    console.error('Add Course Error:', err);
    return errorResponse(
      res,
      err.code || 'ADD_COURSE_FAILED',
      err.message || 'Failed to add course(s).',
      err.status || 500
    );
  }
};

export const editCourse = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { courseCode } = req.params;
    const { courseTitle, unit, lecturer } = req.body;

    if (!courseCode) {
      return errorResponse(
        res,
        'MISSING_CODE',
        'Course code is required in params.',
        400
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'USER_NOT_FOUND', 'User not found.', 404);
    }

    const courseIndex = user.courses.findIndex(
      (c) => c.courseCode === courseCode.toUpperCase()
    );

    if (courseIndex === -1) {
      return errorResponse(res, 'COURSE_NOT_FOUND', 'Course not found.', 404);
    }

    // Check for duplicate title (excluding the current one)
    const titleExists = user.courses.some(
      (c, i) =>
        i !== courseIndex &&
        c.courseTitle?.toLowerCase().trim() ===
          courseTitle?.toLowerCase().trim()
    );
    if (titleExists) {
      return errorResponse(
        res,
        'DUPLICATE_TITLE',
        'Another course already uses this title.',
        400
      );
    }

    const updated = {
      ...user.courses[courseIndex]._doc,
      courseTitle: courseTitle?.trim(),
      unit: Number(unit),
      lecturer: {
        name: lecturer?.name?.trim() || '',
        email: lecturer?.email?.trim() || '',
      },
    };

    user.courses[courseIndex] = updated;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Course updated successfully.',
      course: updated,
    });
  } catch (err) {
    console.error('Edit Course Error:', err);
    return errorResponse(
      res,
      err.code || 'EDIT_COURSE_FAILED',
      err.message || 'Failed to update course.',
      err.status || 500
    );
  }
};

export const deleteCourse = async (req, res) => {
  const { courseCode } = req.params;

  try {
    const user = await User.findById(req.user._id);

    const index = user.courses.findIndex(
      (c) => c.courseCode.toLowerCase() === courseCode.toLowerCase()
    );

    if (index === -1) {
      return errorResponse(res, 'COURSE_NOT_FOUND', 'Course not found.', 404);
    }

    user.courses.splice(index, 1);
    await user.save();

    res.status(200).json({ success: true, message: 'Course deleted.' });
  } catch (err) {
    return errorResponse(
      res,
      'COURSE_DELETE_FAILED',
      'Failed to delete course.',
      500
    );
  }
};
