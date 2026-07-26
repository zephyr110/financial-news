import { useEffect, useRef } from "react";

/**
 * Checks for new critical signals (score >= 4) and shows browser notification.
 * Only fires once per session for the same signal set to avoid spam.
 */
export default function SignalAlert({ items }) {
  const lastNotifiedRef = useRef(0);

  useEffect(() => {
    if (!items || items.length === 0) return;
    if (typeof Notification === 'undefined') return;

    const critical = items.filter(i => i.signal_score >= 4);
    if (critical.length === 0) return;

    // Only notify if we have new items since last check
    const latestId = critical[0]?.id || 0;
    if (latestId <= lastNotifiedRef.current) return;
    lastNotifiedRef.current = latestId;

    // Request permission if needed
    if (Notification.permission === 'granted') {
      showNotification(critical);
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') showNotification(critical);
      });
    }
  }, [items]);

  return null;
}

function showNotification(critical) {
  const top = critical.slice(0, 3);
  const body = top.map(i => `[${i.signal_score}分] ${i.summary}`).join('\n');
  try {
    new Notification(`财经信号 · ${critical.length} 条重要预警`, {
      body,
      icon: '/favicon.svg',
      tag: 'financial-signals-alert',
    });
  } catch { /* browser may block */ }
}
