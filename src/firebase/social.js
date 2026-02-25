import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from './config';

// ── User Profiles ──

export const ensureUserProfile = async (user) => {
  const ref = doc(db, 'userProfiles', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || null,
      workoutCount: 0,
      autoShare: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    // Update display name / photo if changed
    await setDoc(ref, {
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
};

export const getAutoSharePreference = async (userId) => {
  const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'));
  if (!snap.exists()) return null;
  return snap.data().autoShare ?? null;
};

export const setAutoSharePreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    autoShare: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const getUserColors = async (userId) => {
  const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'));
  if (!snap.exists()) return { activeColor: null, restColor: null };
  const data = snap.data();
  return {
    activeColor: data.activeColor || null,
    restColor: data.restColor || null
  };
};

export const setUserColors = async (userId, { activeColor, restColor }) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    activeColor,
    restColor,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const getWorkoutOrder = async (userId) => {
  const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'));
  if (!snap.exists()) return null;
  return snap.data().workoutOrder || null;
};

export const setWorkoutOrder = async (userId, orderArray) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    workoutOrder: orderArray,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

// ── Users (People tab) ──

export const getAllUsers = async () => {
  const snapshot = await getDocs(collection(db, 'userProfiles'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── Following / Followers ──

export const followUser = async (myUid, targetUid) => {
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'following', myUid, 'userFollowing', targetUid),
    { followedAt: serverTimestamp() }
  );
  batch.set(
    doc(db, 'followers', targetUid, 'userFollowers', myUid),
    { followedAt: serverTimestamp() }
  );
  await batch.commit();
};

export const unfollowUser = async (myUid, targetUid) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'following', myUid, 'userFollowing', targetUid));
  batch.delete(doc(db, 'followers', targetUid, 'userFollowers', myUid));
  await batch.commit();
};

export const getFollowing = async (userId) => {
  const snapshot = await getDocs(
    collection(db, 'following', userId, 'userFollowing')
  );
  return snapshot.docs.map(d => d.id);
};

// ── Suggested Users (mutual friends) ──

export const getSuggestedUsers = async (userId) => {
  // Get who the current user follows
  const myFollowing = await getFollowing(userId);
  if (myFollowing.length === 0) return [];

  // For each followed user, get who they follow
  const mutualCounts = {};
  await Promise.all(
    myFollowing.map(async (followedUid) => {
      const theirFollowing = await getFollowing(followedUid);
      theirFollowing.forEach(uid => {
        // Skip self and already-followed users
        if (uid === userId || myFollowing.includes(uid)) return;
        mutualCounts[uid] = (mutualCounts[uid] || 0) + 1;
      });
    })
  );

  // Convert to array sorted by mutual count desc
  return Object.entries(mutualCounts)
    .map(([uid, mutualCount]) => ({ uid, mutualCount }))
    .sort((a, b) => b.mutualCount - a.mutualCount);
};

// ── Posts ──

export const createPost = async (userId, workoutData, profile) => {
  const postRef = await addDoc(collection(db, 'posts'), {
    userId,
    displayName: profile.displayName || 'Anonymous',
    photoURL: profile.photoURL || null,
    workoutName: workoutData.workoutName,
    workoutType: workoutData.workoutType,
    duration: workoutData.duration,
    exerciseCount: workoutData.exercises.length,
    exercises: workoutData.exercises,
    likeCount: 0,
    createdAt: serverTimestamp()
  });

  // Increment workout count on profile
  await setDoc(doc(db, 'userProfiles', userId), {
    workoutCount: increment(1),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return postRef.id;
};

export const getFeedPosts = async (userId, pageSize = 30) => {
  // Get who the user follows
  const followingIds = await getFollowing(userId);
  // Include own posts
  const userIds = [userId, ...followingIds];

  if (userIds.length === 0) return [];

  // Firestore 'in' queries support max 30 values
  const chunks = [];
  for (let i = 0; i < userIds.length; i += 30) {
    chunks.push(userIds.slice(i, i + 30));
  }

  let allPosts = [];
  for (const chunk of chunks) {
    const q = query(
      collection(db, 'posts'),
      where('userId', 'in', chunk),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null
      };
    });
    allPosts = allPosts.concat(posts);
  }

  // Sort combined results by date
  allPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return allPosts.slice(0, pageSize);
};

// ── Likes ──

export const toggleLike = async (postId, userId) => {
  const likeRef = doc(db, 'posts', postId, 'likes', userId);
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(likeRef);

  if (snap.exists()) {
    const batch = writeBatch(db);
    batch.delete(likeRef);
    batch.set(postRef, { likeCount: increment(-1) }, { merge: true });
    await batch.commit();
    return false; // unliked
  } else {
    const batch = writeBatch(db);
    batch.set(likeRef, { userId, createdAt: serverTimestamp() });
    batch.set(postRef, { likeCount: increment(1) }, { merge: true });
    await batch.commit();
    return true; // liked
  }
};

export const batchCheckLikes = async (postIds, userId) => {
  if (postIds.length === 0) return {};
  const result = {};
  // Check each post's likes subcollection for this user
  await Promise.all(
    postIds.map(async (postId) => {
      const snap = await getDoc(doc(db, 'posts', postId, 'likes', userId));
      result[postId] = snap.exists();
    })
  );
  return result;
};
