'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { announcementApi, Announcement } from '@/lib/api';
import Link from 'next/link';

export default function AnnouncementsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>('ALL');
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadAnnouncements();
    setupTabs();
  }, [isAuthenticated, router]);

  useEffect(() => {
    filterAnnouncements();
  }, [selectedTab, announcements]);

  const setupTabs = () => {
    if (!user) return;
    
    const userDepartments = user.departments || [];
    const isKaryalay = user.isAdmin && userDepartments.includes('Karyalay');
    const isHOD = user.isAdmin && !userDepartments.includes('Karyalay');
    
    let tabs: string[] = ['ALL'];
    
    if (isKaryalay || isHOD) {
      tabs.push('Your announcements');
    } else {
      if (!userDepartments.includes('Karyalay')) {
        tabs.push('Karyalay');
      }
    }
    
    userDepartments.forEach(dept => {
      if (!tabs.includes(dept)) {
        tabs.push(dept);
      }
    });
    
    setAvailableTabs(Array.from(new Set(tabs)));
  };

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const data = await announcementApi.fetchUserAnnouncements();
      setAnnouncements(data);
      setFilteredAnnouncements(data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAnnouncements = () => {
    if (!user) return;
    
    if (selectedTab === 'ALL') {
      setFilteredAnnouncements(announcements);
      return;
    }

    let filtered: Announcement[] = [];

    if (selectedTab === 'Your announcements') {
      filtered = announcements.filter(a => a.authorId === user.userId);
    } else if (selectedTab === 'Karyalay') {
      filtered = announcements.filter(a => 
        a.authorDepartments && a.authorDepartments.includes('Karyalay')
      );
    } else {
      filtered = announcements.filter(a => 
        a.departmentTag && a.departmentTag.includes(selectedTab)
      );
    }

    setFilteredAnnouncements(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isRead = (announcement: Announcement) => {
    if (!user) return false;
    return announcement.readBy?.some(read => read.userId === user.userId) || false;
  };

  const hasUserLiked = (announcement: Announcement) => {
    if (!user) return false;
    return announcement.likedBy?.some(like => like.userId === user.userId) || false;
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

  const isAdmin = user.isAdmin || false;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.fullName || user.userId}</span>
            {isAdmin && (
              <Link
                href="/announcements/create"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            )}
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <div className="bg-white border-b border-gray-200 sticky top-[73px] z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-2 overflow-x-auto py-3 scrollbar-hide">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedTab === tab
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Announcements List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="ml-3 text-gray-600">Loading announcements...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No announcements found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => (
              <Link
                key={announcement.id}
                href={`/announcements/${announcement.id}`}
                className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {announcement.title}
                      </h2>
                      {announcement.status === 'scheduled' && (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                          Scheduled
                        </span>
                      )}
                      {announcement.status === 'draft' && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          Draft
                        </span>
                      )}
                      {!isRead(announcement) && announcement.status === 'published' && (
                        <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                      )}
                    </div>
                    <div
                      className="text-gray-600 mb-3 line-clamp-2 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: announcement.body.substring(0, 200) + '...',
                      }}
                    />
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>By {announcement.authorName || 'Unknown'}</span>
                      <span>•</span>
                      <span>{formatDate(announcement.createdAt)}</span>
                      {announcement.departmentTag && announcement.departmentTag.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex gap-2">
                            {announcement.departmentTag.slice(0, 3).map((dept, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs"
                              >
                                {dept}
                              </span>
                            ))}
                            {announcement.departmentTag.length > 3 && (
                              <span className="text-gray-500">+{announcement.departmentTag.length - 3}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      {announcement.likedBy && announcement.likedBy.length > 0 && (
                        <span className="text-sm text-gray-600">
                          ❤️ {announcement.likedBy.length} like{announcement.likedBy.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {announcement.readBy && announcement.readBy.length > 0 && (
                        <span className="text-sm text-gray-600">
                          👁️ {announcement.readBy.length} read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

