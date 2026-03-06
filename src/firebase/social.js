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
  deleteField,
  arrayUnion,
  arrayRemove
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
      isPrivate: false,
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
      shuffleExercises: false,
      selectedWorkout: null,
      showCardPhotos: true,
      inAppNotifications: true,
      pinnedWorkouts: [],
      weeklySchedule: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    };
  }
  const data = snap.data();
  return {
    autoShare: data.autoShare ?? null,
    activeColor: data.activeColor || null,
    restColor: data.restColor || null,
    workoutOrder: data.workoutOrder || null,
    sidePlankAlert: data.sidePlankAlert ?? true,
    prepTime: data.prepTime ?? 15,
    restTime: data.restTime ?? 15,
    activeLastMinute: data.activeLastMinute ?? true,
    shuffleExercises: data.shuffleExercises ?? false,
    selectedWorkout: data.selectedWorkout || null,
    showCardPhotos: data.showCardPhotos ?? true,
    inAppNotifications: data.inAppNotifications ?? true,
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

export const setInAppNotificationsPreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    inAppNotifications: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setActiveLastMinutePreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    activeLastMinute: value,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const setShuffleExercisesPreference = async (userId, value) => {
  await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
    shuffleExercises: value,
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

// ── Account Privacy ──

export const setAccountPrivate = async (userId, isPrivate) => {
  await setDoc(doc(db, 'userProfiles', userId), {
    isPrivate,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

// ── Follow Requests ──

export const createFollowRequest = async ({ requesterUid, requesterName, requesterPhotoURL, targetUid }) => {
  if (!targetUid || targetUid === requesterUid) return;
  // Check for existing request (pending or cancelled) to reuse instead of creating duplicates
  const existing = await getDocs(query(
    collection(db, 'notifications'),
    where('actorUid', '==', requesterUid),
    where('type', '==', 'follow_request'),
    where('recipientUid', '==', targetUid)
  ));
  const reusable = existing.docs.find(d => {
    const s = d.data().status;
    return s === 'pending' || s === 'cancelled';
  });
  if (reusable) {
    // Reactivate existing doc
    await setDoc(doc(db, 'notifications', reusable.id), { status: 'pending', createdAt: serverTimestamp() }, { merge: true });
    return reusable.id;
  }
  const ref = await addDoc(collection(db, 'notifications'), {
    type: 'follow_request',
    actorUid: requesterUid,
    actorName: requesterName || 'Someone',
    actorPhotoURL: requesterPhotoURL || null,
    recipientUid: targetUid,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  return ref.id;
};

export const acceptFollowRequest = async (notificationId, requesterUid, myUid, myName, myPhotoURL) => {
  // NOTE: Requires following/{userId} write rule to allow any authenticated user
  // (same as followers rule) so we can write to following/{requesterUid}
  await followUser(requesterUid, myUid);
  await updateNotificationStatus(notificationId, 'accepted');
  // Notify the requester that their request was accepted (shows as a follow notification)
  await addDoc(collection(db, 'notifications'), {
    type: 'follow_request_accepted',
    recipientUid: requesterUid,
    actorUid: myUid,
    actorName: myName || 'Someone',
    actorPhotoURL: myPhotoURL || null,
    createdAt: serverTimestamp()
  });
};

export const denyFollowRequest = async (notificationId) => {
  await updateNotificationStatus(notificationId, 'denied');
};

export const cancelFollowRequest = async (notificationId, actorUid) => {
  // Actor cancels their own request — update status.
  // NOTE: Default rules only allow recipientUid to update. You must add to notification rules:
  //   allow update: if request.auth != null && (resource.data.recipientUid == request.auth.uid || resource.data.actorUid == request.auth.uid);
  await setDoc(doc(db, 'notifications', notificationId), { status: 'cancelled' }, { merge: true });
};

export const getPendingFollowRequests = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('actorUid', '==', userId),
    where('type', '==', 'follow_request'),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  const result = {};
  snapshot.docs.forEach(d => {
    result[d.data().recipientUid] = d.id;
  });
  return result;
};

export const getFollowRequestNotifications = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', userId),
    where('type', '==', 'follow_request'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  const seen = new Set();
  const results = [];
  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.status === 'cancelled') return; // hide cancelled requests
    if (seen.has(data.actorUid)) return; // deduplicate per user
    seen.add(data.actorUid);
    results.push({
      id: d.id,
      type: 'follow_request',
      userId: data.actorUid,
      displayName: data.actorName,
      photoURL: data.actorPhotoURL,
      status: data.status,
      createdAt: data.createdAt?.toDate?.() || null
    });
  });
  return results;
};

export const getFollowRequestAcceptedNotifications = async (userId) => {
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', userId),
    where('type', '==', 'follow_request_accepted'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type: 'follow_request_accepted',
      userId: data.actorUid,
      displayName: data.actorName,
      photoURL: data.actorPhotoURL,
      createdAt: data.createdAt?.toDate?.() || null
    };
  });
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
    isPublic: true,
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
    joinedUserIds: arrayUnion(joinerUid),
    updatedAt: serverTimestamp()
  });
};

