// utils/dateUtils.ts
// Utility functions for consistent IST (Indian Standard Time) handling

/**
 * Get current IST timestamp as ISO string
 */
export const getISTTimestamp = (): string => {
  const now = new Date();
  // Return current time as ISO string - backend will handle IST conversion
  console.log("now",now);
  return now.toISOString();
};

/**
 * Convert any date to IST display time
 */
export const toIST = (date: Date | string): Date => {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  // For display purposes, we'll use the browser's timezone handling
  // The backend already stores timestamps in the correct timezone
  return inputDate;
};

/**
 * Format IST date for display
 */
export const formatISTDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  return inputDate.toLocaleString('en-IN', { ...defaultOptions, ...options });
};

/**
 * Format IST time only
 */
export const formatISTTime = (date: Date | string): string => {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  
  return inputDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format IST date only
 */
export const formatISTDateOnly = (date: Date | string): string => {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  
  return inputDate.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Get relative time in IST context
 */
export const getRelativeTimeIST = (date: Date | string): string => {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const diffInMs = now.getTime() - inputDate.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else {
    return formatISTDateOnly(inputDate);
  }
};

/**
 * Check if two dates are the same day in IST
 */
export const isSameDayIST = (date1: Date | string, date2: Date | string): boolean => {
  const inputDate1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const inputDate2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  // Convert both dates to IST timezone for comparison
  const istDate1 = new Date(inputDate1.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const istDate2 = new Date(inputDate2.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  return istDate1.toDateString() === istDate2.toDateString();
};

/**
 * Get IST timezone offset string
 */
export const getISTOffset = (): string => {
  return '+05:30';
};

/**
 * Parse timestamp for database operations
 * Note: This function is kept for backward compatibility but may not be needed
 */
export const parseISTToUTC = (timestamp: string): Date => {
  const date = new Date(timestamp);
  return date;
};
