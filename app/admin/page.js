import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminDashboardClient from './AdminDashboardClient';

const AUTH_COOKIE = 'smj_auth';

async function getAdminAuth() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const authUser = await getAdminAuth();

  if (!authUser) {
    redirect('/login');
  }

  if (authUser.role !== 'admin') {
    redirect('/dashboard');
  }

  return <AdminDashboardClient />;
}
