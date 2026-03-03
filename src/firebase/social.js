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
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  increment,
  deleteField
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

// Single read for all user preferences (replaces 7 individual reads)
export const getAllPreferences = async (userId) => {
  const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'));
  if (!snap.exists()) {
    return {
      autoShare: null,
      activeColor: null,
      restColor: null,
      workoutOrder: null,
      sidePlankAlert: true,
      prepTime: 15,
      restTime: 15,
      activeLastMinute: true,
      selectedWorkout: null,
      showCardPhotos: true,
      pinnedWorkouts: [],
      weeklySchedule: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    };
  }
  const data = snap.data();
  return {
    autoShare: data.autoShare ?? null,
    newWorkoutsPublic: data.newWorkoutsPublic ?? true,
    activeColor: data.activeColor || null,
    restColor: data.restColor || null,
    workoutOrder: data.workoutOrder || null,
    sidePlankAlert: data.sidePlankAlert ?? true,
    prepTime: data.prepTime ?? 15,
    restTime: data.restTime ?? 15,
    activeLastMinute: data.activeLastMinute ?? true,
    selectedWorkout: data.selectedWorkout || null,
    showCardPhotos: data.showCardPhotos ?? true,
    pinnedWorkouts: data.pinnedWorkouts || [],
    weeklySchedule: data.weeklySchedule || { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
  };
};

export const getWorkoutOrder = async (userId) => {
  const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'));
  if (!snap.exists()) return null;
  return snap.data().workoutOrder || null;
};

export const setAutoSharePreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    autoShare: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setNewWorkoutsPublicPreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    newWorkoutsPublic: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setUserColors = async (userId, { activeColor, restColor }) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    activeColor,
    restColor,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setSelectedWorkout = async (userId, workoutName) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    selectedWorkout: workoutName,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setWorkoutOrder = async (userId, orderArray) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    workoutOrder: orderArray,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setSidePlankAlertPreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    sidePlankAlert: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setPrepTimePreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    prepTime: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setRestTimePreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    restTime: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setShowCardPhotosPreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    showCardPhotos: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setActiveLastMinutePreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    activeLastMinute: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setWeeklySchedule = async (userId, schedule) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    weeklySchedule: schedule,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setPinnedWorkouts = async (userId, pinnedArray) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    pinnedWorkouts: pinnedArray,
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
    { followedAt: serverTimestamp(), active: true, unfollowedAt: deleteField() },
    { merge: true }
  );
  batch.set(
    doc(db, 'followers', targetUid, 'userFollowers', myUid),
    { followedAt: serverTimestamp(), active: true, unfollowedAt: deleteField() },
    { merge: true }
  );
  await batch.commit();
};

export const unfollowUser = async (myUid, targetUid) => {
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'following', myUid, 'userFollowing', targetUid),
    { active: false, unfollowedAt: serverTimestamp() },
    { merge: true }
  );
  batch.delete(doc(db, 'followers', targetUid, 'userFollowers', myUid));
  await batch.commit();
};

export const getFollowing = async (userId) => {
  const snapshot = await getDocs(
    collection(db, 'following', userId, 'userFollowing')
  );
  return snapshot.docs.filter(d => d.data().active !== false).map(d => d.id);
};

export const getFollowers = async (userId) => {
  const snapshot = await getDocs(
    collection(db, 'followers', userId, 'userFollowers')
  );
  return snapshot.docs.map(d => d.id);
};

export const getFollowerNotifications = async (userId) => {
  const snapshot = await getDocs(
    collection(db, 'followers', userId, 'userFollowers')
  );
  const followerDocs = snapshot.docs.map(d => ({
    uid: d.id,
    followedAt: d.data().followedAt?.toDate?.() || null
  })).filter(f => f.followedAt);
  if (followerDocs.length === 0) return [];
  // Fetch profiles for display names/photos
  const profiles = await getUserProfiles(followerDocs.map(f => f.uid));
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.uid] = p; });
  return followerDocs.map(f => {
    const p = profileMap[f.uid] || {};
    return {
      id: `follow-${f.uid}`,
      type: 'follow',
      userId: f.uid,
      displayName: p.displayName || 'Someone',
      photoURL: p.photoURL || null,
      createdAt: f.followedAt
    };
  });
};

