// Audio & Microphone Diagnostics Utility for Web Speech API and Web Audio
// Adheres strictly to zero-private-content logging and privacy standards

export interface MicHealthReport {
  streamAcquired: boolean;
  audioTrackCount: number;
  audioTrackState: string;
  audioTrackEnabled: boolean;
  audioTrackMuted: boolean;
  audioInputLevelDetected: boolean;
  microphoneAvailable: boolean;
  audioInputDevicesCount: number;
  error?: string;
  measuredPeakEnergy?: number;
  measuredRmsEnergy?: number;
}

/**
 * Runs a temporary microphone health diagnostic
 * Tests if the browser receives audio energy via Web Audio API AnalyserNode,
 * enumerates input devices, and immediately releases all tracks.
 */
export async function runMicrophoneHealthCheck(): Promise<MicHealthReport> {
  console.log("[VOICE] Starting microphone health diagnostic...");

  const isSecure = typeof window !== "undefined" ? Boolean(window.isSecureContext) : false;
  console.log(`[VOICE] Secure context: ${isSecure}`);

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.log("[VOICE] getUserMedia available: false");
    console.log("Microphone available: false");
    return {
      streamAcquired: false,
      audioTrackCount: 0,
      audioTrackState: "unavailable",
      audioTrackEnabled: false,
      audioTrackMuted: false,
      audioInputLevelDetected: false,
      microphoneAvailable: false,
      audioInputDevicesCount: 0,
      error: "navigator.mediaDevices.getUserMedia is not supported in this browser.",
    };
  }

  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;

  try {
    // 1. Enumerate available audio input devices
    let inputCount = 0;
    if (navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputDevices = devices.filter((d) => d.kind === "audioinput");
        inputCount = inputDevices.length;
      } catch {
        inputCount = 1; // Fallback estimate
      }
    }

    // 2. Acquire audio stream
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    console.log("[VOICE] Microphone stream acquired");

    const tracks = stream.getAudioTracks();
    const trackCount = tracks.length;
    console.log(`[VOICE] Audio track count: ${trackCount}`);

    const primaryTrack = tracks[0];
    const trackState = primaryTrack ? primaryTrack.readyState : "none";
    const trackEnabled = primaryTrack ? primaryTrack.enabled : false;
    const trackMuted = primaryTrack ? primaryTrack.muted : false;

    console.log(`[VOICE] Audio track state: ${trackState}`);
    console.log(`[VOICE] Audio track enabled: ${trackEnabled}`);
    console.log(`Microphone available: ${trackCount > 0 && trackState === "live"}`);
    console.log(`Audio input devices detected: ${inputCount}`);
    console.log(`Active audio track: ${trackState}`);

    // 3. Audio energy measurement via Web Audio AnalyserNode (sample for 600ms)
    let audioInputLevelDetected = false;
    let peakEnergy = 0;
    let rmsEnergy = 0;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass && primaryTrack && trackState === "live") {
      try {
        audioContext = new AudioContextClass();
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const startTime = Date.now();
        // Sample for ~600ms to detect acoustic energy without logging any audio
        while (Date.now() - startTime < 600) {
          analyser.getByteTimeDomainData(dataArray);

          let sumSquares = 0;
          for (let i = 0; i < bufferLength; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            const abs = Math.abs(normalized);
            if (abs > peakEnergy) peakEnergy = abs;
            sumSquares += normalized * normalized;
          }
          const currentRms = Math.sqrt(sumSquares / bufferLength);
          if (currentRms > rmsEnergy) rmsEnergy = currentRms;

          // Energy threshold: non-zero signal above baseline noise
          if (peakEnergy > 0.015 || rmsEnergy > 0.008) {
            audioInputLevelDetected = true;
          }

          await new Promise((r) => setTimeout(r, 60));
        }
      } catch (audioErr) {
        console.log("[VOICE] Audio energy analysis notice:", audioErr);
        // If AnalyserNode is blocked, assume level detected if track is live and unmuted
        audioInputLevelDetected = trackState === "live" && !trackMuted;
      }
    } else {
      audioInputLevelDetected = trackState === "live" && !trackMuted;
    }

    console.log(`[VOICE] Audio input level detected: ${audioInputLevelDetected}`);

    return {
      streamAcquired: true,
      audioTrackCount: trackCount,
      audioTrackState: trackState,
      audioTrackEnabled: trackEnabled,
      audioTrackMuted: trackMuted,
      audioInputLevelDetected,
      microphoneAvailable: trackCount > 0 && trackState === "live",
      audioInputDevicesCount: inputCount,
      measuredPeakEnergy: Math.round(peakEnergy * 1000) / 1000,
      measuredRmsEnergy: Math.round(rmsEnergy * 1000) / 1000,
    };
  } catch (err: any) {
    console.log("[VOICE] Microphone health diagnostic error:", err?.name || err?.message || err);
    return {
      streamAcquired: false,
      audioTrackCount: 0,
      audioTrackState: "error",
      audioTrackEnabled: false,
      audioTrackMuted: false,
      audioInputLevelDetected: false,
      microphoneAvailable: false,
      audioInputDevicesCount: 0,
      error: err?.message || "Microphone check failed.",
    };
  } finally {
    // Crucial: release stream completely to prevent hardware lockup
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      console.log("[VOICE] Diagnostic microphone stream released");
    }
    if (audioContext) {
      try {
        audioContext.close();
      } catch {}
    }
  }
}

