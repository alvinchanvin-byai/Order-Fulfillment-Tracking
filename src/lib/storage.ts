// Safe local/session storage fallback utility to prevent security exceptions in sandboxed iframes
const memoryStorage = new Map<string, string>();
const sessionMemoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage.getItem read blocked/failed for key "${key}". Using active memory backup.`, e);
      return memoryStorage.get(key) || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`localStorage.setItem write blocked/failed for key "${key}". Saving to active memory backup.`, e);
    }
    memoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`localStorage.removeItem delete failed for "${key}".`, e);
    }
    memoryStorage.delete(key);
  },
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('localStorage.clear blocked/failed.', e);
    }
    memoryStorage.clear();
  }
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      console.warn(`sessionStorage.getItem read blocked/failed for key "${key}". Using active memory backup.`, e);
      return sessionMemoryStorage.get(key) || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn(`sessionStorage.setItem write blocked/failed for key "${key}". Saving to active memory backup.`, e);
    }
    sessionMemoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn(`sessionStorage.removeItem delete failed for "${key}".`, e);
    }
    sessionMemoryStorage.delete(key);
  },
  clear: (): void => {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('sessionStorage.clear blocked/failed.', e);
    }
    sessionMemoryStorage.clear();
  }
};
