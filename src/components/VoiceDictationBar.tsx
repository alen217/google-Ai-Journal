import React, { useState, useEffect } from "react";
import { useSpeechRecognition } from "../lib/useSpeechRecognition";
import { TextRefineMode, RefineResult } from "../types";
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Wand2, 
  Check, 
  X, 
  RefreshCw, 
  Volume2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown,
  Globe,
  SlidersHorizontal,
  ArrowRight
} from "lucide-react";

interface VoiceDictationBarProps {
  currentText: string;
  onTextChange: (newText: string) => void;
  onAppendText: (chunk: string) => void;
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
  onAppendText,
  currentMood,
}) => {
  const {
    isListening,
    interimTranscript,
    error: speechError,
    isSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const [selectedLang, setSelectedLang] = useState("en-US");
  const [autoRefineOnStop, setAutoRefineOnStop] = useState(true);
  const [isRefining, setIsRefining] = useState(false);
  const [refineResult, setRefineResult] = useState<RefineResult | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refineSuccessNotice, setRefineSuccessNotice] = useState<string | null>(null);

  // Track if we were dictating to trigger auto-refinement when stopped
  const [wasDictating, setWasDictating] = useState(false);

  // Toggle listening
  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      setWasDictating(true);
    } else {
      setRefineResult(null);
      setRefineError(null);
      setWasDictating(false);
      startListening({
        lang: selectedLang,
        onFinalChunk: (chunk) => {
          onAppendText(chunk);
        },
      });
    }
  };

  // When listening stops and auto-refine is enabled, automatically polish the spoken words
  useEffect(() => {
    if (!isListening && wasDictating && autoRefineOnStop) {
      setWasDictating(false);
      if (currentText.trim()) {
        handleRefineText("punctuate_speech", currentText);
      }
    }
  }, [isListening, wasDictating, autoRefineOnStop, currentText]);

  // Call Gemini contextual auto-correction / grammar API
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
        setTimeout(() => setRefineSuccessNotice(null), 3000);
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

  return (
    <div className="space-y-3">
      {/* Main Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-stone-100/90 border border-stone-200/90 text-xs">
        
        {/* Left Side: Voice Dictation Start/Stop + Interim Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="voice-dictation-toggle-btn"
            type="button"
            onClick={handleToggleListening}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-xs ${
              isListening
                ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-2 ring-rose-300"
                : "bg-stone-900 hover:bg-stone-800 text-stone-100"
            }`}
            title={isListening ? "Stop Voice Dictation" : "Dictate Journal with Voice"}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-amber-400" />
                <span>Dictate with Voice</span>
              </>
            )}
          </button>

          {/* Language selector */}
          <div className="relative inline-flex items-center">
            <Globe className="w-3.5 h-3.5 text-stone-400 absolute left-2 pointer-events-none" />
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              disabled={isListening}
              className="pl-7 pr-4 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-clean toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-stone-600 hover:text-stone-900 select-none px-2 py-1">
            <input
              type="checkbox"
              checked={autoRefineOnStop}
              onChange={(e) => setAutoRefineOnStop(e.target.checked)}
              className="rounded border-stone-300 text-amber-500 focus:ring-amber-400 w-3.5 h-3.5"
            />
            <span className="text-[11px] font-medium">Auto-punctuate speech</span>
          </label>
        </div>

        {/* Right Side: Contextual Auto-Correction & Grammar Tools */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            id="btn-auto-correct"
            type="button"
            onClick={() => handleRefineText("auto_correct")}
            disabled={isRefining || !currentText.trim() || isListening}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-stone-800 hover:text-amber-900 border border-stone-200 hover:border-amber-300 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Auto-correct spelling typos and grammar based on journal context"
          >
            {isRefining ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
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

      {/* Live Voice Waveform & Interim Transcription Banner when Listening */}
      {isListening && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 shadow-xs space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold text-amber-950">
                Listening to your voice... Speak your thoughts freely.
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

          {interimTranscript && (
            <p className="text-xs text-stone-600 font-['Newsreader'] italic bg-white/70 p-2.5 rounded-xl border border-amber-200">
              &ldquo;{interimTranscript}&rdquo;
            </p>
          )}

          <p className="text-[11px] text-amber-800">
            Spoken words are instantly written into your reflection. Click <strong>Stop Listening</strong> when finished.
          </p>
        </div>
      )}

      {/* Speech Support Warning or Errors */}
      {!isSupported && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Speech recognition requires a Web Speech-compatible browser (e.g. Google Chrome, Edge, or Safari). You can still type and use Gemini AI contextual auto-correction.
          </span>
        </div>
      )}

      {speechError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{speechError}</span>
          </div>
          <button
            onClick={() => handleToggleListening()}
            className="text-xs font-bold text-rose-700 underline"
          >
            Retry Mic
          </button>
        </div>
      )}

      {/* Refine Error */}
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
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-sm space-y-3 animate-fade-in">
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
