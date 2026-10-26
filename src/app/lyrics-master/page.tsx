// src/app/lyrics-master/page.tsx

"use client";

// ============================================================================
// TODO: SECURITY WARNING
// This route is currently accessible for diagnostics and development purposes.
// Before deploying to production or general public access, this entire route
// must be secured with administrator authentication and role-based access checks.
// ============================================================================

import React, { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  DatabaseSong,
  ResolvedRecording,
  RecordingMatchAssessment,
  UnifiedLyrics,
  CandidateTrackSummary,
} from "./types/lyricsMaster.types";

import {
  resolveSongWithLiriQo,
  fetchRawTTML,
  fetchJsonLyrics,
} from "./utils/liriqoClient";
import { parseTTML } from "./utils/ttmlParser";
import {
  analyzeCandidates,
  normalizeJsonTrack,
} from "./utils/jsonLyricsParser";
import { assessRecordingMatch } from "./utils/recordingMatcher";

import { SongSearchPanel } from "./components/SongSearchPanel";
import { RecordingResolverCard } from "./components/RecordingResolverCard";
import { RetrievalPipelineControls } from "./components/RetrievalPipelineControls";
import { TtmlInspectionCard } from "./components/TtmlInspectionCard";
import { JsonTracksTable } from "./components/JsonTracksTable";
import { NormalizedLyricsViewer } from "./components/NormalizedLyricsViewer";
import { AudioDiagnosticsPanel } from "./components/AudioDiagnosticsPanel";
import { MetricsSummaryCard } from "./components/MetricsSummaryCard";
import { RawPayloadModal } from "./components/RawPayloadModal";

import { FaTerminal, FaSlidersH, FaLayerGroup, FaMusic } from "react-icons/fa";
import { AppleLyricsRenderer } from "./components/AppleLyricsRenderer";

