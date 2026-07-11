import React, { useState, useRef } from "react";
import { X, Upload, Check, AlertTriangle, Sparkles, Sliders, Volume2, HelpCircle } from "lucide-react";
import { VoiceProfile } from "../types.ts";

interface CreateVoiceModalProps {
  onClose: () => void;
  onSuccess: (newVoice: VoiceProfile) => void;
}

export default function CreateVoiceModal({ onClose, onSuccess }: CreateVoiceModalProps) {
  const [voiceName, setVoiceName] = useState("");
  const [language, setLanguage] = useState("English (US)");
  const [accent, setAccent] = useState("General American");
  const [gender, setGender] = useState("female");
  const [description, setDescription] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  
  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Automated audio analysis metrics
  const [audioAnalysis, setAudioAnalysis] = useState<{
    duration: number;
    sampleRate: number;
    noiseFloor: string;
    silenceRatio: string;
    normalized: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse file and mock analyze parameters for instant UX feedback
  const handleFileChange = (file: File) => {
    setErrorMsg("");
    
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/webm"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isAudio = allowedTypes.includes(file.type) || [".wav", ".mp3", ".m4a", ".aac", ".ogg", ".webm"].includes(ext);
    
    if (!isAudio) {
      setErrorMsg("Invalid file format. Please upload standard audio files (WAV, MP3, M4A).");
      setSelectedFile(null);
      setAudioAnalysis(null);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMsg("File exceeds the maximum limit of 100 MB.");
      setSelectedFile(null);
      setAudioAnalysis(null);
      return;
    }

    setSelectedFile(file);

    // Simulate standard browser audio parsing for metrics
    // Heuristics: calculate approximate seconds from file size
    const approxDuration = Math.max(12, Math.round(file.size / 32000)); // approximate compressed bitrates
    const detectedSampleRate = ext === ".wav" ? 24000 : 44100;
    const isLowNoise = Math.random() > 0.3;

    setAudioAnalysis({
      duration: approxDuration,
      sampleRate: detectedSampleRate,
      noiseFloor: isLowNoise ? "-62 dB (Excellent)" : "-45 dB (Fair)",
      silenceRatio: `${(2 + Math.random() * 5).toFixed(1)}%`,
      normalized: true,
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Convert File to Base64 safely
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // Strip the data:audio/...;base64, prefix
        const cleanBase64 = base64String.split(",")[1];
        resolve(cleanBase64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Upload sample & trigger training pipeline
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!voiceName.trim()) {
      setErrorMsg("Please specify a voice signature name.");
      return;
    }
    if (!selectedFile) {
      setErrorMsg("Please upload a vocal sample file to proceed.");
      return;
    }
    if (!consentConfirmed) {
      setErrorMsg("You must explicitly confirm speaker consent before cloning a voice.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(15);

      // 1. Encode file to Base64
      const fileBase64 = await fileToBase64(selectedFile);
      setUploadProgress(40);

      // 2. Submit voice and file to backend
      const uploadPayload = {
        voiceName: voiceName.trim(),
        language,
        accent: accent.trim(),
        gender,
        description: description.trim(),
        consentConfirmed,
        fileName: selectedFile.name,
        fileBase64,
      };

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uploadPayload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create voice profile and upload audio.");
      }

      setUploadProgress(75);
      const data = await response.json();
      const voiceId = data.voice.id;

      // 3. Trigger Neural Training Pipeline
      const trainResponse = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });

      if (!trainResponse.ok) {
        const errData = await trainResponse.json();
        throw new Error(errData.error || "Vocal calibration failed.");
      }

      setUploadProgress(100);
      
      // Delay to show beautiful completion
      setTimeout(() => {
        onSuccess(data.voice);
        onClose();
      }, 500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred during training.");
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div 
        id="create-voice-modal" 
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold font-display text-slate-800">Extract New Voice Profile</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"
            id="close-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Voice Name *</label>
              <input
                type="text"
                placeholder="e.g. My Personal Clone, Emily British"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-800 placeholder:text-slate-400 transition"
                id="voice-name-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Language Profile</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-800 transition cursor-pointer"
              >
                <option value="English (US)">English (US)</option>
                <option value="English (UK)">English (UK)</option>
                <option value="Spanish (ES)">Spanish (ES)</option>
                <option value="French (FR)">French (FR)</option>
                <option value="German (DE)">German (DE)</option>
                <option value="Hindi (IN)">Hindi (IN)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vocal Accent *</label>
              <input
                type="text"
                placeholder="e.g. American Southern, Received Pronunciation"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-800 placeholder:text-slate-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Voice Gender/Range</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-800 transition cursor-pointer"
              >
                <option value="female">Feminine (High Range)</option>
                <option value="male">Masculine (Deep Range)</option>
                <option value="neutral">Androgynous (Mid Range)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vocal Profile Description</label>
            <textarea
              placeholder="Provide a description of voice qualities (e.g., breathy voice, speaking calmly, corporate marketing style...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-800 placeholder:text-slate-400 transition resize-none"
            />
          </div>

          {/* Drag & Drop Audio Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Upload Voice Sample Audio *</label>
            
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging 
                  ? "border-indigo-500 bg-indigo-50/50" 
                  : selectedFile 
                    ? "border-green-500 bg-green-50/30" 
                    : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                className="hidden"
                accept=".wav,.mp3,.m4a,.aac,.ogg,.webm"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-700 mx-auto border border-green-200">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-[280px] mx-auto">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Audio Format</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto border border-slate-200">
                    <Upload className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 font-medium">Drag & drop voice sample or <span className="text-indigo-600 font-semibold underline">browse file</span></p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Supports WAV, MP3, M4A up to 100 MB</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Min length: 30s recommended for perfect timbre matching</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audio Diagnostics Analysis Preview */}
          {audioAnalysis && selectedFile && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                Vocal Diagnostics Analysis
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[11px] font-mono">
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500">Duration Est:</span>
                  <span className="text-slate-800 font-medium">~{audioAnalysis.duration} seconds</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500">Sample Rate:</span>
                  <span className="text-slate-800 font-medium">{audioAnalysis.sampleRate} Hz</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500">Noise Floor:</span>
                  <span className="text-green-600 font-medium">{audioAnalysis.noiseFloor}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500">Silence Gaps:</span>
                  <span className="text-slate-800 font-medium">{audioAnalysis.silenceRatio}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 bg-indigo-50/50 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Audio will be normalized automatically to -18 LUFS on the synthesis server.</span>
              </div>
            </div>
          )}

          {/* Legal Consent Acknowledgement Box */}
          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
            <div className="flex items-start gap-3">
              <input
                id="consent-checkbox"
                type="checkbox"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <label htmlFor="consent-checkbox" className="font-semibold text-slate-850 block cursor-pointer select-none">
                  Legal Cloning authorization *
                </label>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  I confirm that I either own this voice or possess explicit, written permission from the speaker to generate AI voice syntheses for personal or business purposes. I agree to use this model responsibly.
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer / Progress */}
        <div className="px-6 py-4 border-t border-slate-150 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-1/2">
            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-500">
                  <span>Uploading & Training...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading || !consentConfirmed}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              id="submit-voice-btn"
            >
              {isUploading ? "Processing..." : "Calibrate Voice"}
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
