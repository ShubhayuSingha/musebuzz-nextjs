// src/hooks/useSearchHistory.ts
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabaseClient';

export interface SearchHistoryItem {
  id: string;
  user_id: string;
  item_id: string;
  item_type: 'song' | 'album' | 'artist' | 'playlist' | 'mix';
  title: string;
  subtitle: string | null;
  image_path: string | null;
  updated_at: string;
}

const getStorageKey = (userId?: string) => `musebuzz_search_history_${userId || 'anonymous'}`;

export const useSearchHistory = () => {
  const user = useUser();
  const userId = user?.id;

  // Initialize from localStorage cache for instant zero-flicker render
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(getStorageKey(userId));
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch latest items: Supabase when online, localStorage fallback when offline
  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setHistory(data);
        try {
          localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
        } catch {}
      } else {
        const cached = localStorage.getItem(getStorageKey(userId));
        if (cached) setHistory(JSON.parse(cached));
      }
    } catch {
      const cached = localStorage.getItem(getStorageKey(userId));
      if (cached) setHistory(JSON.parse(cached));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // 2. Add or "Bump" an item to the top (works online and offline)
  const addToHistory = async (item: Omit<SearchHistoryItem, 'id' | 'user_id' | 'updated_at'>) => {
    if (!user) return;

    const newItem: SearchHistoryItem = {
      id: `${user.id}_${item.item_id}`,
      user_id: user.id,
      item_id: item.item_id,
      item_type: item.item_type,
      title: item.title,
      subtitle: item.subtitle,
      image_path: item.image_path,
      updated_at: new Date().toISOString(),
    };

    // Optimistically update local state & localStorage for instant UI feedback
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.item_id !== item.item_id);
      const updated = [newItem, ...filtered].slice(0, 20);
      try {
        localStorage.setItem(getStorageKey(user.id), JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const { error } = await supabase
        .from('search_history')
        .upsert(newItem, { onConflict: 'user_id, item_id' });

      if (!error) {
        fetchHistory();
      }
    } catch {
      // Offline fallback: already stored locally in state and localStorage
    }
  };

  // 3. Remove a single item (The 'X' button on a row)
  const removeFromHistory = async (historyId: string) => {
    if (!user) return;

    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== historyId);
      try {
        localStorage.setItem(getStorageKey(user.id), JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await supabase
        .from('search_history')
        .delete()
        .eq('id', historyId)
        .eq('user_id', user.id);
    } catch {}
  };

  // 4. Clear all history (The 'Clear recent searches' button)
  const clearAllHistory = async () => {
    if (!user) return;

    setHistory([]);
    try {
      localStorage.removeItem(getStorageKey(user.id));
    } catch {}

    try {
      await supabase
        .from('search_history')
        .delete()
        .eq('user_id', user.id);
    } catch {}
  };

  return {
    history,
    isLoading,
    addToHistory,
    removeFromHistory,
    clearAllHistory,
  };
};
