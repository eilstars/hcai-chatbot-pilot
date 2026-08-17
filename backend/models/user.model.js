import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserSchema = new Schema({
  participantId: { type: String, required: true, unique: true, index: true },
  group: { type: String, enum: ['nudging', 'paternalistic', 'control'], required: true },
  consented: { type: Boolean, default: false },
  progress: { type: String, default: 'consent' },
  completionCode: { type: String, default: function() { return generateRandomString(10); }, unique: true },
  paternalisticCounters: {
    type: Object,
    of: Number,
    default: {}
  },
  interventions_round1: { type: Number, default: 0 },
  suboptimal_questions_round2: { type: Number, default: 0 }
}, { timestamps: true });

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}

const User = mongoose.model('User', UserSchema);
export default User;

