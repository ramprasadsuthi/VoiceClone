import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { db } from "./server/database.ts";
import { speechEngine, convertWavToMp3 } from "./server/speech.ts";

const app = express();
const PORT = 3000;

// High-capacity JSON parsing to handle large audio file uploads in base64 safely (up to 100MB)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// --- API Endpoints ---

// Check server status
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET all trained voices
app.get("/api/voices", (req, res) => {
  try {
    const voices = db.getVoices();
    const voicesWithPreviews = voices.map((voice) => {
      const samples = db.getSamples(voice.id);
      if (samples.length > 0) {
        const sample = samples[0];
        const previewUrl = `/api/audio/uploads/${path.basename(sample.filePath)}`;
        return {
          ...voice,
          previewUrl,
        };
      }
      return voice;
    });
    res.json(voicesWithPreviews);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve voices", details: error.message });
  }
});

// POST Create Profile & Upload voice sample
app.post("/api/upload", (req, res) => {
  try {
    const {
      voiceName,
      language,
      accent,
      gender,
      description,
      consentConfirmed,
      fileName,
      fileBase64, // base64 string
    } = req.body;

    if (!voiceName || !language || !accent || !fileName || !fileBase64) {
      res.status(400).json({ error: "Missing required fields for voice creation and upload." });
      return;
    }

    if (!consentConfirmed) {
      res.status(400).json({ error: "Explicit user consent is mandatory to clone voices." });
      return;
    }

    // Safety checks: File extension validation
    const allowedExtensions = [".wav", ".mp3", ".m4a", ".aac", ".ogg", ".webm"];
    const ext = path.extname(fileName).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      res.status(400).json({ error: `Unsupported audio format. Allowed: ${allowedExtensions.join(", ")}` });
      return;
    }

    // Create the Voice Profile first
    const newVoice = db.createVoice({
      voiceName,
      language,
      accent,
      gender: gender || "Not Specified",
      description: description || `Voice clone profile for ${voiceName}`,
      consentConfirmed: true,
    });

    // Write file to uploads directory
    const uploadId = "sample_" + Math.random().toString(36).substr(2, 9);
    // Sanitize filename to prevent directory traversal
    const sanitizedFileName = `${newVoice.id}_${uploadId}${ext}`;
    const targetPath = path.join(db.getUploadsDir(), sanitizedFileName);

    const fileBuffer = Buffer.from(fileBase64, "base64");
    fs.writeFileSync(targetPath, fileBuffer);

    // Calculate duration based on file size as fallback (64kbps, mono is approx 8000 bytes/sec)
    // 16-bit 24kHz mono PCM is 48000 bytes/sec. Let's make an approximation based on extension.
    let duration = 30; // 30s default
    if (ext === ".wav") {
      duration = Math.max(5, Math.round(fileBuffer.length / 48000));
    } else {
      duration = Math.max(5, Math.round(fileBuffer.length / 16000)); // assume compressed
    }

    // Save sample metadata
    const sample = db.addSample({
      voiceId: newVoice.id,
      fileName: fileName,
      filePath: path.relative(process.cwd(), targetPath),
      duration: duration,
      sampleRate: ext === ".wav" ? 24000 : 44100,
      fileSize: fileBuffer.length,
    });

    const previewUrl = `/api/audio/uploads/${path.basename(targetPath)}`;
    res.status(201).json({
      message: "Voice profile created and sample uploaded successfully.",
      voice: { ...newVoice, previewUrl },
      sample,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload voice sample", details: error.message });
  }
});

// POST Train Voice Profile
app.post("/api/train", async (req, res) => {
  try {
    const { voiceId } = req.body;
    if (!voiceId) {
      res.status(400).json({ error: "Missing voiceId for training." });
      return;
    }

    // Check if voice exists
    const voice = db.getVoice(voiceId);
    if (!voice) {
      res.status(404).json({ error: "Voice profile not found." });
      return;
    }

    // Trigger training asynchronously so the client gets immediate success feedback
    // with "Training" status. The database status will transition to "Ready" once completed.
    db.updateVoice(voiceId, { status: "Training" });
    
    // We launch training as background task
    speechEngine.trainVoice(voiceId)
      .then((trainedVoice) => {
        console.log(`Background training successful for voice profile: ${trainedVoice.voiceName}`);
      })
      .catch((err) => {
        console.error(`Background training failed for voice ${voiceId}:`, err);
        db.updateVoice(voiceId, { status: "Failed" });
      });

    res.json({
      message: "Vocal signature extraction and model training started in background.",
      voiceId,
      status: "Training",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to trigger training", details: error.message });
  }
});

// DELETE a Voice Profile
app.delete("/api/voice/:id", (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteVoice(id);
    if (deleted) {
      res.json({ success: true, message: "Voice profile deleted successfully." });
    } else {
      res.status(404).json({ error: "Voice profile not found." });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete voice profile", details: error.message });
  }
});

// POST Generate custom Text-To-Speech audio
app.post("/api/generate", async (req, res) => {
  try {
    const {
      voiceId,
      inputText,
      speed = 1.0,
      pitch = 0,
      volume = 1.0,
      emotion = "Neutral",
      engine = "Gemini", // "Gemini" or "Local DSP"
    } = req.body;

    if (!voiceId || !inputText) {
      res.status(400).json({ error: "Missing voiceId or text to speak." });
      return;
    }

    const voice = db.getVoice(voiceId);
    if (!voice) {
      res.status(404).json({ error: "Selected voice profile does not exist." });
      return;
    }

    if (voice.status !== "Ready") {
      res.status(400).json({ error: `Selected voice is currently in status '${voice.status}'. Please wait until it is Trained.` });
      return;
    }

    // Synthesize audio
    const result = await speechEngine.generateAudio(
      voiceId,
      inputText,
      parseFloat(speed),
      parseInt(pitch),
      parseFloat(volume),
      emotion,
      engine as "Gemini" | "Local DSP"
    );

    // Save physical WAV file
    const fileId = "gen_" + Math.random().toString(36).substr(2, 9);
    const fileName = `${fileId}.wav`;
    const outputPath = path.join(db.getGeneratedDir(), fileName);
    fs.writeFileSync(outputPath, result.audioBuffer);

    // Convert and save physical MP3 file
    let mp3FileName = "";
    let mp3OutputPath = "";
    try {
      const mp3Buffer = convertWavToMp3(result.audioBuffer, result.pcmSampleRate);
      mp3FileName = `${fileId}.mp3`;
      mp3OutputPath = path.join(db.getGeneratedDir(), mp3FileName);
      fs.writeFileSync(mp3OutputPath, mp3Buffer);
      console.log(`SpeechEngine: Successfully saved MP3 file: ${mp3FileName}`);
    } catch (mp3Err) {
      console.error("Failed to convert/save MP3 file:", mp3Err);
    }

    // Add to Database History
    const historyItem = db.addHistoryItem({
      voiceId: voice.id,
      voiceName: voice.voiceName,
      inputText,
      outputAudioPath: path.relative(process.cwd(), outputPath),
      outputAudioUrl: `/api/audio/generated/${fileName}`,
      outputAudioPathMp3: mp3OutputPath ? path.relative(process.cwd(), mp3OutputPath) : undefined,
      outputAudioUrlMp3: mp3FileName ? `/api/audio/generated/${mp3FileName}` : undefined,
      speed: parseFloat(speed),
      pitch: parseInt(pitch),
      volume: parseFloat(volume),
      emotion,
      durationSeconds: result.durationSeconds,
      characterCount: inputText.length,
      isFallback: result.isFallback,
      engine: result.engine,
      quotaExceeded: result.quotaExceeded,
    });

    res.status(201).json(historyItem);
  } catch (error: any) {
    console.error("Speech synthesis failed:", error);
    res.status(500).json({ error: "Speech synthesis failed", details: error.message });
  }
});

// GET generation history
app.get("/api/history", (req, res) => {
  try {
    const history = db.getHistory();
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve history", details: error.message });
  }
});

// DELETE history item
app.delete("/api/history/:id", (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteHistoryItem(id);
    if (deleted) {
      res.json({ success: true, message: "History item deleted." });
    } else {
      res.status(404).json({ error: "History record not found." });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete history item", details: error.message });
  }
});

// --- File Streaming Routes with SEEK & Range Header Support ---
app.use("/api/audio/generated", express.static(db.getGeneratedDir()));
app.use("/api/audio/uploads", express.static(db.getUploadsDir()));

// --- Vite & Client App Delivery ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode: Integrate Vite Dev Server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static bundles
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VoiceClone Studio Server] Running on http://localhost:${PORT}`);
    
    // 1. Pre-seed Aria (Female) default voice profile if not present
    try {
      const ariaVoiceId = "voice_aria_female";
      const ariaSampleId = "sample_aria_default";
      const ariaSampleName = "aria_sample.wav";
      const ariaSamplePath = `data/uploads/${ariaVoiceId}_${ariaSampleId}.wav`;

      db.seedVoiceAtBeginning({
        id: ariaVoiceId,
        voiceName: "Aria (Female)",
        language: "English (US)",
        accent: "General American",
        gender: "female",
        description: "A beautifully warm, clear, and professional female voice calibrated for high-fidelity speech.",
        status: "Ready",
        createdAt: new Date().toISOString(),
        consentConfirmed: true,
        genderProfile: "female",
        basePitchOffset: 3,
        formantShift: 1.12,
        vocalClarity: 0.95,
        timbreProfile: {
          lowShelf: 0.5,
          midPeak: 1.2,
          highShelf: 2.0,
          paceModifier: 1.05
        },
        sampleDurations: 5,
        noiseLevel: "low",
        sampleCount: 1
      });

      db.seedSample({
        id: ariaSampleId,
        voiceId: ariaVoiceId,
        fileName: ariaSampleName,
        filePath: ariaSamplePath,
        duration: 5,
        sampleRate: 24000,
        fileSize: 240044,
        createdAt: new Date().toISOString()
      });

      // Ensure default Aria (Female) audio sample is physically generated
      const sampleFullPath = path.join(process.cwd(), ariaSamplePath);
      if (!fs.existsSync(sampleFullPath)) {
        console.log(`[Startup] Generating preview audio file for Aria (Female) default voice profile at ${sampleFullPath}...`);
        speechEngine.generateAudio(
          ariaVoiceId,
          "Hello! I am Aria, your default calibrated voice clone. You can use me to generate highly realistic, natural speech.",
          1.0, // speed
          0,   // pitch
          1.0, // volume
          "Neutral" // emotion
        ).then((generated) => {
          fs.writeFileSync(sampleFullPath, generated.audioBuffer);
          console.log(`[Startup] Successfully generated Aria (Female) preview sample (${generated.audioBuffer.length} bytes, engine: ${generated.engine})`);
        }).catch((err) => {
          console.error("[Startup] Failed to automatically generate Aria preview file:", err);
        });
      }
    } catch (seedErr) {
      console.error("[Startup] Failed to seed Aria (Female) default voice profile:", seedErr);
    }

    // Automatically resume training for any voice left in 'Training' status
    try {
      const voices = db.getVoices();
      const trainingVoices = voices.filter((v) => v.status === "Training");
      for (const voice of trainingVoices) {
        console.log(`[Startup] Resuming background training for voice: ${voice.voiceName} (${voice.id})`);
        speechEngine.trainVoice(voice.id)
          .then((trainedVoice) => {
            console.log(`[Startup] Background training completed successfully for voice: ${trainedVoice.voiceName}`);
          })
          .catch((err) => {
            console.error(`[Startup] Background training failed for voice ${voice.id}:`, err);
            db.updateVoice(voice.id, { status: "Failed" });
          });
      }
    } catch (err) {
      console.error("[Startup] Failed to check or resume voice training:", err);
    }
  });
}

startServer();
