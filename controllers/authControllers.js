// {department:"Philosophy"email:"rep123@gmail.com"
// faculty:"Arts"
// level:"300L"
// name:"nnnnn"
// otp0:"1"
// otp1:"2"
// otp2:"3"
// otp3:"4"
// otp4:"5"
// otp5:"6"
// password:"1234nnn"
// profilePicture:null
// role:"student"}
// };

import { createClassRep } from '../utils/createClassRep.js';
import { createStudent } from '../utils/createStudent.js';
import { createToken } from '../utils/createToken.js';

export const register = async (req, res) => {
  const { role, ...userData } = req.body;
  const profilePicture = req.file?.path || null; // Cloudinary URL

  if (!role) {
    return res.status(400).json({ message: 'Role is required.' });
  }

  try {
    let user;

    if (role === 'student') {
      user = await createStudent(userData, profilePicture);
    } else if (role === 'class-rep') {
      user = await createClassRep(userData, profilePicture);
    } else {
      return res.status(400).json({ message: 'Invalid role provided.' });
    }

    createToken(user._id, res);

    res.status(201).json({
      message: `${role === 'student' ? 'Student' : 'ClassRep'} account created`,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};
