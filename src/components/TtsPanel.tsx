import React, { useState, useRef, useEffect } from "react";
import { 
  Volume2, Play, Pause, Download, Sliders, ChevronDown, 
  Sparkles, MessageSquareCode, RefreshCw, AudioLines 
} from "lucide-react";
import { VoiceProfile, GeneratedSpeechItem } from "../types.ts";

interface TtsPanelProps {
  voices: VoiceProfile[];
  selectedVoice: VoiceProfile | null;
  onSelectVoice: (voice: VoiceProfile) => void;
  onGenerationComplete: (newItem: GeneratedSpeechItem) => void;
}

const TEXT_PRESETS = [
  {
    label: "🎙️ Podcast Intro",
    text: "Welcome back to Tech Horizons! Today, we are exploring the future of generative media, real-time voice modeling, and speech synthesis pipelines that can model human expressions. Sit back, relax, and enjoy the show.",
  },
  {
    label: "📢 Product Promo",
    text: "Introducing VoiceClone Studio. Experience the most realistic AI voice synthesis platform ever built. Clone any voice with just 30 seconds of audio and generate beautiful speech with perfect inflections.",
  },
  {
    label: "🧘 Mindfulness Guide",
    text: "Close your eyes, take a deep, slow breath, and release all tension from your shoulders. Let yourself be fully present in this moment as we begin our daily practice.",
  },
  {
    label: "🎮 Game Narration",
    text: "In the shadow of the ancient peak, the traveler discovered the dormant artifact. As it flickered with a raw energy, a forgotten voice echoed throughout the valley...",
  },
];

