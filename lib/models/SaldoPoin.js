import mongoose from 'mongoose';

const saldoPoinSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    total_poin: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: 'updated_at' },
    collection: 'saldo_poin',
  }
);

export default mongoose.models.SaldoPoin || mongoose.model('SaldoPoin', saldoPoinSchema);
