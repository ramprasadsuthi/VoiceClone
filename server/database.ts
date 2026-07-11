import fs from "fs";
import path from "path";

// Define TypeScript interfaces for our Database schema
export interface VoiceProfile {
  id: string;
  voiceName: string;
  language: string;
  accent: string;
  gender: string;
  description: string;
  status: "Ready" | "Training" | "Failed";
  createdAt: string;
  consentConfirmed: boolean;
  
  // Analyzed synthesis parameters
  genderProfile: "male" | "female" | "neutral";
  basePitchOffset: number; // e.g. -20 to +20 semitones
  formantShift: number; // e.g. 0.8 to 1.3
  vocalClarity: number; // 0.1 to 1.0
  timbreProfile: {
    lowShelf: number;  // gain in dB
    midPeak: number;   // gain in dB
    highShelf: number; // gain in dB
    paceModifier: number; // speaking speed modifier e.g. 0.9 to 1.1
  };
  sampleDurations: number; // total duration of training samples in seconds
  noiseLevel: string; // "low" | "medium" | "high"
  sampleCount: number;
  previewUrl?: string;
}

export interface UserAudioSample {
  id: string;
  voiceId: string;
  fileName: string;
  filePath: string;
  duration: number; // in seconds
  sampleRate: number;
  fileSize: number; // in bytes
  createdAt: string;
}

export interface GeneratedSpeechItem {
  id: string;
  voiceId: string;
  voiceName: string;
  inputText: string;
  outputAudioPath: string; // local file path relative to data dir
  outputAudioUrl: string; // HTTP accessible path
  outputAudioPathMp3?: string; // local MP3 file path
  outputAudioUrlMp3?: string; // HTTP accessible MP3 path
  speed: number; // 0.5 to 2.0
  pitch: number; // -10 to +10 semitones
  volume: number; // 0.0 to 1.0
  emotion: string; // Neutral, Happy, Excited, Serious, Calm
  createdAt: string;
  durationSeconds: number;
  characterCount: number;
  isFallback?: boolean;
  engine?: "Gemini TTS" | "Local DSP";
  quotaExceeded?: boolean;
}

interface DbSchema {
  voices: VoiceProfile[];
  samples: UserAudioSample[];
  history: GeneratedSpeechItem[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const GENERATED_DIR = path.join(DATA_DIR, "generated");
const DB_FILE = path.join(DATA_DIR, "database.json");

// Ensure data folders exist
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

class Database {
  private data: DbSchema = { voices: [], samples: [], history: [] };

  constructor() {
    ensureDirectories();
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(fileContent);
        
        // Safety checks to ensure fields exist
        if (!this.data.voices) this.data.voices = [];
        if (!this.data.samples) this.data.samples = [];
        if (!this.data.history) this.data.history = [];
      } else {
        this.save();
      }
    } catch (error) {
      console.error("Failed to load local database, resetting to empty:", error);
      this.data = { voices: [], samples: [], history: [] };
      this.save();
    }
  }

  private save() {
    try {
      ensureDirectories();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save local database:", error);
    }
  }

  // --- Voices ---
  public getVoices(): VoiceProfile[] {
    this.load();
    return this.data.voices;
  }

  public seedVoiceAtBeginning(voice: VoiceProfile) {
    this.load();
    if (!this.data.voices.some((v) => v.id === voice.id)) {
      this.data.voices.unshift(voice);
      this.save();
    }
  }

  public seedSample(sample: UserAudioSample) {
    this.load();
    if (!this.data.samples.some((s) => s.id === sample.id)) {
      this.data.samples.push(sample);
      this.save();
    }
  }

  public getVoice(id: string): VoiceProfile | undefined {
    this.load();
    return this.data.voices.find((v) => v.id === id);
  }

