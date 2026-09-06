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
import {
  ReflectionDoc,
  UserProfile,
  ObjectiveItem,
  ReminderItem,
  FutureNote,
  ScrapbookDoc,
  LifeGraphEntity,
  LifeGraphRelationship,
} from "../types";

// Helper function to strip undefined values from firestore payloads
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (v === undefined ? null : v))
  );
}

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
export const updateUserProfileDoc = updateUserProfile;

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

// Persist an AI analysis record in /users/{userId}/analyses/{analysisId}
export async function persistAnalysisDoc(
  userId: string,
  analysisId: string,
  payload: Record<string, any>
): Promise<void> {
  const ref = doc(db, "users", userId, "analyses", analysisId);
  const clean = sanitizePayload({
    ...payload,
    id: analysisId,
    userId,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(ref, clean);
}

// Fetch all analyses for a user
export async function fetchUserAnalyses(userId: string): Promise<any[]> {
  const colRef = collection(db, "users", userId, "analyses");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const results: any[] = [];
  snapshot.forEach((snap) => {
    results.push(snap.data());
  });
  return results;
}

// Delete an analysis record
export async function deleteAnalysisDoc(userId: string, analysisId: string): Promise<void> {
  const ref = doc(db, "users", userId, "analyses", analysisId);
  await deleteDoc(ref);
}

// Persist a confirmed calendar item in /users/{userId}/calendarItems/{itemId}
export async function persistCalendarItem(userId: string, item: any): Promise<void> {
  const ref = doc(db, "users", userId, "calendarItems", item.id);
  const clean = sanitizePayload({
    ...item,
    userId,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(ref, clean);
}

// Fetch all calendar items for a user
export async function fetchUserCalendarItems(userId: string): Promise<any[]> {
  const colRef = collection(db, "users", userId, "calendarItems");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const results: any[] = [];
  snapshot.forEach((snap) => {
    results.push(snap.data());
  });
  return results;
}

// Delete calendar item
export async function deleteCalendarItemDoc(userId: string, itemId: string): Promise<void> {
  const ref = doc(db, "users", userId, "calendarItems", itemId);
  await deleteDoc(ref);
}

// -------------------------------------------------------------
// Objectives Persistence & Management
// -------------------------------------------------------------

export async function persistObjective(userId: string, objective: ObjectiveItem): Promise<void> {
  const ref = doc(db, "users", userId, "objectives", objective.id);
  const cleanData = sanitizeFirestorePayload(objective);
  await setDoc(ref, cleanData, { merge: true });
}

export async function fetchUserObjectives(userId: string, sourceReflectionId?: string): Promise<ObjectiveItem[]> {
  const colRef = collection(db, "users", userId, "objectives");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const results: ObjectiveItem[] = [];
  snapshot.forEach((snap) => {
    const data = snap.data() as ObjectiveItem;
    if (!sourceReflectionId || data.sourceReflectionId === sourceReflectionId) {
      results.push(data);
    }
  });
  return results;
}

export async function updateObjectiveDoc(
  userId: string,
  objectiveId: string,
  updates: Partial<ObjectiveItem>
): Promise<void> {
  const ref = doc(db, "users", userId, "objectives", objectiveId);
  const cleanUpdates = sanitizeFirestorePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(ref, cleanUpdates);
}

export async function deleteObjectiveDoc(userId: string, objectiveId: string): Promise<void> {
  const ref = doc(db, "users", userId, "objectives", objectiveId);
  await deleteDoc(ref);
}

// -------------------------------------------------------------
// Reminders Persistence & Management
// -------------------------------------------------------------

export async function persistReminder(userId: string, reminder: ReminderItem): Promise<void> {
  const ref = doc(db, "users", userId, "reminders", reminder.id);
  const cleanData = sanitizeFirestorePayload(reminder);
  await setDoc(ref, cleanData, { merge: true });
}

export async function fetchUserReminders(userId: string, sourceReflectionId?: string): Promise<ReminderItem[]> {
  const colRef = collection(db, "users", userId, "reminders");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const results: ReminderItem[] = [];
  snapshot.forEach((snap) => {
    const data = snap.data() as ReminderItem;
    if (!sourceReflectionId || data.sourceReflectionId === sourceReflectionId) {
      results.push(data);
    }
  });
  return results;
}

export async function updateReminderDoc(
  userId: string,
  reminderId: string,
  updates: Partial<ReminderItem>
): Promise<void> {
  const ref = doc(db, "users", userId, "reminders", reminderId);
  const cleanUpdates = sanitizeFirestorePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(ref, cleanUpdates);
}

export async function deleteReminderDoc(userId: string, reminderId: string): Promise<void> {
  const ref = doc(db, "users", userId, "reminders", reminderId);
  await deleteDoc(ref);
}

// -------------------------------------------------------------
// Future Notes Persistence & Management
// -------------------------------------------------------------

export async function persistFutureNote(userId: string, note: FutureNote): Promise<void> {
  const ref = doc(db, "users", userId, "futureNotes", note.id);
  const cleanData = sanitizeFirestorePayload(note);
  await setDoc(ref, cleanData, { merge: true });
}

export async function fetchUserFutureNotes(userId: string): Promise<FutureNote[]> {
  const colRef = collection(db, "users", userId, "futureNotes");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const results: FutureNote[] = [];
  snapshot.forEach((snap) => {
    results.push(snap.data() as FutureNote);
  });
  return results;
}

export async function updateFutureNoteDoc(
  userId: string,
  noteId: string,
  updates: Partial<FutureNote>
): Promise<void> {
  const ref = doc(db, "users", userId, "futureNotes", noteId);
  const cleanUpdates = sanitizeFirestorePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(ref, cleanUpdates);
}

export async function deleteFutureNoteDoc(userId: string, noteId: string): Promise<void> {
  const ref = doc(db, "users", userId, "futureNotes", noteId);
  await deleteDoc(ref);
}

// -------------------------------------------------------------
// AI Scrapbook Persistence Helpers
// -------------------------------------------------------------

export async function saveScrapbookDoc(userId: string, scrapbook: ScrapbookDoc): Promise<void> {
  const ref = doc(db, "users", userId, "scrapbooks", scrapbook.id);
  const clean = sanitizeFirestorePayload({
    ...scrapbook,
    userId,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(ref, clean);
}

export async function fetchUserScrapbooks(userId: string): Promise<ScrapbookDoc[]> {
  const colRef = collection(db, "users", userId, "scrapbooks");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  const list: ScrapbookDoc[] = [];
  snapshot.forEach((docSnap) => {
    list.push(docSnap.data() as ScrapbookDoc);
  });
  return list;
}

export async function fetchScrapbookDoc(userId: string, scrapbookId: string): Promise<ScrapbookDoc | null> {
  const ref = doc(db, "users", userId, "scrapbooks", scrapbookId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as ScrapbookDoc;
  }
  return null;
}

export async function deleteScrapbookDoc(userId: string, scrapbookId: string): Promise<void> {
  const ref = doc(db, "users", userId, "scrapbooks", scrapbookId);
  await deleteDoc(ref);
}

// -------------------------------------------------------------
// Life Graph Persistence Helpers
// -------------------------------------------------------------

export async function fetchLifeGraphEntities(userId: string): Promise<LifeGraphEntity[]> {
  const colRef = collection(db, "users", userId, "lifeGraphEntities");
  const snapshot = await getDocs(colRef);
  const list: LifeGraphEntity[] = [];
  snapshot.forEach((docSnap) => {
    list.push(docSnap.data() as LifeGraphEntity);
  });
  return list;
}

export async function saveLifeGraphEntity(userId: string, entity: LifeGraphEntity): Promise<void> {
  const ref = doc(db, "users", userId, "lifeGraphEntities", entity.id);
  const clean = sanitizeFirestorePayload({
    ...entity,
    userId,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(ref, clean);
}

export async function deleteLifeGraphEntity(userId: string, entityId: string): Promise<void> {
  const ref = doc(db, "users", userId, "lifeGraphEntities", entityId);
  await deleteDoc(ref);
}

export async function fetchLifeGraphRelationships(userId: string): Promise<LifeGraphRelationship[]> {
  const colRef = collection(db, "users", userId, "lifeGraphRelationships");
  const snapshot = await getDocs(colRef);
  const list: LifeGraphRelationship[] = [];
  snapshot.forEach((docSnap) => {
    list.push(docSnap.data() as LifeGraphRelationship);
  });
  return list;
}

export async function saveLifeGraphRelationship(userId: string, rel: LifeGraphRelationship): Promise<void> {
  const ref = doc(db, "users", userId, "lifeGraphRelationships", rel.id);
  const clean = sanitizeFirestorePayload({
    ...rel,
    userId,
  });
  await setDoc(ref, clean);
}

export async function deleteLifeGraphRelationship(userId: string, relId: string): Promise<void> {
  const ref = doc(db, "users", userId, "lifeGraphRelationships", relId);
  await deleteDoc(ref);
}

export async function saveLifeGraphEntities(userId: string, entities: LifeGraphEntity[]): Promise<void> {
  for (const ent of entities) {
    await saveLifeGraphEntity(userId, ent);
  }
}

export async function saveLifeGraphRelationships(userId: string, relationships: LifeGraphRelationship[]): Promise<void> {
  for (const rel of relationships) {
    await saveLifeGraphRelationship(userId, rel);
  }
}

export async function batchSaveLifeGraph(
  userId: string,
  entities: LifeGraphEntity[],
  relationships: LifeGraphRelationship[]
): Promise<void> {
  for (const ent of entities) {
    await saveLifeGraphEntity(userId, ent);
  }
  for (const rel of relationships) {
    await saveLifeGraphRelationship(userId, rel);
  }
}

// -------------------------------------------------------------
// Total Data Purge for Privacy & AI Data Controls
// -------------------------------------------------------------

export async function deleteAllUserData(userId: string): Promise<void> {
  const subcollections = [
    "reflections",
    "objectives",
    "reminders",
    "futureNotes",
    "calendarItems",
    "analyses",
    "milestones",
    "interactions",
    "scrapbooks",
    "lifeGraphEntities",
    "lifeGraphRelationships",
  ];

  for (const sub of subcollections) {
    try {
      const colRef = collection(db, "users", userId, sub);
      const snapshot = await getDocs(colRef);
      const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      console.warn(`Subcollection deletion notice (${sub}):`, err);
    }
  }

  // Reset user stats in user document
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    totalEntries: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastJournalDate: null,
    updatedAt: new Date().toISOString(),
  });
}


