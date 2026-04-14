import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../firebase/auth';
import { collection, getDocs, getDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { DEFAULT_TIMER_WORKOUTS, DEFAULT_STOPWATCH_WORKOUTS, countActiveExercises } from '../data/defaultWorkouts';
import { SOUNDS, unlockAudio } from '../data/sounds';
import ProfilePopup from './ProfilePopup';
import './SideMenu.css';

const ACTIVE_DEFAULT = '#ff3b30';
const REST_DEFAULT = '#007aff';
const OTHER_COLORS = ['#00E5FF', '#DBF9B8', '#C4B5E0', '#C47A6E', '#2D7D6B', '#FF6B2B'];
const NEON_COLORS = ['#E040FB', '#7C4DFF', '#ACD8AA', '#76FF03', '#FFD740', '#FF4081', '#1DE9B6', '#304FFE'];
const EARTH_COLORS = ['#F4845F', '#B8860B', '#E6194B', '#059669', '#DC2626', '#0891B2', '#D97706', '#E15634'];

const ADMIN_EMAIL = 'jarongwenger@gmail.com';

const SideMenu = ({ isOpen, onClose, requestClose, autoShareEnabled, onToggleAutoShare, isPrivate, onTogglePrivate, prepTime, onPrepTimeChange, restTime, onRestTimeChange, activeLastMinute, onToggleActiveLastMinute, shuffleExercises, onToggleShuffleExercises, soundEnabled, onToggleSoundEnabled, activeSound = 'ping', onActiveSoundChange, restSound = 'chime', onRestSoundChange, activeColor, restColor, onColorChange, inAppNotifications, onToggleInAppNotifications, onOpenProfile, isPro, onProTap, onTogglePro, weeklySchedule, onScheduleOpen, isTestAccount, testOnboardingMode, onToggleTestOnboarding }) => {
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);
  const [colorPopup, setColorPopup] = useState(null); // null | 'active' | 'rest'
  const [soundPopup, setSoundPopup] = useState(null); // null | 'active' | 'rest'
  const [pendingSound, setPendingSound] = useState(null);

  // Admin panel state
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminDetail, setAdminDetail] = useState(null); // { title, items: [{ label, sublabel, value }], filterFn? }
  const [adminDetailFilter, setAdminDetailFilter] = useState('all');
  const [adminProfileUser, setAdminProfileUser] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(null);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const loadAdminStats = useCallback(async () => {
    setAdminLoading(true);
    setShowAdminPopup(true);
    setAdminDetail(null);
    try {
      // Fetch all collections in parallel
      const [profilesSnap, postsSnap, workoutsSnap, notificationsSnap, proInterestSnap, stripeRedirectsSnap] = await Promise.all([
        getDocs(collection(db, 'userProfiles')),
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'workouts')),
        getDocs(collection(db, 'notifications')),
        getDocs(collection(db, 'proInterest')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'stripeRedirects')).catch(() => ({ size: 0, docs: [] })),
      ]);

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const activeUsersTodaySet = new Set();
      const activeUsers7dSet = new Set();
      // Per-user activity signals: uid -> { signal: count }
      const userSignalsToday = {};
      const userSignals7d = {};
      const addSignal = (uid, signal, date) => {
        if (date && date > todayStart) {
          if (!userSignalsToday[uid]) userSignalsToday[uid] = {};
          userSignalsToday[uid][signal] = (userSignalsToday[uid][signal] || 0) + 1;
        }
        if (date && date > weekAgo) {
          if (!userSignals7d[uid]) userSignals7d[uid] = {};
          userSignals7d[uid][signal] = (userSignals7d[uid][signal] || 0) + 1;
        }
      };
      const totalUsers = profilesSnap.size;
      const totalPosts = postsSnap.size;
      const totalWorkouts = workoutsSnap.size;

      // Build profile lookup
      const profileMap = {};
      const profilePhotoMap = {};
      const profileEmailMap = {};
      profilesSnap.docs.forEach(d => {
        const data = d.data();
        profileMap[d.id] = data.displayName || 'Unknown';
        profilePhotoMap[d.id] = data.photoURL || null;
        profileEmailMap[d.id] = data.email || null;
      });

      // Per-user workout created/forked counts
      const userWorkoutsCreated = {};
      const userWorkoutsForked = {};
      let totalForked = 0;
      workoutsSnap.docs.forEach(d => {
        const data = d.data();
        const owner = data.ownerUid;
        if (!owner) return;
        userWorkoutsCreated[owner] = (userWorkoutsCreated[owner] || 0) + 1;
        if (data.forked) {
          totalForked++;
          userWorkoutsForked[owner] = (userWorkoutsForked[owner] || 0) + 1;
        }
      });
      console.log('[Admin] Workouts debug:', {
        totalDocs: workoutsSnap.size,
        ownerUids: Object.keys(userWorkoutsCreated),
        profileUids: Object.keys(profileMap),
        sample3: workoutsSnap.docs.slice(0, 3).map(d => ({ id: d.id, ownerUid: d.data().ownerUid, createdAt: d.data().createdAt })),
      });

      // Per-user post counts + reactions received + joins received
      const userPostCounts = {};
      const userReactionsReceived = {};
      const userJoinsReceived = {};
      let totalReactions = 0;
      let totalJoins = 0;
      postsSnap.docs.forEach(d => {
        const data = d.data();
        const uid = data.userId;
        userPostCounts[uid] = (userPostCounts[uid] || 0) + 1;
        const counts = data.reactionCounts || {};
        let postReactions = 0;
        Object.values(counts).forEach(n => { postReactions += n; });
        totalReactions += postReactions;
        userReactionsReceived[uid] = (userReactionsReceived[uid] || 0) + postReactions;
        const joinCount = (data.joinedUserIds || []).length;
        totalJoins += joinCount;
        userJoinsReceived[uid] = (userJoinsReceived[uid] || 0) + joinCount;
      });

      // Notifications breakdown + per-user shares/saves
      let workoutsShared = 0;
      let workoutsSaved = 0;
      const userSharesSent = {};
      const userSavesReceived = {};
      notificationsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'workout_shared') {
          workoutsShared++;
          userSharesSent[data.actorUid] = (userSharesSent[data.actorUid] || 0) + 1;
        } else if (data.type === 'workout_saved') {
          workoutsSaved++;
          userSavesReceived[data.recipientUid] = (userSavesReceived[data.recipientUid] || 0) + 1;
        }
      });

      // Pre-index: first reaction per user from post reaction subcollections
      const userFirstReaction = {};
      await Promise.all(postsSnap.docs.map(async (postDoc) => {
        try {
          const reactionsSnap = await getDocs(collection(db, 'posts', postDoc.id, 'reactions'));
          reactionsSnap.docs.forEach(rd => {
            const rData = rd.data();
            const uid = rData.userId;
            const ts = rData.createdAt?.toDate?.() || null;
            if (uid && ts && (!userFirstReaction[uid] || ts < userFirstReaction[uid])) {
              userFirstReaction[uid] = ts;
            }
            if (uid && ts && ts > todayStart) activeUsersTodaySet.add(uid);
            if (uid && ts && ts > weekAgo) activeUsers7dSet.add(uid);
            if (uid && ts) addSignal(uid, 'reacted', ts);
          });
        } catch (_) { /* skip */ }
      }));

      // Per-user history + followers (parallel)
      const userIds = profilesSnap.docs.map(d => d.id);
      let totalFollows = 0;
      let totalActiveSeconds = 0;
      let totalCompletions = 0;
      let totalSets = 0;
      const workoutNameCounts = {};
      const workoutUserCounts = {}; // workoutName -> { uid: count }
      const userActiveSeconds = {};
      const userCompletions = {};
      const userSets = {};
      const userFollowerCounts = {};
      const userPinnedCounts = {};
      let totalPinned = 0;
      const workoutOwnerCounts = {}; // workoutId -> number of users who have it in library
      const workoutOwnerUids = {}; // workoutId -> [uid, uid, ...]
      const userSignupDates = {};
      profilesSnap.docs.forEach(d => {
        const data = d.data();
        userSignupDates[d.id] = data.createdAt?.toDate?.() || null;
      });

      // Feature adoption tracking per user
      const userFirstCompletion = {};
      const userFirstFollow = {};
      const userSettingsChanged = {};
      const userHasPinned = {};

      // Pre-index: first workout created/forked per user from workouts snap
      const userFirstCreated = {};
      const userFirstForked = {};
      workoutsSnap.docs.forEach(d => {
        const data = d.data();
        const owner = data.ownerUid;
        if (!owner) return;
        const ts = data.createdAt?.toDate?.() || null;
        if (ts && (!userFirstCreated[owner] || ts < userFirstCreated[owner])) userFirstCreated[owner] = ts;
        if (data.forked && ts && (!userFirstForked[owner] || ts < userFirstForked[owner])) userFirstForked[owner] = ts;
      });

      // Pre-index: first save action per user from notifications (actorUid saved someone's workout)
      const userFirstSaved = {};
      notificationsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'workout_saved') {
          const ts = data.createdAt?.toDate?.() || null;
          const actor = data.actorUid;
          if (actor && ts && (!userFirstSaved[actor] || ts < userFirstSaved[actor])) userFirstSaved[actor] = ts;
        }
      });

      await Promise.all(userIds.map(async (uid) => {
        // History
        try {
          const histSnap = await getDocs(collection(db, 'users', uid, 'history'));
          let userSeconds = 0;
          let userComp = 0;
          let userSetCount = 0;
          let firstComp = null;
          histSnap.docs.forEach(d => {
            const data = d.data();
            totalCompletions++;
            userComp++;
            const sets = data.setCount || 1;
            totalSets += sets;
            userSetCount += sets;
            const exercises = data.exercises || [];
            const rest = data.restTime ?? 15;
            const alm = data.activeLastMinute ?? true;
            const activeCount = countActiveExercises(exercises);
            const activePerSet = activeCount > 0
              ? (activeCount - 1) * (60 - rest) + (60 - (alm ? 0 : rest))
              : 0;
            const seconds = activePerSet * sets;
            totalActiveSeconds += seconds;
            userSeconds += seconds;
            const wn = data.workoutName || 'Unknown';
            workoutNameCounts[wn] = (workoutNameCounts[wn] || 0) + 1;
            if (!workoutUserCounts[wn]) workoutUserCounts[wn] = {};
            workoutUserCounts[wn][uid] = (workoutUserCounts[wn][uid] || 0) + 1;
            const compAt = data.completedAt?.toDate?.() || null;
            if (compAt && (!firstComp || compAt < firstComp)) firstComp = compAt;
            if (compAt && compAt > todayStart) activeUsersTodaySet.add(uid);
            if (compAt && compAt > weekAgo) activeUsers7dSet.add(uid);
            if (compAt) addSignal(uid, 'completed', compAt);
          });
          userActiveSeconds[uid] = userSeconds;
          userCompletions[uid] = userComp;
          userSets[uid] = userSetCount;
          if (firstComp) userFirstCompletion[uid] = firstComp;
        } catch (_) { /* skip */ }

        // Followers
        try {
          const followersSnap = await getDocs(collection(db, 'followers', uid, 'userFollowers'));
          const count = followersSnap.size;
          totalFollows += count;
          userFollowerCounts[uid] = count;
        } catch (_) { /* skip */ }

        // Following (first follow date)
        try {
          const followingSnap = await getDocs(collection(db, 'following', uid, 'userFollowing'));
          let firstFollow = null;
          followingSnap.docs.forEach(d => {
            const ts = d.data().followedAt?.toDate?.() || null;
            if (ts && (!firstFollow || ts < firstFollow)) firstFollow = ts;
            if (ts && ts > todayStart) activeUsersTodaySet.add(uid);
            if (ts && ts > weekAgo) activeUsers7dSet.add(uid);
            if (ts) addSignal(uid, 'followed', ts);
          });
          if (firstFollow) userFirstFollow[uid] = firstFollow;
        } catch (_) { /* skip */ }

        // Preferences (pinned + settings changed)
        try {
          const prefsSnap = await getDoc(doc(db, 'users', uid, 'settings', 'preferences'));
          if (prefsSnap.exists()) {
            const p = prefsSnap.data();
            const prefsUpdated = p.updatedAt?.toDate?.() || null;
            if (prefsUpdated && prefsUpdated > todayStart) activeUsersTodaySet.add(uid);
            if (prefsUpdated && prefsUpdated > weekAgo) activeUsers7dSet.add(uid);
            if (prefsUpdated) addSignal(uid, 'settings', prefsUpdated);
            const pinned = (p.pinnedWorkouts || []).length;
            totalPinned += pinned;
            userPinnedCounts[uid] = pinned;
            userHasPinned[uid] = pinned > 0;
            // Check if any setting differs from defaults
            userSettingsChanged[uid] = (
              p.prepTime !== 10 ||
              p.activeLastMinute !== undefined ||
              p.shuffleExercises === true ||
              p.activeColor !== '#ff3b30' ||
              p.restColor !== '#007aff' ||
              p.autoShare === true ||
              p.inAppNotifications === false ||
              p.isPrivate === true
            );
          } else {
            userPinnedCounts[uid] = 0;
            userHasPinned[uid] = false;
            userSettingsChanged[uid] = false;
          }
        } catch (_) { /* skip */ }

        // Library refs (count owners per workout)
        try {
          const libSnap = await getDocs(collection(db, 'users', uid, 'library'));
          libSnap.docs.forEach(ld => {
            const addedAt = ld.data().addedAt?.toDate?.() || null;
            if (addedAt && addedAt > todayStart) activeUsersTodaySet.add(uid);
            if (addedAt && addedAt > weekAgo) activeUsers7dSet.add(uid);
            if (addedAt) addSignal(uid, 'library', addedAt);
            workoutOwnerCounts[ld.id] = (workoutOwnerCounts[ld.id] || 0) + 1;
            if (!workoutOwnerUids[ld.id]) workoutOwnerUids[ld.id] = [];
            workoutOwnerUids[ld.id].push(uid);
          });
        } catch (_) { /* skip */ }
      }));

      // Build most owned workout ranking
      const workoutNameMap = {};
      [...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].forEach(w => {
        workoutNameMap[w.id] = w.name;
      });
      workoutsSnap.docs.forEach(d => {
        workoutNameMap[d.id] = d.data().name || 'Unknown';
      });
      const ownershipRanking = Object.entries(workoutOwnerCounts)
        .map(([id, count]) => ({ id, name: workoutNameMap[id] || id, count, uids: workoutOwnerUids[id] || [] }))
        .sort((a, b) => b.count - a.count);
      const mostOwnedWorkout = ownershipRanking[0] || null;

      const now = Date.now();

      // Build feature adoption stats
      const FEATURES = [
        { key: 'completed', label: 'Completed Workout', getFirst: uid => userFirstCompletion[uid] },
        { key: 'created', label: 'Created Workout', getFirst: uid => userFirstCreated[uid] },
        { key: 'followed', label: 'Followed Someone', getFirst: uid => userFirstFollow[uid] },
        { key: 'forked', label: 'Forked Workout', getFirst: uid => userFirstForked[uid] },
        { key: 'saved', label: 'Saved Workout', getFirst: uid => userFirstSaved[uid] },
        { key: 'reacted', label: 'Reacted on Post', getFirst: uid => userFirstReaction[uid] },
        { key: 'settings', label: 'Changed Settings', getFirst: () => null, everCheck: uid => userSettingsChanged[uid] },
        { key: 'pinned', label: 'Pinned Workout', getFirst: () => null, everCheck: uid => userHasPinned[uid] },
      ];

      const calcAdoption = (days) => {
        const ms = days * 24 * 60 * 60 * 1000;
        const eligible = userIds.filter(uid => {
          const signup = userSignupDates[uid];
          return signup && (now - signup.getTime()) >= ms;
        });
        if (eligible.length === 0) return { eligible: 0, features: {} };
        const result = {};
        FEATURES.forEach(f => {
          const adopted = [];
          const notAdopted = [];
          eligible.forEach(uid => {
            const signup = userSignupDates[uid];
            if (f.everCheck) {
              // No timestamp — just check if ever done
              if (f.everCheck(uid)) adopted.push(uid); else notAdopted.push(uid);
            } else {
              const first = f.getFirst(uid);
              if (first && (first.getTime() - signup.getTime()) <= ms) {
                adopted.push(uid);
              } else {
                notAdopted.push(uid);
              }
            }
          });
          result[f.key] = {
            label: f.label,
            pct: Math.round((adopted.length / eligible.length) * 100),
            adopted,
            notAdopted,
            total: eligible.length,
          };
        });
        return { eligible: eligible.length, features: result };
      };
      const adoption7 = calcAdoption(7);
      const adoption30 = calcAdoption(30);

      // Most popular workout
      let mostPopularWorkout = null;
      let maxCount = 0;
      for (const [name, count] of Object.entries(workoutNameCounts)) {
        if (count > maxCount) { maxCount = count; mostPopularWorkout = name; }
      }

      // Top user by active time
      let topUser = null;
      let topSeconds = 0;
      for (const [uid, seconds] of Object.entries(userActiveSeconds)) {
        if (seconds > topSeconds) { topSeconds = seconds; topUser = { name: profileMap[uid], seconds }; }
      }

      // Most recent signup
      let newestUser = null;
      profilesSnap.docs.forEach(d => {
        const data = d.data();
        const created = data.createdAt?.toDate?.() || null;
        if (created && (!newestUser || created > newestUser.date)) {
          newestUser = { name: data.displayName, date: created };
        }
      });

      // Active users (any meaningful app activity in last 7 days / today)
      const openedAppTodaySet = new Set();
      const openedApp7dSet = new Set();

      // Profile updatedAt = app opened (ensureUserProfile runs on every login)
      const userLastOpened = {};
      profilesSnap.docs.forEach(d => {
        const data = d.data();
        const updated = data.updatedAt?.toDate?.() || data.updatedAt || null;
        const ts = updated instanceof Date ? updated : (updated?.seconds ? new Date(updated.seconds * 1000) : null);
        if (ts) userLastOpened[d.id] = ts;
        if (ts && ts > weekAgo) openedApp7dSet.add(d.id);
        if (ts && ts > todayStart) openedAppTodaySet.add(d.id);
      });

      // Posts — track poster + joiners
      postsSnap.docs.forEach(d => {
        const data = d.data();
        const created = data.createdAt?.toDate?.() || null;
        if (created && created > weekAgo) activeUsers7dSet.add(data.userId);
        if (created) addSignal(data.userId, 'posted', created);
        if (created && created > todayStart) {
          activeUsersTodaySet.add(data.userId);
          const lastCompleted = data.lastCompletedAt?.toDate?.() || null;
          if (lastCompleted && lastCompleted > todayStart) {
            (data.joinedUserIds || []).forEach(uid => { activeUsersTodaySet.add(uid); addSignal(uid, 'joined', lastCompleted); });
          }
          if (lastCompleted && lastCompleted > weekAgo) {
            (data.joinedUserIds || []).forEach(uid => { activeUsers7dSet.add(uid); addSignal(uid, 'joined', lastCompleted); });
          }
        }
        if (created && created > weekAgo) {
          const lastCompleted = data.lastCompletedAt?.toDate?.() || null;
          if (lastCompleted && lastCompleted > weekAgo) {
            (data.joinedUserIds || []).forEach(uid => { activeUsers7dSet.add(uid); addSignal(uid, 'joined', lastCompleted); });
          }
        }
      });

      // Workout edits — ownerUid edited a workout
      workoutsSnap.docs.forEach(d => {
        const data = d.data();
        const updated = data.updatedAt?.toDate?.() || null;
        const owner = data.ownerUid;
        if (!owner || !updated) return;
        if (updated > weekAgo) activeUsers7dSet.add(owner);
        if (updated > todayStart) activeUsersTodaySet.add(owner);
        addSignal(owner, 'edited', updated);
      });

      // Notifications — actorUid performed an action
      notificationsSnap.docs.forEach(d => {
        const data = d.data();
        const created = data.createdAt?.toDate?.() || null;
        if (created && created > weekAgo && data.actorUid) activeUsers7dSet.add(data.actorUid);
        if (created && created > todayStart && data.actorUid) activeUsersTodaySet.add(data.actorUid);
        if (created && data.actorUid) addSignal(data.actorUid, 'shared', created);
      });
      // History + followers checked per-user below

      // New users this week
      const newUsersThisWeek = [];
      profilesSnap.docs.forEach(d => {
        const data = d.data();
        const created = data.createdAt?.toDate?.() || null;
        if (created && created > weekAgo) newUsersThisWeek.push({ uid: d.id, name: data.displayName, photo: data.photoURL, email: data.email, date: created });
      });
      newUsersThisWeek.sort((a, b) => b.date - a.date);

      // Retention: users who signed up > N days ago, retained = has any history
      const calcRetention = (days) => {
        const retained = [];
        const churned = [];
        userIds.forEach(uid => {
          const signup = userSignupDates[uid];
          if (!signup || (now - signup.getTime()) < days * 24 * 60 * 60 * 1000) return;
          if ((userCompletions[uid] || 0) > 0) {
            retained.push(uid);
          } else {
            churned.push(uid);
          }
        });
        const eligible = retained.length + churned.length;
        return {
          pct: eligible > 0 ? Math.round((retained.length / eligible) * 100) : 0,
          retainedCount: retained.length,
          churnedCount: churned.length,
          retained,
          churned,
        };
      };
      const retention7 = calcRetention(7);
      const retention30 = calcRetention(30);

      // Build drill-down lists
      const userList = userIds.map(uid => ({
        uid,
        name: profileMap[uid],
        photo: profilePhotoMap[uid],
        email: profileEmailMap[uid],
        signupDate: userSignupDates[uid],
        activeSeconds: userActiveSeconds[uid] || 0,
        completions: userCompletions[uid] || 0,
        sets: userSets[uid] || 0,
        posts: userPostCounts[uid] || 0,
        followers: userFollowerCounts[uid] || 0,
        reactionsReceived: userReactionsReceived[uid] || 0,
        joinsReceived: userJoinsReceived[uid] || 0,
        sharesSent: userSharesSent[uid] || 0,
        savesReceived: userSavesReceived[uid] || 0,
        pinned: userPinnedCounts[uid] || 0,
        workoutsCreated: userWorkoutsCreated[uid] || 0,
        workoutsForked: userWorkoutsForked[uid] || 0,
        lastOpened: userLastOpened[uid] || null,
      }));

      const workoutRanking = Object.entries(workoutNameCounts)
        .map(([name, count]) => ({ name, count, users: workoutUserCounts[name] || {} }))
        .sort((a, b) => b.count - a.count);

      setAdminStats({
        totalUsers,
        totalPosts,
        totalWorkouts,
        totalCompletions,
        totalSets,
        totalActiveSeconds,
        activeUsers7d: activeUsers7dSet.size,
        activeUsersToday: activeUsersTodaySet.size,
        _activeUsersToday: [...activeUsersTodaySet],
        openedAppToday: openedAppTodaySet.size,
        _openedAppToday: [...openedAppTodaySet],
        openedApp7d: openedApp7dSet.size,
        _openedApp7d: [...openedApp7dSet],
        _userLastOpened: userLastOpened,
        _userSignalsToday: userSignalsToday,
        _userSignals7d: userSignals7d,
        newUsersThisWeek: newUsersThisWeek.length,
        _newUsersThisWeek: newUsersThisWeek,
        newestUser,
        totalReactions,
        totalFollows,
        workoutsShared,
        workoutsSaved,
        totalJoins,
        avgSetsPerCompletion: totalCompletions > 0 ? (totalSets / totalCompletions).toFixed(1) : '0',
        mostPopularWorkout,
        mostPopularCount: maxCount,
        topUser,
        // Drill-down data
        _users: userList,
        _activeUsers7d: [...activeUsers7dSet],
        _workoutRanking: workoutRanking,
        totalPinned,
        totalForked,
        mostOwnedWorkout,
        _ownershipRanking: ownershipRanking,
        retention7,
        retention30,
        adoption7,
        adoption30,
        proInterestCount: proInterestSnap.size,
        _proInterest: proInterestSnap.docs.map(d => {
          const data = d.data();
          return {
            userId: data.userId,
            displayName: data.displayName || 'Unknown',
            email: data.email || null,
            createdAt: data.createdAt?.toDate?.() || null,
          };
        }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        stripeRedirectCount: stripeRedirectsSnap.size,
        _stripeRedirects: stripeRedirectsSnap.docs.map(d => {
          const data = d.data();
          return {
            userId: data.userId,
            displayName: data.displayName || 'Unknown',
            email: data.email || null,
            createdAt: data.createdAt?.toDate?.() || null,
          };
        }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        _proSubscribers: profilesSnap.docs
          .filter(d => d.data().subscriptionStatus)
          .map(d => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: data.displayName || 'Unknown',
              email: data.email || null,
              photo: data.photoURL || null,
              subscriptionStatus: data.subscriptionStatus,
              isPro: data.isPro ?? false,
              proSince: data.proSince?.toDate?.() || null,
            };
          }),
        proTrialingCount: profilesSnap.docs.filter(d => d.data().subscriptionStatus === 'trialing').length,
        proActiveCount: profilesSnap.docs.filter(d => d.data().subscriptionStatus === 'active').length,
        proCanceledCount: profilesSnap.docs.filter(d => d.data().subscriptionStatus === 'canceled').length,
        proRefundedCount: profilesSnap.docs.filter(d => d.data().refunded === true).length,
        _proRefunded: profilesSnap.docs
          .filter(d => d.data().refunded === true)
          .map(d => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: data.displayName || 'Unknown',
              email: data.email || null,
              photo: data.photoURL || null,
              refundedAt: data.refundedAt?.toDate?.() || null,
            };
          }),
      });
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setAdminStats({ error: err.message });
    } finally {
      setAdminLoading(false);
    }
  }, []);

  // Drill-down helpers
  const openDetail = (title, items, opts) => { setAdminDetail({ title, items, ...opts }); setAdminDetailFilter('all'); };
  const closeDetail = () => setAdminDetail(null);

  const drillUsers = (sortKey, title, valueFormatter) => {
    if (!adminStats?._users) return;
    const sorted = [...adminStats._users].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    openDetail(title, sorted.map((u, i) => ({
      rank: i + 1,
      uid: u.uid,
      name: u.name,
      photo: u.photo,
      email: u.email,
      value: valueFormatter ? valueFormatter(u) : u[sortKey],
    })));
  };

  // Reset popups and portal loading when menu opens/closes
  useEffect(() => {
    if (!isOpen) {
      setColorPopup(null);
      setSoundPopup(null);
      setPendingSound(null);
    }
    if (isOpen) setPortalLoading(false);
  }, [isOpen]);

  // ── Swipe left to close ──
  const swipeRef = useRef({ startX: 0, startY: 0, locked: null });
  const panelElRef = useRef(null);
  const backdropElRef = useRef(null);
  const animClearedRef = useRef(false);

  // Clear CSS entry animations after they finish so inline styles work during swipe
  useEffect(() => {
    if (!isOpen) { animClearedRef.current = false; return; }
    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;
    if (!panel) return;
    const onEnd = () => {
      panel.style.animation = 'none';
      if (backdrop) backdrop.style.animation = 'none';
      animClearedRef.current = true;
    };
    panel.addEventListener('animationend', onEnd);
    return () => panel.removeEventListener('animationend', onEnd);
  }, [isOpen]);

  const handleSwipeStart = useCallback((e) => {
    if (!e.touches || isClosing) return;
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, locked: null };
  }, [isClosing]);

  const handleSwipeMove = useCallback((e) => {
    if (!e.touches || isClosing) return;
    const s = swipeRef.current;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - s.startX;
    const dy = y - s.startY;

    if (!s.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.locked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (s.locked !== 'h' || dx > 0) return;

    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;
    if (panel) {
      panel.style.willChange = 'transform';
      panel.style.transform = `translateX(${dx}px)`;
    }
    // Fade backdrop proportionally to how far the panel has been dragged
    if (backdrop) {
      const panelW = panel ? panel.offsetWidth : 280;
      const progress = Math.min(1, Math.abs(dx) / panelW);
      backdrop.style.opacity = `${1 - progress}`;
    }
  }, [isClosing]);

  const handleSwipeEnd = useCallback((e) => {
    const s = swipeRef.current;
    if (s.locked !== 'h' || isClosing) {
      swipeRef.current.locked = null;
      return;
    }
    const endX = e.changedTouches?.[0]?.clientX ?? s.startX;
    const dx = endX - s.startX;
    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;

    if (dx <= -80) {
      if (panel) {
        panel.style.transition = 'transform 0.22s ease';
        panel.style.transform = 'translateX(-100%)';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.22s ease';
        backdrop.style.opacity = '0';
      }
      setTimeout(() => {
        if (panel) { panel.style.transform = ''; panel.style.transition = ''; panel.style.willChange = ''; panel.style.animation = ''; }
        if (backdrop) { backdrop.style.opacity = ''; backdrop.style.transition = ''; }
        onClose();
      }, 220);
    } else {
      if (panel) {
        panel.style.transition = 'transform 0.2s ease';
        panel.style.transform = 'translateX(0)';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.2s ease';
        backdrop.style.opacity = '';
      }
      setTimeout(() => {
        if (panel) { panel.style.transition = ''; panel.style.willChange = ''; }
        if (backdrop) { backdrop.style.transition = ''; }
      }, 200);
    }
    swipeRef.current.locked = null;
  }, [isClosing, onClose]);

  // Allow parent to trigger animated close
  useEffect(() => {
    if (requestClose && isOpen && !isClosing) {
      triggerClose();
    }
  }, [requestClose, isOpen, isClosing]);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 600;

  const triggerClose = () => {
    if (isClosing) return;
    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;
    if (isDesktop) {
      if (panel) {
        panel.style.transition = 'opacity 0.22s ease';
        panel.style.opacity = '0';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.22s ease';
        backdrop.style.opacity = '0';
      }
    } else {
      if (panel) {
        panel.style.transition = 'transform 0.26s ease';
        panel.style.transform = 'translateX(-100%)';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.26s ease';
        backdrop.style.opacity = '0';
      }
    }
    setIsClosing(true);
    setTimeout(() => {
      if (panel) { panel.style.transform = ''; panel.style.transition = ''; panel.style.willChange = ''; panel.style.animation = ''; panel.style.opacity = ''; }
      if (backdrop) { backdrop.style.opacity = ''; backdrop.style.transition = ''; backdrop.style.animation = ''; }
      setIsClosing(false);
      onClose();
    }, isDesktop ? 220 : 260);
  };

  const handleOverlayClick = () => {
    triggerClose();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      triggerClose();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className={`sidemenu-overlay ${isClosing ? 'sidemenu-overlay-closing' : ''}`}>
      <div
        className={`sidemenu-panel ${isClosing ? 'sidemenu-panel-closing' : ''}`}
        ref={panelElRef}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
        {/* Profile header */}
        <div className="sidemenu-profile" onClick={() => onOpenProfile && onOpenProfile()} style={{ cursor: 'pointer' }}>
          <div className="sidemenu-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="sidemenu-avatar-placeholder">
                {(user.displayName || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="sidemenu-profile-info">
            <span className="sidemenu-profile-name">{user.displayName}</span>
            <span className="sidemenu-profile-email">{user.email}</span>
          </div>
        </div>

        <div className="sidemenu-items">
          {!isPro ? (
            <div className="sidemenu-pro-banner">
              <div className="sidemenu-pro-banner-text">
                <span className="sidemenu-pro-badge">PRO</span>
                <span className="sidemenu-pro-banner-title">Unlock all features</span>
              </div>
              <span className="sidemenu-pro-banner-subtitle">Custom colors, sounds, shuffle, and more</span>
              <button className="sidemenu-pro-btn" onClick={() => onProTap && onProTap()}>
                Upgrade
              </button>
            </div>
          ) : (
            <div className="sidemenu-item" style={{ opacity: portalLoading ? 0.5 : 1 }} onClick={async () => {
              if (portalLoading) return;
              setPortalLoading(true);
              try {
                const res = await fetch('https://us-central1-tenminutesfromhell.cloudfunctions.net/createPortalSession', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ uid: user.uid }),
                });
                const { url } = await res.json();
                if (url) window.location.href = url;
                else setPortalLoading(false);
              } catch (err) {
                console.error('Portal session error:', err);
                setPortalLoading(false);
              }
            }}>
              {portalLoading ? (
                <span className="pro-popup-cta-spinner" style={{ width: 18, height: 18, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              )}
              <span className="sidemenu-item-label">Manage Plan</span>
              <span className="sidemenu-pro-tag">PRO</span>
            </div>
          )}

          <div className="sidemenu-item" onClick={handleSignOut}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="sidemenu-item-label">Sign Out</span>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={() => { window.open('https://forms.gle/9A23uv92efj2FVAcA', '_blank'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="sidemenu-item-label">Developer Feedback</span>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onTogglePrivate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="sidemenu-item-label">Private account</span>
            <div className={`sidemenu-toggle ${isPrivate === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleAutoShare}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span className="sidemenu-item-label">Auto-Share Workouts</span>
            <div className={`sidemenu-toggle ${autoShareEnabled === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleInAppNotifications}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="sidemenu-item-label">In-App Notifications</span>
            <div className={`sidemenu-toggle ${inAppNotifications !== false ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-color-section">
            <span className="sidemenu-color-header">Timer Colors</span>
            <div className="sidemenu-color-row">
              <div className="sidemenu-color-pair">
                <span className="sidemenu-color-label">Active</span>
                <div
                  className="sidemenu-color-preview"
                  style={{ background: activeColor }}
                  onClick={() => setColorPopup(colorPopup === 'active' ? null : 'active')}
                />
              </div>
              <div className="sidemenu-color-pair">
                <span className="sidemenu-color-label">Rest</span>
                <div
                  className="sidemenu-color-preview"
                  style={{ background: restColor }}
                  onClick={() => setColorPopup(colorPopup === 'rest' ? null : 'rest')}
                />
              </div>
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item sidemenu-item-stepper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="sidemenu-item-label">Prep time</span>
            <div className="sidemenu-stepper">
              <button
                className="sidemenu-stepper-btn"
                onClick={(e) => { e.stopPropagation(); if (prepTime > 0) onPrepTimeChange(prepTime - 5); }}
              >
                −
              </button>
              <span className="sidemenu-stepper-value">{prepTime}s</span>
              <button
                className="sidemenu-stepper-btn"
                onClick={(e) => { e.stopPropagation(); if (prepTime < 30) onPrepTimeChange(prepTime + 5); }}
              >
                +
              </button>
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={() => isPro ? onToggleShuffleExercises() : onProTap && onProTap()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
              <line x1="4" y1="4" x2="9" y2="9"/>
            </svg>
            <span className="sidemenu-item-label">Shuffle exercises {!isPro && <span className="sidemenu-pro-tag">PRO</span>}</span>
            <div className={`sidemenu-toggle ${shuffleExercises === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-sound-section">
            <div className="sidemenu-item" onClick={() => onToggleSoundEnabled && onToggleSoundEnabled()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              <span className="sidemenu-item-label">Sound effects</span>
              <div className={`sidemenu-toggle ${soundEnabled === true ? 'on' : ''}`}>
                <div className="sidemenu-toggle-knob" />
              </div>
            </div>
            {soundEnabled && (
              <div className="sidemenu-sound-names">
                <div className="sidemenu-sound-name-pair" onClick={() => { setSoundPopup('active'); setPendingSound(activeSound); }}>
                  <span className="sidemenu-sound-name-label">Active</span>
                  <span className="sidemenu-sound-name-value">{SOUNDS.find(s => s.id === activeSound)?.name ?? 'Ping'}</span>
                </div>
                <div className="sidemenu-sound-name-pair" onClick={() => { setSoundPopup('rest'); setPendingSound(restSound); }}>
                  <span className="sidemenu-sound-name-label">Rest</span>
                  <span className="sidemenu-sound-name-value">{SOUNDS.find(s => s.id === restSound)?.name ?? 'Chime'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="sidemenu-divider" />

          <div
            className="sidemenu-item"
            onClick={() => onScheduleOpen && onScheduleOpen()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="sidemenu-item-label">Weekly Schedule {!isPro && <span className="sidemenu-pro-tag">PRO</span>}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleActiveLastMinute}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="sidemenu-item-label">Stay active last minute</span>
            <div className={`sidemenu-toggle ${activeLastMinute === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          {isTestAccount && (
            <>
              <div className="sidemenu-divider" />
              <div className="sidemenu-item" onClick={onToggleTestOnboarding}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                <span className="sidemenu-item-label">Onboarding Mode</span>
                <div className={`sidemenu-toggle ${testOnboardingMode ? 'on' : ''}`}>
                  <div className="sidemenu-toggle-knob" />
                </div>
              </div>
            </>
          )}

          {isAdmin && (
            <>
              <div className="sidemenu-divider" />
              <div className="sidemenu-item" onClick={onTogglePro}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span className="sidemenu-item-label">Pro</span>
                <div className={`sidemenu-toggle ${isPro ? 'on' : ''}`}>
                  <div className="sidemenu-toggle-knob" />
                </div>
              </div>
              <div className="sidemenu-divider" />
              <div className="sidemenu-item" onClick={loadAdminStats}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10"/>
                  <path d="M18 20V4"/>
                  <path d="M6 20v-4"/>
                </svg>
                <span className="sidemenu-item-label">Admin</span>
              </div>
            </>
          )}

        </div>

      </div>

      {/* Admin stats popup */}
      {showAdminPopup && (
        <div className="sidemenu-color-popup-overlay" onClick={() => { setShowAdminPopup(false); setAdminDetail(null); }}>
          <div className="sidemenu-admin-popup" onClick={e => e.stopPropagation()}>
            <div className="sidemenu-admin-header">
              <span>Admin Dashboard</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={() => setShowAdminPopup(false)} style={{ cursor: 'pointer', opacity: 0.5 }}>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            {adminLoading ? (
              <div className="sidemenu-admin-loading">Loading stats...</div>
            ) : adminStats?.error ? (
              <div className="sidemenu-admin-loading" style={{ color: '#ff4444' }}>Error: {adminStats.error}</div>
            ) : adminStats ? (
              <>
                <div className="sidemenu-admin-section-label">Users</div>
                <div className="sidemenu-admin-grid">
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    const todayUids = adminStats._activeUsersToday || [];
                    const signals = adminStats._userSignalsToday || {};
                    const todayList = adminStats._users.filter(u => todayUids.includes(u.uid));
                    todayList.sort((a, b) => b.posts - a.posts);
                    const allItems = todayList.map((u, i) => ({
                      rank: i + 1, name: u.name, photo: u.photo, email: u.email, uid: u.uid,
                      value: Object.keys(signals[u.uid] || {}).join(', ') || '—',
                      signals: signals[u.uid] || {},
                    }));
                    openDetail('Active Today', allItems, { signalMap: signals });
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.activeUsersToday}</span>
                    <span className="sidemenu-admin-stat-label">Active Today</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    const activeUids = adminStats._activeUsers7d || [];
                    const signals = adminStats._userSignals7d || {};
                    const activeList = adminStats._users.filter(u => activeUids.includes(u.uid));
                    activeList.sort((a, b) => b.posts - a.posts);
                    const allItems = activeList.map((u, i) => ({
                      rank: i + 1, name: u.name, photo: u.photo, email: u.email, uid: u.uid,
                      value: Object.keys(signals[u.uid] || {}).join(', ') || '—',
                      signals: signals[u.uid] || {},
                    }));
                    openDetail('Active Users (7d)', allItems, { signalMap: signals });
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.activeUsers7d}</span>
                    <span className="sidemenu-admin-stat-label">Active (7d)</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    const todayUids = adminStats._openedAppToday || [];
                    const lastOpened = adminStats._userLastOpened || {};
                    const todayList = adminStats._users.filter(u => todayUids.includes(u.uid));
                    todayList.sort((a, b) => (lastOpened[b.uid] || 0) - (lastOpened[a.uid] || 0));
                    openDetail('Opened App Today', todayList.map((u, i) => {
                      const d = lastOpened[u.uid];
                      return { rank: i + 1, uid: u.uid, name: u.name, photo: u.photo, email: u.email, value: d ? d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—' };
                    }));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.openedAppToday}</span>
                    <span className="sidemenu-admin-stat-label">Opened App Today</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    const uids7d = adminStats._openedApp7d || [];
                    const lastOpened = adminStats._userLastOpened || {};
                    const list7d = adminStats._users.filter(u => uids7d.includes(u.uid));
                    list7d.sort((a, b) => (lastOpened[b.uid] || 0) - (lastOpened[a.uid] || 0));
                    openDetail('Opened App (7d)', list7d.map((u, i) => {
                      const d = lastOpened[u.uid];
                      return { rank: i + 1, uid: u.uid, name: u.name, photo: u.photo, email: u.email, value: d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' };
                    }));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.openedApp7d}</span>
                    <span className="sidemenu-admin-stat-label">Opened App (7d)</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    const sorted = [...adminStats._users].sort((a, b) => (b.signupDate || 0) - (a.signupDate || 0));
                    openDetail('Users by Signup', sorted.map((u, i) => ({
                      rank: i + 1, uid: u.uid, name: u.name, photo: u.photo, email: u.email,
                      value: u.signupDate ? u.signupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value" style={{ fontSize: '0.85rem' }}>{adminStats.newestUser?.name || '—'}</span>
                    <span className="sidemenu-admin-stat-label">Newest User</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('followers', 'Users by Followers', u => u.followers)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalFollows}</span>
                    <span className="sidemenu-admin-stat-label">Total Follows</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    const sorted = [...adminStats._users].sort((a, b) => (b.signupDate || 0) - (a.signupDate || 0));
                    openDetail('All Users', sorted.map((u, i) => ({
                      rank: i + 1, uid: u.uid, name: u.name, photo: u.photo, email: u.email,
                      value: u.signupDate ? u.signupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalUsers}</span>
                    <span className="sidemenu-admin-stat-label">Total Users</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('New Users This Week', (adminStats._newUsersThisWeek || []).map((u, i) => ({
                      rank: i + 1, uid: u.uid, name: u.name, photo: u.photo, email: u.email,
                      value: u.date ? u.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.newUsersThisWeek}</span>
                    <span className="sidemenu-admin-stat-label">New This Week</span>
                  </div>
                </div>

                <div className="sidemenu-admin-section-label">Workouts</div>
                <div className="sidemenu-admin-grid">
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('activeSeconds', 'Users by Active Time', u => formatTime(u.activeSeconds))}>
                    <span className="sidemenu-admin-stat-value">{formatTime(adminStats.totalActiveSeconds)}</span>
                    <span className="sidemenu-admin-stat-label">Total Active Time</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('completions', 'Users by Completions', u => u.completions)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalCompletions}</span>
                    <span className="sidemenu-admin-stat-label">Completions</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('sets', 'Users by Sets', u => u.sets)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalSets}</span>
                    <span className="sidemenu-admin-stat-label">Total Sets</span>
                  </div>
                  <div className="sidemenu-admin-stat">
                    <span className="sidemenu-admin-stat-value">{adminStats.avgSetsPerCompletion}</span>
                    <span className="sidemenu-admin-stat-label">Avg Sets/Completion</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('workoutsCreated', 'Users by Workouts Created', u => `${u.workoutsCreated || 0} created`)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalWorkouts}</span>
                    <span className="sidemenu-admin-stat-label">Workouts Created</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('workoutsForked', 'Users by Workouts Forked', u => `${u.workoutsForked || 0} forked`)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalForked}</span>
                    <span className="sidemenu-admin-stat-label">Forked</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('Workouts by Completions', adminStats._workoutRanking.map((w, i) => ({
                      rank: i + 1, name: w.name, value: `${w.count}x`,
                      onTap: () => {
                        const users = Object.entries(w.users)
                          .map(([uid, cnt]) => {
                            const u = adminStats._users.find(x => x.uid === uid);
                            return { uid, name: u?.name || 'Unknown', photo: u?.photo, email: u?.email, value: `${cnt}x`, cnt };
                          })
                          .sort((a, b) => b.cnt - a.cnt);
                        openDetail(`${w.name} — Completions`, users.map((u, j) => ({ rank: j + 1, ...u })));
                      },
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value" style={{ fontSize: '0.85rem' }}>{adminStats.mostPopularWorkout || '—'}</span>
                    <span className="sidemenu-admin-stat-label">Most Completed ({adminStats.mostPopularCount || 0}x)</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('Workouts by Owners', adminStats._ownershipRanking.map((w, i) => ({
                      rank: i + 1, name: w.name, value: `${w.count} ${w.count === 1 ? 'owner' : 'owners'}`,
                      onTap: () => {
                        const users = w.uids.map(uid => {
                          const u = adminStats._users.find(x => x.uid === uid);
                          return { rank: null, uid, name: u?.name || 'Unknown', photo: u?.photo, email: u?.email, value: '' };
                        });
                        openDetail(`${w.name} — Owners`, users.map((u, j) => ({ ...u, rank: j + 1 })));
                      },
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value" style={{ fontSize: '0.85rem' }}>{adminStats.mostOwnedWorkout?.name || '—'}</span>
                    <span className="sidemenu-admin-stat-label">Most Owned ({adminStats.mostOwnedWorkout?.count || 0})</span>
                  </div>
                </div>

                <div className="sidemenu-admin-section-label">Social</div>
                <div className="sidemenu-admin-grid">
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('posts', 'Users by Posts', u => u.posts)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalPosts}</span>
                    <span className="sidemenu-admin-stat-label">Posts</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('reactionsReceived', 'Users by Reactions Received', u => u.reactionsReceived)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalReactions}</span>
                    <span className="sidemenu-admin-stat-label">Reactions</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('joinsReceived', 'Users by Joins Received', u => u.joinsReceived)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalJoins}</span>
                    <span className="sidemenu-admin-stat-label">Workout Joins</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('sharesSent', 'Users by Shares Sent', u => u.sharesSent)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.workoutsShared}</span>
                    <span className="sidemenu-admin-stat-label">Workouts Shared</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('savesReceived', 'Users by Saves Received', u => u.savesReceived)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.workoutsSaved}</span>
                    <span className="sidemenu-admin-stat-label">Workouts Saved</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => drillUsers('pinned', 'Users by Pinned Workouts', u => u.pinned)}>
                    <span className="sidemenu-admin-stat-value">{adminStats.totalPinned}</span>
                    <span className="sidemenu-admin-stat-label">Workouts Pinned</span>
                  </div>
                </div>

                <div className="sidemenu-admin-section-label-pro">Pro Funnel</div>
                <div className="sidemenu-admin-grid">
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-pro sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('CTA Taps', (adminStats._proInterest || []).map((p, i) => ({
                      rank: i + 1,
                      uid: p.userId,
                      name: p.displayName,
                      photo: null,
                      email: p.email,
                      value: p.createdAt ? p.createdAt.toLocaleDateString() : '',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.proInterestCount || 0}</span>
                    <span className="sidemenu-admin-stat-label">CTA Taps</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-pro sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('Stripe Redirects', (adminStats._stripeRedirects || []).map((p, i) => ({
                      rank: i + 1,
                      uid: p.userId,
                      name: p.displayName,
                      photo: null,
                      email: p.email,
                      value: p.createdAt ? p.createdAt.toLocaleDateString() : '',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.stripeRedirectCount || 0}</span>
                    <span className="sidemenu-admin-stat-label">Stripe Visits</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-pro sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('Trialing Users', (adminStats._proSubscribers || []).filter(u => u.subscriptionStatus === 'trialing').map((u, i) => ({
                      rank: i + 1,
                      name: u.displayName,
                      photo: u.photo,
                      email: u.email,
                      value: u.proSince ? u.proSince.toLocaleDateString() : '',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.proTrialingCount || 0}</span>
                    <span className="sidemenu-admin-stat-label">Trialing</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-pro sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('Paying Users', (adminStats._proSubscribers || []).filter(u => u.subscriptionStatus === 'active').map((u, i) => ({
                      rank: i + 1,
                      name: u.displayName,
                      photo: u.photo,
                      email: u.email,
                      value: u.proSince ? u.proSince.toLocaleDateString() : '',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.proActiveCount || 0}</span>
                    <span className="sidemenu-admin-stat-label">Paying</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-pro sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('Canceled Users', (adminStats._proSubscribers || []).filter(u => u.subscriptionStatus === 'canceled').map((u, i) => ({
                      rank: i + 1,
                      name: u.displayName,
                      photo: u.photo,
                      email: u.email,
                      value: u.proSince ? u.proSince.toLocaleDateString() : '',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.proCanceledCount || 0}</span>
                    <span className="sidemenu-admin-stat-label">Canceled</span>
                  </div>
                  <div className="sidemenu-admin-stat sidemenu-admin-stat-pro sidemenu-admin-stat-tap" onClick={() => {
                    openDetail('Refunded Users', (adminStats._proRefunded || []).map((u, i) => ({
                      rank: i + 1,
                      uid: u.uid,
                      name: u.displayName,
                      photo: u.photo,
                      email: u.email,
                      value: u.refundedAt ? u.refundedAt.toLocaleDateString() : '',
                    })));
                  }}>
                    <span className="sidemenu-admin-stat-value">{adminStats.proRefundedCount || 0}</span>
                    <span className="sidemenu-admin-stat-label">Refunded</span>
                  </div>
                </div>

                <div className="sidemenu-admin-section-label">Retention</div>
                <div className="sidemenu-admin-grid">
                  {[{ label: '7 Day', data: adminStats.retention7 }, { label: '30 Day', data: adminStats.retention30 }].map(({ label, data }) => (
                    <div key={label} className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                      const retained = (data.retained || []).map(uid => {
                        const u = adminStats._users.find(x => x.uid === uid);
                        return { uid, name: u?.name || 'Unknown', photo: u?.photo, email: u?.email, value: formatTime(u?.activeSeconds || 0) };
                      });
                      const churned = (data.churned || []).map(uid => {
                        const u = adminStats._users.find(x => x.uid === uid);
                        return { uid, name: u?.name || 'Unknown', photo: u?.photo, email: u?.email, value: 'churned' };
                      });
                      openDetail(`${label} Retention — ${data.pct}%`, [
                        ...retained.map((r, i) => ({ rank: i + 1, ...r })),
                        ...churned.map((c, i) => ({ rank: retained.length + i + 1, ...c })),
                      ]);
                    }}>
                      <span className="sidemenu-admin-stat-value">{data.pct}%</span>
                      <span className="sidemenu-admin-stat-label">{label} ({data.retainedCount} / {data.retainedCount + data.churnedCount})</span>
                    </div>
                  ))}
                </div>

                {[{ label: '7 Day Adoption', data: adminStats.adoption7 }, { label: '30 Day Adoption', data: adminStats.adoption30 }].map(({ label, data }) => (
                  data.eligible > 0 && <React.Fragment key={label}>
                    <div className="sidemenu-admin-section-label">{label} ({data.eligible} users)</div>
                    <div className="sidemenu-admin-grid">
                      {Object.values(data.features).map(f => (
                        <div key={f.label} className="sidemenu-admin-stat sidemenu-admin-stat-tap" onClick={() => {
                          const adopted = f.adopted.map(uid => {
                            const u = adminStats._users.find(x => x.uid === uid);
                            return { uid, name: u?.name || 'Unknown', photo: u?.photo, email: u?.email, value: 'yes' };
                          });
                          const not = f.notAdopted.map(uid => {
                            const u = adminStats._users.find(x => x.uid === uid);
                            return { uid, name: u?.name || 'Unknown', photo: u?.photo, email: u?.email, value: '—' };
                          });
                          openDetail(`${f.label} — ${label}`, [
                            ...adopted.map((r, i) => ({ rank: i + 1, ...r })),
                            ...not.map((r, i) => ({ rank: adopted.length + i + 1, ...r })),
                          ]);
                        }}>
                          <span className="sidemenu-admin-stat-value">{f.pct}%</span>
                          <span className="sidemenu-admin-stat-label">{f.label}</span>
                        </div>
                      ))}
                    </div>
                  </React.Fragment>
                ))}

                <div
                  className="sidemenu-admin-ga-link"
                  onClick={() => window.open('https://analytics.google.com/analytics/web/', '_blank')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  <span>Open Google Analytics</span>
                </div>
                <div
                  className="sidemenu-admin-ga-link"
                  onClick={() => window.open('https://docs.google.com/spreadsheets/d/1yOkKrvjObVx_ph3rCX_chIkX4l1F1rA6qW--EFXQO3o/edit?resourcekey=&gid=351051000#gid=351051000', '_blank')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  <span>Dev Feedback Responses</span>
                </div>

                <div
                  className="sidemenu-admin-ga-link"
                  onClick={() => setTestEmailOpen(!testEmailOpen)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span>Test Emails</span>
                </div>
                {testEmailOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {[
                      { key: 'welcome', label: 'Welcome' },
                      { key: 'pro_confirmed', label: 'Pro Confirmed' },
                      { key: 'trial_ending', label: 'Trial Ending' },
                      { key: 'payment_failed', label: 'Payment Failed' },
                      { key: 'all', label: 'Send All' },
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        className="sidemenu-admin-ga-link"
                        style={{ opacity: testEmailSending === key ? 0.5 : 1, justifyContent: 'center' }}
                        onClick={async () => {
                          if (testEmailSending) return;
                          setTestEmailSending(key);
                          try {
                            await fetch('https://us-central1-tenminutesfromhell.cloudfunctions.net/sendTestEmail', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: 'jarongwenger@gmail.com', type: key }),
                            });
                          } catch (_) {}
                          setTestEmailSending(null);
                        }}
                      >
                        {testEmailSending === key
                          ? <span className="pro-popup-cta-spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
                          : <span>{label}</span>
                        }
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Admin detail drill-down (overlays on top of dashboard) */}
      {adminDetail && (
        <div className="sidemenu-admin-detail-overlay" onClick={(e) => { e.stopPropagation(); closeDetail(); }}>
          <div className="sidemenu-admin-popup sidemenu-admin-detail-popup" onClick={e => e.stopPropagation()}>
            <div className="sidemenu-admin-header">
              <div className="sidemenu-admin-back" onClick={closeDetail}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </div>
              <span>{adminDetail.title}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={closeDetail} style={{ cursor: 'pointer', opacity: 0.5 }}>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            {adminDetail.signalMap && (() => {
              const SIGNAL_LABELS = { all: 'All', completed: 'Completed', posted: 'Posted', edited: 'Edited', reacted: 'Reacted', followed: 'Followed', shared: 'Shared', joined: 'Joined', settings: 'Settings', library: 'Library' };
              const signalCounts = {};
              adminDetail.items.forEach(item => {
                Object.keys(item.signals || {}).forEach(s => { signalCounts[s] = (signalCounts[s] || 0) + 1; });
              });
              const activeSignals = Object.keys(SIGNAL_LABELS).filter(s => s === 'all' || signalCounts[s]);
              return (
                <div className="sidemenu-admin-filter-row" style={{ display: 'flex', gap: '6px', padding: '8px 16px', overflowX: 'auto', flexShrink: 0 }}>
                  {activeSignals.map(s => (
                    <div
                      key={s}
                      onClick={() => setAdminDetailFilter(s)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        background: adminDetailFilter === s ? 'rgba(255,255,255,0.15)' : 'transparent',
                        color: adminDetailFilter === s ? '#fff' : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${adminDetailFilter === s ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      }}
                    >
                      {SIGNAL_LABELS[s]}{s !== 'all' ? ` (${signalCounts[s]})` : ''}
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="sidemenu-admin-detail-list">
              {(adminDetailFilter === 'all' ? adminDetail.items : adminDetail.items.filter(item => item.signals?.[adminDetailFilter])).map((item, i) => (
                <div key={item.uid || i} className={`sidemenu-admin-detail-row${(item.onTap || item.uid) ? ' sidemenu-admin-detail-row-tap' : ''}`} style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }} onClick={item.onTap || (item.uid ? () => setAdminProfileUser({ uid: item.uid, displayName: item.name, photoURL: item.photo || null }) : undefined)}>
                  <span className="sidemenu-admin-detail-rank">{i + 1}</span>
                  {item.photo !== undefined && (
                    <div className="sidemenu-admin-detail-avatar">
                      {item.photo ? (
                        <img src={item.photo} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="sidemenu-admin-detail-avatar-placeholder">
                          {(item.name || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="sidemenu-admin-detail-name-col">
                    <span className="sidemenu-admin-detail-name">{item.name}</span>
                    {item.email && <span className="sidemenu-admin-detail-email">{item.email}</span>}
                  </div>
                  <span className="sidemenu-admin-detail-value">{adminDetailFilter !== 'all' && item.signals?.[adminDetailFilter] ? `${item.signals[adminDetailFilter]}×` : item.value}</span>
                </div>
              ))}
              {adminDetail.items.length === 0 && (
                <div className="sidemenu-admin-loading">No data</div>
              )}
            </div>
          </div>
        </div>
      )}

      {adminProfileUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10001 }}>
          <ProfilePopup
            profile={adminProfileUser}
            user={user}
            onClose={() => setAdminProfileUser(null)}
          />
        </div>
      )}

      {/* Color picker popup — fixed center of screen */}
      {colorPopup && (
        <div className="sidemenu-color-popup-overlay" onClick={() => setColorPopup(null)}>
          <div className="sidemenu-color-popup" onClick={e => e.stopPropagation()}>
            <div className="sidemenu-color-popup-swatches">
              {[
                ...(colorPopup === 'active' ? [ACTIVE_DEFAULT, REST_DEFAULT] : [REST_DEFAULT, ACTIVE_DEFAULT]),
                ...OTHER_COLORS
              ].map(hex => (
                <div
                  key={hex}
                  className={`sidemenu-swatch ${(colorPopup === 'active' ? activeColor : restColor) === hex ? 'selected' : ''}`}
                  style={{ background: hex }}
                  onClick={() => { onColorChange(colorPopup, hex); setColorPopup(null); }}
                />
              ))}
            </div>
            {!isPro && <div className="sidemenu-color-pro-label" onClick={() => { setColorPopup(null); onProTap && onProTap(); }}><span className="sidemenu-color-pro-line" /><span>PRO</span><span className="sidemenu-color-pro-line" /></div>}
            <div
              className={`sidemenu-color-popup-swatches ${!isPro ? 'sidemenu-pro-locked-colors' : ''}`}
              onClick={() => { if (!isPro) { setColorPopup(null); onProTap && onProTap(); } }}
            >
              {NEON_COLORS.map(hex => (
                <div
                  key={hex}
                  className={`sidemenu-swatch ${(colorPopup === 'active' ? activeColor : restColor) === hex ? 'selected' : ''}`}
                  style={{ background: hex }}
                  onClick={(e) => { if (!isPro) return; e.stopPropagation(); onColorChange(colorPopup, hex); setColorPopup(null); }}
                />
              ))}
            </div>
            <div
              className={`sidemenu-color-popup-swatches ${!isPro ? 'sidemenu-pro-locked-colors' : ''}`}
              onClick={() => { if (!isPro) { setColorPopup(null); onProTap && onProTap(); } }}
            >
              {EARTH_COLORS.map(hex => (
                <div
                  key={hex}
                  className={`sidemenu-swatch ${(colorPopup === 'active' ? activeColor : restColor) === hex ? 'selected' : ''}`}
                  style={{ background: hex }}
                  onClick={(e) => { if (!isPro) return; e.stopPropagation(); onColorChange(colorPopup, hex); setColorPopup(null); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sound picker popup */}
      {soundPopup && (
        <div className="sidemenu-color-popup-overlay" onClick={() => setSoundPopup(null)}>
          <div className="sidemenu-sound-popup" onClick={e => e.stopPropagation()}>
            <div className="sidemenu-sound-popup-title">{soundPopup === 'active' ? 'Active Sound' : 'Rest Sound'}</div>
            <div className="sidemenu-sound-options-grid">
              {SOUNDS.filter(s => !s.pro).map(sound => {
                const isSelected = pendingSound === sound.id;
                return (
                  <div
                    key={sound.id}
                    className={`sidemenu-sound-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => { unlockAudio(); sound.play(); setPendingSound(sound.id); }}
                  >
                    <span>{sound.name}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            {!isPro && (
              <div className="sidemenu-color-pro-label" onClick={() => { setSoundPopup(null); onProTap && onProTap(); }}>
                <span className="sidemenu-color-pro-line" />
                <span>PRO</span>
                <span className="sidemenu-color-pro-line" />
              </div>
            )}
            <div className={`sidemenu-sound-options-grid ${!isPro ? 'sidemenu-pro-locked-sounds' : ''}`}>
              {SOUNDS.filter(s => s.pro).map(sound => {
                const isSelected = pendingSound === sound.id;
                return (
                  <div
                    key={sound.id}
                    className={`sidemenu-sound-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => { unlockAudio(); sound.play(); setPendingSound(sound.id); }}
                  >
                    <span>{sound.name}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="sidemenu-sound-popup-footer">
              <button className="sidemenu-sound-save-btn" onClick={() => {
                const selectedSound = SOUNDS.find(s => s.id === pendingSound);
                if (selectedSound?.pro && !isPro) {
                  setSoundPopup(null);
                  onProTap && onProTap();
                  return;
                }
                if (soundPopup === 'active') onActiveSoundChange && onActiveSoundChange(pendingSound);
                else onRestSoundChange && onRestSoundChange(pendingSound);
                setSoundPopup(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Tap outside to close */}
      <div
        className="sidemenu-backdrop"
        ref={backdropElRef}
        onClick={handleOverlayClick}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      />
    </div>
  );
};

export default SideMenu;
