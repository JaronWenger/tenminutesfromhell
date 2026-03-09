import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Get all workout history for a user
export const getUserHistory = async (userId) => {
  const q = query(
    collection(db, 'users', userId, 'history'),
    orderBy('completedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      completedAt: data.completedAt?.toDate?.() || null,
      date: data.date?.toDate?.() || null
    };
  });
};

// Record a completed workout to history — returns the new doc ID
export const recordWorkoutHistory = async (userId, entry) => {
  const data = {
    workoutName: entry.workoutName,
    workoutType: entry.workoutType,
    date: serverTimestamp(),
    duration: entry.duration,
    setCount: entry.setCount,
    exercises: entry.exercises,
    completedAt: serverTimestamp()
  };
  if (entry.workoutId) data.workoutId = entry.workoutId;
  if (entry.restTime != null) data.restTime = entry.restTime;
  if (entry.prepTime != null) data.prepTime = entry.prepTime;
  if (entry.activeLastMinute != null) data.activeLastMinute = entry.activeLastMinute;
  const docRef = await addDoc(collection(db, 'users', userId, 'history'), data);
  return docRef.id;
};

// Update an existing history entry (e.g., when additional sets are completed)
export const updateWorkoutHistory = async (userId, historyId, updates) => {
  await updateDoc(doc(db, 'users', userId, 'history', historyId), updates);
};

// ═══════════════════════════════════════════════════════════════
// V2: Top-level workouts collection + library references
// ═══════════════════════════════════════════════════════════════

// Create a workout in the top-level collection — returns the doc ID
export const createWorkoutV2 = async (ownerUid, workoutData) => {
  const data = {
    ownerUid,
    ownerDeleted: false,
    name: workoutData.name,
    type: workoutData.type,
    exercises: workoutData.exercises || [],
    isDefault: workoutData.isDefault || false,
    isCustom: workoutData.isCustom || false,
    forked: workoutData.forked || false,
    defaultId: workoutData.defaultId || null,
    restTime: workoutData.restTime ?? null,
    isPublic: workoutData.isPublic !== false,
    tags: workoutData.tags || null,
    creatorUid: workoutData.creatorUid || null,
    creatorName: workoutData.creatorName || null,
    creatorPhotoURL: workoutData.creatorPhotoURL || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const docRef = await addDoc(collection(db, 'workouts'), data);
  return docRef.id;
};

// Update a workout (owner only — caller must verify ownership)
export const updateWorkoutV2 = async (workoutId, updates) => {
  await updateDoc(doc(db, 'workouts', workoutId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

// Read a single workout
export const getWorkoutV2 = async (workoutId) => {
  const snap = await getDoc(doc(db, 'workouts', workoutId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

// Batch-fetch multiple workouts by ID — returns array (skips missing docs)
export const getWorkoutsBatchV2 = async (workoutIds) => {
  if (!workoutIds || workoutIds.length === 0) return [];
  const results = await Promise.all(
    workoutIds.map(async (id) => {
      const snap = await getDoc(doc(db, 'workouts', id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    })
  );
  return results.filter(Boolean);
};

// Soft-delete a workout (owner deletes — freezes for everyone else)
export const softDeleteWorkoutV2 = async (workoutId) => {
  await updateDoc(doc(db, 'workouts', workoutId), {
    ownerDeleted: true,
    updatedAt: serverTimestamp()
  });
};

// Revive a soft-deleted workout (owner re-adds it)
export const reviveWorkoutV2 = async (workoutId) => {
  await updateDoc(doc(db, 'workouts', workoutId), {
    ownerDeleted: false,
    updatedAt: serverTimestamp()
  });
};

// ── Library references ──

// Add a workout reference to a user's library
export const addLibraryRef = async (userId, workoutId, source = 'created') => {
  await setDoc(doc(db, 'users', userId, 'library', workoutId), {
    addedAt: serverTimestamp(),
    source
  });
};

// Remove a workout reference from a user's library
export const removeLibraryRef = async (userId, workoutId) => {
  await deleteDoc(doc(db, 'users', userId, 'library', workoutId));
};

// Get all library references for a user
export const getLibraryRefs = async (userId) => {
  const snapshot = await getDocs(collection(db, 'users', userId, 'library'));
  return snapshot.docs.map(d => ({
    workoutId: d.id,
    ...d.data()
  }));
};

// Load a user's full library: refs → resolved workout data
// Auto-deduplicates by workout name (keeps first, removes duplicate refs)
export const getUserWorkoutsV2 = async (userId) => {
  const refs = await getLibraryRefs(userId);
  if (refs.length === 0) return { workouts: [], refs: [] };
  const workoutIds = refs.map(r => r.workoutId);
  const workouts = await getWorkoutsBatchV2(workoutIds);
  // Build a map for easy lookup
  const refMap = {};
  refs.forEach(r => { refMap[r.workoutId] = r; });
  // Deduplicate by name — keep first occurrence, remove duplicate refs in background
  const seenNames = new Set();
  const duplicateRefIds = [];
  const enriched = [];
  for (const w of workouts) {
    if (seenNames.has(w.name)) {
      duplicateRefIds.push(w.id);
      continue;
    }
    seenNames.add(w.name);
    enriched.push({
      ...w,
      _librarySource: refMap[w.id]?.source || null,
      _libraryAddedAt: refMap[w.id]?.addedAt || null
    });
  }
  // Clean up duplicate refs in background (don't await)
  if (duplicateRefIds.length > 0) {
    Promise.all(duplicateRefIds.map(id => removeLibraryRef(userId, id)))
      .catch(err => console.error('Failed to clean duplicate refs:', err));
  }
  const dedupedRefs = refs.filter(r => !duplicateRefIds.includes(r.workoutId));
  return { workouts: enriched, refs: dedupedRefs };
};

// Update deletedDefaults in user preferences
export const setDeletedDefaults = async (userId, deletedDefaults) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    deletedDefaults,
    updatedAt: serverTimestamp()
  }, { merge: true });
};
