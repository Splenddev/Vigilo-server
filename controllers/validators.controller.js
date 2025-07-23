import Group from '../models/group.js';

export const validateGroupMatricNumbers = async (req, res) => {
  try {
    const { groupId, matricNumbers } = req.body;

    if (!groupId || !Array.isArray(matricNumbers)) {
      return res
        .status(400)
        .json({ error: 'Group ID and matricNumbers are required.' });
    }

    const group = await Group.findById(groupId).select('members.matricNumber');

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const memberMatricSet = new Set(group.members.map((m) => m.matricNumber));

    const validMatricNumbers = [];
    const invalidMatricNumbers = [];

    matricNumbers.forEach((matric) => {
      if (memberMatricSet.has(matric.toLowerCase().trim())) {
        validMatricNumbers.push(matric);
      } else {
        invalidMatricNumbers.push(matric);
      }
    });

    res.json({
      success: true,
      message: 'matric numbers validation complete. Below are the results',
      data: {
        valid: validMatricNumbers,
        invalid: invalidMatricNumbers,
        isValid: invalidMatricNumbers.length === 0,
      },
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Server error validating matric numbers' });
  }
};
