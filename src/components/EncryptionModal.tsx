import React, { useState } from "react";
import { UserProfile } from "../types";
import { 
  generateSaltHex, 
  deriveKeyFromPassphrase, 
  setSessionPasskey, 
  clearSessionPasskey 
} from "../lib/encryption";
import { updateUserProfile } from "../lib/firebase";
import { ShieldCheck, Lock, Unlock, Key, AlertTriangle, X, Check } from "lucide-react";

interface EncryptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onKeyUnlocked: (key: CryptoKey, passkey: string) => void;
  onProfileUpdated: (updated: UserProfile) => void;
  isUnlocked: boolean;
}

export const EncryptionModal: React.FC<EncryptionModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onKeyUnlocked,
  onProfileUpdated,
  isUnlocked,
}) => {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isE2EEEnabled = userProfile?.e2eeEnabled;

  // Handle Unlocking with existing passphrase
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setErrorMsg("Please enter your encryption passphrase.");
      return;
    }
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const salt = userProfile?.salt || generateSaltHex();
      const derivedKey = await deriveKeyFromPassphrase(passphrase, salt);
      setSessionPasskey(passphrase);
      onKeyUnlocked(derivedKey, passphrase);
      setSuccessMsg("Vault unlocked for this session!");
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg("Failed to derive encryption key. Check your passphrase.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Enabling E2EE for the first time
  const handleEnableE2EE = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 6) {
      setErrorMsg("Passphrase must be at least 6 characters long.");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setErrorMsg("Passphrases do not match.");
      return;
    }
    if (!userProfile) return;

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const saltHex = generateSaltHex();
      const derivedKey = await deriveKeyFromPassphrase(passphrase, saltHex);
      
      // Update User profile in Firestore
      await updateUserProfile(userProfile.uid, {
        e2eeEnabled: true,
        salt: saltHex,
      });

      const updated = {
        ...userProfile,
        e2eeEnabled: true,
        salt: saltHex,
      };

      setSessionPasskey(passphrase);
      onKeyUnlocked(derivedKey, passphrase);
      onProfileUpdated(updated);

      setSuccessMsg("End-to-End Encryption enabled successfully!");
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to enable E2EE.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Locking / clearing session key
  const handleLockVault = () => {
    clearSessionPasskey();
    window.location.reload(); // Clean memory reload
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200">
        
        {/* Close Button */}
        <button
          id="e2ee-modal-close-btn"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isE2EEEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}>
            {isE2EEEnabled ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
              {isE2EEEnabled ? "End-to-End Encryption Vault" : "Enable End-to-End Encryption"}
            </h3>
            <p className="text-xs text-stone-500">
              AES-GCM 256-Bit Browser-Side Key Derivation
            </p>
          </div>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* State 1: Already Enabled & Unlocked */}
        {isE2EEEnabled && isUnlocked ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-sm mb-1 text-emerald-950">
                <Unlock className="w-4 h-4 text-emerald-600" />
                Vault is currently unlocked in this browser session
              </div>
              Your journal entries are encrypted client-side with AES-256 before being written to Firestore, and decrypted smoothly on your device.
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                id="e2ee-lock-now-btn"
                onClick={handleLockVault}
                className="flex-1 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Lock className="w-4 h-4" />
                Lock Vault Now
              </button>
              <button
                id="e2ee-done-btn"
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        ) : isE2EEEnabled && !isUnlocked ? (
          /* State 2: Enabled but Locked - Prompt to Unlock */
          <form onSubmit={handleUnlock} className="space-y-4">
            <p className="text-xs text-stone-600">
              Your journal entries are protected by your personal passphrase. Enter your passphrase to decrypt and read past entries.
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Enter Master Passphrase
              </label>
              <div className="relative">
                <input
                  id="e2ee-unlock-passphrase-input"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter your encryption passphrase..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50"
                  autoFocus
                />
                <Key className="w-4 h-4 text-stone-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <button
              id="e2ee-submit-unlock-btn"
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? "Deriving Key..." : "Unlock Vault"}
            </button>
          </form>
        ) : (
          /* State 3: Not Enabled - Setup Form */
          <form onSubmit={handleEnableE2EE} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              <span className="font-bold">Zero-Knowledge Guarantee:</span> When enabled, your reflections are encrypted in your browser using AES-GCM 256. Neither Google, Firebase, nor anyone else can read the raw text without your passphrase.
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Create Master Passphrase
              </label>
              <input
                id="e2ee-new-passphrase-input"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Choose a strong passkey (min 6 characters)..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Confirm Master Passphrase
              </label>
              <input
                id="e2ee-confirm-passphrase-input"
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Re-enter passphrase..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50"
              />
            </div>

            <button
              id="e2ee-enable-submit-btn"
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? "Setting up Encryption..." : "Enable E2E Encryption"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
