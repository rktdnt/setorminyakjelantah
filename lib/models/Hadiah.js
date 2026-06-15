import mongoose from 'mongoose';

const hadiahSchema = new mongoose.Schema(
  {
    nama_hadiah: {
      type: String,
      required: true,
      maxlength: 140,
    },
    deskripsi: {
      type: String,
      default: null,
    },
    poin_dibutuhkan: {
      type: Number,
      required: true,
    },
    stok: {
      type: Number,
      default: 0,
    },
    foto_contoh: {
      type: String,
      default: null,
    },
    status_hadiah: {
      type: String,
      enum: ['aktif', 'nonaktif'],
      default: 'aktif',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'hadiah',
  }
);

export default mongoose.models.Hadiah || mongoose.model('Hadiah', hadiahSchema);
