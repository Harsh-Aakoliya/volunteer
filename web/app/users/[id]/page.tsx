'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { userApi, UserProfile } from '@/lib/api';

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const userId = params?.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      router.push('/login');
      return;
    }

    if (userId) {
      loadUserData();
    }
  }, [isAuthenticated, currentUser, router, userId]);

  const loadUserData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [userData, attendance] = await Promise.all([
        userApi.getUserProfileById(userId),
        userApi.fetchSabhaAttendanceForUser(userId).catch(() => []),
      ]);

      setUser(userData);
      setAttendanceData(attendance || []);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleEdit = () => {
    router.push(`/users/${userId}/edit`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">User not found</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user.fullName}</h1>
              <p className="text-gray-600 mt-1">{user.mobileNumber}</p>
            </div>
            <button
              onClick={handleEdit}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <div className="flex items-center mb-6">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-indigo-600 text-2xl font-semibold">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{user.fullName}</h2>
                <p className="text-gray-600">ID: {user.userId}</p>
                {user.isAdmin && (
                  <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                    Admin
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-500 text-sm">Mobile Number</p>
                <p className="text-gray-900 font-medium">{user.mobileNumber || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Gender</p>
                <p className="text-gray-900 font-medium">{user.gender || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Date of Birth</p>
                <p className="text-gray-900 font-medium">{user.dateOfBirth || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Blood Group</p>
                <p className="text-gray-900 font-medium">{user.bloodGroup || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Marital Status</p>
                <p className="text-gray-900 font-medium">{user.maritalStatus || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Education</p>
                <p className="text-gray-900 font-medium">{user.education || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Occupation</p>
                <p className="text-gray-900 font-medium">{user.occupation || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">WhatsApp Number</p>
                <p className="text-gray-900 font-medium">{(user as any).whatsappNumber || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Emergency Contact</p>
                <p className="text-gray-900 font-medium">{(user as any).emergencyContact || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Email</p>
                <p className="text-gray-900 font-medium">{(user as any).email || 'Not Available'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-sm">Address</p>
                <p className="text-gray-900 font-medium">{user.address || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">City</p>
                <p className="text-gray-900 font-medium">{user.city || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">State</p>
                <p className="text-gray-900 font-medium">{user.state || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Pincode</p>
                <p className="text-gray-900 font-medium">{user.pincode || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Xetra</p>
                <p className="text-gray-900 font-medium">{user.xetra || 'Not Available'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Mandal</p>
                <p className="text-gray-900 font-medium">{user.mandal || 'Not Available'}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <p className="text-gray-500 text-sm mb-2">Departments</p>
              {user.departments && user.departments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.departments.map((dept, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full"
                    >
                      {dept}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Not Available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