export const getUserProfiles = async (userIds) => {
  if (!userIds || userIds.length === 0) return [];
  const profiles = await Promise.all(
    userIds.map(async (uid) => {
      const snap = await getDoc(doc(db, 'userProfiles', uid));
      return snap.exists() ? { uid, ...snap.data() } : { uid, displayName: 'Unknown' };
    })
  );
  return profiles;
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

// ── Save Notifications ──

export const createSaveNotification = async ({ recipientUid, actorUid, actorName, actorPhotoURL, workoutName, source }) => {
  if (!recipientUid || recipientUid === actorUid) return;
  await addDoc(collection(db, 'notifications'), {
    recipientUid,
    type: 'workout_saved',
    actorUid,
    actorName: actorName || 'Someone',
    actorPhotoURL: actorPhotoURL || null,
    workoutName,
    source,
    createdAt: serverTimestamp()
  });
};

export const getSaveNotifications = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', userId),
    where('type', '==', 'workout_saved'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  const seen = new Set();
  const results = [];
  snapshot.docs.forEach(d => {
    const data = d.data();
    const key = `${data.actorUid}_${data.workoutName}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      id: d.id,
      type: 'workout_saved',
      userId: data.actorUid,
      displayName: data.actorName,
      photoURL: data.actorPhotoURL,
      workoutName: data.workoutName,
      source: data.source,
      createdAt: data.createdAt?.toDate?.() || null
    });
  });
  return results;
};

export const createShareNotification = async ({ recipientUid, actorUid, actorName, actorPhotoURL, workoutName, workoutType, exercises, restTime, tags, creatorUid, creatorName, creatorPhotoURL }) => {
  if (!recipientUid || recipientUid === actorUid) return;
  await addDoc(collection(db, 'notifications'), {
    recipientUid,
    type: 'workout_shared',
    actorUid,
    actorName: actorName || 'Someone',
    actorPhotoURL: actorPhotoURL || null,
    workoutName,
    workoutType: workoutType || 'timer',
    exercises: exercises || [],
    restTime: restTime ?? null,
    tags: tags || null,
    // Preserve original creator (falls back to sharer if not provided)
    creatorUid: creatorUid || actorUid,
    creatorName: creatorName || actorName || 'Someone',
    creatorPhotoURL: creatorPhotoURL || actorPhotoURL || null,
    status: 'pending',
    createdAt: serverTimestamp()
  });
};

export const getShareNotifications = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', userId),
    where('type', '==', 'workout_shared'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  const seen = new Set();
  const results = [];
  snapshot.docs.forEach(d => {
    const data = d.data();
    const key = `${data.actorUid}_${data.workoutName}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      id: d.id,
      type: 'workout_shared',
      userId: data.actorUid,
      displayName: data.actorName,
      photoURL: data.actorPhotoURL,
      workoutName: data.workoutName,
      workoutType: data.workoutType,
      exercises: data.exercises,
      restTime: data.restTime,
      tags: data.tags,
      status: data.status,
      creatorUid: data.creatorUid || data.actorUid,
      creatorName: data.creatorName || data.actorName,
      creatorPhotoURL: data.creatorPhotoURL || data.actorPhotoURL,
      createdAt: data.createdAt?.toDate?.() || null
    });
  });
  return results;
};

export const getSentShareNotifications = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('actorUid', '==', userId),
    where('type', '==', 'workout_shared'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if (allDocs.length === 0) return [];
  // Deduplicate: keep most recent per recipient + workout
  const seen = new Set();
  const docs = [];
  allDocs.forEach(d => {
    const key = `${d.recipientUid}_${d.workoutName}`;
    if (seen.has(key)) return;
    seen.add(key);
    docs.push(d);
  });
  const recipientIds = [...new Set(docs.map(d => d.recipientUid))];
  const profiles = await getUserProfiles(recipientIds);
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.uid] = p; });
  return docs.map(d => {
    const recipient = profileMap[d.recipientUid] || {};
    return {
      id: d.id,
      type: 'workout_sent',
      userId: d.recipientUid,
      recipientName: recipient.displayName || 'Someone',
      recipientPhotoURL: recipient.photoURL || null,
      displayName: d.actorName,
      photoURL: d.actorPhotoURL,
      workoutName: d.workoutName,
      workoutType: d.workoutType,
      exercises: d.exercises,
      restTime: d.restTime,
      tags: d.tags,
      status: d.status,
      createdAt: d.createdAt?.toDate?.() || null
    };
  });
};