export const leavePost = async (postId, joinerUid) => {
  await updateDoc(doc(db, 'posts', postId), {
    [`joinedUsers.${joinerUid}`]: deleteField(),
    joinedUserIds: arrayRemove(joinerUid),
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
    )),
    // Follow request notifications (recipientUid + type + createdAt index)
    getDocs(query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      where('type', '==', 'follow_request'),
      orderBy('createdAt', 'desc'), limit(1)
    )),
    // Follow request accepted notifications
    getDocs(query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId),
      where('type', '==', 'follow_request_accepted'),
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
  const followStartCutoffs = {}; // userId -> followedAt Date (for active follows)
  const allFollowIds = [];
  followSnapshot.docs.forEach(d => {
    const data = d.data();
    allFollowIds.push(d.id);
    if (data.active === false && data.unfollowedAt) {
      unfollowCutoffs[d.id] = data.unfollowedAt.toDate ? data.unfollowedAt.toDate() : data.unfollowedAt;
    }
    // Track when each follow started (active or not)
    if (data.followedAt) {
      followStartCutoffs[d.id] = data.followedAt.toDate ? data.followedAt.toDate() : data.followedAt;
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
  const seenIds = new Set();
  const mapPost = (d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || null,
      lastCompletedAt: data.lastCompletedAt?.toDate?.() || null
    };
  };

  for (const chunk of chunks) {
    const q = query(
      collection(db, 'posts'),
      where('userId', 'in', chunk),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(d => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        allPosts.push(mapPost(d));
      }
    });
  }

  // Also fetch posts where a followed user joined (tagged on)
  if (allFollowIds.length > 0) {
    try {
      const joinChunks = [];
      for (let i = 0; i < allFollowIds.length; i += 30) {
        joinChunks.push(allFollowIds.slice(i, i + 30));
      }
      for (const chunk of joinChunks) {
        const q = query(
          collection(db, 'posts'),
          where('joinedUserIds', 'array-contains-any', chunk),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => {
          if (!seenIds.has(d.id)) {
            seenIds.add(d.id);
            allPosts.push(mapPost(d));
          }
        });
      }
    } catch (err) {
      console.error('[Feed] joinedUserIds query failed (index may be needed):', err);
    }
  }

  // Helper: check if any followed user joined this post
  const hasFollowedJoiner = (post) => {
    const joinedIds = post.joinedUserIds || [];
    return joinedIds.some(id => allFollowIds.includes(id));
  };

  // Filter out posts from unfollowed users that were created after the unfollow
  allPosts = allPosts.filter(post => {
    if (hasFollowedJoiner(post)) return true; // visible via a followed joiner
    const cutoff = unfollowCutoffs[post.userId];
    if (!cutoff) return true; // active follow or own post — keep all
    return post.createdAt && post.createdAt <= cutoff; // only keep posts from before unfollow
  });

  // Only show posts created after the user started following that person
  allPosts = allPosts.filter(post => {
    if (post.userId === userId) return true; // own posts always visible
    if (hasFollowedJoiner(post)) return true; // visible via a followed joiner
    const startCutoff = followStartCutoffs[post.userId];
    if (!startCutoff) return true; // no followedAt data — keep (safety fallback)
    return post.createdAt && post.createdAt >= startCutoff;
  });

  // Hide posts from private accounts where viewer is not a follower
  const activeFollowIds = followSnapshot.docs.filter(d => d.data().active !== false).map(d => d.id);
  const otherUserIds = [...new Set(allPosts.filter(p => p.userId !== userId).map(p => p.userId))];
  let privateUserIds = new Set();
  if (otherUserIds.length > 0) {
    const profiles = await getUserProfiles(otherUserIds);
    profiles.forEach(p => { if (p.isPrivate && !activeFollowIds.includes(p.uid)) privateUserIds.add(p.uid); });
  }
  allPosts = allPosts.filter(post => {
    if (post.userId === userId) return true;
    if (privateUserIds.has(post.userId) && !hasFollowedJoiner(post)) return false;
    return true;
  });

  // Merge follow + save + share + sent + follow request notifications
  try {
    const [followNotifs, saveNotifs, shareNotifs, sentNotifs, followRequestNotifs, followAcceptedNotifs] = await Promise.all([
      getFollowerNotifications(userId),
      getSaveNotifications(userId).catch(err => { console.error('Save notifications failed:', err); return []; }),
      getShareNotifications(userId).catch(err => { console.error('Share notifications failed:', err.message, err); return []; }),
      getSentShareNotifications(userId).catch(err => { console.error('Sent notifications failed:', err.message, err); return []; }),
      getFollowRequestNotifications(userId).catch(err => { console.error('Follow request notifications failed:', err); return []; }),
      getFollowRequestAcceptedNotifications(userId).catch(err => { console.error('Follow accepted notifications failed:', err); return []; })
    ]);
    allPosts = allPosts.concat(followNotifs, saveNotifs, shareNotifs, sentNotifs, followRequestNotifs, followAcceptedNotifs);
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

// ── Reactions ──

export const toggleReaction = async (postId, userId, emoji, displayName) => {
  const reactionRef = doc(db, 'posts', postId, 'reactions', `${userId}_${emoji}`);
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(reactionRef);

  const batch = writeBatch(db);
  if (snap.exists()) {
    // Removing — check if this is the last reaction for this emoji
    const postSnap = await getDoc(postRef);
    const currentCount = postSnap.data()?.reactionCounts?.[emoji] || 0;
    batch.delete(reactionRef);
    if (currentCount <= 1) {
      // Last one — remove from order too
      batch.update(postRef, {
        [`reactionCounts.${emoji}`]: increment(-1),
        emojiOrder: arrayRemove(emoji)
      });
    } else {
      batch.update(postRef, { [`reactionCounts.${emoji}`]: increment(-1) });
    }
    await batch.commit();
    return false;
  } else {
    // Adding — arrayUnion keeps order stable and avoids duplicates
    batch.set(reactionRef, { emoji, userId, displayName: displayName || null, createdAt: serverTimestamp() });
    batch.update(postRef, {
      [`reactionCounts.${emoji}`]: increment(1),
      emojiOrder: arrayUnion(emoji)
    });
    await batch.commit();
    return true;
  }
};

export const getEmojiReactors = async (postId, emoji) => {
  const q = query(
    collection(db, 'posts', postId, 'reactions'),
    where('emoji', '==', emoji)
  );
  const snap = await getDocs(q);
  const reactors = snap.docs.map(d => ({
    userId: d.data().userId,
    displayName: d.data().displayName || null
  }));

  // Back-fill display names for any reactions saved before displayName was stored
  const missing = reactors.filter(r => !r.displayName);
  if (missing.length > 0) {
    const profiles = await getUserProfiles(missing.map(r => r.userId));
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.uid] = p.displayName || null; });
    missing.forEach(r => { r.displayName = profileMap[r.userId] || 'Someone'; });
  }

  return reactors;
};

export const batchCheckReactions = async (postIds, userId) => {
  if (postIds.length === 0) return {};
  const result = {};
  postIds.forEach(id => { result[id] = []; });
  await Promise.all(
    postIds.map(async (postId) => {
      const q = query(
        collection(db, 'posts', postId, 'reactions'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      result[postId] = snap.docs.map(d => d.data().emoji);
    })
  );
  return result;
};
