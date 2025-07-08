// services/classRepService.js
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '../utils/constants.js';
import ClassRep from '../models/classRep.js';

export const createClassRep = async (data, profilePicture, courses = []) => {
  const {
    name,
    email,
    password,
    username,
    department,
    faculty,
    level,
    matricNumber,
  } = data;

  const existing = await ClassRep.findOne({
    $or: [{ email }, { username }, { matricNumber }],
  });

  if (existing) {
    const conflictField =
      existing.email === email
        ? 'email'
        : existing.username === username
          ? 'username'
          : 'matricNumber';

    const error = new Error(`${conflictField} already exists.`);
    error.code = 'DUPLICATE_FIELD';
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const newRep = await ClassRep.create({
    name,
    email,
    password: hashedPassword,
    username,
    role: 'class-rep',
    department,
    faculty,
    level,
    matricNumber,
    profilePicture: profilePicture || null,
    courses,
    group: null,
  });

  return newRep;
};
