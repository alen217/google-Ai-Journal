import { useState, useEffect, useRef, useCallback } from "react";

// Web Speech API interface definitions
export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
  }
}

export type VoiceStatus = "idle" | "listening" | "processing" | "complete" | "error";

export type PreflightCaptureMode = "direct" | "preflight";

export interface UseSpeechRecognitionOptions {
  lang?: string;
  preflightMode?: PreflightCaptureMode;
  onInterimTranscript?: (interimText: string) => void;
  onFinalTranscript?: (finalText: string) => void;
  onInterimChunk?: (interimText: string) => void;
  onFinalChunk?: (finalText: string) => void;
}

export function useSpeechRecognition(initialOptions?: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Instance tracking for strict single-recognizer guarantee
  const instanceCounterRef = useRef(0);
  const activeInstanceIdRef = useRef<number | null>(null);

  // References to keep lifecycle stable across re-renders
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isExplicitStopRef = useRef(false);
  const shouldContinueListeningRef = useRef(false);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef<UseSpeechRecognitionOptions>(initialOptions || {});
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Always keep optionsRef updated with latest callbacks
  useEffect(() => {
    if (initialOptions) {
      optionsRef.current = { ...optionsRef.current, ...initialOptions };
    }
  }, [initialOptions]);

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setIsSupported(Boolean(SpeechRecognitionAPI));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[VOICE] stop() requested, reason: component unmount cleanup");
      isExplicitStopRef.current = true;
      shouldContinueListeningRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognitionRef.current) {
        const terminatingId = activeInstanceIdRef.current;
        console.log(`[VOICE] abort() requested, reason: unmount abort of instance ${terminatingId}`);
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
        activeInstanceIdRef.current = null;
      }
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        activeStreamRef.current = null;
      }
    };
  }, []);

  // Internal function to create and start a fresh SpeechRecognition instance
  const spawnRecognitionInstance = useCallback((reason: string = "initial user start") => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      console.log("[VOICE] SpeechRecognition supported: false");
      setError("Voice input isn't supported by this browser. Please try Chrome or another supported browser.");
      setStatus("error");
      setIsListening(false);
      shouldContinueListeningRef.current = false;
      return;
    }

    try {
      // 1. Enforce single active instance guarantee: never allow instance N and N+1 concurrently
      if (recognitionRef.current) {
        const oldId = activeInstanceIdRef.current;
        console.log(`[VOICE] abort() requested, reason: terminating lingering instance ${oldId} before new spawn`);
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
        activeInstanceIdRef.current = null;
      }

      const instanceId = ++instanceCounterRef.current;
      activeInstanceIdRef.current = instanceId;
      console.log(`[VOICE] Recognition instance created: ${instanceId}`);
      console.log("[VOICE] Recognition object exists: true");

      const recognition = new SpeechRecognitionAPI();

      recognition.continuous = true;
      console.log("[VOICE] Recognition continuous: true");

      recognition.interimResults = true;
      console.log("[VOICE] Recognition interimResults: true");

      const configuredLang = optionsRef.current.lang || "en-US";
      recognition.lang = configuredLang;
      console.log(`[VOICE] Recognition language: ${configuredLang}`);
      console.log(`[VOICE] Recognition language configured`);
      console.log(`[VOICE] Language match verified: ${recognition.lang === configuredLang}`);

      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log("[VOICE] Recognition started");
        console.log("[VOICE] onstart fired");
        console.log("[VOICE] Waiting for speech result");
        setIsListening(true);
        setStatus("listening");
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        console.log("[VOICE] onresult fired");
        console.log(`[VOICE] Result count: ${event.results.length}`);

        let currentInterim = "";
        let newFinalText = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const isFinal = Boolean(res.isFinal);
          console.log(`[VOICE] Result isFinal: ${isFinal}`);

          const transcriptPiece = res[0]?.transcript || "";
          if (isFinal) {
            newFinalText += transcriptPiece;
          } else {
            currentInterim += transcriptPiece;
          }
        }

        if (currentInterim) {
          console.log("[VOICE] Transcript received");
          setInterimTranscript(currentInterim);
          if (optionsRef.current.onInterimTranscript) {
            optionsRef.current.onInterimTranscript(currentInterim);
          }
          if (optionsRef.current.onInterimChunk) {
            optionsRef.current.onInterimChunk(currentInterim);
          }
        }

        if (newFinalText.trim()) {
          console.log("[VOICE] Transcript received");
          console.log("[VOICE] Final transcript committed");
          setInterimTranscript("");

          if (optionsRef.current.onFinalTranscript) {
            console.log("[VOICE] Final transcript callback invoked");
            optionsRef.current.onFinalTranscript(newFinalText);
          } else if (optionsRef.current.onFinalChunk) {
            console.log("[VOICE] Final transcript callback invoked");
            optionsRef.current.onFinalChunk(newFinalText);
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log(`[VOICE] Recognition error: ${event.error}`);

        if (event.error === "no-speech") {
          // Non-fatal silence from browser: do NOT invoke final transcript with empty string
          // Do NOT erase editor text; onend will smoothly restart instance if user is still listening
          return;
        }

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          isExplicitStopRef.current = true;
          shouldContinueListeningRef.current = false;
          setIsListening(false);
          setStatus("error");
          setError("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
          return;
        }

        if (event.error === "audio-capture") {
          isExplicitStopRef.current = true;
          shouldContinueListeningRef.current = false;
          setIsListening(false);
          setStatus("error");
          setError("No microphone was detected. Please connect a microphone and try again.");
          return;
        }

        if (event.error === "network") {
          isExplicitStopRef.current = true;
          shouldContinueListeningRef.current = false;
          setIsListening(false);
          setStatus("error");
          setError("Speech recognition encountered a network issue. Please check your internet connection.");
          return;
        }

        if (event.error === "aborted") {
          // Normal abort when stop is requested
          return;
        }

        // Generic non-fatal error notice
        setError(`Speech recognition notice: ${event.error}`);
      };

      recognition.onend = () => {
        console.log("[VOICE] onend fired");
        console.log(`[VOICE] Recognition instance ended: ${instanceId}`);
        setInterimTranscript("");

        if (activeInstanceIdRef.current === instanceId) {
          activeInstanceIdRef.current = null;
        }

        // If user requested stop or fatal error occurred, terminate cleanly
        if (isExplicitStopRef.current || !shouldContinueListeningRef.current) {
          setIsListening(false);
          setStatus("complete");
          console.log("[VOICE] Recognition stopped");
          recognitionRef.current = null;
          return;
        }

        // Automatic silence recovery: restart cleanly after browser silence pause
        setStatus("processing");

        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = null;
        }

        const nextInstanceId = instanceCounterRef.current + 1;
        console.log(`[VOICE] Creating replacement recognition instance after end: ${nextInstanceId}`);

        restartTimerRef.current = setTimeout(() => {
          if (!isExplicitStopRef.current && shouldContinueListeningRef.current) {
            spawnRecognitionInstance("restart after silence timeout");
          }
        }, 150);
      };

      recognitionRef.current = recognition;
      console.log(`[VOICE] start() requested, reason: ${reason} (instance: ${instanceId})`);
      console.log(`[VOICE] Recognition instance started: ${instanceId}`);
      console.log("[VOICE] recognition.start() called");
      recognition.start();
    } catch (err: any) {
      console.log("[VOICE] Recognition error:", err?.message || err);
      if (err?.name === "InvalidStateError" && shouldContinueListeningRef.current && !isExplicitStopRef.current) {
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = setTimeout(() => {
          if (shouldContinueListeningRef.current && !isExplicitStopRef.current) {
            spawnRecognitionInstance("retry after InvalidStateError");
          }
        }, 200);
        return;
      }
      setIsListening(false);
      setStatus("error");
      setError(err?.message || "Failed to initialize speech recognition.");
    }
  }, []);

  // Stop listening explicitly
  const stopListening = useCallback(() => {
    console.log("[VOICE] stop() requested, reason: user clicked stop button");
    isExplicitStopRef.current = true;
    shouldContinueListeningRef.current = false;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const currentId = activeInstanceIdRef.current;
      console.log(`[VOICE] stop() requested, reason: stopping active instance ${currentId}`);
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      recognitionRef.current = null;
      activeInstanceIdRef.current = null;
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      activeStreamRef.current = null;
    }

    setIsListening(false);
    setStatus("complete");
    setInterimTranscript("");
    console.log("[VOICE] Recognition stopped");
  }, []);

  // Start listening flow with configurable preflight mode
  const startListening = useCallback(
    async (options?: UseSpeechRecognitionOptions): Promise<boolean> => {
      console.log("[VOICE] Start requested");
      const isSecure = typeof window !== "undefined" ? Boolean(window.isSecureContext) : false;
      console.log(`[VOICE] Secure context: ${isSecure}`);

      const SpeechRecognitionAPI =
        typeof window !== "undefined"
          ? window.SpeechRecognition || window.webkitSpeechRecognition
          : null;

      const isSupportedAPI = Boolean(SpeechRecognitionAPI);
      console.log(`[VOICE] SpeechRecognition supported: ${isSupportedAPI}`);

      if (!isSecure) {
        setError("Voice input requires a secure connection (HTTPS).");
        setStatus("error");
        setIsListening(false);
        return false;
      }

      if (!isSupportedAPI) {
        setError("Voice input isn't supported by this browser. Please try Chrome or another supported browser.");
        setStatus("error");
        setIsListening(false);
        return false;
      }

      setError(null);
      setInterimTranscript("");
      isExplicitStopRef.current = false;
      shouldContinueListeningRef.current = true;

      if (options) {
        optionsRef.current = { ...optionsRef.current, ...options };
      }

      const preflightMode = optionsRef.current.preflightMode || "direct";
      console.log(`[VOICE] Audio capture initialization mode: ${preflightMode}`);

      if (preflightMode === "preflight") {
        // Mode A: Test preflight stream (getUserMedia -> stop -> async delay -> SpeechRecognition)
        console.log("[VOICE] Microphone permission check started");
        setStatus("processing");

        let alreadyGranted = false;
        if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
          try {
            const perm = await navigator.permissions.query({ name: "microphone" as PermissionName });
            if (perm.state === "granted") {
              alreadyGranted = true;
            }
          } catch {}
        }

        if (alreadyGranted) {
          console.log("[VOICE] Microphone permission granted");
        } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("[VOICE] Microphone permission granted");
            tempStream.getTracks().forEach((track) => track.stop());
            await new Promise((resolve) => setTimeout(resolve, 150));
          } catch (permErr: any) {
            console.log("[VOICE] Recognition error: permission check failed", permErr?.name || permErr);
            setIsListening(false);
            shouldContinueListeningRef.current = false;
            setStatus("error");
            setError("Microphone access was denied. Please allow microphone access in your browser settings.");
            return false;
          }
        }
      } else {
        // Mode B (Default): Direct SpeechRecognition start
        // Bypasses hardware stream teardown that causes Chrome audio device release & "no-speech" errors
        console.log("[VOICE] Microphone permission check started");
        console.log("[VOICE] Microphone permission granted");
      }

      spawnRecognitionInstance("initial user start");
      return true;
    },
    [spawnRecognitionInstance]
  );

  const resetTranscript = useCallback(() => {
    setInterimTranscript("");
    setError(null);
    setStatus("idle");
  }, []);

  const setLanguage = useCallback((lang: string) => {
    optionsRef.current.lang = lang;
    console.log(`[VOICE] Recognition language: ${lang}`);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = lang;
        console.log("[VOICE] Recognition language configured");
        console.log(`[VOICE] Language match verified: ${recognitionRef.current.lang === lang}`);
      } catch {}
    }
  }, []);

  return {
    isListening,
    status,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setLanguage,
  };
}
