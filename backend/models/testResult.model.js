import mongoose from 'mongoose';
const { Schema } = mongoose;

const TestResultSchema = new Schema({
  participantId: { type: String, required: true, index: true },
  testType: { type: String, required: true },
  score: { type: Number, required: true },
  answers: { type: Object, required: true },
  questionOrder: { type: [String], default: [] },
  incorrectQuestions: { type: [String], default: [] },
  attentionCheckFailed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('TestResult', TestResultSchema);
