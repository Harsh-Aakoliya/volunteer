'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/authStore';
import { announcementApi, Announcement } from '@/lib/api';

// Dynamically import TipTapEditor to avoid SSR issues
const TipTapEditor = dynamic(() => import('@/components/TipTapEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[300px] border border-gray-300 rounded-lg flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  ),
});

function CreateAnnouncementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  
  const editId = searchParams.get('edit') || searchParams.get('id');
  const isEdit = !!editId;
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadedMediaFiles, setUploadedMediaFiles] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ file: File; progress: number; status: 'uploading' | 'success' | 'error' }[]>([]);
  const [announcementId, setAnnouncementId] = useState<number | null>(null);
  const [isKaryalay, setIsKaryalay] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }
    
    if (!user.isAdmin) {
      alert('Only HODs and Karyalay users can create announcements.');
      router.push('/announcements');
      return;
    }

    const userDepartments = user.departments || [];
    const isKaryalayUser = user.isAdmin && userDepartments.includes('Karyalay');
    setIsKaryalay(isKaryalayUser);

    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, router, editId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDepartments(availableDepartments);
    } else {
      setFilteredDepartments(
        availableDepartments.filter(dept =>
          dept.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, availableDepartments]);

  const initializeData = async () => {
    try {
      setIsLoading(true);
      
      if (isEdit && editId) {
        // Load existing announcement for editing
        const announcement = await announcementApi.getAnnouncementDetails(Number(editId));
        setTitle(announcement.title);
        setContent(announcement.body);
        setSelectedDepartments(announcement.departmentTags || announcement.departmentTag || []);
        setAnnouncementId(announcement.id);
        
        // Load existing media files
        try {
          const mediaResponse = await announcementApi.getAnnouncementMedia(announcement.id);
          if (mediaResponse.success && mediaResponse.files) {
            setUploadedMediaFiles(mediaResponse.files);
          }
        } catch (error) {
          console.log('No existing media files');
        }
      } else {
        // Create a new draft only if we don't have an announcementId already
        if (!announcementId && user) {
          const draft = await announcementApi.createDraft(user.userId, []);
          setAnnouncementId(draft.id);
        }
      }

      // Load departments
      await loadDepartments();
    } catch (error) {
      console.error('Error initializing:', error);
      alert('Failed to initialize. Please try again.');
      router.push('/announcements');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      if (!user) return;
      
      const userDepartments = user.departments || [];
      let departments: string[] = [];

      if (isKaryalay) {
        departments = await announcementApi.getAllDepartments();
      } else {
        departments = userDepartments;
      }

      setAvailableDepartments(departments);
      setFilteredDepartments(departments);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev =>
      prev.includes(dept)
        ? prev.filter(d => d !== dept)
        : [...prev, dept]
    );
  };

  const selectAllDepartments = () => {
    const allSelected = filteredDepartments.every(dept => selectedDepartments.includes(dept));
    if (allSelected) {
      setSelectedDepartments(prev => prev.filter(dept => !filteredDepartments.includes(dept)));
    } else {
      setSelectedDepartments(prev => Array.from(new Set([...prev, ...filteredDepartments])));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (!announcementId) {
      alert('Please wait for the announcement to be initialized');
      return;
    }

    const files = Array.from(e.target.files);
    const newFiles = files.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);
    setAttachedFiles(prev => [...prev, ...files]);

    try {
      // Upload files immediately
      const response = await announcementApi.uploadMedia(announcementId, files);
      
      if (response.success) {
        // Mark files as successfully uploaded
        setUploadingFiles(prev => 
          prev.map(uf => 
            files.includes(uf.file) 
              ? { ...uf, progress: 100, status: 'success' as const }
              : uf
          )
        );
        
        // Fetch updated media files from server
        try {
          const mediaResponse = await announcementApi.getAnnouncementMedia(announcementId);
          if (mediaResponse.success && mediaResponse.files) {
            setUploadedMediaFiles(mediaResponse.files);
          }
        } catch (mediaError) {
          console.error('Error fetching media files:', mediaError);
        }
        
        // Clear uploaded files from attachedFiles after a delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(uf => !files.includes(uf.file)));
          setAttachedFiles(prev => prev.filter(f => !files.includes(f)));
        }, 2000);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
      
      // Mark files as error
      setUploadingFiles(prev => 
        prev.map(uf => 
          files.includes(uf.file) 
            ? { ...uf, status: 'error' as const }
            : uf
        )
      );
      
      // Remove files from attachedFiles
      setAttachedFiles(prev => prev.filter(f => !files.includes(f)));
    }
    
    // Reset file input
    e.target.value = '';
  };

  const handleRemoveMediaFile = async (file: any) => {
    if (!announcementId) return;
    
    try {
      await announcementApi.deleteMedia(announcementId, file.fileName);
      
      // Fetch updated media files from server
      try {
        const mediaResponse = await announcementApi.getAnnouncementMedia(announcementId);
        if (mediaResponse.success && mediaResponse.files) {
          setUploadedMediaFiles(mediaResponse.files);
        }
      } catch (mediaError) {
        console.error('Error fetching media files:', mediaError);
        // Fallback: remove from state if fetch fails
        setUploadedMediaFiles(prev => prev.filter(f => f.id !== file.id));
      }
    } catch (error) {
      console.error('Error removing file:', error);
      alert('Failed to remove file. Please try again.');
    }
  };

  const handleSaveDraft = async () => {
    if (!announcementId || !user || isSaving) return;

    try {
      setIsSaving(true);
      await announcementApi.updateDraft(
        announcementId,
        title.trim(),
        content.trim(),
        user.userId,
        selectedDepartments
      );
      alert('Draft saved successfully!');
      router.push('/announcements');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!announcementId || !user || isSaving) return;

    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!content.trim() || content.trim() === '<p></p>') {
      alert('Please enter announcement content');
      return;
    }

    if (selectedDepartments.length === 0) {
      alert('Please select at least one department');
      return;
    }

    try {
      setIsSaving(true);
      
      // Files are already uploaded, no need to upload again

      if (isEdit) {
        await announcementApi.updateAnnouncement(
          announcementId,
          title.trim(),
          content.trim(),
          selectedDepartments
        );
      } else {
        await announcementApi.publishDraft(
          announcementId,
          title.trim(),
          content.trim(),
          user.userId,
          selectedDepartments
        );
      }

      alert('Announcement published successfully!');
      router.push('/announcements');
    } catch (error) {
      console.error('Error publishing:', error);
      alert('Failed to publish announcement. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!announcementId || !user || isSaving || !scheduledDate || !scheduledTime) {
      alert('Please select both date and time');
      return;
    }

    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!content.trim() || content.trim() === '<p></p>') {
      alert('Please enter announcement content');
      return;
    }

    if (selectedDepartments.length === 0) {
      alert('Please select at least one department');
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

    if (new Date(scheduledAt) <= new Date()) {
      alert('Scheduled time must be in the future');
      return;
    }

    try {
      setIsScheduling(true);

      // Files are already uploaded, no need to upload again

      if (isEdit) {
        await announcementApi.rescheduleAnnouncement(
          announcementId,
          title.trim(),
          content.trim(),
          user.userId,
          selectedDepartments,
          scheduledAt
        );
      } else {
        await announcementApi.scheduleDraft(
          announcementId,
          title.trim(),
          content.trim(),
          user.userId,
          selectedDepartments,
          scheduledAt
        );
      }

      alert('Announcement scheduled successfully!');
      router.push('/announcements');
    } catch (error) {
      console.error('Error scheduling:', error);
      alert('Failed to schedule announcement. Please try again.');
    } finally {
      setIsScheduling(false);
      setShowScheduleModal(false);
    }
  };

  const isFormValid = title.trim() !== '' && content.trim() !== '' && content.trim() !== '<p></p>' && selectedDepartments.length > 0;

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/announcements')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Announcement' : 'Create Announcement'}
          </h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Announcement Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter announcement title..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg text-black"
            />
          </div>

          {/* Rich Text Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Announcement Content
            </label>
            <TipTapEditor content={content} onChange={setContent} />
          </div>

          {/* Media Files */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach Media Files (optional)
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={!announcementId}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
            />
            
            {/* Uploading files */}
            {uploadingFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadingFiles.map((uf, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{uf.file.name}</span>
                        {uf.status === 'success' && (
                          <span className="text-xs text-green-600">✓ Uploaded</span>
                        )}
                        {uf.status === 'error' && (
                          <span className="text-xs text-red-600">✗ Failed</span>
                        )}
                      </div>
                      {uf.status === 'uploading' && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uf.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Uploaded files */}
            {uploadedMediaFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Uploaded Files:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {uploadedMediaFiles.map((file) => (
                    <div key={file.id} className="relative group border border-gray-200 rounded-lg overflow-hidden">
                      {file.mimeType.startsWith('image/') && (() => {
                        // Construct proper image URL
                        // Backend returns URL like: http://localhost:3000/media/announcement/{id}/media/{fileName}
                        // The backend uses process.env.API_URL which defaults to http://localhost:3000
                        let imageUrl = file.url || '';
                        
                        if (!imageUrl && file.fileName && announcementId) {
                          // If no URL, construct it from file name
                          // Backend typically uses port 3000 for media serving
                          imageUrl = `http://localhost:3000/media/announcement/${announcementId}/media/${file.fileName}`;
                        } else if (imageUrl && !imageUrl.startsWith('http')) {
                          // If relative URL, prepend base URL
                          // Check if it's already a full path
                          if (imageUrl.startsWith('/media/')) {
                            imageUrl = `http://localhost:3000${imageUrl}`;
                          } else {
                            const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8080';
                            imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
                          }
                        }
                        
                        return (
                          <img
                            src={imageUrl}
                            alt={file.originalName}
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              // Fallback: try with different ports
                              const target = e.target as HTMLImageElement;
                              if (file.fileName && announcementId) {
                                // Try different common ports
                                const ports = ['3000', '8080', '5000'];
                                const currentSrc = target.src;
                                const currentPort = currentSrc.match(/:(\d+)/)?.[1];
                                const nextPortIndex = ports.indexOf(currentPort || '') + 1;
                                
                                if (nextPortIndex < ports.length) {
                                  target.src = `http://localhost:${ports[nextPortIndex]}/media/announcement/${announcementId}/media/${file.fileName}`;
                                } else {
                                  // Last resort: try without port assumption
                                  target.style.display = 'none';
                                }
                              }
                            }}
                          />
                        );
                      })()}
                      {file.mimeType.startsWith('video/') && (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      )}
                      {file.mimeType.startsWith('audio/') && (
                        <div className="w-full h-32 bg-purple-100 flex items-center justify-center">
                          <svg className="w-12 h-12 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {!file.mimeType.startsWith('image/') && !file.mimeType.startsWith('video/') && !file.mimeType.startsWith('audio/') && (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleRemoveMediaFile(file)}
                          className="bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-2 bg-white">
                        <p className="text-xs text-gray-600 truncate" title={file.originalName}>
                          {file.originalName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Departments *
            </label>
            
            {/* Search */}
            {availableDepartments.length > 1 && (
              <div className="mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search departments..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            {/* Select All */}
            {filteredDepartments.length > 1 && (
              <button
                type="button"
                onClick={selectAllDepartments}
                className="mb-3 px-4 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-700"
              >
                {filteredDepartments.every(dept => selectedDepartments.includes(dept))
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            )}

            {/* Department List */}
            <div className="border border-gray-300 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {filteredDepartments.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'No departments match your search' : 'No departments available'}
                </div>
              ) : (
                filteredDepartments.map((dept) => (
                  <label
                    key={dept}
                    className="flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDepartments.includes(dept)}
                      onChange={() => toggleDepartment(dept)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">{dept}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving || isScheduling}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              disabled={!isFormValid || isSaving || isScheduling}
              className="px-6 py-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 font-medium disabled:opacity-50"
            >
              Schedule
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={!isFormValid || isSaving || isScheduling}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
            >
              {isSaving ? 'Publishing...' : isEdit ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Schedule Announcement</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowScheduleModal(false);
                  setScheduledDate('');
                  setScheduledTime('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSchedule}
                disabled={!scheduledDate || !scheduledTime || isScheduling}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium disabled:opacity-50"
              >
                {isScheduling ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateAnnouncementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CreateAnnouncementContent />
    </Suspense>
  );
}

