import React from "react";
import { Mic, Trash2, Calendar, FileJson, Speech, RefreshCw, AlertTriangle, Play, CheckCircle2, Pause } from "lucide-react";
import { VoiceProfile } from "../types.ts";

interface VoiceCardProps {
  voice: VoiceProfile;
  onDelete: (id: string) => void | Promise<void>;
  onSelectForTts: (voice: VoiceProfile) => void;
  onRefreshStatus: (id: string) => void | Promise<void>;
  isPlayingPreview: boolean;
  onPlayPreview: (voice: VoiceProfile) => void;
  onPausePreview: () => void;
}

export const VoiceCard: React.FC<VoiceCardProps> = ({ 
  voice, 
  onDelete, 
  onSelectForTts, 
  onRefreshStatus,
  isPlayingPreview,
  onPlayPreview,
  onPausePreview
}) => {
  
  // Format Date Helper
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Recently";
    }
  };

  // Helper to trigger voice profile json configuration download
  const handleDownloadMetadata = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(voice, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${voice.voiceName.replace(/\s+/g, "_")}_voice_profile.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-slate-300 hover:shadow transition-all flex flex-col justify-between gap-4 group"
      id={`voice-card-${voice.id}`}
    >
      {/* Voice Title and Status */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${
              voice.status === "Ready" 
                ? "bg-green-50 border border-green-200 text-green-700" 
                : voice.status === "Training" 
                  ? "bg-indigo-50 border border-indigo-200 text-indigo-700" 
                  : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base group-hover:text-indigo-600 transition truncate max-w-[160px]">
                {voice.voiceName}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {voice.language} • {voice.accent}
              </p>
            </div>
          </div>

          {/* Badge */}
          <div>
            {voice.status === "Ready" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-green-50 border border-green-200 text-green-700">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                Ready
              </span>
            )}
            {voice.status === "Training" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 animate-pulse">
                <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                Training
              </span>
            )}
            {voice.status === "Failed" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-red-50 border border-red-200 text-red-700">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                Failed
              </span>
            )}
          </div>
        </div>

        {/* Description / Summary */}
        <p className="text-xs text-slate-600 line-clamp-2 min-h-[32px] leading-relaxed">
          {voice.description || "No voice synthesis parameters registered."}
        </p>
      </div>

      {/* Voice Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] font-mono">
        <div className="space-y-0.5">
          <span className="text-slate-450 block text-[10px] uppercase font-semibold">Vocal Range:</span>
          <span className="text-slate-800 font-medium capitalize">{voice.gender}</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-450 block text-[10px] uppercase font-semibold">Pitch Shift:</span>
          <span className="text-indigo-600 font-semibold">{voice.basePitchOffset > 0 ? "+" : ""}{voice.basePitchOffset} semitones</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-450 block text-[10px] uppercase font-semibold">Formant tract:</span>
          <span className="text-slate-800 font-medium">{voice.formantShift.toFixed(2)}x</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-450 block text-[10px] uppercase font-semibold">Training Audio:</span>
          <span className="text-slate-800 font-medium">{voice.sampleDurations}s ({voice.sampleCount} file)</span>
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3" />
            {formatDate(voice.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Refresh Action for Training files */}
          {voice.status === "Training" && (
            <button
              onClick={() => onRefreshStatus(voice.id)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Refresh Training Status"
              type="button"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Download Metadata Action */}
          <button
            onClick={handleDownloadMetadata}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Download Voice Profile JSON config"
            type="button"
            id={`download-metadata-${voice.id}`}
          >
            <FileJson className="w-3.5 h-3.5" />
          </button>

          {/* Delete Action */}
          <button
            onClick={() => onDelete(voice.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete Voice Signature"
            type="button"
            id={`delete-voice-${voice.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Preview Action */}
          {voice.status === "Ready" && voice.previewUrl && (
            <button
              onClick={() => isPlayingPreview ? onPausePreview() : onPlayPreview(voice)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border shadow-sm transition flex items-center gap-1 cursor-pointer ${
                isPlayingPreview
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse font-bold"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
              type="button"
              id={`preview-voice-btn-${voice.id}`}
              title={isPlayingPreview ? "Pause Voice Preview" : "Play Voice Preview Sample"}
            >
              {isPlayingPreview ? (
                <>
                  <Pause className="w-3 h-3 text-indigo-700 fill-indigo-700" />
                  <span>Playing</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-slate-600 fill-slate-600" />
                  <span>Preview</span>
                </>
              )}
            </button>
          )}

          {/* Generate Speech Action */}
          <button
            onClick={() => onSelectForTts(voice)}
            disabled={voice.status !== "Ready"}
            className="px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
            type="button"
            id={`use-voice-btn-${voice.id}`}
          >
            <Speech className="w-3 h-3" />
            TTS
          </button>
        </div>
      </div>
    </div>
  );
}
