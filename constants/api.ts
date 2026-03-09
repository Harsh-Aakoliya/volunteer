// API URL: reads/writes from centralized Zustand store so all consumers stay in sync
import { useApiStore } from "@/stores/apiStore";

export const getApiUrl = (): string => useApiStore.getState().getApiUrl();

export const setApiUrl = (newUrl: string): void => {
  useApiStore.getState().setApiUrl(newUrl);
};

export const updateDevIP = (newDevIP: string): void => {
  setApiUrl(newDevIP);
  console.log("🔧 Dev IP updated and set as API URL:", newDevIP);
};

// Proxy so existing code using API_URL as a string still works (always reads current value from store)
const createDynamicString = () => {
  return new Proxy(
    {},
    {
      get(_, prop) {
        const currentApiUrl = useApiStore.getState().getApiUrl();
        if (
          prop === Symbol.toPrimitive ||
          prop === "valueOf" ||
          prop === "toString"
        ) {
          return () => currentApiUrl;
        }
        if (prop === "replace") {
          return (searchValue: string | RegExp, replaceValue: string) =>
            currentApiUrl.replace(searchValue as string, replaceValue);
        }
        if (prop === "includes") {
          return (searchString: string, position?: number) =>
            currentApiUrl.includes(searchString, position);
        }
        if (prop === "startsWith") {
          return (searchString: string, position?: number) =>
            currentApiUrl.startsWith(searchString, position);
        }
        if (prop === "endsWith") {
          return (searchString: string, length?: number) =>
            currentApiUrl.endsWith(searchString, length);
        }
        if (prop === "substring") {
          return (start: number, end?: number) =>
            currentApiUrl.substring(start, end);
        }
        if (prop === "slice") {
          return (start?: number, end?: number) =>
            currentApiUrl.slice(start, end);
        }
        if (prop === "length") {
          return currentApiUrl.length;
        }
        return (currentApiUrl as any)[prop as keyof string];
      },
    }
  );
};

export const API_URL = createDynamicString() as unknown as string;
