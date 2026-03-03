// src/hooks/useSearchHistory.ts
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabaseClient';

export interface SearchHistoryItem {
  id: string;
  user_id: string;
  item_id: string;
  item_type: 'song' | 'album' | 'artist' | 'playlist';
  title: string;
  subtitle: string | null;
  image_path: string | null;
  updated_at: string;
}

export const useSearchHistory = () => {
  const user = useUser();
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch the latest 20 items
  const fetchHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setHistory(data);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // 2. Add or "Bump" an item to the top
  const addToHistory = async (item: Omit<SearchHistoryItem, 'id' | 'user_id' | 'updated_at'>) => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      item_id: item.item_id,
      item_type: item.item_type,
      title: item.title,
      subtitle: item.subtitle,
      image_path: item.image_path,
      updated_at: new Date().toISOString(),
    };

    // The 'onConflict' uses that UNIQUE rule we made in SQL to trigger an update instead of a crash
    const { error } = await supabase
      .from('search_history')
      .upsert(payload, { onConflict: 'user_id, item_id' });

    if (!error) {
      fetchHistory(); // Refresh the list to show it at the top
    }
  };

  // 3. Remove a single item (The 'X' button on a row)
  const removeFromHistory = async (historyId: string) => {
    if (!user) return;

    // Optimistic UI update for instant feel
    setHistory((prev) => prev.filter((item) => item.id !== historyId));

    await supabase
      .from('search_history')
      .delete()
      .eq('id', historyId)
      .eq('user_id', user.id);
  };

  // 4. Clear all history (The 'Clear recent searches' button)
  const clearAllHistory = async () => {
    if (!user) return;

    setHistory([]);

    await supabase
      .from('search_history')
      .delete()
      .eq('user_id', user.id);
  };

  return {
    history,
    isLoading,
    addToHistory,
    removeFromHistory,
    clearAllHistory,
  };
};