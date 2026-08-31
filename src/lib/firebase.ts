import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { ReflectionDoc, UserProfile } from "../types";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Firestore with custom databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Strict undefined-stripping utility (Zero-Crash Payload Hygiene)
export function sanitizePayload<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
        sanitized[key] = sanitizePayload(val);
      } else {
        sanitized[key] = val;
      }
    }
  }
  return sanitized;
}

// Google Sign-In
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// Sign Out
export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

// Format date as YYYY-MM-DD
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Check difference in days between two YYYY-MM-DD strings
export function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Fetch or create UserProfile doc in /users/{userId}
export async function getOrCreateUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }

  const now = new Date().toISOString();
  const newProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || user.email?.split("@")[0] || "Mindful Writer",
    email: user.email || "",
    photoURL: user.photoURL || undefined,
    currentStreak: 0,
    longestStreak: 0,
    totalEntries: 0,
    e2eeEnabled: false,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(userRef, sanitizePayload(newProfile));
  return newProfile;
}

// Update UserProfile settings (e.g. E2EE settings)
export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const userRef = doc(db, "users", uid);
  const payload = sanitizePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(userRef, payload as { [key: string]: any });
}

// Save or Update Reflection in /users/{userId}/reflections/{reflectionId}
export async function persistReflection(
  reflection: ReflectionDoc,
  userProfile: UserProfile
): Promise<{ reflection: ReflectionDoc; updatedProfile: UserProfile; streakIncremented: boolean }> {
  const reflectionRef = doc(db, "users", reflection.userId, "reflections", reflection.id);
  
  // Clean payload
  const cleanDoc = sanitizePayload({
    id: reflection.id,
    userId: reflection.userId,
    title: reflection.title || "Reflective Entry",
    date: reflection.date || getTodayDateString(),
    createdAt: reflection.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mood: reflection.mood || "reflective",
    moodScore: reflection.moodScore ?? 3,
    tags: reflection.tags || [],
    isEncrypted: Boolean(reflection.isEncrypted),
    encryptedData: reflection.encryptedData || undefined,
    iv: reflection.iv || undefined,
    messages: reflection.messages || [],
    summary: reflection.summary || undefined,
    actionItems: reflection.actionItems || undefined,
    keyEmotions: reflection.keyEmotions || undefined,
  });

  await setDoc(reflectionRef, cleanDoc);

  // Also write to user interactions subcollection for audit/compliance
  try {
    const interactionRef = doc(db, "users", reflection.userId, "interactions", reflection.id);
    await setDoc(interactionRef, cleanDoc);
  } catch (err) {
    console.warn("Audit interaction write notice:", err);
  }

  // Calculate Streak updates
  const today = getTodayDateString();
  let streakIncremented = false;
  let newCurrentStreak = userProfile.currentStreak;
  let newLongestStreak = userProfile.longestStreak;
  const isNewEntry = !userProfile.lastJournalDate || userProfile.lastJournalDate !== today;

  if (isNewEntry) {
    if (!userProfile.lastJournalDate) {
      newCurrentStreak = 1;
      streakIncremented = true;
    } else {
      const diff = getDaysDifference(userProfile.lastJournalDate, today);
      if (diff === 1) {
        newCurrentStreak += 1;
        streakIncremented = true;
      } else if (diff > 1) {
        newCurrentStreak = 1;
        streakIncremented = true;
      }
    }
  }

  if (newCurrentStreak > newLongestStreak) {
    newLongestStreak = newCurrentStreak;
  }

  const updatedProfile: UserProfile = {
    ...userProfile,
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastJournalDate: today,
    totalEntries: (userProfile.totalEntries || 0) + (isNewEntry ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };

  const userRef = doc(db, "users", reflection.userId);
  await updateDoc(userRef, sanitizePayload(updatedProfile) as { [key: string]: any });

  return { reflection, updatedProfile, streakIncremented };
}

// Fetch all reflections for a user from /users/{userId}/reflections
export async function fetchUserReflections(userId: string): Promise<ReflectionDoc[]> {
  const colRef = collection(db, "users", userId, "reflections");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  const list: ReflectionDoc[] = [];
  snapshot.forEach((docSnap) => {
    list.push(docSnap.data() as ReflectionDoc);
  });

  return list;
}

// Delete reflection document
export async function deleteReflectionDoc(userId: string, reflectionId: string): Promise<void> {
  const ref = doc(db, "users", userId, "reflections", reflectionId);
  await deleteDoc(ref);
  try {
    const interRef = doc(db, "users", userId, "interactions", reflectionId);
    await deleteDoc(interRef);
  } catch {}
}