export default function LyricsMasterPage() {
  // 1. Database Song Selection
  const [selectedSong, setSelectedSong] = useState<DatabaseSong | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // 2. Recording Resolution
  const [resolvedRecording, setResolvedRecording] =
    useState<ResolvedRecording | null>(null);
  const [matchAssessment, setMatchAssessment] =
    useState<RecordingMatchAssessment | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(false);

  // 3. TTML Retrieval & Inspection
  const [rawXml, setRawXml] = useState<string | null>(null);
  const [ttmlLyrics, setTtmlLyrics] = useState<UnifiedLyrics | null>(null);
  const [isFetchingTtml, setIsFetchingTtml] = useState<boolean>(false);
  const [ttmlError, setTtmlError] = useState<string | null>(null);

  // 4. JSON Multi-Provider Retrieval
  const [rawJsonString, setRawJsonString] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateTrackSummary[]>([]);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<
    number | null
  >(null);
  const [isFetchingJson, setIsFetchingJson] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 5. Active Unified Lyrics for Testing & Display
  const [activeLyrics, setActiveLyrics] = useState<UnifiedLyrics | null>(null);
  const [activeSource, setActiveSource] = useState<"ttml" | "json" | null>(
    null,
  );

  // 6. Audio Playback & Real-time Sync State
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [seekRequestMs, setSeekRequestMs] = useState<number | null>(null);

  // 7. Pipeline Status Banner
  const [pipelineStatus, setPipelineStatus] = useState<{
    type: "idle" | "loading" | "success" | "warning" | "error" | "info";
    message: string;
  }>({
    type: "idle",
    message:
      "Welcome to Lyrics Master. Select a song from the catalogue on the left to begin.",
  });

  // 8. Raw Payload Viewer Modal State
  const [rawModal, setRawModal] = useState<{
    isOpen: boolean;
    title: string;
    payload: string | null;
    format: "xml" | "json";
  }>({
    isOpen: false,
    title: "",
    payload: null,
    format: "xml",
  });

  // Active view tab state (Pipeline vs Lyrics Stream vs Diagnostics)
  const [activeTab, setActiveTab] = useState<
    "pipeline" | "stream" | "diagnostics"
  >("pipeline");

  // Handle selecting a database song
  const handleSelectSong = (song: DatabaseSong) => {
    setSelectedSong(song);

    // Resolve public audio URL from Supabase storage
    if (song.song_path) {
      const { data } = supabase.storage
        .from("songs")
        .getPublicUrl(song.song_path);
      setAudioUrl(data.publicUrl);
    } else {
      setAudioUrl(null);
    }

    // Reset retrieval state
    setResolvedRecording(null);
    setMatchAssessment(null);
    setRawXml(null);
    setTtmlLyrics(null);
    setRawJsonString(null);
    setCandidates([]);
    setSelectedCandidateIndex(null);
    setActiveLyrics(null);
    setActiveSource(null);
    setCurrentTimeMs(0);
    setSeekRequestMs(null);

    setPipelineStatus({
      type: "idle",
      message: `Selected "${song.title}". Click "Resolve with LiriQo" or run the automated pipeline.`,
    });

    // Auto-resolve video ID for convenience
    resolveSong(song);
  };

  // Video resolution logic
  const resolveSong = async (song: DatabaseSong) => {
    setIsResolving(true);
    const artistName = song.albums?.artists?.name || "";
    const query = `${song.title} ${artistName}`.trim();

    setPipelineStatus({
      type: "loading",
      message: `Resolving YouTube video ID for "${song.title}" by ${artistName}...`,
    });

    const res = await resolveSongWithLiriQo(query, {
      title: song.title,
      artist: artistName,
    });

    setIsResolving(false);

    if (res.success && res.data) {
      setResolvedRecording(res.data);
      const assessment = assessRecordingMatch(song, res.data);
      setMatchAssessment(assessment);

      setPipelineStatus({
        type: assessment.confidence === "WARNING" ? "warning" : "success",
        message: `Resolved video ID "${res.data.videoId}". Recording match confidence: ${assessment.confidence}.`,
      });
    } else {
      setPipelineStatus({
        type: "error",
        message: `Resolution failed: ${res.error || "No matching video ID found."}. You can manually paste a YouTube ID above.`,
      });
    }
  };

  // Handle manual video ID change
  const handleVideoIdChange = (newId: string) => {
    if (!selectedSong) return;
    const manualResolved: ResolvedRecording = {
      videoId: newId,
      source: "youtube",
      title: selectedSong.title,
      artist: selectedSong.albums?.artists?.name || "Unknown",
      album: selectedSong.albums?.title || "",
      duration: "",
    };
    setResolvedRecording(manualResolved);
    const assessment = assessRecordingMatch(selectedSong, manualResolved);
    setMatchAssessment(assessment);
    setPipelineStatus({
      type: "info",
      message: `Manual video ID "${newId}" applied. Ready to fetch lyrics.`,
    });
  };

  // Handle Fetching TTML
  const handleFetchTtml = useCallback(async (): Promise<boolean> => {
    if (!resolvedRecording?.videoId) {
      setPipelineStatus({
        type: "error",
        message: "Cannot fetch TTML: No video ID available.",
      });
      return false;
    }

    setIsFetchingTtml(true);
    setTtmlError(null);
    setPipelineStatus({
      type: "loading",
      message: `Requesting raw TTML from /ttml?v=${resolvedRecording.videoId}...`,
    });

    const res = await fetchRawTTML(resolvedRecording.videoId);
    setIsFetchingTtml(false);

    if (!res.success || !res.xml) {
      setTtmlError(res.error || "TTML endpoint returned no usable lyrics.");
      setPipelineStatus({
        type: "warning",
        message: `TTML rejected: ${res.error || "No TTML track available"}. Fallback to JSON is recommended.`,
      });
      return false;
    }

    setRawXml(res.xml);

    // Parse and inspect TTML
    const parseRes = parseTTML(res.xml);
    if (!parseRes.success || !parseRes.lyrics) {
      setTtmlError(parseRes.error || "XML parsing failed.");
      setPipelineStatus({
        type: "error",
        message: `TTML parse failed: ${parseRes.error}`,
      });
      return false;
    }

    setTtmlLyrics(parseRes.lyrics);
    setActiveLyrics(parseRes.lyrics);
    setActiveSource("ttml");

    const isSyllable = parseRes.lyrics.isGenuineSyllableSync;
    setPipelineStatus({
      type: isSyllable ? "success" : "warning",
      message: isSyllable
        ? `TTML successfully loaded! Syllable-level timing verified with ${parseRes.lyrics.diagnostics.totalSegments} segments.`
        : `TTML loaded with ${parseRes.lyrics.actualGranularity.toUpperCase()} timing (${parseRes.lyrics.granularityReason}).`,
    });

    return true;
  }, [resolvedRecording?.videoId]);

  // Handle Fetching JSON Fallback
  const handleFetchJson = useCallback(async (): Promise<boolean> => {
    if (!resolvedRecording?.videoId) {
      setPipelineStatus({
        type: "error",
        message: "Cannot fetch JSON: No video ID available.",
      });
      return false;
    }

    setIsFetchingJson(true);
    setJsonError(null);
    setPipelineStatus({
      type: "loading",
      message: `Querying multi-provider endpoint /lyrics?v=${resolvedRecording.videoId}&debug=1...`,
    });

    const res = await fetchJsonLyrics(resolvedRecording.videoId, true);
    setIsFetchingJson(false);

    if (!res.success || !res.data) {
      setJsonError(res.error || "Failed to retrieve JSON lyrics.");
      setPipelineStatus({
        type: "error",
        message: `JSON fetch error: ${res.error || "Failed to retrieve multi-provider lyrics"}`,
      });
      return false;
    }

    setRawJsonString(JSON.stringify(res.data, null, 2));

    const candidateList = analyzeCandidates(res.data);
    setCandidates(candidateList);

    if (candidateList.length === 0) {
      setPipelineStatus({
        type: "warning",
        message: "No lyric tracks found in the multi-provider response.",
      });
      return false;
    }

    // Select the top recommended candidate
    const top = candidateList[0];
    setSelectedCandidateIndex(top.index);

    const normalized = normalizeJsonTrack(
      top.rawTrack,
      JSON.stringify(res.data, null, 2),
    );
    setActiveLyrics(normalized);
    setActiveSource("json");

    setPipelineStatus({
      type: "success",
      message: `Retrieved ${candidateList.length} provider tracks. Selected recommended: "${top.provider}" (${top.actualGranularity.toUpperCase()} sync).`,
    });

    return true;
  }, [resolvedRecording?.videoId]);

  // Handle Auto Pipeline: TTML first -> verify syllable/word -> fallback to JSON if line-only or missing
  const handleRunAutoPipeline = async () => {
    if (!resolvedRecording?.videoId) return;

    setPipelineStatus({
      type: "loading",
      message:
        "Running automated retrieval pipeline: Attempting Apple Music TTML first...",
    });

    const ttmlSuccess = await handleFetchTtml();

    // Check if TTML was syllable grade
    if (ttmlSuccess && ttmlLyrics?.isGenuineSyllableSync) {
      setPipelineStatus({
        type: "success",
        message:
          "Pipeline complete: Genuine syllable-grade TTML retrieved and validated!",
      });
      return;
    }

    // If TTML was missing or only line-level, also fetch JSON fallback to compare all providers
    setPipelineStatus({
      type: "loading",
      message:
        "TTML was not syllable-grade. Fetching multi-provider JSON to find higher-quality tracks...",
    });

    await handleFetchJson();
  };

  // Handle manual provider selection from JSON tracks table
  const handleSelectCandidate = (index: number) => {
    const candidate = candidates.find((c) => c.index === index);
    if (!candidate) return;

    setSelectedCandidateIndex(index);
    const normalized = normalizeJsonTrack(
      candidate.rawTrack,
      rawJsonString || undefined,
    );
    setActiveLyrics(normalized);
    setActiveSource("json");

    setPipelineStatus({
      type: "info",
      message: `Switched active candidate to "${candidate.provider}" (${candidate.actualGranularity.toUpperCase()} timing).`,
    });
  };

  // Seek handler from lyrics line click
  const handleSeek = (ms: number) => {
    setSeekRequestMs(ms);
  };

  // Find active line index based on playback time
  const currentLineIndex = activeLyrics
    ? activeLyrics.lines.findIndex(
        (l) => currentTimeMs >= l.startMs && currentTimeMs <= l.endMs,
      )
    : -1;

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workspace Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-purple-950/40 border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="bg-purple-600 text-white font-black text-xs px-2.5 py-1 rounded-md uppercase tracking-wider">
                Workspace
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Lyrics Master
              </h1>
              <span className="text-xs text-neutral-400 font-mono hidden sm:inline-block">
                v1.0 (Phase 1: Retrieval & Diagnostics)
              </span>
            </div>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Explore your catalog, resolve YouTube recordings, audit TTML vs
              JSON timing granularity, and verify syllable synchronisation
              against recording audio.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs bg-neutral-800/80 border border-neutral-700 text-neutral-300 font-mono px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LiriQo API v1 Connected
            </span>
          </div>
        </div>
        {/* Section 1: Song Database Search & Recording Resolution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SongSearchPanel
            selectedSong={selectedSong}
            onSelectSong={handleSelectSong}
          />

          {selectedSong ? (
            <RecordingResolverCard
              selectedSong={selectedSong}
              resolvedRecording={resolvedRecording}
              matchAssessment={matchAssessment}
              isResolving={isResolving}
              onResolve={() => resolveSong(selectedSong)}
              onVideoIdChange={handleVideoIdChange}
            />
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg">
              <FaMusic className="text-neutral-600 text-4xl mb-3" />
              <h3 className="font-bold text-neutral-300 text-lg">
                No Song Selected
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1">
                Select a track from the catalogue on the left to inspect its
                metadata and resolve its YouTube video ID.
              </p>
            </div>
          )}
        </div>
        {/* Section 2: Retrieval Pipeline Controls */}
        <RetrievalPipelineControls
          hasSelectedSong={Boolean(selectedSong)}
          hasVideoId={Boolean(resolvedRecording?.videoId)}
          isFetchingTtml={isFetchingTtml}
          isFetchingJson={isFetchingJson}
          activeSource={activeSource}
          pipelineStatus={pipelineStatus}
          onFetchTtml={handleFetchTtml}
          onFetchJson={handleFetchJson}
          onRunAutoPipeline={handleRunAutoPipeline}
          onReset={() => {
            setActiveLyrics(null);
            setActiveSource(null);
            setRawXml(null);
            setTtmlLyrics(null);
            setCandidates([]);
            setSelectedCandidateIndex(null);
            setCurrentTimeMs(0);
            setPipelineStatus({
              type: "idle",
              message: "Workspace reset. Ready to retrieve lyrics.",
            });
          }}
        />
        {/* Navigation Tabs for Granular Workspaces */}
        <div className="flex border-b border-neutral-800 gap-2 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`pb-3 px-4 transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "pipeline"
                ? "border-purple-500 text-purple-400 font-bold"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <FaLayerGroup className="text-xs" />
            Provider Inspection (TTML & JSON Matrix)
          </button>

          <button
            onClick={() => setActiveTab("stream")}
            className={`pb-3 px-4 transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "stream"
                ? "border-purple-500 text-purple-400 font-bold"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <FaTerminal className="text-xs" />
            Normalized Timeline & Syllable Drilldown
            {activeLyrics && (
              <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded font-mono">
                {activeLyrics.lines.length} lines
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`pb-3 px-4 transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "diagnostics"
                ? "border-purple-500 text-purple-400 font-bold"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <FaSlidersH className="text-xs" />
            Audio Playback & Sync Diagnostics
          </button>
        </div>
        {/* Tab 1: Provider Inspection View */}
        {activeTab === "pipeline" && (
          <div className="space-y-6">
            <TtmlInspectionCard
              ttmlLyrics={ttmlLyrics}
              rawXml={rawXml}
              errorMessage={ttmlError}
              onViewRawXml={() =>
                setRawModal({
                  isOpen: true,
                  title: "Raw Apple Music TTML Payload",
                  payload: rawXml,
                  format: "xml",
                })
              }
            />

            <JsonTracksTable
              candidates={candidates}
              selectedCandidateIndex={selectedCandidateIndex}
              onSelectCandidate={handleSelectCandidate}
              onViewRawJson={() =>
                setRawModal({
                  isOpen: true,
                  title: "Raw Multi-Provider JSON Response",
                  payload: rawJsonString,
                  format: "json",
                })
              }
              isLoading={isFetchingJson}
              errorMessage={jsonError}
            />
          </div>
        )}
        {/* Tab 2: Normalized Lyric Stream View */}
        {activeTab === "stream" && (
          <NormalizedLyricsViewer
            lyrics={activeLyrics}
            currentTimeMs={currentTimeMs}
            activeLineIndex={currentLineIndex}
            onSeek={handleSeek}
          />
        )}
        
        {/* Tab 3: Audio Diagnostics & Quality Metrics View */}
        {activeTab === "diagnostics" && (
          <div className="space-y-6">
            <AudioDiagnosticsPanel
              audioUrl={audioUrl}
              songTitle={selectedSong?.title || "Unknown Title"}
              songDurationSeconds={selectedSong?.duration_seconds}
              lyrics={activeLyrics}
              currentTimeMs={currentTimeMs}
              onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
              seekRequestMs={seekRequestMs}
              onSeekHandled={() => setSeekRequestMs(null)}
            />

            <MetricsSummaryCard
              lyrics={activeLyrics}
              songDurationSeconds={selectedSong?.duration_seconds}
            />
          </div>
        )}
        {/* Apple Music Style Animated Renderer Preview (Moved inside max-w-7xl) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4">
            Live Apple Music Renderer Preview
          </h2>

          <AppleLyricsRenderer
            lyrics={activeLyrics}
            currentTimeMs={currentTimeMs}
            onSeek={handleSeek}
          />
        </div>
      </div>{" "}
      {/* End of max-w-7xl mx-auto container */}
      {/* Raw Payload Inspection Modal */}
      <RawPayloadModal
        isOpen={rawModal.isOpen}
        title={rawModal.title}
        payload={rawModal.payload}
        format={rawModal.format}
        onClose={() => setRawModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
