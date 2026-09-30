import mongoose from 'mongoose';

const { Schema } = mongoose;

const ReplayMessageSchema = new Schema({
  replayRound: { type: String, required: true, index: true },
  participantId: { type: String, required: true, index: true },
  round: { type: Number, required: true },
  currentQuestionId: { type: String, required: true },
  message: { type: String, required: true },
  response: { type: String, required: true },
  threeStepLogic: { type: String, enum: ['outlandish', 'verbatim', 'semantic', 'none'], required: true },
  promptText: { type: String, default: '' },
  effectiveMessage: { type: String, default: '' },
  sourceRow: { type: Number, default: null }
}, { timestamps: true });

export default mongoose.model('ReplayMessage', ReplayMessageSchema);