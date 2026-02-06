// utils/dateUtils.ts
// Utility functions for consistent IST (Indian Standard Time) handling

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
  
  return inputDate.toLocaleString('en-US', { ...defaultOptions, ...options });
};

/**
 * Format IST time only
 */
export const formatISTTime = (date: Date | string): string => {
  if(date === null || date === undefined || date === ""){
    return "";
  }
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  
  return inputDate.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

