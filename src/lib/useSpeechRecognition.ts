import { useState, useEffect, useRef, useCallback } from "react";

// Web Speech API interface definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
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

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isExplicitStopRef = useRef(false);

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(Boolean(SpeechRecognitionAPI));
  }, []);

  const stopListening = useCallback(() => {
    isExplicitStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Speech recognition stop error:", err);
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(
    (options?: { lang?: string; onFinalChunk?: (chunk: string) => void }) => {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        setError(
          "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari."
        );
        return;
      }

      setError(null);
      isExplicitStopRef.current = false;

      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = options?.lang || "en-US";
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = "";
          let finalChunk = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const transcriptText = result[0].transcript;
            if (result.isFinal) {
              finalChunk += transcriptText;
              setTranscript((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
              if (options?.onFinalChunk) {
                options.onFinalChunk(transcriptText);
              }
            } else {
              currentInterim += transcriptText;
            }
          }
          setInterimTranscript(currentInterim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            setError(
              "Microphone access was denied. Please allow microphone permissions in your browser bar."
            );
            setIsListening(false);
          } else if (event.error === "no-speech") {
            // benign pause
          } else if (event.error === "network") {
            setError("Speech recognition network error. Please check your connection.");
            setIsListening(false);
          } else {
            setError(`Speech recognition notice: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setInterimTranscript("");
          // If not stopped explicitly by user, restart to maintain continuous dictation flow
          if (!isExplicitStopRef.current && recognitionRef.current) {
            try {
              recognition.start();
            } catch {
              setIsListening(false);
            }
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.error("Failed to start speech recognition:", err);
        setError(err?.message || "Failed to initialize microphone.");
        setIsListening(false);
      }
    },
    []
  );

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
