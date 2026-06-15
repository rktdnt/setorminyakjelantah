import mongoose from 'mongoose';

const mutasiPointSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jenis_mutasi: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    referensi_tabel: {
      type: String,
      maxlength: 64,
      default: null,
    },
    referensi_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    poin: {
      type: Number,
      required: true,
    },
    poin_sebelum: {
      type: Number,
      default: 0,
    },
    poin_sesudah: {
      type: Number,
      default: 0,
    },
    keterangan: {
      type: String,
      maxlength: 255,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    collection: 'mutasi_point',
  }
);

export default mongoose.models.MutasiPoint || mongoose.model('MutasiPoint', mutasiPointSchema);
