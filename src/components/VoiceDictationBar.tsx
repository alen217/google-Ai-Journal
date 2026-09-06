import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition, PreflightCaptureMode } from "../lib/useSpeechRecognition";
import { 
  runMicrophoneHealthCheck, 
  MicHealthReport, 
  runIsolatedSpeechTest, 
  IsolatedTestMode, 
  IsolatedTestResult 
} from "../lib/audioDiagnostics";
import { TextRefineMode, RefineResult } from "../types";
import { 
  Mic, 
  Square, 
  Sparkles, 
  Wand2, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Globe, 
  ArrowRight, 
  ShieldCheck,
  Activity,
  Sliders,
  ChevronDown,
  ChevronUp,
  Volume2
} from "lucide-react";

interface VoiceDictationBarProps {
  currentText: string;
  onTextChange: (newText: string) => void;
  onTranscript?: (transcript: string) => void;
  onAppendText?: (chunk: string) => void;
  currentMood?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "en-AU", name: "English (AU)" },
  { code: "es-ES", name: "Español (ES)" },
  { code: "es-MX", name: "Español (MX)" },
  { code: "fr-FR", name: "Français" },
  { code: "de-DE", name: "Deutsch" },
  { code: "it-IT", name: "Italiano" },
  { code: "pt-BR", name: "Português (BR)" },
  { code: "ja-JP", name: "日本語" },
  { code: "hi-IN", name: "हिन्दी" },
];

