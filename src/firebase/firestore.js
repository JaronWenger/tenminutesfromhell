import {
  collection,
  doc,
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
