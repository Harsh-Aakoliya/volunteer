'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { departmentApi, Department, DepartmentUser } from '@/lib/api';
import Link from 'next/link';

export default function DepartmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated } = useAuthStore();
  const departmentId = params?.id as string;

  const [department, setDepartment] = useState<Department | null>(null);
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }

    if (departmentId) {
      loadDepartmentData();
    }
  }, [isAuthenticated, user, router, departmentId]);

  const loadDepartmentData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [departmentData, allUsers] = await Promise.all([
        departmentApi.fetchDepartmentById(departmentId),
        departmentApi.fetchAllUsers(),
      ]);

      setDepartment(departmentData);

      // Filter users that belong to this department
      const usersInDepartment = allUsers.filter(user =>
        departmentData.userList?.includes(user.userId) ||
        departmentData.hodList?.includes(user.userId)
      );

      setDepartmentUsers(usersInDepartment);
    } catch (error) {
      console.error('Error loading department:', error);
      setError('Failed to load department. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewUser = (user: DepartmentUser) => {
    router.push(`/users/${user.userId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading department...</p>
        </div>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Department not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const hods = departmentUsers.filter(user => department.hodList?.includes(user.userId));
  const users = departmentUsers.filter(user =>
    department.userList?.includes(user.userId) && !department.hodList?.includes(user.userId)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{department.departmentName}</h1>
          <p className="text-gray-600 mt-1">
            Created on {new Date(department.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* HODs Section */}
        {hods.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-800">HODs ({hods.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hods.map((user) => (
                <UserCard key={user.userId} user={user} isHOD={true} onView={handleViewUser} />
              ))}
            </div>
          </div>
        )}

        {/* Users Section */}
        {users.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-800">Users ({users.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user) => (
                <UserCard key={user.userId} user={user} isHOD={false} onView={handleViewUser} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {departmentUsers.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Members Yet</h2>
            <p className="text-gray-500">
              This department doesn't have any members assigned yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function UserCard({ user, isHOD, onView }: { user: DepartmentUser; isHOD: boolean; onView: (user: DepartmentUser) => void }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-blue-600 font-semibold text-lg">
              {user.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-800 text-lg truncate">
                {user.fullName}
              </h3>
              {isHOD && (
                <span className="ml-2 bg-green-100 px-2 py-1 rounded text-xs font-medium text-green-600">
                  HOD
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">{user.mobileNumber}</p>
            <p className="text-gray-500 text-sm">ID: {user.userId}</p>
            {user.xetra && (
              <p className="text-blue-500 text-sm">Xetra: {user.xetra}</p>
            )}
            {user.mandal && (
              <p className="text-blue-500 text-sm">Mandal: {user.mandal}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onView(user)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="View Profile"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

