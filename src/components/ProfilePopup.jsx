import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { getUserProfiles, getFollowing, getFollowers, getAllPreferences, createSaveNotification, followUser, unfollowUser, createFollowRequest, cancelFollowRequest } from '../firebase/social';
import { getUserHistory, addLibraryRef, createWorkoutV2, getWorkoutV2, getWorkoutsBatchV2 } from '../firebase/firestore';
import { DEFAULT_TIMER_WORKOUTS, DEFAULT_STOPWATCH_WORKOUTS } from '../data/defaultWorkouts';
import './StatsPage.css';

const buildCalendarGrid = (dailyMap) => {
  const today = new Date();
  const year = today.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const startDay = new Date(jan1);
  startDay.setDate(jan1.getDate() - jan1.getDay());
  const dec31 = new Date(year, 11, 31);
  const endDay = new Date(dec31);
  endDay.setDate(dec31.getDate() + (6 - dec31.getDay()));

  const weeks = [];
  const monthLabels = [];
  let currentDate = new Date(startDay);
  let weekIndex = 0;
  let todayWeekIndex = 0;

  while (currentDate <= endDay) {
    const week = [];
    for (let day = 0; day < 7; day++) {
      if (currentDate <= endDay) {
        const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const isFuture = currentDate > today;
        if (currentDate.toDateString() === today.toDateString()) {
          todayWeekIndex = weekIndex;
        }
        week.push({ date: key, count: dailyMap[key] || 0, isFuture });
        if (currentDate.getDate() <= 7 && day === 0) {
          monthLabels.push({
            weekIndex,
            label: currentDate.toLocaleString('default', { month: 'short' })
          });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
    weekIndex++;
  }

  return { weeks, monthLabels, numWeeks: weeks.length, todayWeekIndex };
};

const getHeatColor = (count, isFuture) => {
  if (isFuture) return 'var(--heat-empty)';
  if (count === 0) return 'var(--heat-empty)';
  if (count === 1) return 'var(--heat-1)';
  if (count === 2) return 'var(--heat-2)';
  if (count === 3) return 'var(--heat-3)';
  return 'var(--heat-4)';
};

// Build a custom heatmap grid that spells "HIITem" using pixel art
const buildHIITemGrid = () => {
  // Each letter is defined as [colOffset, row] pairs in a 7-row grid
  // H(5) gap I(3) gap I(3) gap T(5) gap e(5) gap m(5) = 31 cols + 5 gaps = 36 cols
  const START = 8; // center in ~53-week grid
  const letters = [];
  let col = START;

  // H (5 wide)
  const H = [];
  for (let r = 0; r < 7; r++) { H.push([0, r]); H.push([4, r]); }
  for (let c = 1; c <= 3; c++) H.push([c, 3]);
  letters.push({ offset: col, cells: H }); col += 6;

  // I (3 wide)
  const I1 = [];
  for (let c = 0; c <= 2; c++) { I1.push([c, 0]); I1.push([c, 6]); }
  for (let r = 1; r <= 5; r++) I1.push([1, r]);
  letters.push({ offset: col, cells: I1 }); col += 4;

  // I (3 wide)
  letters.push({ offset: col, cells: [...I1] }); col += 4;

  // T (5 wide)
  const T = [];
  for (let c = 0; c <= 4; c++) T.push([c, 0]);
  for (let r = 1; r <= 6; r++) T.push([2, r]);
  letters.push({ offset: col, cells: T }); col += 6;

  // e (5 wide, lowercase rows 2-6)
  const E = [[1,2],[2,2],[3,2], [0,3],[4,3], [0,4],[1,4],[2,4],[3,4],[4,4], [0,5], [1,6],[2,6],[3,6]];
  letters.push({ offset: col, cells: E }); col += 6;

  // m (5 wide, lowercase rows 2-6)
  const M = [[0,2],[1,2],[2,2],[3,2],[4,2], [0,3],[2,3],[4,3], [0,4],[2,4],[4,4], [0,5],[2,5],[4,5], [0,6],[2,6],[4,6]];
  letters.push({ offset: col, cells: M });

  // Build the grid (53 weeks × 7 days) with varying intensities per letter
  const numWeeks = 53;
  const filledMap = {}; // "col,row" → count (1-4)
  let totalCells = 0;
  // Each letter gets a base intensity that shifts across, creating a gradient
  const letterIntensities = [3, 3, 3, 3, 3, 3]; // H I I T e m
  letters.forEach(({ offset, cells }, li) => {
    const base = letterIntensities[li];
    cells.forEach(([c, r]) => {
      // Vary within each letter based on position
      const variation = ((c + r + li) % 3); // 0, 1, or 2
      const count = Math.max(1, Math.min(4, base + variation - 1));
      filledMap[`${offset + c},${r}`] = count;
      totalCells++;
    });
  });

  const weeks = [];
  for (let wi = 0; wi < numWeeks; wi++) {
    const week = [];
    for (let di = 0; di < 7; di++) {
      week.push({
        date: `hiitem-${wi}-${di}`,
        count: filledMap[`${wi},${di}`] || 0,
        isFuture: false
      });
    }
    weeks.push(week);
  }

  // Build month labels matching the real calendar layout
  const year = new Date().getFullYear();
  const jan1 = new Date(year, 0, 1);
  const startDay = new Date(jan1);
  startDay.setDate(jan1.getDate() - jan1.getDay());
  const monthLabels = [];
  const labelDate = new Date(startDay);
  for (let wi = 0; wi < numWeeks; wi++) {
    for (let di = 0; di < 7; di++) {
      if (labelDate.getDate() <= 7 && di === 0) {
        monthLabels.push({
          weekIndex: wi,
          label: labelDate.toLocaleString('default', { month: 'short' })
        });
      }
      labelDate.setDate(labelDate.getDate() + 1);
    }
  }

  // Center the scroll on the text (middle of the spelled word)
  const midCol = START + 18;
  return { weeks, monthLabels, numWeeks, todayWeekIndex: midCol, totalCells };
};

const ProfilePopup = ({ profile, user, allWorkouts = [], onClose, onStartWorkout, onWorkoutAdded, onShareWorkout, onFollowChanged, prepTime = 15, globalRestTime = 15, pendingFollowRequests = {}, onPendingFollowRequestsChange, onFindPeople }) => {
  const [activeProfile, setActiveProfile] = useState(profile);
  const [profileFollowing, setProfileFollowing] = useState(0);
  const [profileFollowers, setProfileFollowers] = useState(0);
  const [closing, setClosing] = useState(false);
  const [stats, setStats] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [pinnedWorkouts, setPinnedWorkouts] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);
  const [takenWorkouts, setTakenWorkouts] = useState({});
  const [savingWorkouts, setSavingWorkouts] = useState({});
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);

  const calendarScrollRef = useRef(null);
  const ppPanelRef = useRef(null);
  const panelHeightRef = useRef(null);
  const skipFadeRef = useRef(false);

  // Detail popup state
  const [detailWorkout, setDetailWorkout] = useState(null);
  const [detailPhase, setDetailPhase] = useState(null);
  const [detailRect, setDetailRect] = useState(null);
  const detailPanelRef = useRef(null);
  const cardRefs = useRef({});

  // Follow list within popup
  const [followListType, setFollowListType] = useState(null);
  const [followListProfiles, setFollowListProfiles] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListClosing, setFollowListClosing] = useState(false);
  const [followListSearch, setFollowListSearch] = useState('');
  const followPanelRef = useRef(null);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const animatePanelHeight = useCallback((ref) => {
    const panel = ref.current;
    if (!panel) return;
    const fromH = panel.getBoundingClientRect().height;
    panel.style.height = '';
    panel.style.minHeight = '';
    panel.style.transition = 'none';
    const toH = panel.scrollHeight;
    if (Math.abs(fromH - toH) < 2) {
      panel.style.transition = '';
      return;
    }
    panel.style.height = fromH + 'px';
    panel.style.overflow = 'hidden';
    // eslint-disable-next-line no-unused-expressions
    panel.offsetHeight;
    panel.style.transition = 'height 0.3s ease';
    panel.style.height = toH + 'px';
    const onEnd = () => {
      panel.style.height = '';
      panel.style.overflow = '';
      panel.style.transition = '';
      panel.removeEventListener('transitionend', onEnd);
    };
    panel.addEventListener('transitionend', onEnd);
  }, []);

  // Keep allWorkouts in a ref to avoid re-triggering the fetch
  const allWorkoutsRef = useRef(allWorkouts);
  allWorkoutsRef.current = allWorkouts;

  // Drill into a new profile from the follow list
  const drillIntoProfile = useCallback((newProfile) => {
    // Skip fade-in since overlay is already visible
    skipFadeRef.current = true;
    // Close detail if open
    setDetailWorkout(null);
    setDetailPhase(null);
    // Animate follow list panel out (backdrop is transparent, so no brightness change)
    setFollowListClosing(true);
    setTimeout(() => {
      setFollowListType(null);
      setFollowListClosing(false);
      setFollowListProfiles([]);
      setFollowListSearch('');
      // Reset data and swap profile after panel animates out
      setProfileFollowing(0);
      setProfileFollowers(0);
      setIsFollowingProfile(false);
      setStats(null);
      setCalendar(null);
      setPinnedWorkouts([]);
      setCompletions({});
      setSavingWorkouts({});
      setActiveProfile(newProfile);
    }, 200);
  }, []);

  const isHIITemProfile = activeProfile?.uid === 'hiitem';

  // Load profile data
  useEffect(() => {
    if (!activeProfile) return;
    let cancelled = false;

    // HIITem synthetic profile — no Firestore data
    if (activeProfile.uid === 'hiitem') {
      const grid = buildHIITemGrid();
      setStats({ totalHours: 20, totalMinutes: 25 });
      setCalendar(grid);
      setLoading(false);
      return;
    }

    if (activeProfile.uid !== user?.uid) {
      const taken = {};
      allWorkoutsRef.current.forEach(w => {
        if (w.creatorUid === activeProfile.uid) taken[w.name] = true;
      });
      setTakenWorkouts(taken);
    } else {
      setTakenWorkouts({});
    }

    setLoading(true);
    (async () => {
      try {
        // Fetch prefs+pinned in one chain, parallel with everything else
        const [following, followers, userHistory, [fullProfile], resolvedPinned] = await Promise.all([
          getFollowing(activeProfile.uid),
          getFollowers(activeProfile.uid),
          getUserHistory(activeProfile.uid),
          getUserProfiles([activeProfile.uid]),
          (async () => {
            const prefs = await getAllPreferences(activeProfile.uid);
            const pinnedIds = prefs.pinnedWorkouts || [];
            if (pinnedIds.length === 0) return [];
            const v2Docs = await getWorkoutsBatchV2(pinnedIds);
            const workoutMap = {};
            v2Docs.forEach(w => { workoutMap[w.id] = w; });
            if (Object.keys(workoutMap).length < pinnedIds.length) {
              const allDefaults = [...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS];
              allDefaults.forEach(w => { if (w.id && !workoutMap[w.id]) workoutMap[w.id] = w; });
            }
            return pinnedIds.map(id => workoutMap[id]).filter(Boolean);
          })()
        ]);
        if (cancelled) return;
        // Merge full profile data (including isPrivate) into activeProfile
        if (fullProfile) {
          setActiveProfile(prev => ({ ...prev, ...fullProfile }));
        }
        setProfileFollowing(following.length);
        setProfileFollowers(followers.length);
        setIsFollowingProfile(followers.includes(user?.uid));

        const totalSeconds = userHistory.reduce((sum, e) => sum + (e.duration || 0), 0);
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
        const dailyMap = {};
        userHistory.forEach(e => {
          const d = e.completedAt || e.date;
          if (!d) return;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          dailyMap[key] = (dailyMap[key] || 0) + 1;
        });
        setStats({ totalHours, totalMinutes, dailyMap });

        const completionMap = {};
        userHistory.forEach(h => {
          if (h.workoutName) completionMap[h.workoutName] = (completionMap[h.workoutName] || 0) + 1;
        });
        setCompletions(completionMap);

        setCalendar(buildCalendarGrid(dailyMap));
        if (resolvedPinned.length > 0) setPinnedWorkouts(resolvedPinned);
      } catch (err) {
        console.error('Failed to load user profile:', err);
      }
      if (!cancelled) {
        if (ppPanelRef.current) {
          panelHeightRef.current = ppPanelRef.current.offsetHeight;
        }
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.uid, user?.uid]);

  // Animate panel height when data loads
  useLayoutEffect(() => {
    const panel = ppPanelRef.current;
    const fromH = panelHeightRef.current;
    if (!panel || !fromH || loading) return;

    const toH = panel.scrollHeight;
    panelHeightRef.current = null;

    if (Math.abs(fromH - toH) < 4) return;

    panel.style.height = fromH + 'px';
    panel.style.overflow = 'hidden';
    panel.style.transition = 'none';
    // eslint-disable-next-line no-unused-expressions
    panel.offsetHeight;
    panel.style.transition = 'height 0.3s ease';
    panel.style.height = toH + 'px';

    const onEnd = () => {
      panel.style.height = '';
      panel.style.overflow = '';
      panel.style.transition = '';
      panel.removeEventListener('transitionend', onEnd);
    };
    panel.addEventListener('transitionend', onEnd);
    return () => panel.removeEventListener('transitionend', onEnd);
  }, [loading, calendar, pinnedWorkouts, isFollowingProfile]);

  // Auto-scroll heatmap to today
  useEffect(() => {
    if (!calendar) return;
    const el = calendarScrollRef.current;
    if (!el) return;
    const cellWidth = 14;
    const todayIdx = calendar.todayWeekIndex ?? 0;
    const scrollTarget = (todayIdx + 1) * cellWidth - el.clientWidth;
    el.scrollLeft = Math.max(0, scrollTarget);
  }, [calendar]);

  const handleClose = useCallback(() => {
    skipFadeRef.current = false;
    setClosing(true);
    setFollowListType(null);
    setFollowListProfiles([]);
    setTimeout(() => {
      if (onClose) onClose();
    }, 260);
  }, [onClose]);

  // ── Detail popup (FLIP) ──
  const openDetail = useCallback((workout) => {
    const el = cardRefs.current[workout.name];
    const rect = el ? el.getBoundingClientRect() : null;
    setDetailRect(rect);
    setDetailWorkout(workout);
    setDetailPhase('entering');
  }, []);

  useLayoutEffect(() => {
    if (detailPhase !== 'entering' || !detailPanelRef.current) return;

    if (!detailRect) {
      setDetailPhase('open');
      return;
    }

    const panel = detailPanelRef.current;
    const panelRect = panel.getBoundingClientRect();

    const dx = (detailRect.left + detailRect.width / 2) - (panelRect.left + panelRect.width / 2);
    const dy = (detailRect.top + detailRect.height / 2) - (panelRect.top + panelRect.height / 2);
    const sx = detailRect.width / panelRect.width;
    const sy = detailRect.height / panelRect.height;

    panel.style.transition = 'none';
    panel.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(255, 59, 48, 0.1)';
    panel.style.borderColor = 'rgba(255, 59, 48, 0.3)';

    // eslint-disable-next-line no-unused-expressions
    panel.offsetHeight;

    panel.style.transition = [
      'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
      'border-radius 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
      'background 0.28s ease 0.1s',
      'border-color 0.28s ease 0.1s'
    ].join(', ');
    panel.style.transform = 'none';
    panel.style.borderRadius = '';
    panel.style.background = '';
    panel.style.borderColor = '';

    const timer = setTimeout(() => {
      panel.style.transition = '';
      panel.style.transform = '';
      setDetailPhase('open');
    }, 400);

    return () => clearTimeout(timer);
  }, [detailPhase, detailRect]);

  const closeDetail = useCallback(() => {
    if (detailPhase === 'leaving') return;

    const panel = detailPanelRef.current;
    if (!panel) {
      setDetailWorkout(null);
      setDetailPhase(null);
      return;
    }

    setDetailPhase('leaving');

    const cardEl = detailWorkout?.name ? cardRefs.current[detailWorkout.name] : null;
    const targetRect = cardEl ? cardEl.getBoundingClientRect() : detailRect;

    if (!targetRect) {
      setTimeout(() => { setDetailWorkout(null); setDetailPhase(null); }, 230);
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (panelRect.left + panelRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (panelRect.top + panelRect.height / 2);
    const sx = targetRect.width / panelRect.width;
    const sy = targetRect.height / panelRect.height;

    panel.style.transition = [
      'transform 0.22s cubic-bezier(0.2, 0, 0.6, 1)',
      'border-radius 0.22s cubic-bezier(0.2, 0, 0.6, 1)',
      'background 0.15s ease',
      'border-color 0.15s ease'
    ].join(', ');
    panel.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(255, 59, 48, 0.1)';
    panel.style.borderColor = 'rgba(255, 59, 48, 0.3)';

    setTimeout(() => {
      setDetailWorkout(null);
      setDetailPhase(null);
    }, 230);
  }, [detailPhase, detailWorkout, detailRect]);

  // ── Follow list ──
  const openFollowList = async (type) => {
    setFollowListType(type);
    setFollowListLoading(true);
    setFollowListClosing(false);
    setFollowListProfiles([]);
    setFollowListSearch('');
    try {
      const ids = type === 'following'
        ? await getFollowing(activeProfile.uid)
        : await getFollowers(activeProfile.uid);
      const profiles = await getUserProfiles(ids);
      const panel = followPanelRef.current;
      if (panel) {
        panel.style.height = panel.getBoundingClientRect().height + 'px';
        panel.style.overflow = 'hidden';
        panel.style.transition = 'none';
      }
      setFollowListProfiles(profiles);
    } catch (err) {
      console.error('Failed to load follow list:', err);
    }
    setFollowListLoading(false);
    requestAnimationFrame(() => requestAnimationFrame(() => animatePanelHeight(followPanelRef)));
  };

  const switchFollowListTab = async (type) => {
    if (type === followListType) return;
    const panel = followPanelRef.current;
    if (panel) {
      panel.style.height = panel.getBoundingClientRect().height + 'px';
      panel.style.minHeight = '';
      panel.style.transition = 'none';
    }
    setFollowListType(type);
    setFollowListSearch('');
    try {
      const ids = type === 'following'
        ? await getFollowing(activeProfile.uid)
        : await getFollowers(activeProfile.uid);
      const profiles = await getUserProfiles(ids);
      setFollowListProfiles(profiles);
      requestAnimationFrame(() => requestAnimationFrame(() => animatePanelHeight(followPanelRef)));
    } catch (err) {
      console.error('Failed to load follow list:', err);
    }
  };

  const closeFollowList = () => {
    setFollowListClosing(true);
    setTimeout(() => {
      setFollowListType(null);
      setFollowListClosing(false);
      setFollowListProfiles([]);
      setFollowListSearch('');
    }, 200);
  };

  // ── Take workout ──
  const handleTakeWorkout = async (workout) => {
    if (!user || savingWorkouts[workout.name]) return;
    if (takenWorkouts[workout.name]) {
      closeDetail();
      handleClose();
      if (onStartWorkout) onStartWorkout(workout.name);
      return;
    }
    setSavingWorkouts(prev => ({ ...prev, [workout.name]: true }));
    try {
      // V2: if the workout has an ID in the top-level collection, add a library reference (live-linked)
      if (workout.id) {
        const existingDoc = await getWorkoutV2(workout.id);
        if (existingDoc && !existingDoc.ownerDeleted) {
          // Live-link: reference the existing workout doc
          await addLibraryRef(user.uid, workout.id, 'saved');
        } else {
          // Workout doc missing or frozen — create a new one owned by user
          const newId = await createWorkoutV2(user.uid, {
            name: workout.name,
            type: workout.type,
            exercises: workout.exercises,
            isCustom: true,
            tags: workout.tags || null,
            restTime: workout.restTime ?? null,
            creatorUid: activeProfile?.uid || null,
            creatorName: activeProfile?.displayName || null,
            creatorPhotoURL: activeProfile?.photoURL || null,
          });
          await addLibraryRef(user.uid, newId, 'saved');
        }
      } else {
        // No workout ID — create new doc (legacy path)
        const newId = await createWorkoutV2(user.uid, {
          name: workout.name,
          type: workout.type,
          exercises: workout.exercises,
          isCustom: true,
          tags: workout.tags || null,
          restTime: workout.restTime ?? null,
          creatorUid: activeProfile?.uid || null,
          creatorName: activeProfile?.displayName || null,
          creatorPhotoURL: activeProfile?.photoURL || null,
        });
        await addLibraryRef(user.uid, newId, 'saved');
      }
      setTakenWorkouts(prev => ({ ...prev, [workout.name]: true }));
      if (onWorkoutAdded) onWorkoutAdded();
      createSaveNotification({
        recipientUid: activeProfile?.uid,
        actorUid: user.uid,
        actorName: user.displayName,
        actorPhotoURL: user.photoURL,
        workoutName: workout.name,
        workoutId: workout.id || null,
        source: 'pinned'
      }).catch(err => console.error('Save notif failed:', err));
    } catch (err) {
      console.error('Failed to take workout:', err);
    } finally {
      setSavingWorkouts(prev => ({ ...prev, [workout.name]: false }));
    }
  };

  const handleFollowToggle = async () => {
    if (!user || isFollowingProfile) return;
    // Cancel pending follow request
    if (pendingFollowRequests[activeProfile.uid]) {
      const notifId = pendingFollowRequests[activeProfile.uid];
      if (onPendingFollowRequestsChange) {
        onPendingFollowRequestsChange(prev => {
          const next = { ...prev };
          delete next[activeProfile.uid];
          return next;
        });
      }
      try {
        await cancelFollowRequest(notifId, user.uid);
      } catch (err) {
        console.error('Cancel follow request failed:', err);
        if (onPendingFollowRequestsChange) {
          onPendingFollowRequestsChange(prev => ({ ...prev, [activeProfile.uid]: notifId }));
        }
      }
      return;
    }
    // Check if target has a private account
    if (activeProfile.isPrivate) {
      try {
        const notifId = await createFollowRequest({
          requesterUid: user.uid,
          requesterName: user.displayName,
          requesterPhotoURL: user.photoURL,
          targetUid: activeProfile.uid
        });
        if (notifId && onPendingFollowRequestsChange) {
          onPendingFollowRequestsChange(prev => ({ ...prev, [activeProfile.uid]: notifId }));
        }
      } catch (err) {
        console.error('Follow request failed:', err);
      }
      return;
    }
    if (ppPanelRef.current) {
      panelHeightRef.current = ppPanelRef.current.offsetHeight;
    }
    setIsFollowingProfile(true);
    setProfileFollowers(prev => prev + 1);
    try {
      await followUser(user.uid, activeProfile.uid);
      if (onFollowChanged) onFollowChanged(activeProfile.uid);
    } catch (err) {
      console.error('Follow failed:', err);
      setIsFollowingProfile(false);
      setProfileFollowers(prev => prev - 1);
    }
  };

  if (!activeProfile) return null;

  return (
    <>
      {/* Profile Summary Overlay */}
      <div
        className={`stats-user-pp-overlay ${closing ? 'closing' : (skipFadeRef.current ? 'no-fade' : '')}`}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div className="stats-pp-panel" ref={ppPanelRef} key={activeProfile.uid}>
          <div className="stats-pp-header">
            <div className="stats-pp-header-left">
              {activeProfile.photoURL ? (
                isHIITemProfile ? (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={activeProfile.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.15)' }} referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <img src={activeProfile.photoURL} alt="" className="stats-pp-avatar" referrerPolicy="no-referrer" />
                )
              ) : (
                <div className="stats-pp-avatar stats-pp-avatar-fallback">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
              <div className="stats-pp-header-info">
                <span className="stats-pp-name">{activeProfile.displayName || 'Unknown'}</span>
                {!isHIITemProfile && (
                  <div className="stats-pp-follow-row">
                    <button className="stats-pp-follow-btn" onClick={() => openFollowList('following')}>
                      <span className="stats-pp-follow-num">{profileFollowing}</span> Following
                    </button>
                    <button className="stats-pp-follow-btn" onClick={() => openFollowList('followers')}>
                      <span className="stats-pp-follow-num">{profileFollowers}</span> Followers
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="stats-pp-header-right">
              {!loading && !isHIITemProfile && activeProfile.uid !== user?.uid && !isFollowingProfile ? (
                <button
                  className={`stats-pp-follow-action-btn ${pendingFollowRequests[activeProfile.uid] ? 'requested' : ''}`}
                  onClick={handleFollowToggle}
                >
                  {pendingFollowRequests[activeProfile.uid] ? 'Requested' : 'Follow'}
                </button>
              ) : !loading && stats ? (
                <div className="stats-pp-time">
                  {stats.totalHours > 0 && (
                    <><span className="stats-pp-time-value">{stats.totalHours}</span><span className="stats-pp-time-unit">h </span></>
                  )}
                  <span className="stats-pp-time-value">{stats.totalMinutes}</span>
                  <span className="stats-pp-time-unit">m</span>
                </div>
              ) : !loading ? (
                <div className="stats-pp-time">
                  <span className="stats-pp-time-value">0</span>
                  <span className="stats-pp-time-unit">m</span>
                </div>
              ) : null}
            </div>
          </div>

          <>
              {(isHIITemProfile || isFollowingProfile || activeProfile.uid === user?.uid) && calendar && (
                <div className="stats-pp-calendar-scroll" ref={calendarScrollRef}>
                  <div
                    className="stats-pp-calendar"
                    style={{ minWidth: `${calendar.numWeeks * 14}px` }}
                  >
                    <div
                      className="calendar-month-labels"
                      style={{ gridTemplateColumns: `repeat(${calendar.numWeeks}, 1fr)` }}
                    >
                      {calendar.monthLabels.map((m, i) => (
                        <span
                          key={i}
                          className="month-label"
                          style={{ gridColumnStart: m.weekIndex + 1 }}
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                    <div className="calendar-cells">
                      {calendar.weeks.map((week, wi) => (
                        <div key={wi} className="calendar-week" style={{ cursor: 'default' }}>
                          {week.map((day, di) => (
                            <div
                              key={di}
                              className="calendar-cell"
                              style={{ backgroundColor: getHeatColor(day.count, day.isFuture), cursor: 'default' }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(isFollowingProfile || activeProfile.uid === user?.uid) && pinnedWorkouts.length > 0 && (
                <div className="stats-pp-cards">
                  {pinnedWorkouts.map((workout, i) => {
                    const totalSeconds = (workout.exercises.length * 60) + 15;
                    const wCompletions = completions[workout.name] || 0;
                    return (
                      <div
                        key={workout.name}
                        ref={(el) => { cardRefs.current[workout.name] = el; }}
                        className="stats-workout-card stats-vp-card-fade"
                        style={{ animationDelay: `${150 + i * 60}ms` }}
                        onClick={() => openDetail(workout)}
                      >
                        <div className="stats-card-left">
                          <div className="stats-card-name-row">
                            <span className="stats-card-name">{workout.name}</span>
                            {(workout.tags || (workout.tag ? [workout.tag] : [])).map(t => (
                              <span key={t} className="stats-card-tag">{t.toUpperCase()}</span>
                            ))}
                          </div>
                          <div className="stats-card-detail">
                            <span className="stats-card-time">{formatTime(totalSeconds)}</span>
                            <span className="stats-card-dot">&middot;</span>
                            <span>{workout.exercises.length} exercises</span>
                            {wCompletions > 0 && (
                              <>
                                <span className="stats-card-dot">&middot;</span>
                                <span className="stats-card-completions">{wCompletions}x</span>
                              </>
                            )}
                          </div>
                        </div>
                        {activeProfile.uid !== user?.uid ? (
                          <button
                            className={`stats-card-action-btn ${takenWorkouts[workout.name] ? 'taken' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleTakeWorkout(workout); }}
                          >
                            {savingWorkouts[workout.name] ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" className="stats-take-spinner">
                                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="42" strokeLinecap="round"/>
                              </svg>
                            ) : takenWorkouts[workout.name] ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                            )}
                          </button>
                        ) : (
                          <button
                            className="stats-card-action-btn"
                            onClick={(e) => { e.stopPropagation(); if (onShareWorkout) onShareWorkout(workout); }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                              <polyline points="16 6 12 2 8 6"/>
                              <line x1="12" y1="2" x2="12" y2="15"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
        </div>

        {/* Detail Popup — rendered inside profile overlay so it paints on top */}
        {detailWorkout && (
          <div
            className={`stats-detail-overlay ${detailPhase === 'leaving' ? 'closing' : ''}`}
            style={{ zIndex: 700 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
          >
          <div className="stats-detail-panel" ref={detailPanelRef}>
            <div className="stats-detail-header">
              <div className="stats-detail-creator">
                {activeProfile.photoURL ? (
                  <img src={activeProfile.photoURL} alt="" className="stats-detail-creator-icon" referrerPolicy="no-referrer" />
                ) : (
                  <div className="stats-detail-creator-icon stats-detail-user-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className={`stats-detail-title-group ${(detailWorkout.tags || (detailWorkout.tag ? [detailWorkout.tag] : [])).length > 0 ? 'has-tags' : ''}`}>
                <h2 className="stats-detail-name">{detailWorkout.name}</h2>
                {(detailWorkout.tags || (detailWorkout.tag ? [detailWorkout.tag] : [])).length > 0 && (
                  <div className="stats-detail-tags-row">
                    {(detailWorkout.tags || (detailWorkout.tag ? [detailWorkout.tag] : [])).map(t => (
                      <span key={t} className="stats-detail-tag-pill">{t.toUpperCase()}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="stats-detail-header-actions">
                {activeProfile.uid !== user?.uid ? (
                  <button
                    className={`stats-detail-share-btn ${takenWorkouts[detailWorkout.name] ? 'taken' : ''}`}
                    onClick={() => handleTakeWorkout(detailWorkout)}
                  >
                    {savingWorkouts[detailWorkout.name] ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" className="stats-take-spinner">
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="42" strokeLinecap="round"/>
                      </svg>
                    ) : takenWorkouts[detailWorkout.name] ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    )}
                  </button>
                ) : (
                  <button className="stats-detail-share-btn" onClick={() => { if (onShareWorkout) onShareWorkout(detailWorkout); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                      <polyline points="16 6 12 2 8 6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </button>
                )}
                <button className="stats-detail-close-btn" onClick={closeDetail}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="stats-detail-meta-row">
              <div className="stats-detail-meta-left">
                <div className="stats-detail-meta">
                  <span>{formatTime((detailWorkout.exercises.length * 60) + prepTime)}</span>
                  <span className="stats-detail-dot">&middot;</span>
                  <span>{detailWorkout.exercises.length} exercises</span>
                </div>
                <span className="stats-detail-rest-display">
                  {detailWorkout.restTime != null ? detailWorkout.restTime : globalRestTime}s rest between exercises
                </span>
              </div>
            </div>

            <div className="stats-detail-exercises">
              {detailWorkout.exercises.map((exercise, i) => (
                <div key={`${exercise}-${i}`} className="stats-detail-exercise">
                  <span className="stats-detail-exercise-num">{i + 1}</span>
                  <span className="stats-detail-exercise-name">{exercise}</span>
                </div>
              ))}
            </div>

            <button
              className="stats-detail-start-btn"
              onClick={() => {
                if (activeProfile.uid !== user?.uid && !takenWorkouts[detailWorkout.name]) {
                  handleTakeWorkout(detailWorkout);
                } else {
                  closeDetail();
                  handleClose();
                  if (onStartWorkout) onStartWorkout(detailWorkout.name);
                }
              }}
            >
              {activeProfile.uid !== user?.uid && !takenWorkouts[detailWorkout.name] ? 'Add Workout' : 'Start Workout'}
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Follow List */}
      {followListType && (
        <div
          className={`stats-follow-overlay ${followListClosing ? 'closing' : ''}`}
          style={{ zIndex: 610, background: 'rgba(0,0,0,0.3)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeFollowList(); }}
        >
          <div className="stats-follow-panel" ref={followPanelRef}>
            <div className="stats-follow-panel-header">
              <div className="stats-follow-tabs">
                <button className={`stats-follow-tab ${followListType === 'following' ? 'active' : ''}`} onClick={() => switchFollowListTab('following')}>Following</button>
                <button className={`stats-follow-tab ${followListType === 'followers' ? 'active' : ''}`} onClick={() => switchFollowListTab('followers')}>Followers</button>
              </div>
              <button className="stats-follow-panel-close" onClick={closeFollowList}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <input
              className="stats-follow-search"
              type="text"
              placeholder="Search..."
              value={followListSearch}
              onChange={(e) => {
                const val = e.target.value;
                if (!followListSearch && val) {
                  const panel = followPanelRef.current;
                  if (panel) panel.style.minHeight = panel.offsetHeight + 'px';
                } else if (followListSearch && !val) {
                  const panel = followPanelRef.current;
                  if (panel) panel.style.minHeight = '';
                }
                setFollowListSearch(val);
              }}
            />
            <div className="stats-follow-panel-list">
              {followListLoading ? (
                <div className="stats-follow-panel-empty">Loading...</div>
              ) : followListProfiles.length === 0 ? (
                <div className="stats-follow-panel-empty">
                  {followListType === 'following' ? 'Not following anyone yet' : 'No followers yet'}
                </div>
              ) : (
                followListProfiles
                  .filter(p => !followListSearch || (p.displayName || '').toLowerCase().includes(followListSearch.toLowerCase()))
                  .map((p, i) => (
                  <div
                    key={p.uid}
                    className="stats-follow-panel-item"
                    style={{ animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
                    onClick={() => drillIntoProfile(p)}
                  >
                    <div className="stats-follow-panel-avatar">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="stats-follow-panel-avatar-placeholder">
                          {(p.displayName || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="stats-follow-panel-name">{p.displayName}</span>
                  </div>
                ))
              )}
              {onFindPeople && profile?.uid === user?.uid && followListType === 'following' && (
                <div className="stats-follow-find-people" style={{ animationDelay: `${(followListProfiles.length) * 40}ms` }} onClick={() => { closeFollowList(); onClose(); onFindPeople(); }}>
                  <div className="stats-follow-find-people-icon">+</div>
                  <span>Find People</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePopup;