export const updateNotificationStatus = async (notificationId, status) => {
  await setDoc(doc(db, 'notifications', notificationId), { status }, { merge: true });
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
    isPublic: workoutData.isPublic !== false,
    setsCompleted: workoutData.setsCompleted || 1,
    joinedUsers: {},
    likeCount: 0,
    createdAt: serverTimestamp(),
    lastCompletedAt: serverTimestamp()
  });

  // Increment workout count on profile
  await setDoc(doc(db, 'userProfiles', userId), {
    workoutCount: increment(1),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return postRef.id;
};

export const updatePostSetsCompleted = async (postId, setsCompleted) => {
  await updateDoc(doc(db, 'posts', postId), {
    setsCompleted,
    lastCompletedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const joinPost = async (postId, joinerUid, joinerProfile) => {
  await updateDoc(doc(db, 'posts', postId), {
    [`joinedUsers.${joinerUid}`]: {
      displayName: joinerProfile.displayName || 'Anonymous',
      photoURL: joinerProfile.photoURL || null,
    },
    updatedAt: serverTimestamp()
  });
};

// ── Unread notification check (lightweight, limit 1) ──

export const hasNewNotifications = async (userId, sinceDate, followingIds = []) => {
  if (!userId) return false;
  const since = sinceDate || new Date(0);

  const isNewer = (snap) => {
    if (snap.empty) return false;
    const data = snap.docs[0].data();
    const ts = data.createdAt?.toDate?.() || data.followedAt?.toDate?.() || null;
    return ts && ts > since;
  };

  // Check all feed sources using existing index patterns (limit 1, compare client-side)
  const checks = [
    // Save notifications (recipientUid + type + createdAt index)
    getDocs(query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      where('type', '==', 'workout_saved'),
      orderBy('createdAt', 'desc'), limit(1)
    )),
    // Share notifications (same index)
    getDocs(query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      where('type', '==', 'workout_shared'),
      orderBy('createdAt', 'desc'), limit(1)
    )),
    // Sent share notifications (actorUid + type + createdAt index)
    getDocs(query(
      collection(db, 'notifications'),
      where('actorUid', '==', userId),
      where('type', '==', 'workout_shared'),
      orderBy('createdAt', 'desc'), limit(1)
    )),
    // Own posts (userId + createdAt index)
    getDocs(query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'), limit(1)
    ))
  ];

  // Posts from followed users
  if (followingIds.length > 0) {
    checks.push(
      getDocs(query(
        collection(db, 'posts'),
        where('userId', 'in', followingIds.slice(0, 30)),
        orderBy('createdAt', 'desc'), limit(1)
      ))
    );
  }

  const results = await Promise.all(checks);
  return results.some(isNewer);
};

export const getFeedPosts = async (userId, pageSize = 30) => {
  // Get ALL following docs (active + inactive) to preserve feed history
  const followSnapshot = await getDocs(
    collection(db, 'following', userId, 'userFollowing')
  );
  const unfollowCutoffs = {}; // userId → unfollowedAt Date (only for inactive follows)
  const allFollowIds = [];
  followSnapshot.docs.forEach(d => {
    const data = d.data();
    allFollowIds.push(d.id);
    if (data.active === false && data.unfollowedAt) {
      unfollowCutoffs[d.id] = data.unfollowedAt.toDate ? data.unfollowedAt.toDate() : data.unfollowedAt;
    }
  });
  // Include own posts
  const userIds = [userId, ...allFollowIds];

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
        createdAt: data.createdAt?.toDate?.() || null,
        lastCompletedAt: data.lastCompletedAt?.toDate?.() || null
      };
    });
    allPosts = allPosts.concat(posts);
  }

  // Filter out posts from unfollowed users that were created after the unfollow
  allPosts = allPosts.filter(post => {
    const cutoff = unfollowCutoffs[post.userId];
    if (!cutoff) return true; // active follow or own post — keep all
    return post.createdAt && post.createdAt <= cutoff; // only keep posts from before unfollow
  });

  // Hide private posts from other users (keep own private posts)
  allPosts = allPosts.filter(post => {
    if (post.type) return true; // notifications, not workout posts
    if (post.userId === userId) return true; // own posts always visible
    return post.isPublic !== false; // hide other users' private posts
  });

  // Merge follow + save + share + sent notifications
  try {
    const [followNotifs, saveNotifs, shareNotifs, sentNotifs] = await Promise.all([
      getFollowerNotifications(userId),
      getSaveNotifications(userId).catch(err => { console.error('Save notifications failed:', err); return []; }),
      getShareNotifications(userId).catch(err => { console.error('Share notifications failed:', err.message, err); return []; }),
      getSentShareNotifications(userId).catch(err => { console.error('Sent notifications failed:', err.message, err); return []; })
    ]);
    allPosts = allPosts.concat(followNotifs, saveNotifs, shareNotifs, sentNotifs);
  } catch (err) {
    console.error('Notification merge failed:', err.message);
    // Still try follow notifications alone
    try {
      const followNotifs = await getFollowerNotifications(userId);
      allPosts = allPosts.concat(followNotifs);
    } catch (_) { /* skip notifications entirely */ }
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