export const VoiceDictationBar: React.FC<VoiceDictationBarProps> = ({
  currentText,
  onTextChange,
  onTranscript,
  onAppendText,
  currentMood,
}) => {
  const [selectedLang, setSelectedLang] = useState("en-US");
  const [sessionSpeechLog, setSessionSpeechLog] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineResult, setRefineResult] = useState<RefineResult | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refineSuccessNotice, setRefineSuccessNotice] = useState<string | null>(null);

  // Diagnostic panel state
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [preflightMode, setPreflightMode] = useState<PreflightCaptureMode>("direct");
  const [isCheckingMicHealth, setIsCheckingMicHealth] = useState(false);
  const [micHealthReport, setMicHealthReport] = useState<MicHealthReport | null>(null);

  // Isolated test state
  const [isIsolatedTestRunning, setIsIsolatedTestRunning] = useState(false);
  const [isolatedTestLogs, setIsolatedTestLogs] = useState<string[]>([]);
  const [isolatedTestResult, setIsolatedTestResult] = useState<IsolatedTestResult | null>(null);
  const isolatedTestStopperRef = useRef<(() => void) | null>(null);

  // Persistent references to prevent stale closures
  const onTranscriptRef = useRef(onTranscript);
  const onTextChangeRef = useRef(onTextChange);
  const onAppendTextRef = useRef(onAppendText);
  const currentTextRef = useRef(currentText);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onTextChangeRef.current = onTextChange;
    onAppendTextRef.current = onAppendText;
    currentTextRef.current = currentText;
  });

  // Diagnostic logging on mount
  useEffect(() => {
    console.log("[VOICE] VoiceDictationBar mounted");
    const callbackAvailable = Boolean(onTranscript || onTextChange);
    console.log(`[VOICE] onTranscript callback available: ${callbackAvailable}`);
  }, [onTranscript, onTextChange]);

  // Dispatch final transcript chunk cleanly to the journal editor
  const handleFinalTranscript = useCallback((finalText: string) => {
    const trimmed = finalText.trim();
    if (!trimmed) return;

    console.log("[VOICE] VoiceDictationBar callback received");
    console.log("[VOICE] Final transcript received by VoiceDictationBar");
    setSessionSpeechLog((prev) => (prev ? `${prev} ${trimmed}` : trimmed));

    console.log("[VOICE] Sending transcript to journal editor");
    if (onTranscriptRef.current) {
      onTranscriptRef.current(trimmed);
    } else if (onAppendTextRef.current) {
      onAppendTextRef.current(trimmed);
    } else if (onTextChangeRef.current) {
      const existing = (currentTextRef.current || "").trim();
      if (!existing) {
        onTextChangeRef.current(trimmed);
      } else {
        onTextChangeRef.current(`${existing}\n\n${trimmed}`);
      }
    }
  }, []);

  const {
    isListening,
    status,
    interimTranscript,
    error: speechError,
    isSupported,
    startListening,
    stopListening,
    setLanguage,
  } = useSpeechRecognition({
    onFinalTranscript: handleFinalTranscript,
  });

  const handleLanguageChange = (newLang: string) => {
    setSelectedLang(newLang);
    setLanguage(newLang);
  };

  // Toggle voice dictation
  const handleToggleListening = async () => {
    if (isListening) {
      stopListening();
    } else {
      setRefineResult(null);
      setRefineError(null);
      setSessionSpeechLog("");

      await startListening({
        lang: selectedLang,
        preflightMode,
        onFinalTranscript: handleFinalTranscript,
      });
    }
  };

  // Trigger temporary microphone health check
  const handleRunMicHealthCheck = async () => {
    setIsCheckingMicHealth(true);
    setMicHealthReport(null);
    try {
      const report = await runMicrophoneHealthCheck();
      setMicHealthReport(report);
    } catch (err: any) {
      console.error("Health check error:", err);
    } finally {
      setIsCheckingMicHealth(false);
    }
  };

  // Trigger isolated browser SpeechRecognition test (Test A or Test B)
  const handleRunIsolatedTest = (mode: IsolatedTestMode) => {
    if (isIsolatedTestRunning) {
      if (isolatedTestStopperRef.current) {
        isolatedTestStopperRef.current();
        isolatedTestStopperRef.current = null;
      }
      setIsIsolatedTestRunning(false);
      return;
    }

    setIsIsolatedTestRunning(true);
    setIsolatedTestLogs([]);
    setIsolatedTestResult(null);

    const testHandle = runIsolatedSpeechTest(
      mode,
      selectedLang,
      (logLine) => {
        setIsolatedTestLogs((prev) => [...prev, logLine]);
      },
      (res) => {
        setIsolatedTestResult(res);
        setIsIsolatedTestRunning(false);
        isolatedTestStopperRef.current = null;
      }
    );

    isolatedTestStopperRef.current = testHandle.stop;
  };

  // Call Gemini contextual auto-correction / grammar API (strictly on user action)
  const handleRefineText = async (mode: TextRefineMode = "auto_correct", textToRefine?: string) => {
    const textTarget = textToRefine !== undefined ? textToRefine : currentText;
    if (!textTarget.trim()) {
      setRefineError("Please speak or write some text before running auto-correction.");
      return;
    }

    setIsRefining(true);
    setRefineError(null);
    setRefineResult(null);

    try {
      const res = await fetch("/api/gemini/refine-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textTarget,
          mode,
          mood: currentMood || "reflective",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to refine text.");
      }

      setRefineResult(data);
      if (data.corrections && data.corrections.length === 0) {
        setRefineSuccessNotice("✨ Your spelling and grammar look pristine!");
        setTimeout(() => setRefineSuccessNotice(null), 3500);
      }
    } catch (err: any) {
      console.error("Text refinement error:", err);
      setRefineError(err?.message || "Failed to auto-correct text.");
    } finally {
      setIsRefining(false);
    }
  };

  // Accept and apply corrected text
  const handleAcceptRefinement = () => {
    if (refineResult?.refinedText) {
      onTextChange(refineResult.refinedText);
      setRefineResult(null);
      setRefineSuccessNotice("✨ Auto-corrections and grammar applied to journal.");
      setTimeout(() => setRefineSuccessNotice(null), 3000);
    }
  };

  // Discard refinement
  const handleDiscardRefinement = () => {
    setRefineResult(null);
  };

  // Render status badge
  const renderStatusBadge = () => {
    switch (status) {
      case "listening":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <span>🔴 Listening...</span>
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold border border-amber-300 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-700" />
            <span>⏳ Processing speech...</span>
          </span>
        );
      case "complete":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-300">
            <Check className="w-3 h-3 text-emerald-700" />
            <span>✓ Voice input complete</span>
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 text-[11px] font-semibold border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>⚠️ Voice input notice</span>
          </span>
        );
      case "idle":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-200/80 text-stone-700 text-[11px] font-medium">
            <span>🎙️ Ready</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Main Voice Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-stone-100/90 border border-stone-200/90 text-xs shadow-2xs">
        
        {/* Left Side: Voice Dictation Start/Stop + Status Badge + Language */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="voice-dictation-toggle-btn"
            type="button"
            onClick={handleToggleListening}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-xs ${
              isListening
                ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-300 animate-pulse"
                : "bg-stone-900 hover:bg-stone-800 text-stone-100"
            }`}
            title={isListening ? "Stop Voice Dictation" : "Start Voice Input"}
          >
            {isListening ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>⏹ Stop Voice</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-amber-400" />
                <span>🎙️ Start Voice Input</span>
              </>
            )}
          </button>

          {/* Status Indicator */}
          <div className="flex items-center">
            {renderStatusBadge()}
          </div>

          {/* Language selector */}
          <div className="relative inline-flex items-center">
            <Globe className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
            <select
              id="voice-language-select"
              value={selectedLang}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="pl-7 pr-4 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Audio Health & Diagnostics Toggle Button */}
          <button
            id="btn-toggle-diagnostics"
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
              showDiagnostics
                ? "bg-amber-100 border-amber-300 text-amber-900"
                : "bg-white border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50"
            }`}
            title="Inspect microphone hardware health, input devices, and run isolated speech recognition tests"
          >
            <Activity className="w-3.5 h-3.5 text-amber-600" />
            <span>Audio Diagnostics</span>
            {showDiagnostics ? (
              <ChevronUp className="w-3 h-3 text-stone-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-stone-400" />
            )}
          </button>
        </div>

        {/* Right Side: Gemini AI Auto-Correction & Grammar Tools */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            id="btn-auto-correct"
            type="button"
            onClick={() => handleRefineText("auto_correct")}
            disabled={isRefining || !currentText.trim() || isListening}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-stone-800 hover:text-amber-900 border border-stone-200 hover:border-amber-300 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 text-[11px]"
            title="Auto-correct spelling typos and grammar based on journal context"
          >
            {isRefining ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>Auto-Correct & Grammar</span>
          </button>

          <button
            id="btn-polish-flow"
            type="button"
            onClick={() => handleRefineText("polish_flow")}
            disabled={isRefining || !currentText.trim() || isListening}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 font-medium flex items-center gap-1 transition-colors disabled:opacity-50 text-[11px]"
            title="Gently polish flow and expression while keeping your authentic tone"
          >
            <Sparkles className="w-3 h-3 text-stone-500" />
            <span>Polish Flow</span>
          </button>
        </div>

      </div>

      {/* Diagnostics & Audio Health Panel */}
      {showDiagnostics && (
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-4 animate-fade-in shadow-xs">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Sliders className="w-4 h-4 text-amber-600" />
              <span>Microphone Health Diagnostic & Isolated Web Speech Test Harness</span>
            </div>
            <span className="text-[11px] text-stone-500">Zero-Private-Content Logging Enforced</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section 1: Microphone Health & Audio Energy Check */}
            <div className="p-3.5 rounded-xl bg-white border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                  1. Hardware & Audio Energy Check
                </span>
                <button
                  id="btn-run-mic-health"
                  type="button"
                  onClick={handleRunMicHealthCheck}
                  disabled={isCheckingMicHealth || isListening}
                  className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium text-[11px] flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isCheckingMicHealth ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      <span>Checking Audio...</span>
                    </>
                  ) : (
                    <span>Test Microphone</span>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-stone-500">
                Tests if browser receives live acoustic signal (RMS/peak) via Web Audio AnalyserNode without recording audio, then releases all tracks immediately.
              </p>

              {micHealthReport && (
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Stream Acquired:</span>
                    <span className={micHealthReport.streamAcquired ? "text-emerald-700 font-bold" : "text-rose-600"}>
                      {String(micHealthReport.streamAcquired)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Tracks Count:</span>
                    <span>{micHealthReport.audioTrackCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Track State:</span>
                    <span className={micHealthReport.audioTrackState === "live" ? "text-emerald-700 font-bold" : "text-amber-600"}>
                      {micHealthReport.audioTrackState}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Track Enabled:</span>
                    <span>{String(micHealthReport.audioTrackEnabled)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Track Muted:</span>
                    <span>{String(micHealthReport.audioTrackMuted)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Input Devices Detected:</span>
                    <span>{micHealthReport.audioInputDevicesCount}</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-200 pt-1 font-bold">
                    <span>Audio Input Level Detected:</span>
                    <span className={micHealthReport.audioInputLevelDetected ? "text-emerald-700" : "text-rose-600"}>
                      {String(micHealthReport.audioInputLevelDetected)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Isolated SpeechRecognition Test (Test A vs Test B) */}
            <div className="p-3.5 rounded-xl bg-white border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-600" />
                  2. Isolated Web Speech Test
                </span>
                <span className="text-[11px] font-mono text-stone-500">Lang: {selectedLang}</span>
              </div>

              <p className="text-[11px] text-stone-500">
                Directly tests Chrome SpeechRecognition isolated from JournalEditor, React state, or text insertion.
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-isolated-test-a"
                  type="button"
                  onClick={() => handleRunIsolatedTest("A")}
                  disabled={isListening}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 transition-all ${
                    isIsolatedTestRunning
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300"
                  }`}
                  title="Test A: Preflight getUserMedia -> stop tracks -> 150ms delay -> SpeechRecognition"
                >
                  {isIsolatedTestRunning ? "⏹ Stop Test" : "Run Test A (Preflight)"}
                </button>

                <button
                  id="btn-isolated-test-b"
                  type="button"
                  onClick={() => handleRunIsolatedTest("B")}
                  disabled={isListening}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 transition-all ${
                    isIsolatedTestRunning
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300"
                  }`}
                  title="Test B: Direct SpeechRecognition.start() without preflight stream acquire/stop"
                >
                  {isIsolatedTestRunning ? "⏹ Stop Test" : "Run Test B (Direct Start)"}
                </button>
              </div>

              {/* Mode Selection for Standard Journal Dictation */}
              <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
                <span className="text-stone-600 font-medium">Standard Dictation Mode:</span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="preflightMode"
                      value="direct"
                      checked={preflightMode === "direct"}
                      onChange={() => setPreflightMode("direct")}
                      className="text-amber-600"
                    />
                    <span className="font-semibold text-emerald-800">Mode B: Direct (Recommended)</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="preflightMode"
                      value="preflight"
                      checked={preflightMode === "preflight"}
                      onChange={() => setPreflightMode("preflight")}
                      className="text-amber-600"
                    />
                    <span className="text-stone-700">Mode A: Preflight</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Live Log Stream of Isolated Test */}
          {(isolatedTestLogs.length > 0 || isolatedTestResult) && (
            <div className="p-3 rounded-xl bg-stone-900 text-stone-200 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
              <div className="text-stone-400 font-bold border-b border-stone-800 pb-1 flex justify-between">
                <span>Isolated Test Console Log:</span>
                {isolatedTestResult && (
                  <span className={isolatedTestResult.success ? "text-emerald-400" : "text-amber-400"}>
                    {isolatedTestResult.success ? "✓ onresult received successfully" : `Result: ${isolatedTestResult.error || "ended"}`}
                  </span>
                )}
              </div>
              {isolatedTestLogs.map((log, idx) => (
                <div key={idx} className="leading-snug">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Voice Transcription Banner when Listening */}
      {isListening && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold text-amber-950 font-sans">
                🔴 Listening... Speak your thoughts naturally.
              </span>
            </div>

            {/* Audio Wave Visualizer Simulation */}
            <div className="flex items-center gap-1 h-4">
              <div className="w-1 bg-amber-600 rounded-full animate-bounce [animation-delay:0.1s] h-3"></div>
              <div className="w-1 bg-amber-600 rounded-full animate-bounce [animation-delay:0.3s] h-4"></div>
              <div className="w-1 bg-amber-600 rounded-full animate-bounce [animation-delay:0.2s] h-2"></div>
              <div className="w-1 bg-amber-600 rounded-full animate-bounce [animation-delay:0.4s] h-4"></div>
              <div className="w-1 bg-amber-600 rounded-full animate-bounce [animation-delay:0.15s] h-3"></div>
            </div>
          </div>

          {/* Real-time speech transcription display (Interim + Session) */}
          <div className="p-3 rounded-xl bg-white/90 border border-amber-200 text-xs text-stone-800 font-['Newsreader'] italic leading-relaxed min-h-[44px]">
            {sessionSpeechLog || interimTranscript ? (
              <span>
                {sessionSpeechLog && <span>{sessionSpeechLog} </span>}
                {interimTranscript && (
                  <span className="text-amber-700 font-semibold underline decoration-amber-300">
                    {interimTranscript}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-stone-400 not-italic font-sans text-[11px]">
                Waiting for speech... Words will appear here and in your journal editor in real time.
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-amber-900/80 pt-1">
            <span>Speech is automatically inserted into your journal. Click <strong>⏹ Stop Voice</strong> when finished.</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-stone-500">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Local Web Speech API ({preflightMode === "direct" ? "Direct Mode" : "Preflight Mode"})
            </span>
          </div>
        </div>
      )}

      {/* Browser Support Warning */}
      {!isSupported && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">
              Voice input isn&apos;t supported by this browser. Please try Chrome or another supported browser.
            </span>
            <p className="text-[11px] text-stone-600">
              You can still type your reflections and use our Gemini AI contextual auto-correction tools.
            </p>
          </div>
        </div>
      )}

      {/* Speech Error Banner */}
      {speechError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{speechError}</span>
          </div>
          <button
            onClick={handleToggleListening}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shrink-0 hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Refine Error Banner */}
      {refineError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{refineError}</span>
        </div>
      )}

      {/* Success Notification */}
      {refineSuccessNotice && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{refineSuccessNotice}</span>
        </div>
      )}

      {/* Interactive Refinement & Auto-Correction Comparison Review Panel */}
      {refineResult && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Contextual Auto-Correction Preview
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardRefinement}
                className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors"
              >
                Keep Original
              </button>
              <button
                id="btn-apply-refinement"
                type="button"
                onClick={handleAcceptRefinement}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Corrections</span>
              </button>
            </div>
          </div>

          {/* Change Summary */}
          {refineResult.changeSummary && (
            <p className="text-xs text-amber-900 font-medium">
              💡 {refineResult.changeSummary}
            </p>
          )}

          {/* List of Specific Word/Grammar Corrections */}
          {refineResult.corrections && refineResult.corrections.length > 0 && (
            <div className="space-y-1.5 bg-white/80 p-3 rounded-xl border border-amber-200">
              <span className="text-[11px] font-bold text-stone-600 block">
                Detected Fixes ({refineResult.corrections.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {refineResult.corrections.map((item, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-950 text-xs border border-amber-300/80 font-mono"
                  >
                    <span className="line-through text-rose-600 opacity-80">{item.original}</span>
                    <ArrowRight className="w-3 h-3 text-stone-400" />
                    <span className="font-bold text-emerald-700">{item.corrected}</span>
                    {item.explanation && (
                      <span className="text-[10px] text-stone-500 font-sans ml-1">
                        ({item.explanation})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Polished Preview Box */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs text-stone-800 font-['Newsreader'] italic leading-relaxed">
            {refineResult.refinedText}
          </div>
        </div>
      )}
    </div>
  );
};
