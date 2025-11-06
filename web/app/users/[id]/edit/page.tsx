'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { userApi, UserProfile, UpdateUserData, SearchFiltersResponse } from '@/lib/api';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const userId = params?.id as string;

  const [originalUser, setOriginalUser] = useState<UserProfile | null>(null);
  const [editedUser, setEditedUser] = useState<UpdateUserData>({
    fullName: '',
    mobileNumber: '',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Department management
  const [filters, setFilters] = useState<SearchFiltersResponse | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isKaryalay, setIsKaryalay] = useState(false);
  const [selectedDOB, setSelectedDOB] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      router.push('/login');
      return;
    }

    if (userId) {
      loadUserData();
      loadFilters();
    }
  }, [isAuthenticated, currentUser, router, userId]);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const userData = await userApi.getUserProfileById(userId);
      setOriginalUser(userData);
      
      // Initialize edited user data
      setEditedUser({
        fullName: userData.fullName || '',
        mobileNumber: userData.mobileNumber || '',
        isAdmin: userData.isAdmin || false,
        gender: userData.gender || '',
        dateOfBirth: userData.dateOfBirth || '',
        bloodGroup: userData.bloodGroup || '',
        maritalStatus: userData.maritalStatus || '',
        education: userData.education || '',
        whatsappNumber: userData.whatsappNumber || '',
        emergencyContact: userData.emergencyContact || '',
        email: userData.email || '',
        address: userData.address || '',
        departmentIds: userData.departmentIds || [],
      });
      
      setSelectedDepartments(userData.departmentIds || []);
      setSelectedDOB(userData.dateOfBirth || '');
    } catch (error) {
      console.error('Error loading user data:', error);
      alert('Failed to load user data');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      const filtersData = await userApi.getSearchFilters();
      setFilters(filtersData);
      setIsKaryalay(filtersData.userRole.isKaryalay);
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  // Check for changes
  useEffect(() => {
    if (originalUser) {
      const formChanges = (
        originalUser.mobileNumber !== editedUser.mobileNumber ||
        originalUser.fullName !== editedUser.fullName ||
        originalUser.isAdmin !== editedUser.isAdmin ||
        originalUser.gender !== editedUser.gender ||
        originalUser.dateOfBirth !== editedUser.dateOfBirth ||
        originalUser.bloodGroup !== editedUser.bloodGroup ||
        originalUser.maritalStatus !== editedUser.maritalStatus ||
        originalUser.education !== editedUser.education ||
        originalUser.whatsappNumber !== editedUser.whatsappNumber ||
        originalUser.emergencyContact !== editedUser.emergencyContact ||
        originalUser.email !== editedUser.email ||
        originalUser.address !== editedUser.address
      );
      
      const originalDepts = originalUser.departmentIds || [];
      const deptChanges = JSON.stringify(originalDepts.sort()) !== JSON.stringify(selectedDepartments.sort());
      
      setHasChanges(formChanges || deptChanges);
    }
  }, [editedUser, originalUser, selectedDepartments]);

  const handleFieldChange = (field: keyof UpdateUserData, value: any) => {
    setEditedUser(prev => ({ ...prev, [field]: value }));
  };

  const handleDOBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    // Convert YYYY-MM-DD to DD/MM/YYYY
    if (dateValue) {
      const [year, month, day] = dateValue.split('-');
      const formattedDate = `${day}/${month}/${year}`;
      setSelectedDOB(dateValue);
      handleFieldChange('dateOfBirth', formattedDate);
    } else {
      setSelectedDOB('');
      handleFieldChange('dateOfBirth', '');
    }
  };

  const toggleDepartment = (departmentId: string) => {
    const newDepartments = selectedDepartments.includes(departmentId)
      ? selectedDepartments.filter(id => id !== departmentId)
      : [...selectedDepartments, departmentId];
    
    setSelectedDepartments(newDepartments);
    handleFieldChange('departmentIds', newDepartments);
  };

  const handleHODToggle = () => {
    const newIsAdmin = !editedUser.isAdmin;
    handleFieldChange('isAdmin', newIsAdmin);
    if (!newIsAdmin) {
      setSelectedDepartments([]);
      handleFieldChange('departmentIds', []);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      setIsSaving(true);
      const updateData: UpdateUserData = {
        fullName: editedUser.fullName,
        mobileNumber: editedUser.mobileNumber,
        isAdmin: editedUser.isAdmin,
        gender: editedUser.gender || undefined,
        dateOfBirth: editedUser.dateOfBirth || undefined,
        bloodGroup: editedUser.bloodGroup || undefined,
        maritalStatus: editedUser.maritalStatus || undefined,
        education: editedUser.education || undefined,
        whatsappNumber: editedUser.whatsappNumber || undefined,
        emergencyContact: editedUser.emergencyContact || undefined,
        email: editedUser.email || undefined,
        address: editedUser.address || undefined,
        departmentIds: selectedDepartments,
      };

      await userApi.updateUserWithSubdepartments(userId, updateData);
      alert('User updated successfully!');
      router.push(`/users/${userId}`);
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.response?.data?.message || 'Failed to update user. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.back();
      }
    } else {
      router.back();
    }
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

  if (!originalUser) {
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

  // Convert DD/MM/YYYY to YYYY-MM-DD for date input
  const getDateInputValue = (dateString: string | undefined): string => {
    if (!dateString) return '';
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit User Profile</h1>
          <p className="text-gray-600 mt-1">{editedUser.fullName || 'User Profile'}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Mobile Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number *</label>
            <input
              type="text"
              value={editedUser.mobileNumber}
              onChange={(e) => handleFieldChange('mobileNumber', e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter mobile number"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={editedUser.fullName}
              onChange={(e) => handleFieldChange('fullName', e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter full name"
            />
          </div>

          {/* Admin/HOD Toggle */}
          <div>
            <label className="flex items-center justify-between">
              <span className="block text-sm font-medium text-gray-700">Make HOD</span>
              <button
                type="button"
                onClick={handleHODToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editedUser.isAdmin ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editedUser.isAdmin ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Department Management - Only for Karyalay users */}
          {isKaryalay && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department Management {selectedDepartments.length > 0 && `(${selectedDepartments.length} selected)`}
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Select departments this user belongs to. {editedUser.isAdmin ? 'As HOD, user will be in both user list and HOD list.' : 'User will be added to user list only.'}
              </p>
              <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                {filters?.departments.map((dept) => {
                  const isSelected = selectedDepartments.includes(dept.departmentId);
                  return (
                    <label
                      key={dept.departmentId}
                      className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 px-2 rounded"
                    >
                      <span className={isSelected ? 'text-indigo-600 font-medium' : 'text-gray-700'}>
                        {dept.departmentName}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDepartment(dept.departmentId)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </label>
                  );
                })}
              </div>
              {selectedDepartments.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {selectedDepartments.map(id => {
                    const dept = filters?.departments.find(d => d.departmentId === id);
                    return dept?.departmentName;
                  }).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleFieldChange('gender', 'male')}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  editedUser.gender === 'male' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('gender', 'female')}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  editedUser.gender === 'female' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                Female
              </button>
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
            <input
              type="date"
              value={getDateInputValue(editedUser.dateOfBirth)}
              onChange={handleDOBChange}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Blood Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
            <div className="flex flex-wrap gap-2">
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => handleFieldChange('bloodGroup', group)}
                  className={`px-4 py-2 rounded-lg border ${
                    editedUser.bloodGroup === group
                      ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Marital Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleFieldChange('maritalStatus', 'single')}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  editedUser.maritalStatus === 'single'
                    ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('maritalStatus', 'married')}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  editedUser.maritalStatus === 'married'
                    ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                Married
              </button>
            </div>
          </div>

          {/* Education */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Education</label>
            <input
              type="text"
              value={editedUser.education || ''}
              onChange={(e) => handleFieldChange('education', e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter education details"
            />
          </div>

          {/* WhatsApp Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Number</label>
            <input
              type="text"
              value={editedUser.whatsappNumber || ''}
              onChange={(e) => handleFieldChange('whatsappNumber', e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter WhatsApp number"
            />
          </div>

          {/* Emergency Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact</label>
            <input
              type="text"
              value={editedUser.emergencyContact || ''}
              onChange={(e) => handleFieldChange('emergencyContact', e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter emergency contact"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={editedUser.email || ''}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter email address"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea
              value={editedUser.address || ''}
              onChange={(e) => handleFieldChange('address', e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter address"
              rows={3}
            />
          </div>

          {/* Save Button */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
