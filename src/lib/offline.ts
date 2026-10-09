import { useEffect, useState } from 'react';

/** Ask the browser not to clear Neon Loop's saved data when the laptop runs low on space. */
export async function keepStorage(): Promise<boolean> {
  try { if (!navigator.storage?.persist) return false; return (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch { return false; }
}

export function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => { const up = () => setOn(true), down = () => setOn(false); addEventListener('online', up); addEventListener('offline', down); return () => { removeEventListener('online', up); removeEventListener('offline', down); }; }, []);
  return on;
}
