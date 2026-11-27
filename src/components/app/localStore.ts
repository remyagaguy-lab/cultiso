const LOCAL_STORAGE_EVENT = "cultiso-local-storage";

export function subscribeLocalStore(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(LOCAL_STORAGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LOCAL_STORAGE_EVENT, handler);
  };
}

export function getLocalItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLocalItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_EVENT));
  } catch {
    // ignore storage quota errors
  }
}