export default function TtsPanel({ voices, selectedVoice, onSelectVoice, onGenerationComplete }: TtsPanelProps) {
  const [inputText, setInputText] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [emotion, setEmotion] = useState<"Neutral" | "Happy" | "Excited" | "Serious" | "Calm">("Neutral");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [latestAudioUrl, setLatestAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const readyVoices = voices.filter((v) => v.status === "Ready");

  // Select first ready voice as default if none selected
  useEffect(() => {
    if (!selectedVoice && readyVoices.length > 0) {
      onSelectVoice(readyVoices[0]);
    }
  }, [readyVoices, selectedVoice, onSelectVoice]);

  // Audio Playback Events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setAudioDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [latestAudioUrl]);

  // Real-time Canvas Waveform Animation while Audio Plays
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      drawStaticWaveform();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const barsCount = 38;
    const barWidth = 4;
    const gap = 3;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw simulated spectrum bar analysis matching speech rhythm
      for (let i = 0; i < barsCount; i++) {
        const x = i * (barWidth + gap) + 12;
        
        // Generate pseudo-spectrum frequencies depending on voice frequency
        const frequencyMod = Math.sin(i * 0.3 + Date.now() * 0.015);
        const dynamicMultiplier = Math.random() * 0.3 + 0.7;
        const scaleFactor = isPlaying ? (frequencyMod + 1) * 15 * dynamicMultiplier : 2;
        
        const height = Math.max(3, scaleFactor);
        const y = (canvas.height - height) / 2;

        // Draw elegant gradient colors
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, "#818cf8"); // indigo-400
        gradient.addColorStop(1, "#4f46e5"); // indigo-600

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const drawStaticWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barsCount = 38;
    const barWidth = 4;
    const gap = 3;

    for (let i = 0; i < barsCount; i++) {
      const x = i * (barWidth + gap) + 12;
      // Static wave heights
      const wavePattern = [5, 8, 12, 10, 6, 8, 14, 18, 22, 16, 8, 12, 18, 26, 32, 28, 15, 10, 14, 20, 24, 18, 12, 8, 14, 18, 15, 12, 6, 8, 12, 10, 7, 5, 4, 3, 3, 2];
      const height = wavePattern[i % wavePattern.length] * 0.8;
      const y = (canvas.height - height) / 2;

      ctx.fillStyle = "#cbd5e1"; // slate-300
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, height, 2);
      ctx.fill();
    }
  };

  // Draw initial static wave
  useEffect(() => {
    drawStaticWaveform();
  }, []);

  const handleApplyPreset = (text: string) => {
    setInputText(text);
  };

  const handlePlayPause = () => {
    if (!latestAudioUrl || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const handleAudioScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  // Synthesize Text to Speech
  const handleGenerate = async () => {
    setErrorMessage("");
    if (!selectedVoice) {
      setErrorMessage("Please select or create a trained voice profile to speak.");
      return;
    }
    if (!inputText.trim()) {
      setErrorMessage("Please type some script text to generate speech.");
      return;
    }

    try {
      setIsGenerating(true);
      
      const payload = {
        voiceId: selectedVoice.id,
        inputText: inputText.trim(),
        speed,
        pitch,
        volume,
        emotion,
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Speech synthesis server error.");
      }

      const generatedItem: GeneratedSpeechItem = await res.json();
      
      // Update UI with latest audio output
      setLatestAudioUrl(generatedItem.outputAudioUrl);
      onGenerationComplete(generatedItem);

      // Auto-trigger playback
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load();
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      }, 100);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Synthesis pipeline failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return "00:00";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      id="tts-panel" 
      className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-6"
    >
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <AudioLines className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-850 font-display">Text-to-Speech Lab</h2>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Model: <span className="text-indigo-600 font-semibold">Gemini Flash-TTS</span>
        </span>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Preset script suggestions */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
          <MessageSquareCode className="w-3.5 h-3.5 text-indigo-600" />
          Quick Text Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {TEXT_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(preset.text)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Core Input text area */}
      <div className="relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value.slice(0, 5000))}
          placeholder="Enter your script here... Type anything you'd like your cloned voice profile to speak aloud."
          rows={6}
          maxLength={5000}
          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-xl p-4 text-sm text-slate-800 placeholder:text-slate-400 transition resize-none leading-relaxed"
          id="tts-text-area"
        />
        <div className="absolute bottom-3 right-4 text-[10px] font-mono text-slate-400">
          {inputText.length} / 5,000 characters
        </div>
      </div>

      {/* Voice Selection dropdown & Emotion selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Selected Voice Profile *</label>
          {readyVoices.length === 0 ? (
            <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
              No ready voices in Library. Please train a voice first.
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedVoice?.id || ""}
                onChange={(e) => {
                  const targetVoice = readyVoices.find((v) => v.id === e.target.value);
                  if (targetVoice) onSelectVoice(targetVoice);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
                id="voice-select-dropdown"
              >
                {readyVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voiceName} ({v.accent})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Vocal Emotion Style</label>
          <div className="relative">
            <select
              value={emotion}
              onChange={(e: any) => setEmotion(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
            >
              <option value="Neutral">Neutral (Professional / Balanced)</option>
              <option value="Happy">Happy (Cheerful / Warm)</option>
              <option value="Excited">Excited (Energetic / Promotional)</option>
              <option value="Serious">Serious (Academic / Low Tone)</option>
              <option value="Calm">Calm (Slow / Soothing)</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Synthesis Tuning Parameters (Sliders) */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
        <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
          <Sliders className="w-3.5 h-3.5 text-indigo-600" />
          Neural Synthesis Tuning
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Speed Modifier */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Speaking Speed:</span>
              <span className="text-indigo-600 font-semibold">{speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>0.5x (Slow)</span>
              <span>1.0x (Normal)</span>
              <span>2.0x (Fast)</span>
            </div>
          </div>

          {/* Pitch Offset */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Pitch Tuning:</span>
              <span className="text-indigo-600 font-semibold">
                {pitch > 0 ? `+${pitch}` : pitch} semitones
              </span>
            </div>
            <input
              type="range"
              min="-10"
              max="10"
              step="1"
              value={pitch}
              onChange={(e) => setPitch(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>Deep</span>
              <span>Calibrated</span>
              <span>Soprano</span>
            </div>
          </div>

          {/* Volume Multiplier */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Output Gain:</span>
              <span className="text-indigo-600 font-semibold">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>Mute</span>
              <span>Normal</span>
              <span>Boost</span>
            </div>
          </div>
        </div>
      </div>

      {/* Synthesis Trigger Button */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || readyVoices.length === 0}
          className="w-full sm:w-auto px-6 py-3 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-750 hover:to-violet-750 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/10 transition flex items-center justify-center gap-2 cursor-pointer grow"
          id="generate-speech-btn"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              Synthesizing Neural Speech...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-100" />
              Synthesize Custom Speech
            </>
          )}
        </button>

        {/* Hidden Audio element */}
        {latestAudioUrl && (
          <audio ref={audioRef} src={latestAudioUrl} className="hidden" />
        )}

        {/* Custom audio visualizer player drawer */}
        <div className="w-full sm:w-auto flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200 grow-[2] justify-between text-slate-800">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePlayPause}
              disabled={!latestAudioUrl}
              className={`p-2 rounded-lg transition text-white ${
                latestAudioUrl 
                  ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer" 
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              title={isPlaying ? "Pause" : "Play Speech"}
              id="play-pause-latest-btn"
              type="button"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
            </button>
            <div className="text-left">
              <span className="text-[10px] font-mono text-slate-500 block">Status:</span>
              <span className="text-xs text-slate-700 font-semibold">
                {isGenerating 
                  ? "Generating..." 
                  : latestAudioUrl 
                    ? "Audio Ready" 
                    : "No Audio Generated"}
              </span>
            </div>
          </div>

          {/* Canvas spectrum audio waveforms */}
          <div className="hidden md:block">
            <canvas 
              ref={canvasRef} 
              width={280} 
              height={44} 
              className="bg-slate-100 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Scrubber and Time Tracking */}
            <div className="text-right font-mono text-[10px] text-slate-500 font-medium">
              {formatTime(currentTime)} / {formatTime(audioDuration)}
            </div>
            
            {/* Download Button */}
            <a
              href={latestAudioUrl || "#"}
              download={`VoiceCloneStudio_${Date.now()}.wav`}
              onClick={(e) => {
                if (!latestAudioUrl) e.preventDefault();
              }}
              className={`p-2 rounded-lg border transition ${
                latestAudioUrl 
                  ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 cursor-pointer" 
                  : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              title="Download WAV voice synthesis"
              id="download-latest-btn"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
