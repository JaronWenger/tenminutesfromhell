import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
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

  // Check if this workout already exists (by name or defaultName)
  const snapshot = await getDocs(workoutsRef);
  const existing = snapshot.docs.find(d => {
    const data = d.data();
    return data.name === workout.name ||
      (workout.defaultName && data.defaultName === workout.defaultName) ||
      (data.defaultName === workout.name);
  });

  const data = {
    name: workout.name,
    type: workout.type,
    exercises: workout.exercises,
    isDefault: workout.isDefault || false,
    defaultName: workout.defaultName || null,
    updatedAt: serverTimestamp()
  };

  if (existing) {
    await setDoc(doc(db, 'users', userId, 'customWorkouts', existing.id), data, { merge: true });
  } else {
    await addDoc(workoutsRef, { ...data, createdAt: serverTimestamp() });
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
export const deleteUserWorkout = async (userId, workoutName, isDefault) => {
  const workoutsRef = collection(db, 'users', userId, 'customWorkouts');
  const snapshot = await getDocs(workoutsRef);

  // Find existing doc by name or defaultName
  const existing = snapshot.docs.find(d => {
    const data = d.data();
    return data.name === workoutName || data.defaultName === workoutName;
  });

  if (isDefault) {
    // For default workouts, save a deletion marker so it stays removed on reload
    if (existing) {
      await setDoc(doc(db, 'users', userId, 'customWorkouts', existing.id), {
        deleted: true,
        defaultName: workoutName,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(workoutsRef, {
        deleted: true,
        defaultName: workoutName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } else {
    // For custom workouts, just delete the doc
    if (existing) {
      await deleteDoc(doc(db, 'users', userId, 'customWorkouts', existing.id));
    }
  }
};

// Record a completed workout to history
export const recordWorkoutHistory = async (userId, entry) => {
  await addDoc(collection(db, 'users', userId, 'history'), {
    workoutName: entry.workoutName,
    workoutType: entry.workoutType,
    date: serverTimestamp(),
    duration: entry.duration,
    setCount: entry.setCount,
    exercises: entry.exercises,
    completedAt: serverTimestamp()
  });
};
