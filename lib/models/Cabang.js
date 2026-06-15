import mongoose from 'mongoose';

const cabangSchema = new mongoose.Schema(
  {
    kode_cabang: {
      type: String,
      required: true,
      unique: true,
      maxlength: 30,
    },
    nama_cabang: {
      type: String,
      required: true,
      maxlength: 120,
    },
    alamat: {
      type: String,
      default: null,
    },
    aktif: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'cabang',
  }
);

export default mongoose.models.Cabang || mongoose.model('Cabang', cabangSchema);
