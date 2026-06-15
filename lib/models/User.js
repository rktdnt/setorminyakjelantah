import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    cabang_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cabang',
      default: null,
    },
    nama: {
      type: String,
      required: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      maxlength: 190,
    },
    password: {
      type: String,
      required: true,
      maxlength: 255,
    },
    status_akun: {
      type: String,
      enum: ['aktif', 'nonaktif', 'petugas', 'admin'],
      default: 'aktif',
    },
    poin: {
      type: Number,
      default: 0,
    },
    tanggal_daftar: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'users',
  }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
