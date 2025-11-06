'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout: logoutAction } = useAuthStore();

  const handleLogout = () => {
    logoutAction();
    router.push('/login');
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user.isAdmin || false;
  const isAnnouncementsActive = pathname?.startsWith('/announcements');
  const isDepartmentsActive = pathname?.startsWith('/departments');

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/announcements" className="text-xl font-bold text-indigo-600">
              Volunteer App
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1">
            <Link
              href="/announcements"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isAnnouncementsActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Announcements
            </Link>
            {isAdmin && (
              <Link
                href="/departments"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDepartmentsActive
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                Departments
              </Link>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 text-sm font-semibold">
                  {user.fullName?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-sm text-gray-700 hidden sm:block">
                {user.fullName || user.userId}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

