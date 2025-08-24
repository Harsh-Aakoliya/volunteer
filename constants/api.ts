// Dynamic API URL configuration
let currentApiUrl = ""; // Will be set dynamically based on network connectivity

// Function to get current API URL
export const getApiUrl = (): string => currentApiUrl;

// Function to get current Socket URL
export const getSocketUrl = (): string => currentApiUrl;

// Function to set new API URL
export const setApiUrl = (newUrl: string): void => {
  currentApiUrl = newUrl;
  console.log('🔗 API_URL configured as:', currentApiUrl);
  console.log('🌐 SOCKET_URL configured as:', currentApiUrl);
};

// Create a proxy object that behaves like a string but returns dynamic value
const createDynamicString = () => {
  return new Proxy({}, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'valueOf' || prop === 'toString') {
        return () => currentApiUrl;
      }
      if (prop === 'replace') {
        return (searchValue: string | RegExp, replaceValue: string) => currentApiUrl.replace(searchValue, replaceValue);
      }
      if (prop === 'includes') {
        return (searchString: string, position?: number) => currentApiUrl.includes(searchString, position);
      }
      if (prop === 'startsWith') {
        return (searchString: string, position?: number) => currentApiUrl.startsWith(searchString, position);
      }
      if (prop === 'endsWith') {
        return (searchString: string, length?: number) => currentApiUrl.endsWith(searchString, length);
      }
      if (prop === 'substring') {
        return (start: number, end?: number) => currentApiUrl.substring(start, end);
      }
      if (prop === 'slice') {
        return (start?: number, end?: number) => currentApiUrl.slice(start, end);
      }
      if (prop === 'length') {
        return currentApiUrl.length;
      }
      // For template literals and string concatenation
      return currentApiUrl[prop as keyof string];
    }
  });
};

// Export dynamic string objects that behave like regular strings
export const API_URL = createDynamicString() as any as string;
export const SOCKET_URL = createDynamicString() as any as string;