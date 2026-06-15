import mongoose from 'mongoose';

const rewardTransaksiSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardRule',
      default: null,
      index: true,
    },
    setoran_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SetoranMinyak',
      default: null,
      index: true,
    },
    jenis_reward: {
      type: String,
      enum: ['setoran', 'bonus', 'penyesuaian'],
      default: 'setoran',
    },
    poin: {
      type: Number,
      required: true,
    },
    deskripsi: {
      type: String,
      maxlength: 255,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'reward_transaksi',
  }
);

export default mongoose.models.RewardTransaksi || mongoose.model('RewardTransaksi', rewardTransaksiSchema);
