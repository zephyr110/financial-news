import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "financial-signals-watched-industries";

export function useWatchedIndustries() {
  const [watched, setWatched] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setWatched(stored ? JSON.parse(stored) : []);
    } catch { setWatched([]); }
    setLoaded(true);
  }, []);

  const toggle = useCallback((industry) => {
    setWatched(prev => {
      const next = prev.includes(industry)
        ? prev.filter(i => i !== industry)
        : [...prev, industry];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setWatched([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const filterByWatched = useCallback((items) => {
    if (!watched || watched.length === 0) return items;
    return items.filter(item => {
      if (!item.industries || item.industries.length === 0) return true;
      return item.industries.some(ind => watched.includes(ind));
    });
  }, [watched]);

  return { watched, loaded, toggle, clearAll, filterByWatched, hasFilters: watched.length > 0 };
}
