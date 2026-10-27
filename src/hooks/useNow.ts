'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 15_000;
const listeners = new Set<() => void>();
let current = typeof window === 'undefined' ? 0 : Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function emit(): void {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (!timer) {
    current = Date.now();
    timer = setInterval(emit, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return current;
}

function getServerSnapshot(): number {
  return 0;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
