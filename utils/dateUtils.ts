// utils/dateUtils.ts
// Utility functions for consistent IST (Indian Standard Time) handling

/**
 * Get current IST timestamp as ISO string
 */
export const getISTTimestamp = (): string => {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return istTime.toISOString();
};

/**
 * Convert any date to IST
 */
export const toIST = (date: Date | string): Date => {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  // Convert to IST (UTC+5:30)
  return new Date(inputDate.getTime() + (5.5 * 60 * 60 * 1000));
};

/**
 * Format IST date for display
 */
export const formatISTDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const istDate = toIST(date);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  return istDate.toLocaleString('en-IN', { ...defaultOptions, ...options });
};

/**
 * Format IST time only
 */
export const formatISTTime = (date: Date | string): string => {
  const istDate = toIST(date);
  
  return istDate.toLocaleString('en-IN', {
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
  const istDate = toIST(date);
  
  return istDate.toLocaleDateString('en-IN', {
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
  const istDate = toIST(date);
  const now = toIST(new Date());
  
  const diffInMs = now.getTime() - istDate.getTime();
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
    return formatISTDateOnly(istDate);
  }
};

/**
 * Check if two dates are the same day in IST
 */
export const isSameDayIST = (date1: Date | string, date2: Date | string): boolean => {
  const istDate1 = toIST(date1);
  const istDate2 = toIST(date2);
  
  return istDate1.toDateString() === istDate2.toDateString();
};

/**
 * Get IST timezone offset string
 */
export const getISTOffset = (): string => {
  return '+05:30';
};

/**
 * Parse IST timestamp to local date for database operations
 */
export const parseISTToUTC = (istTimestamp: string): Date => {
  const date = new Date(istTimestamp);
  // Subtract IST offset to get UTC
  return new Date(date.getTime() - (5.5 * 60 * 60 * 1000));
};
