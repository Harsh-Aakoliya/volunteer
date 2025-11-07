'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { announcementApi, Announcement } from '@/lib/api';
import Link from 'next/link';

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated, webPermissions } = useAuthStore();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);

  const announcementId = Number(params.id);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (announcementId) {
      loadAnnouncementDetails();
    }
  }, [isAuthenticated, announcementId, router]);

  const loadAnnouncementDetails = async () => {
    try {
      setIsLoading(true);
      const data = await announcementApi.getAnnouncementDetails(announcementId);
      setAnnouncement(data);
      
      // Mark as read if not already read
      if (user && !hasUserRead(data)) {
        await announcementApi.markAsRead(announcementId, user.userId);
        // Reload to get updated read status
        const updated = await announcementApi.getAnnouncementDetails(announcementId);
        setAnnouncement(updated);
      }

      // Load media files
      try {
        const mediaResponse = await announcementApi.getAnnouncementMedia(announcementId);
        if (mediaResponse.success) {
          setAttachedMediaFiles(mediaResponse.files || []);
        }
      } catch (error) {
        console.log('No media files found');
      }
    } catch (error) {
      console.error('Error loading announcement:', error);
      router.push('/announcements');
    } finally {
      setIsLoading(false);
    }
  };

  const hasUserRead = (announcement: Announcement) => {
    if (!user) return false;
    return announcement.readBy?.some(read => read.userId === user.userId) || false;
  };

  const hasUserLiked = (announcement: Announcement) => {
    if (!user) return false;
    return announcement.likedBy?.some(like => like.userId === user.userId) || false;
  };

  const handleToggleLike = async () => {
    if (!announcement || !user || isLiking) return;
    
    try {
      setIsLiking(true);
      const currentlyLiked = hasUserLiked(announcement);
      
      // Optimistic update
      const newLikedBy = currentlyLiked
        ? announcement.likedBy?.filter(like => like.userId !== user.userId) || []
        : [
            ...(announcement.likedBy || []),
            {
              userId: user.userId,
              fullName: user.fullName || 'You',
              likedAt: new Date().toISOString(),
            },
          ];
      
      setAnnouncement({
        ...announcement,
        likedBy: newLikedBy,
      });

      await announcementApi.toggleLike(announcement.id, user.userId);
      
      // Reload to get accurate data
      const updated = await announcementApi.getAnnouncementDetails(announcementId);
      setAnnouncement(updated);
    } catch (error) {
      console.error('Error toggling like:', error);
      // Reload on error
      loadAnnouncementDetails();
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!announcement || !user || !webPermissions) return;

    if (!confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await announcementApi.deleteAnnouncement(announcement.id);
      router.push('/announcements');
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete announcement';
      alert(errorMessage);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!isAuthenticated || !user || !webPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading announcement...</p>
        </div>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Announcement not found</p>
          <Link href="/announcements" className="text-indigo-600 hover:text-indigo-700">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  const isAuthor = announcement.authorId === user.userId;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  
  // Check if user can edit/delete this announcement
  // Master users can edit/delete announcements created by admin users OR their own announcements
  // Admin users can only edit/delete their own announcements
  const canEditOrDelete = () => {
    if (!webPermissions || !announcement) return false;
    
    const userAccessLevel = webPermissions.accessLevel;
    const authorAccessLevel = announcement.authorAccessLevel;
    
    if (userAccessLevel === 'admin') {
      // Admin can only edit/delete their own announcements
      return isAuthor;
    } else if (userAccessLevel === 'master') {
      // Master can edit/delete if:
      // 1. Announcement author is admin, OR
      // 2. It's their own announcement
      return authorAccessLevel === 'admin' || isAuthor;
    }
    
    return false;
  };
  
  const showEditDelete = canEditOrDelete();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/announcements"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Announcement</h1>
          {showEditDelete && (
            <div className="flex items-center gap-3">
              <Link
                href={`/announcements/create?edit=${announcement.id}&id=${announcement.id}`}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Edit announcement"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:text-red-700"
                title="Delete announcement"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{announcement.title}</h1>
          
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 pb-4 border-b">
            <span>By {announcement.authorName || 'Unknown'}</span>
            <span>•</span>
            <span>{formatDate(announcement.createdAt)}</span>
            {announcement.status === 'scheduled' && announcement.scheduledAt && (
              <>
                <span>•</span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                  Scheduled for {formatDate(announcement.scheduledAt)}
                </span>
              </>
            )}
          </div>

          {announcement.departmentTag && announcement.departmentTag.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {announcement.departmentTag.map((dept, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                >
                  {dept}
                </span>
              ))}
            </div>
          )}

          <div
            className="text-black prose prose-lg max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: announcement.body }}
          />

          {/* Media Files */}
          {attachedMediaFiles.length > 0 && (
            <div className="mt-8 space-y-4">
              {attachedMediaFiles.map((file) => {
                if (file.mimeType.startsWith('image/')) {
                  return (
                    <img
                      key={file.fileName}
                      src={`${API_URL.replace('/api', '')}/media/announcement/${announcementId}/media/${file.fileName}`}
                      alt={file.originalName || file.fileName}
                      className="w-full rounded-lg"
                    />
                  );
                } else if (file.mimeType.startsWith('video/')) {
                  return (
                    <video
                      key={file.fileName}
                      src={`${API_URL.replace('/api', '')}/media/announcement/${announcementId}/media/${file.fileName}`}
                      controls
                      className="w-full rounded-lg"
                    />
                  );
                } else if (file.mimeType.startsWith('audio/')) {
                  return (
                    <audio
                      key={file.fileName}
                      src={`${API_URL.replace('/api', '')}/media/announcement/${announcementId}/media/${file.fileName}`}
                      controls
                      className="w-full"
                    />
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Like Button for Non-Authors */}
          {!isAuthor && (
            <div className="mt-8 pt-6 border-t">
              <button
                onClick={handleToggleLike}
                disabled={isLiking}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  hasUserLiked(announcement)
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg
                  className={`w-5 h-5 ${hasUserLiked(announcement) ? 'fill-current' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <span>{hasUserLiked(announcement) ? 'Liked' : 'Like'}</span>
                {announcement.likedBy && announcement.likedBy.length > 0 && (
                  <span className="text-sm">({announcement.likedBy.length})</span>
                )}
              </button>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}

