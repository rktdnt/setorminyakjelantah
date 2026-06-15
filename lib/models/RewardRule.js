import mongoose from 'mongoose';

const rewardRuleSchema = new mongoose.Schema(
  {
    nama_rule: {
      type: String,
      required: true,
      maxlength: 120,
    },
    minimal_liter: {
      type: Number,
      default: 0,
    },
    poin_per_liter: {
      type: Number,
      default: 10,
    },
    bonus_poin: {
      type: Number,
      default: 0,
    },
    aktif: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'reward_rules',
  }
);

export default mongoose.models.RewardRule || mongoose.model('RewardRule', rewardRuleSchema);