  public createVoice(voice: Omit<VoiceProfile, "id" | "createdAt" | "status" | "sampleCount" | "sampleDurations" | "genderProfile" | "basePitchOffset" | "formantShift" | "vocalClarity" | "timbreProfile" | "noiseLevel">): VoiceProfile {
    this.load();
    const newVoice: VoiceProfile = {
      ...voice,
      id: "voice_" + Math.random().toString(36).substr(2, 9),
      status: "Training",
      createdAt: new Date().toISOString(),
      genderProfile: "neutral",
      basePitchOffset: 0,
      formantShift: 1.0,
      vocalClarity: 0.8,
      timbreProfile: {
        lowShelf: 0,
        midPeak: 0,
        highShelf: 0,
        paceModifier: 1.0,
      },
      sampleDurations: 0,
      noiseLevel: "low",
      sampleCount: 0,
    };
    this.data.voices.push(newVoice);
    this.save();
    return newVoice;
  }

  public updateVoice(id: string, updates: Partial<VoiceProfile>): VoiceProfile | undefined {
    this.load();
    const index = this.data.voices.findIndex((v) => v.id === id);
    if (index === -1) return undefined;
    
    this.data.voices[index] = {
      ...this.data.voices[index],
      ...updates,
    };
    this.save();
    return this.data.voices[index];
  }

  public deleteVoice(id: string): boolean {
    this.load();
    const initialLength = this.data.voices.length;
    
    // Remove the voice profile
    this.data.voices = this.data.voices.filter((v) => v.id !== id);
    
    // Remove samples metadata belonging to this voice
    const samplesToDelete = this.data.samples.filter((s) => s.voiceId === id);
    this.data.samples = this.data.samples.filter((s) => s.voiceId !== id);
    
    // Attempt to delete physical files
    for (const sample of samplesToDelete) {
      try {
        const fullPath = path.join(process.cwd(), sample.filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        console.error(`Failed to delete physical file: ${sample.filePath}`, err);
      }
    }

    this.save();
    return this.data.voices.length < initialLength;
  }

  // --- Samples ---
  public getSamples(voiceId?: string): UserAudioSample[] {
    this.load();
    if (voiceId) {
      return this.data.samples.filter((s) => s.voiceId === voiceId);
    }
    return this.data.samples;
  }

  public addSample(sample: Omit<UserAudioSample, "id" | "createdAt">): UserAudioSample {
    this.load();
    const newSample: UserAudioSample = {
      ...sample,
      id: "sample_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    this.data.samples.push(newSample);
    
    // Update voice sample stats
    const voice = this.data.voices.find((v) => v.id === sample.voiceId);
    if (voice) {
      const voiceSamples = this.data.samples.filter((s) => s.voiceId === sample.voiceId);
      voice.sampleCount = voiceSamples.length;
      voice.sampleDurations = voiceSamples.reduce((sum, s) => sum + s.duration, 0);
    }

    this.save();
    return newSample;
  }

  // --- History ---
  public getHistory(): GeneratedSpeechItem[] {
    this.load();
    // Return sorted newest first
    return [...this.data.history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addHistoryItem(item: Omit<GeneratedSpeechItem, "id" | "createdAt">): GeneratedSpeechItem {
    this.load();
    const newItem: GeneratedSpeechItem = {
      ...item,
      id: "hist_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    this.data.history.push(newItem);
    this.save();
    return newItem;
  }

  public deleteHistoryItem(id: string): boolean {
    this.load();
    const item = this.data.history.find((h) => h.id === id);
    if (!item) return false;

    this.data.history = this.data.history.filter((h) => h.id !== id);

    // Delete physical generated audio
    try {
      const fullPath = path.join(process.cwd(), item.outputAudioPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      if (item.outputAudioPathMp3) {
        const fullPathMp3 = path.join(process.cwd(), item.outputAudioPathMp3);
        if (fs.existsSync(fullPathMp3)) {
          fs.unlinkSync(fullPathMp3);
        }
      }
    } catch (err) {
      console.error(`Failed to delete physical generated file: ${item.outputAudioPath}`, err);
    }

    this.save();
    return true;
  }

  // File paths getters
  public getUploadsDir() {
    return UPLOADS_DIR;
  }

  public getGeneratedDir() {
    return GENERATED_DIR;
  }
}

export const db = new Database();
