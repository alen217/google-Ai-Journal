# ReflectAI - Secure Authenticated Journal & Gemini AI Companion

ReflectAI is a production-grade, user-authenticated mindful journaling web application powered by Google Cloud Run, Cloud Firestore, Firebase Authentication, and the Gemini 3.6 Flash API. It provides multi-turn empathetic reflections, automated executive summaries, emotional mood tracking, daily streak milestone badges, and optional client-side AES-GCM 256-bit End-to-End Encryption (E2EE).

---

## 🔒 1. Architecture & Threat Model Overview

ReflectAI implements an isolated multi-zone defense model:

| Threat Zone | Potential Vulnerability | Production Countermeasure |
| :--- | :--- | :--- |
| **Input Surfaces** | Prompt injection, malicious payload injection | Defensive payload ingestion, sanitization, system instruction framing |
| **Planning & Reasoning** | Unhandled model failures, API rate limits | 4-tier resilient fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`) |
| **Tool Execution** | SSRF or dynamic code execution | No arbitrary shell execution; pure serverless API proxy architecture |
| **Memory & State** | Cross-user data leakage, session hijacking | Strict owner-bound Firestore security rules (`request.auth.uid == userId`) + Optional AES-GCM 256 client encryption |
| **Inter-System Comms** | API key leakage in browser client | Gemini API key is accessed exclusively server-side via Google Cloud Secret Manager / env injection |

---

## 🛡️ 2. Cloud Firestore Security Rules

Deploy the following security rules to Cloud Firestore to ensure absolute user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User root profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // User reflections / journal entries subcollection
      match /reflections/{reflectionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User interactions subcollection
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User milestones and streak records
      match /milestones/{milestoneId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 🔑 3. Secret Management Setup (Google Cloud Secret Manager)

To securely configure the Gemini API key without hardcoding:

```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 2. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the default Cloud Run service account access to read the secret
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🚀 4. Google Cloud Run Deployment

Deploy the containerized full-stack application directly to Cloud Run:

```bash
# 1. Build and deploy to Cloud Run
gcloud run deploy reflect-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000

# 2. Apply the required campaign challenge verification label
gcloud run services update reflect-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 5. Functional Stability & Verification Walkthroughs

The following step-by-step test cases verify every feature of ReflectAI:

### Test Case 1: Google Authentication & Isolated Profile
1. **Action**: Open the landing page and click **Continue with Google Sign-In**.
2. **Expected Result**: Firebase Google Auth popup opens. Upon completing sign-in, the user document `/users/{uid}` is automatically initialized in Firestore and the user is redirected to their private Dashboard.

### Test Case 2: Multi-Turn Gemini AI Reflection & Mode Switching
1. **Action**: Click **Write New Reflection**. Select a mood (e.g. *Radiant* ✨) and mode *Mindful Reflection*. Type a reflection and click **Reflect with AI** (or press `Cmd+Enter`).
2. **Expected Result**: Gemini 3.6 Flash returns an empathetic reflection and gentle question. Switch mode to *Executive Summary* or *Brainstorm Solutions* and send a follow-up message to continue the multi-turn dialogue.

### Test Case 3: Firestore Document Persistence & Streak Calculation
1. **Action**: Click **Save Entry** in the reflection editor.
2. **Expected Result**: The entire multi-turn thread is persisted in `/users/{uid}/reflections/{reflectionId}`. The user's journaling streak increments, and the streak counter in the navbar and dashboard updates immediately.

### Test Case 4: Client-Side End-to-End Encryption (AES-GCM 256)
1. **Action**: Click **E2EE Off** in the navbar. Enter a master passphrase (e.g., `SecurePass123!`) and click **Enable E2E Encryption**.
2. **Expected Result**: The browser derives a 256-bit AES-GCM key using PBKDF2. Subsequent saved entries have their message payloads encrypted client-side before being written to Firestore.

### Test Case 5: Mood Analytics & Streak Milestone Celebration
1. **Action**: Navigate to **Mood & Streaks** tab.
2. **Expected Result**: View the 30-day reflection consistency map, emotional spectrum distribution percentages, and milestone badges (*First Step*, *Momentum Maker*, etc.). Upon achieving milestone days, celebratory confetti and the milestone dialog trigger automatically.

### Test Case 6: History Archive, Search, & Markdown Export
1. **Action**: Navigate to **Past Entries**. Filter by mood, type search keywords, or click **Export Journal (.md)**.
2. **Expected Result**: Matching reflections are filtered dynamically. Clicking export downloads a clean Markdown file with all saved reflections and conversation history.

### Test Case 7: Speech-to-Text Voice Dictation
1. **Action**: Open the reflection editor and click **Dictate with Voice** (or **Voice Dictate** on Dashboard). Speak your reflection into your microphone.
2. **Expected Result**: Browser prompts for microphone access (if not already granted). The live audio visualizer pulses and your spoken words are transcribed in real-time directly into the journal input area.

### Test Case 8: Contextual Auto-Correction, Spelling & Grammar Refinement
1. **Action**: With draft or dictated text in the reflection box, click **Auto-Correct & Grammar** (or toggle *Auto-punctuate speech*).
2. **Expected Result**: Gemini 3.6 Flash analyzes the text in context, fixes typos (e.g. misspelled words, speech phonetic errors, punctuation, run-on sentences), and displays a clear comparison panel with individual detected fixes. Clicking **Apply Corrections** updates the journal prompt instantly.

