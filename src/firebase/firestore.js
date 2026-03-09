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

// Get all custom workouts for a user
export const getUserWorkouts = async (userId) => {
  const snapshot = await getDocs(
    collection(db, 'users', userId, 'customWorkouts')
  );
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Save or update a custom workout
export const saveUserWorkout = async (userId, workout) => {
  const workoutsRef = collection(db, 'users', userId, 'customWorkouts');

  const data = {
    name: workout.name,
    type: workout.type,
    exercises: workout.exercises,
    isDefault: workout.isDefault || false,
    isCustom: workout.isCustom || false,
    forked: workout.forked || false,
    defaultName: workout.defaultName || null,
    defaultId: workout.defaultId || null,
    restTime: workout.restTime ?? null,
    isPublic: true,
    tags: workout.tags || null,
    creatorUid: workout.creatorUid || null,
    creatorName: workout.creatorName || null,
    creatorPhotoURL: workout.creatorPhotoURL || null,
    updatedAt: serverTimestamp()
  };

  // If we have the Firestore doc ID, update directly (handles renames without creating duplicates)
  if (workout.id) {
    await setDoc(doc(db, 'users', userId, 'customWorkouts', workout.id), data, { merge: true });
    return workout.id;
  }

  // No doc ID — match by defaultId if it's a default override, otherwise create new
  const snapshot = await getDocs(workoutsRef);
  const existing = workout.defaultId
    ? snapshot.docs.find(d => {
        const dd = d.data();
        return !dd.deleted && dd.defaultId === workout.defaultId;
      })
    : null;

  if (existing) {
    await setDoc(doc(db, 'users', userId, 'customWorkouts', existing.id), data, { merge: true });
    return existing.id;
  } else {
    const docRef = await addDoc(workoutsRef, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }
};

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

// Delete a workout for a user
export const deleteUserWorkout = async (userId, workoutId, isDefault, defaultId = null) => {
  const workoutsRef = collection(db, 'users', userId, 'customWorkouts');

  if (isDefault && defaultId) {
    // Find existing doc by defaultId
    const snapshot = await getDocs(workoutsRef);
    const existing = snapshot.docs.find(d => d.data().defaultId === defaultId);
    // Save a deletion marker so it stays removed on reload
    const marker = {
      deleted: true,
      defaultId: defaultId,
      updatedAt: serverTimestamp()
    };
    if (existing) {
      await setDoc(doc(db, 'users', userId, 'customWorkouts', existing.id), marker);
    } else {
      await addDoc(workoutsRef, { ...marker, createdAt: serverTimestamp() });
    }
  } else if (workoutId) {
    // Custom workout: delete by Firestore doc ID directly (no query needed)
    await deleteDoc(doc(db, 'users', userId, 'customWorkouts', workoutId));
  }
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

// ── Migration ──

// Migrate a user's customWorkouts to V2 (top-level workouts + library refs)
// Returns { idMap, deletedDefaults } for updating preferences
// Idempotent: checks existing library refs to avoid duplicates
export const migrateUserWorkoutsV2 = async (userId) => {
  const oldDocs = await getDocs(collection(db, 'users', userId, 'customWorkouts'));
  if (oldDocs.empty) return { idMap: {}, deletedDefaults: [] };

  // Check existing library refs to avoid re-migrating
  const existingRefs = await getLibraryRefs(userId);
  const existingWorkoutIds = new Set(existingRefs.map(r => r.workoutId));
  // Also load existing workout docs to check for duplicates by name
  let existingWorkouts = [];
  if (existingRefs.length > 0) {
    existingWorkouts = await getWorkoutsBatchV2(existingRefs.map(r => r.workoutId));
  }
  const existingNames = new Set(existingWorkouts.map(w => w.name));

  const idMap = {};          // oldId → newId
  const deletedDefaults = []; // defaultIds that were soft-deleted

  for (const d of oldDocs.docs) {
    const data = d.data();

    // Soft-delete markers for defaults
    if (data.deleted) {
      if (data.defaultId) deletedDefaults.push(data.defaultId);
      continue;
    }

    // Skip docs with missing required fields (corrupt/partial data)
    if (!data.name || !data.type) continue;

    // Skip if already migrated (workout with same name already in library)
    if (existingNames.has(data.name)) continue;

    // Create top-level workout doc
    const newId = await createWorkoutV2(userId, {
      name: data.name,
      type: data.type,
      exercises: data.exercises || [],
      isDefault: data.isDefault || false,
      isCustom: data.isCustom || false,
      forked: data.forked || false,
      defaultId: data.defaultId || null,
      restTime: data.restTime ?? null,
      isPublic: data.isPublic !== false,
      tags: data.tags || null,
      creatorUid: data.creatorUid || null,
      creatorName: data.creatorName || null,
      creatorPhotoURL: data.creatorPhotoURL || null
    });

    idMap[d.id] = newId;

    // Determine source
    const source = (data.creatorUid && data.creatorUid !== userId) ? 'saved' : 'created';
    await addLibraryRef(userId, newId, source);
  }

  return { idMap, deletedDefaults };
};

// Mark V2 migration complete and remap preference IDs
export const markMigrationComplete = async (userId, deletedDefaults, idMap, oldPrefs) => {
  const updates = {
    workoutModelV2: true,
    deletedDefaults,
    updatedAt: serverTimestamp()
  };
  // Remap pinnedWorkouts IDs
  if (oldPrefs.pinnedWorkouts?.length > 0) {
    updates.pinnedWorkouts = oldPrefs.pinnedWorkouts.map(id => idMap[id] || id);
  }
  // Remap weeklySchedule IDs
  if (oldPrefs.weeklySchedule) {
    const remapped = {};
    for (const day in oldPrefs.weeklySchedule) {
      const old = oldPrefs.weeklySchedule[day];
      remapped[day] = old ? (idMap[old] || old) : null;
    }
    updates.weeklySchedule = remapped;
  }
  // Remap selectedWorkoutId
  if (oldPrefs.selectedWorkoutId && idMap[oldPrefs.selectedWorkoutId]) {
    updates.selectedWorkoutId = idMap[oldPrefs.selectedWorkoutId];
  }
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), updates, { merge: true });
  return updates;
};
