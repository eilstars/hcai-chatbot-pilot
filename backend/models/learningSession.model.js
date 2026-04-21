import mongoose from 'mongoose';
const { Schema } = mongoose;

const LearningSessionSchema = new Schema({
  participantId: { type: String, required: true, index: true },
  sessionType: { type: String, required: true, default: 'learning-session' },
  questionOrder: { type: [String], default: [] },
  responses: { type: Object, default: {} },
  submissionCount: { type: Number, default: 0 }
}, { timestamps: true });

LearningSessionSchema.index({ participantId: 1, sessionType: 1 }, { unique: true });

export default mongoose.model('LearningSession', LearningSessionSchema);
