import express from 'express';
import SurveyResponse from '../models/surveyResponse.model.js';
import User from '../models/user.model.js';

const router = express.Router();

// @route   POST api/surveys/submit
// @desc    Submit a survey and update user progress
router.post('/submit', async (req, res) => {
    const { participantId, surveyType, responses, nextProgress } = req.body;

    try {
        // Save the survey response
        const newSurvey = new SurveyResponse({
            participantId,
            surveyType,
            responses
        });
        await newSurvey.save();

        // Update the user's progress to the next step
        const user = await User.findOneAndUpdate(
            { participantId },
            { progress: nextProgress },
            { new: true }
        );

        res.status(201).json({ msg: 'Survey submitted successfully', user });

    } catch (error) {
        console.error('Survey submission error:', error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

export default router;