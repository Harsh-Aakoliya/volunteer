'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome, {user.fullName || user.userId}!</h2>
          
          <div className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">User Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">User ID:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{user.userId}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Mobile Number:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{user.mobileNumber}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Full Name:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">{user.fullName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Role:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    {user.isAdmin ? 'HOD' : 'Sevak'}
                  </span>
                </div>
                {user.departments && user.departments.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600">Departments:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {user.departments.map((dept, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {dept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    {user.isApproved ? (
                      <span className="text-green-600">Approved</span>
                    ) : (
                      <span className="text-yellow-600">Pending Approval</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
