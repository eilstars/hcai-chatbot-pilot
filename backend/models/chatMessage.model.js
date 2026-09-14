import mongoose from 'mongoose';
const { Schema } = mongoose;

const ChatMessageSchema = new Schema({
  participantId: { type: String, required: true, index: true },
  sender: { type: String, required: true, enum: ['user', 'bot', 'system'] },
  message: { type: String, required: true },
  promptText: { type: String, default: '' },
  currentQuestionId: { type: String, default: null, sparse: true },
  wasIntervention: { type: Boolean, default: false },

  // Three-step pipeline classification: 'verbatim' | 'semantic' | 'outlandish' | 'none'
  threeStepLogic: {
    type: String,
    enum: ['verbatim', 'semantic', 'outlandish', 'none'],
    default: 'none'
  },
  // Semantic similarity score (numerical cosine or verbatim match score)
  semanticScore: { type: Number, default: null, sparse: true },

  semanticMatchedBankEntry: { type: String, default: null },

  // Evaluated directly from question-revealing evaluator without overwriting threeStepLogic
  questionRevealsAnswer: { type: Boolean, default: null, sparse: true },

  // Standalone logic tracking variable
  questionStandalone: { type: Boolean, default: true },

  wasRewritten: { type: Boolean, default: false },
  rewrittenMessage: { type: String, default: null },
  effectiveMessage: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model('ChatMessage', ChatMessageSchema);
