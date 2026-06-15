import mongoose from 'mongoose';

const petugasSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cabang_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cabang',
      default: null,
    },
    jabatan: {
      type: String,
      maxlength: 100,
      default: null,
    },
    status_petugas: {
      type: String,
      enum: ['aktif', 'nonaktif'],
      default: 'aktif',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'petugas',
  }
);

export default mongoose.models.Petugas || mongoose.model('Petugas', petugasSchema);
