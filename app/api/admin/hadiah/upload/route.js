import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'public/uploads/hadiah');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const AUTH_COOKIE = 'smj_auth';

function readAuthUser(req) {
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

async function POST(request) {
  try {
    const auth = readAuthUser(request);
    if (!auth || auth.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'Invalid file type. Only JPG and PNG allowed.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const ext = file.type === 'image/jpeg' ? 'jpg' : 'png';
    const filename = `${timestamp}-${random}.${ext}`;

    // Ensure directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Write file
    const filepath = join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);

    // Return relative path for database storage
    const relativePath = `/uploads/hadiah/${filename}`;

    return Response.json({
      success: true,
      path: relativePath,
      filename: filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export { POST };
