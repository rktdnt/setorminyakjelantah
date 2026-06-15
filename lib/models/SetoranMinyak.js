import mongoose from 'mongoose';

const setoranMinyakSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    petugas_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Petugas',
      default: null,
      index: true,
    },
    cabang_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cabang',
      default: null,
      index: true,
    },
    rule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardRule',
      default: null,
    },
    tanggal_setor: {
      type: Date,
      default: Date.now,
      index: true,
    },
    jumlah_liter: {
      type: Number,
      required: true,
    },
    poin_didapat: {
      type: Number,
      default: 0,
    },
    status_verifikasi: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    verified_at: {
      type: Date,
      default: null,
    },
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    foto_bukti: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'setoran_minyak',
  }
);

export default mongoose.models.SetoranMinyak || mongoose.model('SetoranMinyak', setoranMinyakSchema);
