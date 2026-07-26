import { useState, useEffect } from "react";

/**
 * Only render children on the client, preventing SSR hydration mismatches.
 * Use for components that depend on browser APIs (Recharts, date formatting, etc.)
 */
export default function ClientOnly({ children, fallback }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return fallback || null;

  return children;
}
