import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Plus, Mic, HelpCircle, AlertTriangle, Play, Check, 
  Info, ShieldCheck, ChevronRight 
} from "lucide-react";
import Header from "./components/Header.tsx";
import CreateVoiceModal from "./components/CreateVoiceModal.tsx";
import { VoiceCard } from "./components/VoiceCard.tsx";
import TtsPanel from "./components/TtsPanel.tsx";
import HistoryList from "./components/HistoryList.tsx";
import { VoiceProfile, GeneratedSpeechItem } from "./types.ts";

export default function App() {
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [history, setHistory] = useState<GeneratedSpeechItem[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // --- Voice Previews Playback Logic ---
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPreview = (voice: VoiceProfile) => {
    if (!voice.previewUrl) return;

    // Toggle off if clicking the currently playing voice
    if (playingPreviewId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreviewId(null);
      return;
    }

    // Stop active audio
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    // Set new audio source
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(voice.previewUrl);
    } else {
      previewAudioRef.current.src = voice.previewUrl;
    }

    previewAudioRef.current.onended = () => {
      setPlayingPreviewId(null);
    };

    previewAudioRef.current.onerror = (e) => {
      console.error("Preview audio playback error:", e);
      setPlayingPreviewId(null);
      showNotification("error", "Failed to load voice preview sample.");
    };

    previewAudioRef.current.load();
    previewAudioRef.current.play()
      .then(() => {
        setPlayingPreviewId(voice.id);
      })
      .catch((err) => {
        console.error("Audio play blocked/failed:", err);
        setPlayingPreviewId(null);
      });
  };

  const handlePausePreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setPlayingPreviewId(null);
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  // --- API Integrations ---

  const fetchVoices = async () => {
    try {
      const res = await fetch("/api/voices");
      if (res.ok) {
        const data = await res.json();
        setVoices(data);
        
        // Retain selection if still in voices
        if (selectedVoice) {
          const updatedSelected = data.find((v: VoiceProfile) => v.id === selectedVoice.id);
          if (updatedSelected) setSelectedVoice(updatedSelected);
        }
      }
    } catch (err) {
      console.error("Failed to fetch voices:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  // Run on Mount
  useEffect(() => {
    const initFetch = async () => {
      setIsLoading(true);
      await Promise.all([fetchVoices(), fetchHistory()]);
      setIsLoading(false);
    };
    initFetch();
  }, []);

  // Auto-polling training profiles if any is in "Training" state
  useEffect(() => {
    const hasActiveTraining = voices.some((v) => v.status === "Training");
    if (!hasActiveTraining) return;

    console.log("[App] Active voice training detected. Starting auto-polling status channel...");
    const interval = setInterval(async () => {
      const res = await fetch("/api/voices");
      if (res.ok) {
        const data = await res.json();
        setVoices(data);
        
        // Check if any has completed
        const activeBefore = voices.filter((v) => v.status === "Training").map(v => v.id);
        const activeAfter = data.filter((v: VoiceProfile) => v.status === "Training").map((v: VoiceProfile) => v.id);
        
        if (activeBefore.length > activeAfter.length) {
          showNotification("success", "Vocal signatures calibrated successfully! Your clone is ready to speak.");
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [voices]);

  // Handler for adding a new voice signature
  const handleVoiceCreated = (newVoice: VoiceProfile) => {
    fetchVoices();
    showNotification("success", `Vocal profile '${newVoice.voiceName}' initialized and queued for calibration.`);
  };

  // Handler for manual status checks
  const handleRefreshVoiceStatus = async (id: string) => {
    await fetchVoices();
  };

  // Handler for deleting voice signatures
  const handleDeleteVoice = async (id: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this cloned voice profile? All uploaded training audio samples and synthesized audio of this voice will be permanently deleted."
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/voice/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVoices((prev) => prev.filter((v) => v.id !== id));
        if (selectedVoice?.id === id) {
          setSelectedVoice(null);
        }
        showNotification("success", "Voice signature deleted.");
        fetchHistory(); // Cascaded generated records files cleanup
      } else {
        showNotification("error", "Failed to delete voice signature.");
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Connection error deleting voice.");
    }
  };

  // Handler for deleting speech items from the history log
  const handleDeleteHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== id));
      } else {
        showNotification("error", "Failed to delete historical audio clip.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Triggered when a new clip completes generation
  const handleGenerationComplete = (newItem: GeneratedSpeechItem) => {
    setHistory((prev) => [newItem, ...prev]);
    if (newItem.isFallback) {
      showNotification("success", "Speech synthesized successfully using Local DSP fallback (Gemini API limit reached).");
    } else {
      showNotification("success", "Custom audio synthesized successfully!");
    }
  };

  // Notification Helper
  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const readyVoices = voices.filter((v) => v.status === "Ready");
  const trainingVoices = voices.filter((v) => v.status === "Training");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-600/20 selection:text-indigo-900">
      {/* Brand Header */}
      <Header readyVoicesCount={readyVoices.length} trainingCount={trainingVoices.length} />

      {/* Floating Notifications */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-2.5 border text-xs font-semibold ${
            notification.type === "success" 
              ? "bg-green-50 border-green-200 text-green-800" 
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${notification.type === "success" ? "bg-green-400" : "bg-red-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${notification.type === "success" ? "bg-green-500" : "bg-red-500"}`}></span>
            </span>
            <span>{notification.text}</span>
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Beautiful Pitch Hero Banner */}
        <section 
          id="hero-banner" 
          className="relative rounded-xl overflow-hidden bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-slate-800 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm"
        >
          {/* Subtle Ambient Orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="space-y-3 max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-xs text-indigo-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Multi-Speaker Voice Calibration Studio</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight leading-none">
              Clone any voice. Generate realistic speech.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Create an AI voice profile with just 30 seconds of speech. Once trained, fine-tune pitch, pace, and emotions to generate natural, conversational vocals using Google Gemini LLM.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm transition flex items-center gap-2 cursor-pointer"
              id="hero-create-voice-btn"
              type="button"
            >
              <Plus className="w-4 h-4" />
              Create Custom Voice
            </button>
          </div>
        </section>

        {/* Loading Skeletons */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="h-6 w-32 bg-slate-200 rounded-md animate-pulse"></div>
              <div className="h-32 bg-slate-100 rounded-xl border border-slate-200 animate-pulse"></div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="h-6 w-48 bg-slate-200 rounded-md animate-pulse"></div>
              <div className="h-80 bg-slate-100 rounded-xl border border-slate-200 animate-pulse"></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Voice Profile Library Section */}
            <section id="library-section" className="lg:col-span-1 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800 font-display flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-indigo-600" />
                    Voice Library
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">Your calibrated vocal signatures</p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition flex items-center justify-center cursor-pointer shadow-sm"
                  title="Add Custom Voice Profile"
                  id="add-voice-header-btn"
                  type="button"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Voices Cards Stack */}
              {voices.length === 0 ? (
                <div className="p-6 rounded-xl bg-white border border-slate-200 text-center space-y-4 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto animate-pulse">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-slate-800">No custom voices found</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-[220px] mx-auto font-medium">
                      Train your first voice signature to start generating customized vocal tracks.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[11px] font-bold text-white shadow-sm transition mx-auto cursor-pointer"
                    type="button"
                  >
                    Calibrate New Voice
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
                  {voices.map((voice) => (
                    <VoiceCard
                      key={voice.id}
                      voice={voice}
                      onDelete={handleDeleteVoice}
                      onSelectForTts={(v) => setSelectedVoice(v)}
                      onRefreshStatus={handleRefreshVoiceStatus}
                      isPlayingPreview={playingPreviewId === voice.id}
                      onPlayPreview={handlePlayPreview}
                      onPausePreview={handlePausePreview}
                    />
                  ))}
                </div>
              )}

              {/* Informative Security Disclaimer banner */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  Responsible AI Policy
                </div>
                <p className="text-[10px] text-slate-550 leading-relaxed">
                  VoiceClone Studio takes safety seriously. Training requires explicit user permission. Cloned voice profiles are protected within private sandbox models and never shared externally.
                </p>
              </div>
            </section>

            {/* Right: TTS Playground & History Archive */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Text-to-Speech Workbench */}
              <TtsPanel
                voices={voices}
                selectedVoice={selectedVoice}
                onSelectVoice={(v) => setSelectedVoice(v)}
                onGenerationComplete={handleGenerationComplete}
              />

              {/* Historical Synthesis Archive */}
              <HistoryList
                history={history}
                onDelete={handleDeleteHistory}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer Branding credits */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6 text-center text-xs text-slate-500 space-y-1 mt-12 shrink-0">
        <p>© 2026 VoiceClone Studio • Crafted with Google Gemini Audio Modality & DSP.</p>
        <p className="text-[10px] text-slate-450">Enterprise Voice Customization Sandbox • Terms of Responsible AI Usage Apply</p>
      </footer>

      {/* Creation Wizard Dialog Modal */}
      {isCreateModalOpen && (
        <CreateVoiceModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleVoiceCreated}
        />
      )}
    </div>
  );
}
