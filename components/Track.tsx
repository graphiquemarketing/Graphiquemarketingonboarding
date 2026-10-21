'use client';
import { useEffect } from 'react';
import { track, type EventName } from '@/lib/analytics';

/** Dispara un evento de analítica al montar, deduplicado por clave. */
export function Track({ event, params, dedupe }: { event: EventName; params?: Record<string, string>; dedupe?: string }) {
  useEffect(() => { track(event, params, dedupe); }, [event, params, dedupe]);
  return null;
}
