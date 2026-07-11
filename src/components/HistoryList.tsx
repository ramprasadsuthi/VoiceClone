import React, { useState, useRef } from "react";
import { 
  Trash2, Play, Pause, Download, Search, Sparkles, 
  Clock, Calendar, FileDown, Eye, FileText, CheckCircle2 
} from "lucide-react";
import { GeneratedSpeechItem } from "../types.ts";

interface HistoryListProps {
  history: GeneratedSpeechItem[];
  onDelete: (id: string) => void;
}

export default function HistoryList({ history, onDelete }: HistoryListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter history based on search query
  const filteredHistory = history.filter((item) =>
    item.inputText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.voiceName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Play audio item
  const handlePlayToggle = (item: GeneratedSpeechItem) => {
    if (playingItemId === item.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingItemId(null);
    } else {
      setPlayingItemId(item.id);
      if (audioRef.current) {
        audioRef.current.src = item.outputAudioUrl;
        audioRef.current.load();
        audioRef.current.play()
          .catch((err) => {
            console.error("Playback failed:", err);
            setPlayingItemId(null);
          });
      }
    }
  };

  const onAudioEnded = () => {
    setPlayingItemId(null);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  };

  // Helper to download JSON data sheet for this synthesis
  const downloadMetadataJson = (item: GeneratedSpeechItem) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `synthesis_${item.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div 
      id="history-list-panel" 
      className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6"
    >
      {/* Hidden audio tag for history row pre-auditions */}
      <audio ref={audioRef} onEnded={onAudioEnded} className="hidden" />

      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-850 font-display flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Generation Archive
          </h2>
          <p className="text-xs text-slate-500 font-medium">Review, play, and download your synthesized vocal files.</p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search script content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 transition"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* History Table/List */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            {searchQuery ? "No history matches your search query." : "No speech synthesis clips generated yet."}
          </p>
          <p className="text-[10px] text-slate-400">
            {searchQuery ? "Try typing different filter keywords." : "Use the text-to-speech workbench to generate your first voice track."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredHistory.map((item) => (
            <div 
              key={item.id}
              className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
              id={`history-row-${item.id}`}
            >
              {/* Play preview and script excerpt */}
              <div className="flex items-start gap-4 grow">
                <button
                  onClick={() => handlePlayToggle(item)}
                  className={`p-2.5 rounded-lg transition shrink-0 ${
                    playingItemId === item.id 
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse cursor-pointer" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  }`}
                  title={playingItemId === item.id ? "Pause Preview" : "Play Preview"}
                  id={`play-history-btn-${item.id}`}
                >
                  {playingItemId === item.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono">
                    <span className="text-indigo-600 font-bold">{item.voiceName}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-700 font-semibold capitalize px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">
                      {item.emotion}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  
                  {/* Script Text block */}
                  <div className="text-xs text-slate-600 leading-relaxed max-w-xl pr-2">
                    {selectedScript === item.id ? (
                      <p className="whitespace-pre-line">{item.inputText}</p>
                    ) : (
                      <p className="truncate">
                        {item.inputText}
                      </p>
                    )}
                  </div>

                  {/* Character/Duration counts */}
                  <div className="flex gap-4 text-[10px] font-mono text-slate-400">
                    <span>Characters: <b className="text-slate-600">{item.characterCount}</b></span>
                    <span>Speech Duration: <b className="text-slate-600">{item.durationSeconds.toFixed(1)}s</b></span>
                  </div>
                </div>
              </div>

              {/* Speech Parameter specs */}
              <div className="hidden lg:flex items-center gap-4 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-[10px] font-mono shrink-0">
                <div>
                  <span className="text-slate-400 block uppercase text-[8px] font-bold">Speed</span>
                  <span className="text-slate-800 font-bold">{item.speed.toFixed(1)}x</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[8px] font-bold">Pitch</span>
                  <span className="text-slate-800 font-bold">{item.pitch > 0 ? `+${item.pitch}` : item.pitch}st</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[8px] font-bold">Vol</span>
                  <span className="text-slate-800 font-bold">{Math.round(item.volume * 100)}%</span>
                </div>
              </div>

              {/* History Row Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t border-slate-100 md:border-0 pt-3.5 md:pt-0 shrink-0">
                {/* View Full Script Toggle */}
                {item.inputText.length > 50 && (
                  <button
                    onClick={() => setSelectedScript(selectedScript === item.id ? null : item.id)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title={selectedScript === item.id ? "Minimize Script" : "Read Full Script"}
                    type="button"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Download Metadata */}
                <button
                  onClick={() => downloadMetadataJson(item)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Download Synthesis Metadata JSON"
                  type="button"
                  id={`meta-history-btn-${item.id}`}
                >
                  <FileDown className="w-3.5 h-3.5" />
                </button>

                {/* Download WAV File */}
                <a
                  href={item.outputAudioUrl}
                  download={`VoiceCloneStudio_${item.id}.wav`}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition cursor-pointer"
                  title="Download WAV voice synthesis"
                  id={`download-history-btn-${item.id}`}
                >
                  <Download className="w-3.5 h-3.5" />
                </a>

                {/* Delete history record */}
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                  title="Delete History Clip"
                  type="button"
                  id={`delete-history-btn-${item.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
