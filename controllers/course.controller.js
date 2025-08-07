import Course from '../models/course.model.js';
import { errorResponse } from '../utils/errorResponses.js';
import Group from '../models/group.js';
import { getPublicHolidays } from '../utils/getPublicHolidays.js';

export const getCourses = async (req, res) => {
  try {
    const user = req.user;

    if (!user?.group) {
      return errorResponse(
        res,
        'NO_GROUP',
        'User must join a group first.',
        403
      );
    }

    const courses = await Course.find({ group: user.group });

    return res.status(200).json({
      success: true,
      message: 'Courses retrieved successfully.',
      courses,
    });
  } catch (err) {
    console.error('Error fetching courses:', err);
    return errorResponse(
      res,
      'FETCH_COURSES_FAILED',
      'Failed to retrieve courses.',
      500
    );
  }
};

function countOverlapDays(startDate, endDate, excludedDates = []) {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const d = new Date(current);
    if (excludedDates.some((ex) => ex.toDateString() === d.toDateString())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export const addCourse = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.group) {
      return errorResponse(
        res,
        'NO_GROUP',
        'Join a group before adding courses.',
        403
      );
    }

    const {
      courseCode,
      courseTitle,
      unit,
      instructor: instructorRaw,
      description = '',
      level,
      department,
      faculty,
      tags: tagsRaw,
      durationWeeks,
      classesPerWeek = 1,
    } = req.body;

    // Validate required fields
    let instructor = null;
    if (instructorRaw) {
      try {
        instructor = JSON.parse(instructorRaw);
      } catch {
        throw createHttpError.BadRequest('Invalid instructor format');
      }
    }

    if (
      !courseCode ||
      !courseTitle ||
      !unit ||
      !level ||
      !department ||
      !faculty ||
      !durationWeeks ||
      !instructor.name
    ) {
      return errorResponse(
        res,
        'MISSING_FIELDS',
        'Required fields: courseCode, unit, level, department, faculty, durationWeeks, instructor.name.',
        400
      );
    }

    const code = courseCode.trim().toUpperCase();
    const title = (courseTitle || '').trim();

    const exists = await Course.exists({
      group: user.group,
      $or: [
        { courseCode: code },
        { courseTitle: new RegExp(`^${title}$`, 'i') },
      ],
    });

    if (exists) {
      return errorResponse(
        res,
        'DUPLICATE_COURSE',
        `Course "${code}" already exists.`,
        400
      );
    }

    // Fetch group for breaks
    const group = await Group.findById(user.group);
    if (!group) {
      return errorResponse(res, 'GROUP_NOT_FOUND', 'Group not found.', 404);
    }

    let tags = [];
    if (tagsRaw) {
      try {
        tags = JSON.parse(tagsRaw);
      } catch {
        throw createHttpError.BadRequest('Invalid tags format');
      }
    }

    // Fetch holidays and merge with breaks
    const currentYear = new Date().getFullYear();
    const holidays = await getPublicHolidays(currentYear, 'NG');

    const groupBreaks = Array.isArray(group.breaks)
      ? group.breaks.flatMap((b) => {
          const from = new Date(b.from);
          const to = new Date(b.to);
          const dates = [];
          const current = new Date(from);
          while (current <= to) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
          }
          return dates;
        })
      : [];

    const excludedDates = [...groupBreaks, ...holidays];

    // Estimate realistic expectedSchedules
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + durationWeeks * 7);

    const totalDays = durationWeeks * 7;
    const totalClassSlots = durationWeeks * classesPerWeek;
    const excludedCount = countOverlapDays(start, end, excludedDates);
    const classDaysMissed = Math.floor(
      (excludedCount / totalDays) * totalClassSlots
    );
    const expectedSchedules = Math.max(0, totalClassSlots - classDaysMissed);

    const thumbnail = req.files?.thumbnail?.[0]?.path || null;
    const instructorImage = req.files?.instructorImage?.[0]?.path || null;

    // Attach image to instructor if present
    if (instructor && instructorImage) {
      instructor.image = instructorImage;
    }

    // Create course
    const newCourse = await Course.create({
      courseCode: code,
      courseTitle: title,
      unit: Number(unit),
      instructor: {
        name: instructor.name?.trim(),
        email: instructor.email?.trim() || '',
        image: instructor.image?.trim() || '',
      },
      description: description.trim(),
      level: level.trim(),
      department: department.trim(),
      faculty: faculty.trim(),
      thumbnail,
      tags: Array.isArray(tags) ? tags : [],
      durationWeeks: Number(durationWeeks),
      classesPerWeek: Number(classesPerWeek),
      expectedSchedules,
      createdBy: user._id,
      group: user.group,
    });

    return res.status(201).json({
      success: true,
      message: `Course "${code}" added successfully.`,
      course: newCourse,
    });
  } catch (err) {
    console.error('Add Course Error:', err);
    return errorResponse(
      res,
      'ADD_COURSE_FAILED',
      'Failed to add course.',
      500
    );
  }
};

export const editCourse = async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { courseTitle, unit, lecturer } = req.body;
    const user = req.user;

    if (!user?.group) {
      return errorResponse(res, 'NO_GROUP', 'You must join a group.', 403);
    }

    const course = await Course.findOne({
      courseCode: courseCode.toUpperCase(),
      group: user.group,
    });

    if (!course) {
      return errorResponse(res, 'COURSE_NOT_FOUND', 'Course not found.', 404);
    }

    // Check for title duplication
    if (courseTitle) {
      const titleExists = await Course.findOne({
        group: user.group,
        courseTitle: new RegExp(`^${courseTitle.trim()}$`, 'i'),
        _id: { $ne: course._id },
      });

      if (titleExists) {
        return errorResponse(
          res,
          'DUPLICATE_TITLE',
          'Another course already uses this title.',
          400
        );
      }
    }

    course.courseTitle = courseTitle?.trim() || course.courseTitle;
    course.unit = unit ?? course.unit;
    course.lecturer = {
      name: lecturer?.name?.trim() || '',
      email: lecturer?.email?.trim() || '',
    };

    await course.save();

    return res.status(200).json({
      success: true,
      message: 'Course updated.',
      course,
    });
  } catch (err) {
    console.error('Edit Course Error:', err);
    return errorResponse(
      res,
      'EDIT_COURSE_FAILED',
      'Failed to edit course.',
      500
    );
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { courseCode } = req.params;
    const user = req.user;

    const course = await Course.findOneAndDelete({
      courseCode: courseCode.toUpperCase(),
      group: user.group,
    });

    if (!course) {
      return errorResponse(
        res,
        'COURSE_NOT_FOUND',
        'Course not found or unauthorized.',
        404
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Course deleted.',
    });
  } catch (err) {
    console.error('Delete Course Error:', err);
    return errorResponse(res, 'DELETE_FAILED', 'Failed to delete course.', 500);
  }
};
