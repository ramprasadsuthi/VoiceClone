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
  
  // Custom synthesis parameters analyzed during training
  genderProfile: "male" | "female" | "neutral";
  basePitchOffset: number;
  formantShift: number;
  vocalClarity: number;
  noiseLevel: string;
  sampleCount: number;
  sampleDurations: number;
  previewUrl?: string;
  timbreProfile: {
    lowShelf: number;
    midPeak: number;
    highShelf: number;
    paceModifier: number;
  };
}

export interface UserAudioSample {
  id: string;
  voiceId: string;
  fileName: string;
  filePath: string;
  duration: number;
  sampleRate: number;
  fileSize: number;
  createdAt: string;
}

export interface GeneratedSpeechItem {
  id: string;
  voiceId: string;
  voiceName: string;
  inputText: string;
  outputAudioPath: string;
  outputAudioUrl: string;
  outputAudioPathMp3?: string;
  outputAudioUrlMp3?: string;
  speed: number;
  pitch: number;
  volume: number;
  emotion: string;
  createdAt: string;
  durationSeconds: number;
  characterCount: number;
  isFallback?: boolean;
  engine?: "Gemini TTS" | "Local DSP";
  quotaExceeded?: boolean;
}
