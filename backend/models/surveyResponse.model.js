import mongoose from 'mongoose';
const { Schema } = mongoose;

const SurveyResponseSchema = new Schema({
  participantId: { type: String, required: true, index: true },
  surveyType: { type: String, required: true },
  responses: { type: Object, required: true }
}, { timestamps: true });

export default mongoose.model('SurveyResponse', SurveyResponseSchema);
