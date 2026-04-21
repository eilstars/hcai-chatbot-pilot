import express from 'express';
import User from '../models/user.model.js';

const router = express.Router();

// @route   POST api/users/login
// @desc    Find a user or create a new one
router.post('/login', async (req, res) => {
  const { participantId } = req.body;
  if (!participantId) {
    return res.status(400).json({ msg: 'Participant ID is required.' });
  }

  try {
    let user = await User.findOne({ participantId });

    if (!user) {
      const group = 'control';
      user = new User({ participantId, group });
      await user.save();

      // --- Start of The Fix ---
      // Manually create the object to send back to the frontend
      // This ensures the default 'consent' progress is included.
      const userResponse = {
        _id: user._id,
        participantId: user.participantId,
        group: user.group,
        progress: 'consent' // Explicitly set the starting progress
      };
      return res.status(201).json(userResponse);
      // --- End of The Fix ---
    }

    if (user.group !== 'control') {
      user = await User.findOneAndUpdate(
        { participantId },
        { group: 'control' },
        { new: true }
      );
    }

    // If an existing user is found, return their data
    res.status(200).json(user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/users/update-progress
// @desc    Update the user's progress in the study
router.post('/update-progress', async (req, res) => {
  const { participantId, progress, consented } = req.body;
    try {
    const update = { progress };
    if (typeof consented === 'boolean') {
      update.consented = consented;
    }

        const user = await User.findOneAndUpdate(
            { participantId },
      update,
            { new: true } // Return the updated document
        );
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Progress update error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
});


export default router;
