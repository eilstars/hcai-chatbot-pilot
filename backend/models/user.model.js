import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserSchema = new Schema({
  participantId: { type: String, required: true, unique: true, index: true },
  group: { type: String, enum: ['nudging', 'paternalistic', 'control'], required: true },
  consented: { type: Boolean, default: false },
  progress: { type: String, default: 'consent' },
  paternalisticCounters: {
    type: Object,
    of: Number,
    default: {}
  }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
export default User;

