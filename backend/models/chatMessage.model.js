import mongoose from 'mongoose';
const { Schema } = mongoose;

const ChatMessageSchema = new Schema({
  participantId: { type: String, required: true, index: true },
  round: { type: Number, required: true, enum: [1, 2] },
  sender: { type: String, required: true, enum: ['user', 'bot', 'system'] },
  message: { type: String, required: true },
  promptText: { type: String, default: '' },
  currentQuestionId: { type: String, default: null, sparse: true },
  wasIntervention: { type: Boolean, default: false },
  interventionType: {
    type: String,
    enum: ['verbatim', 'semantic', 'outlandish', 'none'],
    default: 'none'
  },
  interventionScore: { type: Number, default: null, sparse: true },
  semanticMatchedBankEntry: { type: String, default: null },
  questionRevealsAnswer: { type: Boolean, default: null, sparse: true },
  isStandalone: { type: Boolean, default: true },
  wasRewritten: { type: Boolean, default: false },
  rewrittenMessage: { type: String, default: null },
  effectiveMessage: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model('ChatMessage', ChatMessageSchema);
