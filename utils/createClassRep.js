import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from './constants.js';
import ClassRep from '../models/classRep.js';

export const createClassRep = async (data) => {
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

  const existing = await ClassRep.findOne({ $or: [{ email }, { username }] });
  if (existing) throw new Error('Email or username already exists.');

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
    group: null,
    matricNumber,
  });

  return newRep;
};
