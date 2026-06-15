import mongoose from 'mongoose';

const penukaranRewardSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hadiah_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hadiah',
      required: true,
      index: true,
    },
    jumlah: {
      type: Number,
      default: 1,
    },
    total_poin_dipakai: {
      type: Number,
      default: 0,
    },
    status_penukaran: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'done'],
      default: 'pending',
      index: true,
    },
    requested_at: {
      type: Date,
      default: Date.now,
    },
    processed_at: {
      type: Date,
      default: null,
    },
    processed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    catatan: {
      type: String,
      default: null,
    },
  },
  {
    collection: 'penukaran_reward',
  }
);

export default mongoose.models.PenukaranReward || mongoose.model('PenukaranReward', penukaranRewardSchema);
