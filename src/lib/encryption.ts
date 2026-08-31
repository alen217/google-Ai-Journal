/**
 * End-to-End Client-Side Encryption (AES-GCM 256-bit + PBKDF2)
 * Ensures user reflections are strictly encrypted in the browser before reaching Firestore.
 */

// Convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate a random cryptographic salt (hex string)
export function generateSaltHex(): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert hex salt to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Derive a CryptoKey from user passphrase and salt
export async function deriveKeyFromPassphrase(passphrase: string, saltHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passphraseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const saltBytes = hexToBytes(saltHex);

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt plaintext JSON/string using AES-GCM
export async function encryptPayload(plainText: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for AES-GCM

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    enc.encode(plainText)
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

// Decrypt ciphertext using AES-GCM
export async function decryptPayload(ciphertextBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  const dec = new TextDecoder();
  const ivBuffer = base64ToArrayBuffer(ivBase64);
  const cipherBuffer = base64ToArrayBuffer(ciphertextBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(ivBuffer),
    },
    key,
    cipherBuffer
  );

  return dec.decode(decryptedBuffer);
}

// Memory / Session Passphrase cache key
const SESSION_KEY_NAME = "reflectai_session_passkey";

export function getSessionPasskey(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY_NAME);
  } catch {
    return null;
  }
}

export function setSessionPasskey(passkey: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY_NAME, passkey);
  } catch (err) {
    console.error("Failed to set session passkey", err);
  }
}

export function clearSessionPasskey(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY_NAME);
  } catch {}
}