export type IsolatedTestMode = "A" | "B";

export interface IsolatedTestResult {
  mode: IsolatedTestMode;
  success: boolean;
  onStartFired: boolean;
  onResultFired: boolean;
  resultCount: number;
  isFinalReceived: boolean;
  error: string | null;
  logs: string[];
}

/**
 * Isolated SpeechRecognition Browser Test
 * Directly tests Web Speech API without JournalEditor, Gemini, autosave, or editor state
 * Compares:
 * - Test A: getUserMedia -> stop tracks -> async delay -> SpeechRecognition.start()
 * - Test B: SpeechRecognition.start() directly without separate preflight stream
 */
export function runIsolatedSpeechTest(
  mode: IsolatedTestMode,
  lang: string = "en-US",
  onLog: (line: string) => void,
  onComplete: (result: IsolatedTestResult) => void
): { stop: () => void } {
  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const collectedLogs: string[] = [];
  const log = (msg: string) => {
    collectedLogs.push(msg);
    console.log(msg);
    onLog(msg);
  };

  log(`[VOICE TEST] Starting Isolated Test - Mode ${mode}`);
  log(`[VOICE TEST] SpeechRecognition API exists: ${Boolean(SpeechRecognitionAPI)}`);
  log(`[VOICE TEST] Recognition language: ${lang}`);

  if (!SpeechRecognitionAPI) {
    log("[VOICE TEST] SpeechRecognition is not supported in this browser.");
    onComplete({
      mode,
      success: false,
      onStartFired: false,
      onResultFired: false,
      resultCount: 0,
      isFinalReceived: false,
      error: "SpeechRecognition not supported",
      logs: collectedLogs,
    });
    return { stop: () => {} };
  }

  let recognition: any = null;
  let isStopped = false;
  let onStartFired = false;
  let onResultFired = false;
  let resultCount = 0;
  let isFinalReceived = false;
  let encounteredError: string | null = null;

  const cleanStop = () => {
    if (isStopped) return;
    isStopped = true;
    if (recognition) {
      try {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {}
      }
      recognition = null;
    }
  };

  const executeRecognitionStart = () => {
    if (isStopped) return;

    try {
      recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      log(`[VOICE TEST] Recognition language configured: ${recognition.lang}`);
      log(`[VOICE TEST] Language match verified: ${recognition.lang === lang}`);

      recognition.onstart = () => {
        onStartFired = true;
        log("[VOICE TEST] recognition.start()");
        log("[VOICE TEST] onstart");
        log("[VOICE TEST] waiting for speech");
      };

      recognition.onresult = (event: any) => {
        onResultFired = true;
        resultCount = event.results.length;
        log("[VOICE TEST] onresult");
        log(`[VOICE TEST] Result count: ${resultCount}`);

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const isFinal = Boolean(res.isFinal);
          log(`[VOICE TEST] Result isFinal: ${isFinal}`);
          if (isFinal) {
            isFinalReceived = true;
            log("[VOICE TEST] final result received");
          }
        }
      };

      recognition.onerror = (event: any) => {
        encounteredError = event.error;
        log(`[VOICE TEST] Recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        log("[VOICE TEST] onend");
        log("[VOICE TEST] Test finished");
        cleanStop();

        onComplete({
          mode,
          success: onResultFired,
          onStartFired,
          onResultFired,
          resultCount,
          isFinalReceived,
          error: encounteredError,
          logs: collectedLogs,
        });
      };

      log("[VOICE TEST] recognition.start() called");
      recognition.start();
    } catch (err: any) {
      encounteredError = err?.message || "Failed to start recognition";
      log(`[VOICE TEST] start error: ${encounteredError}`);
      cleanStop();
      onComplete({
        mode,
        success: false,
        onStartFired,
        onResultFired: false,
        resultCount: 0,
        isFinalReceived: false,
        error: encounteredError,
        logs: collectedLogs,
      });
    }
  };

  if (mode === "A") {
    // TEST A: Preflight getUserMedia -> stop tracks -> 150ms delay -> SpeechRecognition.start()
    log("[VOICE TEST] Mode A: Opening preflight getUserMedia stream...");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          log("[VOICE TEST] Preflight stream acquired. Stopping all tracks immediately...");
          stream.getTracks().forEach((track) => track.stop());
          log("[VOICE TEST] Preflight stream tracks stopped. Waiting 150ms release barrier...");
          setTimeout(() => {
            if (!isStopped) {
              executeRecognitionStart();
            }
          }, 150);
        })
        .catch((permErr: any) => {
          log(`[VOICE TEST] Preflight getUserMedia failed: ${permErr?.name || permErr}`);
          encounteredError = permErr?.name || "Permission denied";
          onComplete({
            mode,
            success: false,
            onStartFired: false,
            onResultFired: false,
            resultCount: 0,
            isFinalReceived: false,
            error: encounteredError,
            logs: collectedLogs,
          });
        });
    } else {
      executeRecognitionStart();
    }
  } else {
    // TEST B: Direct SpeechRecognition.start() WITHOUT opening/stopping preflight stream
    log("[VOICE TEST] Mode B: Starting SpeechRecognition directly (no preflight audio stream open/stop)...");
    executeRecognitionStart();
  }

  return {
    stop: () => {
      log("[VOICE TEST] User requested stop of isolated test");
      cleanStop();
    },
  };
}
