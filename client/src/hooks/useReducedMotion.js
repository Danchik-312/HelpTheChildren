import { useSyncExternalStore } from 'react';

const query = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribe = (notify) => {
  query?.addEventListener('change', notify);
  return () => query?.removeEventListener('change', notify);
};

export default function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => query?.matches ?? true, () => true);
}
