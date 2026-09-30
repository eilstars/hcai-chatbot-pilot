import mongoose from 'mongoose';
const { Schema } = mongoose;

const ChatMessageSchema = new Schema({
  participantId: { type: String, required: true, index: true },
  sender: { type: String, required: true, enum: ['user', 'bot', 'system'] },
  message: { type: String, required: true },
  promptText: { type: String, default: '' },
  currentQuestionId: { type: String, default: null, sparse: true },
  wasIntervention: { type: Boolean, default: false },

  // Answer-seeking classification: 'semantic' when questionRevealsAnswer is true, otherwise 'none'.
  threeStepLogic: {
    type: String,
    enum: ['verbatim', 'semantic', 'outlandish', 'none'],
    default: 'none'
  },
  // Standalone logic tracking variable
  questionStandalone: { type: Boolean, default: true },

  wasRewritten: { type: Boolean, default: false },
  rewrittenMessage: { type: String, default: null },
  effectiveMessage: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model('ChatMessage', ChatMessageSchema);
