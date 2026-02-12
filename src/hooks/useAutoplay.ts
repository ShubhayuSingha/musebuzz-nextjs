import { useEffect, useRef } from "react";
import usePlayerStore from "@/stores/usePlayerStore";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

// Helper: Safely parse embedding string/array
const parseEmbedding = (embedding: any): number[] => {
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === 'string') {
    try {
      return JSON.parse(embedding);
    } catch (e) {
      console.error("Failed to parse embedding string", e);
      return [];
    }
  }
  return [];
};

// Helper: Add slight random noise to a vector
// noiseLevel: 0.0 to 1.0 (Recommended: 0.1 for subtle variety)
const addNoiseToVector = (vector: number[], noiseLevel: number = 0.1): number[] => {
  return vector.map(val => {
    // Generate a random shift between -noiseLevel and +noiseLevel
    const noise = (Math.random() * 2 - 1) * noiseLevel; 
    return val + (val * noise); // Scale noise relative to the value
  });
};

// Helper: Mix two vectors with a weight
const getWeightedVector = (vectorA: number[], vectorB: number[], weightA: number): number[] => {
  if (!vectorA || vectorA.length === 0) return vectorB || [];
  if (!vectorB || vectorB.length === 0) return vectorA || [];
  const length = vectorA.length;
  if (vectorB.length !== length) return vectorA; 

  const result = new Array(length).fill(0);
  const weightB = 1.0 - weightA;

  for (let i = 0; i < length; i++) {
    result[i] = (vectorA[i] * weightA) + (vectorB[i] * weightB);
  }
  return result;
};

// Helper: Simple Average (Centroid)
const getAverageEmbedding = (embeddings: number[][]): number[] => {
  if (embeddings.length === 0) return [];
  const length = embeddings[0].length;
  const result = new Array(length).fill(0);

  for (const vector of embeddings) {
    if (vector.length !== length) continue;
    for (let i = 0; i < length; i++) {
      if (typeof vector[i] === 'number' && !isNaN(vector[i])) {
         result[i] += vector[i];
      }
    }
  }
  return result.map(val => val / embeddings.length);
};

const useAutoplay = () => {
  const supabase = useSupabaseClient();
  const { 
    activeId, 
    bucketA,      
    autoplay,     
    isPlayingAutoplay,
    appendAutoplay
  } = usePlayerStore();

  const isFetching = useRef(false);

  useEffect(() => {
    const checkAndRefillQueue = async () => {
      if (bucketA.length === 0 && autoplay.length === 0) return;
      if (isFetching.current) return;

      // 1. Calculate Distance to End
      let itemsRemaining = 0;

      if (isPlayingAutoplay) {
        const currentIndex = activeId ? autoplay.indexOf(activeId) : -1;
        if (currentIndex !== -1) {
            itemsRemaining = autoplay.length - currentIndex - 1;
        }
      } else {
        const currentIndex = activeId ? bucketA.indexOf(activeId) : -1;
        if (currentIndex !== -1) {
            const contextRemaining = bucketA.length - currentIndex - 1;
            itemsRemaining = contextRemaining + autoplay.length;
        }
      }

      // 2. Trigger Fetch if low
      if (itemsRemaining <= 3) {
        isFetching.current = true;
        try {
           console.log("⚡ Generating Recommendations (Weighted + Noise)...");

           // A. GATHER SEEDS
           const effectiveQueue = [...bucketA, ...autoplay];
           const seedIds = effectiveQueue.slice(-5);

           if (seedIds.length === 0) return;

           // B. FETCH EMBEDDINGS
           const { data: seedData, error: fetchError } = await supabase
             .from("songs")
             .select("id, embedding")
             .in("id", seedIds);

           if (fetchError || !seedData) return;

           const vectorMap = new Map(seedData.map(s => [s.id, parseEmbedding(s.embedding)]));
           
           const orderedVectors = seedIds
              .map(id => vectorMap.get(id))
              .filter(v => v !== undefined && v.length > 0) as number[][];

           if (orderedVectors.length === 0) return;

           // C. CALCULATE TARGET
           let baseVector: number[] = [];

           if (orderedVectors.length === 1) {
              baseVector = orderedVectors[0];
           } else {
              const lastSongVector = orderedVectors[orderedVectors.length - 1];
              const historyVectors = orderedVectors.slice(0, orderedVectors.length - 1);
              const historyAverage = getAverageEmbedding(historyVectors);

              if (lastSongVector && historyAverage) {
                  // 70% Last Song / 30% History
                  baseVector = getWeightedVector(lastSongVector, historyAverage, 0.7);
              } else {
                  baseVector = lastSongVector || historyAverage || [];
              }
           }

           // 🟢 D. ADD THE NOISE (The "Jitter")
           // 0.15 = 15% variation. Enough to escape the album, small enough to stay in genre.
           const searchVector = addNoiseToVector(baseVector, 0.15);

           if (searchVector.length === 0) return;

           // E. SEARCH SUPABASE
           const { data: newSongs, error } = await supabase.rpc("match_songs", {
             query_embedding: searchVector, 
             match_threshold: 0.6,          
             match_count: 10,  
             exclude_ids: effectiveQueue    
           });

           if (error) throw error;

           if (newSongs && newSongs.length > 0) {
             const newIds = newSongs.map((s: any) => s.id);
             appendAutoplay(newIds); 
           }

        } catch (error: any) {
          console.error("Autoplay Error:", error.message);
        } finally {
          isFetching.current = false;
        }
      }
    };

    checkAndRefillQueue();
  }, [activeId, bucketA, autoplay, isPlayingAutoplay, appendAutoplay, supabase]);
};

export default useAutoplay;