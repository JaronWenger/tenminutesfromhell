import React, { useState, useEffect, useRef, useCallback } from 'react';
import Timer from './Timer';
import Home from './Home';
import Stopwatch from './Stopwatch';
import StatsPage from './StatsPage';
import TabBar from './TabBar';
import EditPage from './EditPage';
import ExerciseEditPage from './ExerciseEditPage';
import FeedPage from './FeedPage';
import SideMenu from './SideMenu';
import LoginModal from './LoginModal';
import SharePrompt from './SharePrompt';
import ProfilePopup from './ProfilePopup';
import { DEFAULT_TIMER_WORKOUTS, DEFAULT_STOPWATCH_WORKOUTS } from '../data/defaultWorkouts';
import { useAuth } from '../contexts/AuthContext';
import { getUserWorkouts, saveUserWorkout, recordWorkoutHistory, updateWorkoutHistory, getUserHistory, deleteUserWorkout } from '../firebase/firestore';
import { ensureUserProfile, getAllPreferences, setAutoSharePreference, setNewWorkoutsPublicPreference, createPost, updatePostSetsCompleted, setUserColors, getWorkoutOrder, setWorkoutOrder, setSidePlankAlertPreference, setPrepTimePreference, setRestTimePreference, setActiveLastMinutePreference, setShuffleExercisesPreference, setSelectedWorkout, setShowCardPhotosPreference, setPinnedWorkouts, setWeeklySchedule, getFollowing, getFollowers, getUserProfiles, createSaveNotification, createShareNotification, updateNotificationStatus, hasNewNotifications } from '../firebase/social';

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string' || hex.length < 7) return '255, 59, 48';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '255, 59, 48';
  return `${r}, ${g}, ${b}`;
};

const Main = () => {
  const [activeTab, setActiveTab] = useState('timer');
  const { user, loading: authLoading } = useAuth();
  const [initialLoad, setInitialLoad] = useState(true);
  const [workoutReady, setWorkoutReady] = useState(false);

  // PWA install banner — show on mobile browsers only
  const [showPwaBanner, setShowPwaBanner] = useState(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    return isMobile && !isStandalone && !dismissed;
  });

  const pwaBannerRef = useRef(null);
  useEffect(() => {
    if (!showPwaBanner) return;
    const t = setTimeout(() => {
      const wrap = pwaBannerRef.current;
      if (wrap) {
        wrap.style.animation = 'none';
        // Force reflow so animation:none takes effect
        void wrap.offsetHeight;
        wrap.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 1, 1), opacity 0.4s ease';
        wrap.style.transform = 'translateY(calc(-100% - 40px))';
        wrap.style.opacity = '0';
      }
      setTimeout(() => { setShowPwaBanner(false); localStorage.setItem('pwa_banner_dismissed', '1'); }, 400);
    }, 6000);
    return () => clearTimeout(t);
  }, [showPwaBanner]);

  // If not logged in (auth resolved, no user), workout is ready immediately
  // If logged in, wait for preferences to load (setWorkoutReady called after prefs load)
  // Safety timeout: if prefs take too long, show content anyway after 2.5s
  useEffect(() => {
    if (workoutReady) return;
    if (!authLoading && !user) {
      setWorkoutReady(true);
      return;
    }
    const timeout = setTimeout(() => setWorkoutReady(true), 2500);
    return () => clearTimeout(timeout);
  }, [authLoading, user, workoutReady]);

  // Workout data as state (defaults, overridable by Firestore)
  const [timerWorkoutData, setTimerWorkoutData] = useState(DEFAULT_TIMER_WORKOUTS);
  const [stopwatchWorkoutData, setStopwatchWorkoutData] = useState(DEFAULT_STOPWATCH_WORKOUTS);

  // Derive name arrays from workout data
  const timerWorkouts = timerWorkoutData.map(w => w.name);
  const stopwatchWorkouts = stopwatchWorkoutData.map(w => w.name);

  // Exercise lookup by workout name
  const getExerciseList = useCallback((workoutName) => {
    if (workoutName === 'New Workout') return [];
    const allWorkouts = [...timerWorkoutData, ...stopwatchWorkoutData];
    const found = allWorkouts.find(w => w.name === workoutName);
    return found ? found.exercises : [];
  }, [timerWorkoutData, stopwatchWorkoutData]);

  const [prepTime, setPrepTime] = useState(15);
  const [restTime, setRestTime] = useState(15);
  const [activeLastMinute, setActiveLastMinute] = useState(true);
  const [shuffleExercises, setShuffleExercises] = useState(false);

  // Calculate total time from exercise count
  const calculateTotalTime = useCallback((workoutName) => {
    const exercises = getExerciseList(workoutName || 'The Devils 10');
    return (exercises.length * 60) + prepTime;
  }, [getExerciseList, prepTime]);

  // Timer state
  const [timerState, setTimerState] = useState(() => {
    const initial = (DEFAULT_TIMER_WORKOUTS[0].exercises.length * 60) + 15;
    return {
      timeLeft: initial,
      isRunning: false,
      targetTime: initial,
      selectedWorkoutIndex: 0
    };
  });

  // Stopwatch state
  const [stopwatchState, setStopwatchState] = useState({
    time: 0,
    isRunning: false,
    laps: []
  });

  // Lap times panel state
  const [showLapTimes, setShowLapTimes] = useState(false);
  const [isClosingLapTimes, setIsClosingLapTimes] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

  // Workout view state (phone only)
  const [showWorkoutView, setShowWorkoutView] = useState(false);
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(-1);

  // Edit page state
  const [currentEditPage, setCurrentEditPage] = useState(null);
  const [currentEditLevel, setCurrentEditLevel] = useState('categories');
  const [currentEditingWorkout, setCurrentEditingWorkout] = useState(null);
  const [timerSelectedWorkout, setTimerSelectedWorkout] = useState('The Devils 10');
  const [stopwatchSelectedWorkout, setStopwatchSelectedWorkout] = useState('Back & Bis');

  // Stats page state
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Social / Feed state
  const [hasUnread, setHasUnread] = useState(false);
  const [feedLastViewed, setFeedLastViewed] = useState(null); // snapshot of last viewed time for highlight
  const [showFeedPage, setShowFeedPage] = useState(false);
  const [feedCloseRequested, setFeedCloseRequested] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [sideMenuCloseRequested, setSideMenuCloseRequested] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [pendingShareData, setPendingShareData] = useState(null);
  const [autoShareEnabled, setAutoShareEnabled] = useState(null); // null = unset, true/false = decided
  const [newWorkoutsPublic, setNewWorkoutsPublic] = useState(true); // default ON
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalCloseRequested, setLoginModalCloseRequested] = useState(false);
  const [homeDetailCloseRequested, setHomeDetailCloseRequested] = useState(false);
  const [openProfilePopup, setOpenProfilePopup] = useState(false);
  const [viewUserProfile, setViewUserProfile] = useState(null);
  const [lastFollowedUid, setLastFollowedUid] = useState(null);
  const [feedDetailPost, setFeedDetailPost] = useState(null);
  const [feedDetailClosing, setFeedDetailClosing] = useState(false);
  const [feedDetailIsOwn, setFeedDetailIsOwn] = useState(false); // current user owns/created this workout
  const [feedDetailTaken, setFeedDetailTaken] = useState(false); // workout is in user's library (from someone else)
  const [feedDetailSaving, setFeedDetailSaving] = useState(false);
  const [feedDetailOwner, setFeedDetailOwner] = useState(null); // { uid, displayName, photoURL } of workout creator
  const [feedDetailTags, setFeedDetailTags] = useState([]);
  const [feedDetailRestTime, setFeedDetailRestTime] = useState(null);
  const [feedAcceptedPostId, setFeedAcceptedPostId] = useState(null);
  const [activeColor, setActiveColor] = useState('#ff3b30');
  const [restColor, setRestColor] = useState('#007aff');
  const [sidePlankAlertEnabled, setSidePlankAlertEnabled] = useState(true);
  const [showCardPhotos, setShowCardPhotos] = useState(true);
  const [pinnedWorkouts, setPinnedWorkoutsState] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [followerIds, setFollowerIds] = useState([]);

  // Send workout popup state (shared between Home + StatsPage)
  const [sendWorkout, setSendWorkout] = useState(null);
  const [sendWorkoutClosing, setSendWorkoutClosing] = useState(false);
  const [sendWorkoutProfiles, setSendWorkoutProfiles] = useState([]);
  const [sendWorkoutSearch, setSendWorkoutSearch] = useState('');
  const [sentTo, setSentTo] = useState({});
  const sendWorkoutPanelRef = useRef(null);
  const [privateShareWorkout, setPrivateShareWorkout] = useState(null);

  // Weekly schedule state
  const [weeklySchedule, setWeeklyScheduleState] = useState({ 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
  const [scheduleWorkout, setScheduleWorkout] = useState(null);
  const [scheduleClosing, setScheduleClosing] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState({});

  const openSchedulePopup = useCallback((workout) => {
    setScheduleClosing(false);
    setScheduleDraft({ ...weeklySchedule });
    setScheduleWorkout(workout);
  }, [weeklySchedule]);

  const closeSchedulePopup = useCallback(() => {
    setScheduleClosing(true);
    setTimeout(() => {
      setScheduleWorkout(null);
      setScheduleClosing(false);
      setScheduleDraft({});
    }, 200);
  }, []);

  const handleScheduleDaySelect = useCallback((dayIndex) => {
    if (!scheduleWorkout) return;
    setScheduleDraft(prev => {
      const next = { ...prev };
      if (next[dayIndex] === scheduleWorkout.name) {
        next[dayIndex] = null;
      } else {
        next[dayIndex] = scheduleWorkout.name;
      }
      return next;
    });
  }, [scheduleWorkout]);

  const handleScheduleSave = useCallback(() => {
    if (!user) return;
    setWeeklyScheduleState(scheduleDraft);
    setWeeklySchedule(user.uid, scheduleDraft).catch(err => console.error('Failed to save schedule:', err));
    closeSchedulePopup();
  }, [user, scheduleDraft, closeSchedulePopup]);

  const openSendWorkout = useCallback(async (workout) => {
    const isOwnWorkout = !workout.creatorUid || workout.creatorUid === user?.uid;
    if (isOwnWorkout && workout.isPublic === false) {
      setPrivateShareWorkout(workout);
      return;
    }
    setSendWorkoutClosing(false);
    setSendWorkoutSearch('');
    setSentTo({});
    try {
      const profiles = await getUserProfiles(followingIds);
      setSendWorkout(workout);
      setSendWorkoutProfiles(profiles);
    } catch (err) {
      console.error('Failed to load following profiles:', err);
      setSendWorkout(workout);
      setSendWorkoutProfiles([]);
    }
  }, [followingIds]);

  const closeSendWorkout = useCallback(() => {
    setSendWorkoutClosing(true);
    setTimeout(() => {
      setSendWorkout(null);
      setSendWorkoutClosing(false);
      setSendWorkoutProfiles([]);
      setSendWorkoutSearch('');
      setSentTo({});
    }, 200);
  }, []);

  const handleSendToUser = useCallback((profile) => {
    setSentTo(prev => {
      const next = { ...prev };
      if (next[profile.uid]) {
        delete next[profile.uid];
      } else {
        next[profile.uid] = true;
      }
      return next;
    });
  }, []);

  // Load user workouts and history from Firestore when user logs in
  useEffect(() => {
    if (!user) {
      // Reset to defaults when logged out
      setTimerWorkoutData(DEFAULT_TIMER_WORKOUTS);
      setStopwatchWorkoutData(DEFAULT_STOPWATCH_WORKOUTS);
      setWorkoutHistory([]);
      setAutoShareEnabled(null);
      setActiveColor('#ff3b30');
      setRestColor('#007aff');
      setSidePlankAlertEnabled(true);
      setShowCardPhotos(true);
      setPinnedWorkoutsState([]);
      setFollowingIds([]);
      setFollowerIds([]);
      setPrepTime(15);
      setRestTime(15);
      setActiveLastMinute(true);
      setTimerSelectedWorkout('The Devils 10');
      setWeeklyScheduleState({ 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
      return;
    }

    let cancelled = false;
    const loadWorkouts = async () => {
      try {
        const [custom, savedOrder] = await Promise.all([
          getUserWorkouts(user.uid),
          getWorkoutOrder(user.uid)
        ]);
        if (cancelled) return;
        if (custom.length > 0) {
          const merged = mergeWorkouts(custom);
          let timer = merged.timer;
          if (savedOrder && savedOrder.length > 0) {
            const orderMap = new Map(savedOrder.map((name, i) => [name, i]));
            timer = [...timer].sort((a, b) => {
              const ai = orderMap.has(a.name) ? orderMap.get(a.name) : savedOrder.length;
              const bi = orderMap.has(b.name) ? orderMap.get(b.name) : savedOrder.length;
              return ai - bi;
            });
          }
          setTimerWorkoutData(timer);
          setStopwatchWorkoutData(merged.stopwatch);
        } else if (savedOrder && savedOrder.length > 0) {
          const orderMap = new Map(savedOrder.map((name, i) => [name, i]));
          setTimerWorkoutData(prev => [...prev].sort((a, b) => {
            const ai = orderMap.has(a.name) ? orderMap.get(a.name) : savedOrder.length;
            const bi = orderMap.has(b.name) ? orderMap.get(b.name) : savedOrder.length;
            return ai - bi;
          }));
        }
      } catch (err) {
        console.error('Failed to load workouts:', err);
      }
    };
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const history = await getUserHistory(user.uid);
        if (!cancelled) setWorkoutHistory(history);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    const loadSocialProfile = async () => {
      try {
        await ensureUserProfile(user);
      } catch (err) {
        console.error('Failed to ensure user profile:', err);
      }
      try {
        const prefs = await getAllPreferences(user.uid);
        if (cancelled) return;
        setAutoShareEnabled(prefs.autoShare);
        setNewWorkoutsPublic(prefs.newWorkoutsPublic);
        if (prefs.activeColor) setActiveColor(prefs.activeColor);
        if (prefs.restColor) setRestColor(prefs.restColor);
        setSidePlankAlertEnabled(prefs.sidePlankAlert);
        setShowCardPhotos(prefs.showCardPhotos);
        setPinnedWorkoutsState(prefs.pinnedWorkouts || []);
        setPrepTime(prefs.prepTime);
        setRestTime(prefs.restTime);
        setActiveLastMinute(prefs.activeLastMinute);
        setShuffleExercises(prefs.shuffleExercises);
        if (prefs.weeklySchedule) setWeeklyScheduleState(prefs.weeklySchedule);
        // Auto-select today's scheduled workout, or fall back to saved selection
        const todayDay = new Date().getDay();
        const scheduledName = prefs.weeklySchedule?.[todayDay];
        if (scheduledName) {
          setTimerSelectedWorkout(scheduledName);
        } else if (prefs.selectedWorkout) {
          setTimerSelectedWorkout(prefs.selectedWorkout);
        }
        setWorkoutReady(true);
        // Load follow data in background (non-blocking)
        Promise.all([getFollowing(user.uid), getFollowers(user.uid)])
          .then(([following, followers]) => {
            if (!cancelled) {
              setFollowingIds(following);
              setFollowerIds(followers);
            }
          })
          .catch(err => console.error('Failed to load follow data:', err));
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadWorkouts();
    loadHistory();
    loadSocialProfile();
    return () => { cancelled = true; };
  }, [user]);

  // Check for unread notifications (on load, tab change, and every 60s)
  const checkUnread = useCallback(() => {
    if (!user) return;
    const lastViewed = localStorage.getItem(`feedLastViewed_${user.uid}`);
    const since = lastViewed ? new Date(lastViewed) : new Date(0);
    hasNewNotifications(user.uid, since, followingIds)
      .then(has => setHasUnread(has))
      .catch(err => console.error('Unread check failed:', err));
  }, [user, followingIds]);

  useEffect(() => {
    if (!user) { setHasUnread(false); return; }
    checkUnread();
    const interval = setInterval(checkUnread, 60000);
    return () => clearInterval(interval);
  }, [user, checkUnread]);

  // Re-check when switching to home tab
  useEffect(() => {
    if (activeTab === 'home') checkUnread();
  }, [activeTab, checkUnread]);

  // Merge custom workouts with defaults
  const mergeWorkouts = (customWorkouts) => {
    const timerDefaults = [...DEFAULT_TIMER_WORKOUTS];
    const stopwatchDefaults = [...DEFAULT_STOPWATCH_WORKOUTS];

    // Collect deleted default names
    const deletedDefaults = customWorkouts
      .filter(c => c.deleted)
      .map(c => c.defaultName)
      .filter(Boolean);

    // Track which custom workouts were used as default overrides
    const usedAsOverride = new Set();

    const timerResult = timerDefaults
      .filter(d => !deletedDefaults.includes(d.name))
      .map(d => {
        const override = customWorkouts.find(
          c => !c.deleted && (c.defaultName === d.name || (!c.defaultName && c.name === d.name))
        );
        if (override) usedAsOverride.add(override.id || override.name);
        return override ? { ...d, ...override, exercises: override.exercises } : d;
      });

    const stopwatchResult = stopwatchDefaults
      .filter(d => !deletedDefaults.includes(d.name))
      .map(d => {
        const override = customWorkouts.find(
          c => !c.deleted && (c.defaultName === d.name || (!c.defaultName && c.name === d.name))
        );
        if (override) usedAsOverride.add(override.id || override.name);
        return override ? { ...d, ...override, exercises: override.exercises } : d;
      });

    // Add any fully custom workouts (not overriding defaults, not deleted, not already used as override)
    const defaultNames = [...timerDefaults, ...stopwatchDefaults].map(d => d.name);
    customWorkouts.forEach(c => {
      if (c.deleted) return;
      if (usedAsOverride.has(c.id || c.name)) return;
      if (c.isCustom) {
        if (c.type === 'timer') timerResult.push(c);
        else stopwatchResult.push(c);
        return;
      }
      const isOverride = defaultNames.includes(c.name) || defaultNames.includes(c.defaultName);
      if (!isOverride) {
        if (c.type === 'timer') timerResult.push(c);
        else stopwatchResult.push(c);
      }
    });

    return { timer: timerResult, stopwatch: stopwatchResult };
  };

  // Refresh history from Firestore (called after joining someone's workout)
  const refreshHistory = useCallback(async () => {
    if (!user) return;
    try {
      const history = await getUserHistory(user.uid);
      setWorkoutHistory(history);
    } catch (err) {
      console.error('Failed to refresh history:', err);
    }
  }, [user]);

  // Refresh workouts from Firestore (called after taking a workout from another user)
  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    try {
      const [custom, savedOrder] = await Promise.all([
        getUserWorkouts(user.uid),
        getWorkoutOrder(user.uid)
      ]);
      if (custom.length > 0) {
        const merged = mergeWorkouts(custom);
        let timer = merged.timer;
        if (savedOrder && savedOrder.length > 0) {
          const orderMap = new Map(savedOrder.map((name, i) => [name, i]));
          timer = [...timer].sort((a, b) => {
            const ai = orderMap.has(a.name) ? orderMap.get(a.name) : savedOrder.length;
            const bi = orderMap.has(b.name) ? orderMap.get(b.name) : savedOrder.length;
            return ai - bi;
          });
        }
        setTimerWorkoutData(timer);
        setStopwatchWorkoutData(merged.stopwatch);
      }
    } catch (err) {
      console.error('Failed to refresh workouts:', err);
    }
  }, [user]);

  // Share workout post helper
  const handleShareWorkout = useCallback(async (workoutData) => {
    if (!user) return null;
    try {
      const postId = await createPost(user.uid, workoutData, {
        displayName: user.displayName,
        photoURL: user.photoURL
      });
      setHasUnread(true);
      return postId;
    } catch (err) {
      console.error('Failed to share workout:', err);
      return null;
    }
  }, [user]);

  // Share prompt handlers
  const handleSharePromptAccept = useCallback(async () => {
    if (!user) return;
    await setAutoSharePreference(user.uid, true);
    setAutoShareEnabled(true);
    setShowSharePrompt(false);
    if (pendingShareData) {
      handleShareWorkout(pendingShareData);
      setPendingShareData(null);
    }
  }, [user, pendingShareData, handleShareWorkout]);

  const handleToggleAutoShare = useCallback(async () => {
    if (!user) return;
    const newValue = autoShareEnabled !== true;
    setAutoShareEnabled(newValue);
    await setAutoSharePreference(user.uid, newValue);
  }, [user, autoShareEnabled]);

  const handleToggleNewWorkoutsPublic = useCallback(async () => {
    if (!user) return;
    const newValue = newWorkoutsPublic !== true;
    setNewWorkoutsPublic(newValue);
    await setNewWorkoutsPublicPreference(user.uid, newValue);
  }, [user, newWorkoutsPublic]);

  const handleToggleSidePlankAlert = useCallback(async () => {
    const newValue = !sidePlankAlertEnabled;
    setSidePlankAlertEnabled(newValue);
    if (user) {
      setSidePlankAlertPreference(user.uid, newValue).catch(err => console.error('Failed to save side plank alert:', err));
    }
  }, [user, sidePlankAlertEnabled]);

  const handlePinnedWorkoutsChange = useCallback(async (newPinned) => {
    setPinnedWorkoutsState(newPinned);
    if (user) {
      setPinnedWorkouts(user.uid, newPinned).catch(err => console.error('Failed to save pinned workouts:', err));
    }
  }, [user]);

  const handleToggleShowCardPhotos = useCallback(async () => {
    const newValue = !showCardPhotos;
    setShowCardPhotos(newValue);
    if (user) {
      setShowCardPhotosPreference(user.uid, newValue).catch(err => console.error('Failed to save show card photos:', err));
    }
  }, [user, showCardPhotos]);

  const handlePrepTimeChange = useCallback(async (newValue) => {
    setPrepTime(newValue);
    if (user) {
      setPrepTimePreference(user.uid, newValue).catch(err => console.error('Failed to save prep time:', err));
    }
  }, [user]);

  const handleToggleActiveLastMinute = useCallback(async () => {
    const newValue = !activeLastMinute;
    setActiveLastMinute(newValue);
    if (user) {
      setActiveLastMinutePreference(user.uid, newValue).catch(err => console.error('Failed to save active last minute:', err));
    }
  }, [user, activeLastMinute]);

  const handleToggleShuffleExercises = useCallback(async () => {
    const newValue = !shuffleExercises;
    setShuffleExercises(newValue);
    if (user) {
      setShuffleExercisesPreference(user.uid, newValue).catch(err => console.error('Failed to save shuffle exercises:', err));
    }
  }, [user, shuffleExercises]);

  const handleRestTimeChange = useCallback(async (newValue) => {
    setRestTime(newValue);
    if (user) {
      setRestTimePreference(user.uid, newValue).catch(err => console.error('Failed to save rest time:', err));
    }
  }, [user]);

  const handleColorChange = useCallback(async (type, hex) => {
    if (type === 'active') setActiveColor(hex);
    else setRestColor(hex);
    if (user) {
      const colors = type === 'active'
        ? { activeColor: hex, restColor }
        : { activeColor, restColor: hex };
      setUserColors(user.uid, colors).catch(err => console.error('Failed to save colors:', err));
    }
  }, [user, activeColor, restColor]);

  const handleSharePromptDismiss = useCallback(async () => {
    if (!user) return;
    await setAutoSharePreference(user.uid, false);
    setAutoShareEnabled(false);
    setShowSharePrompt(false);
    setPendingShareData(null);
  }, [user]);

  // Recalculate timer when workout selection changes
  useEffect(() => {
    const newTotalTime = calculateTotalTime(timerSelectedWorkout);
    setTimerState(prev => ({
      ...prev,
      timeLeft: newTotalTime,
      targetTime: newTotalTime
    }));
  }, [timerSelectedWorkout, calculateTotalTime]);

  // Timer interval ref
  const timerIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Timer interval — pure countdown only, no side effects in updater
  useEffect(() => {
    if (timerState.isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerState(prev => {
          if (prev.timeLeft <= 1) {
            return { ...prev, timeLeft: 0, isRunning: false };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerState.isRunning]);

  // Session tracking for set credits, multi-set posts, and history — reset when workout changes
  const sessionPostIdRef = useRef(null);
  const sessionHistoryIdRef = useRef(null);
  const sessionSetCountRef = useRef(0);
  useEffect(() => {
    sessionPostIdRef.current = null;
    sessionHistoryIdRef.current = null;
    sessionSetCountRef.current = 0;
  }, [timerSelectedWorkout]);

  // Detect workout completion — runs side effects outside of state updater
  const timerCompletedRef = useRef(false);
  useEffect(() => {
    if (timerState.timeLeft === 0 && !timerState.isRunning && timerState.targetTime > 0 && !timerCompletedRef.current) {
      timerCompletedRef.current = true;

      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }

      // Fire GTM event
      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'workout_complete',
          workout_duration: timerState.targetTime,
          workout_type: 'ten_minutes_from_hell'
        });
      }

      // Record history and share
      if (user) {
        const exercises = getExerciseList(timerSelectedWorkout);
        const selectedWorkoutObj = timerWorkoutData.find(w => w.name === timerSelectedWorkout);

        // Increment set counter for this session (always, for all workouts)
        sessionSetCountRef.current += 1;
        const setsCompleted = sessionSetCountRef.current;

        const refreshHistory = () => getUserHistory(user.uid)
          .then(setWorkoutHistory)
          .catch(err => console.error('Failed to refresh history:', err));

        // Create or update single history entry for this session
        if (setsCompleted === 1 || !sessionHistoryIdRef.current) {
          recordWorkoutHistory(user.uid, {
            workoutName: timerSelectedWorkout,
            workoutId: selectedWorkoutObj?.id || null,
            workoutType: 'timer',
            duration: timerState.targetTime,
            setCount: 1,
            exercises
          }).then(historyId => {
            if (historyId) sessionHistoryIdRef.current = historyId;
            refreshHistory();
          }).catch(err => console.error('Failed to record history:', err));
        } else {
          updateWorkoutHistory(user.uid, sessionHistoryIdRef.current, {
            duration: timerState.targetTime * setsCompleted,
            setCount: setsCompleted
          }).then(refreshHistory)
            .catch(err => console.error('Failed to update history:', err));
        }

        if (selectedWorkoutObj?.isPublic !== false) {
          const shareData = {
            workoutName: timerSelectedWorkout,
            workoutId: selectedWorkoutObj?.id || null,
            workoutType: 'timer',
            duration: timerState.targetTime,
            exercises,
            exerciseCount: exercises.length
          };
          if (autoShareEnabled === true) {
            if (setsCompleted === 1 || !sessionPostIdRef.current) {
              handleShareWorkout({ ...shareData, isPublic: true, setsCompleted }).then(postId => {
                if (postId) sessionPostIdRef.current = postId;
              });
            } else {
              updatePostSetsCompleted(sessionPostIdRef.current, setsCompleted)
                .catch(err => console.error('Failed to update post sets:', err));
            }
          } else if (autoShareEnabled === null && setsCompleted === 1) {
            setPendingShareData({ ...shareData, isPublic: true, setsCompleted });
            setShowSharePrompt(true);
          }
        }
      }
    }

    // Reset completion flag when timer is reset (timeLeft > 0)
    if (timerState.timeLeft > 0) {
      timerCompletedRef.current = false;
    }
  }, [timerState.timeLeft, timerState.isRunning, timerState.targetTime, user, timerSelectedWorkout, getExerciseList, autoShareEnabled, handleShareWorkout]);

  // Stopwatch interval ref
  const stopwatchIntervalRef = useRef(null);

  // Stopwatch interval management
  useEffect(() => {
    if (stopwatchState.isRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchState(prev => ({
          ...prev,
          time: prev.time + 10
        }));
      }, 10);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [stopwatchState.isRunning]);

  // Wake lock management
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Wake Lock not supported');
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.log('Error releasing wake lock');
    }
  };

  // Timer state change handler
  const handleTimerStateChange = (newState) => {
    if (newState.isRunning !== undefined) {
      setTimerState(prev => {
        if (newState.isRunning && !prev.isRunning) requestWakeLock();
        else if (!newState.isRunning && prev.isRunning) releaseWakeLock();
        return { ...prev, ...newState };
      });
    } else {
      setTimerState(prev => ({ ...prev, ...newState }));
    }
  };

  // Stopwatch state change handler
  const handleStopwatchStateChange = (newState) => {
    if (newState.isRunning !== undefined) {
      setStopwatchState(prev => {
        if (newState.isRunning && !prev.isRunning) requestWakeLock();
        else if (!newState.isRunning && prev.isRunning) releaseWakeLock();
        return { ...prev, ...newState };
      });
    } else {
      setStopwatchState(prev => ({ ...prev, ...newState }));
    }
  };

  // Stopwatch control handlers
  const handleStopwatchStart = () => {
    handleStopwatchStateChange({ isRunning: true });
  };

  const handleStopwatchStop = () => {
    handleStopwatchStateChange({ isRunning: false });
  };

  const handleStopwatchReset = () => {
    // Record history before resetting
    if (user && stopwatchState.time > 0) {
      const exercises = getExerciseList(stopwatchSelectedWorkout);
      const selectedWorkoutObj = stopwatchWorkoutData.find(w => w.name === stopwatchSelectedWorkout);
      const workoutData = {
        workoutName: stopwatchSelectedWorkout,
        workoutId: selectedWorkoutObj?.id || null,
        workoutType: 'stopwatch',
        duration: Math.round(stopwatchState.time / 1000),
        setCount: stopwatchState.laps.length,
        exercises
      };
      recordWorkoutHistory(user.uid, workoutData)
        .catch(err => console.error('Failed to record history:', err));

      // Social sharing logic — only public workouts
      if (selectedWorkoutObj?.isPublic !== false) {
        if (autoShareEnabled === true) {
          handleShareWorkout({ ...workoutData, isPublic: true });
        } else if (autoShareEnabled === null) {
          setPendingShareData({ ...workoutData, isPublic: true });
          setShowSharePrompt(true);
        }
      }
    }
    handleStopwatchStateChange({ time: 0, isRunning: false, laps: [] });
    setShowLapTimes(false);
  };

  const handleClearSets = () => {
    setStopwatchState(prev => ({ ...prev, laps: [] }));
    setShowLapTimes(false);
  };

  // Edit page handlers
  const handleNavigateToEdit = (type) => {
    setCurrentEditPage(type);
    setCurrentEditLevel('categories');
  };

  const handleEditPageBack = () => {
    if (currentEditLevel === 'exercise-edit') {
      if (activeTab === 'home') {
        setCurrentEditPage(null);
        setCurrentEditLevel('categories');
        setCurrentEditingWorkout(null);
        setActiveTab('home');
      } else {
        setCurrentEditLevel('categories');
        setCurrentEditingWorkout(null);
      }
    } else {
      setCurrentEditPage(null);
      setCurrentEditLevel('categories');
      setCurrentEditingWorkout(null);
      setActiveTab('home');
    }
  };

  const handleNavigateToTab = (type) => {
    setCurrentEditPage(null);
    setActiveTab(type);
  };

  const handleEditWorkoutSelect = (type, workout) => {
    if (type && !currentEditPage) {
      setCurrentEditPage(type);
      setCurrentEditLevel('categories');
    }

    if (currentEditLevel === 'categories') {
      if (workout === 'New Workout') {
        setCurrentEditLevel('exercise-edit');
        setCurrentEditingWorkout('New Workout');
        return;
      }

      if (type === 'timer') {
        setTimerSelectedWorkout(workout);
      } else if (type === 'stopwatch') {
        setStopwatchSelectedWorkout(workout);
      }
      setCurrentEditLevel('exercise-edit');
      setCurrentEditingWorkout(workout);
    } else {
      setCurrentEditLevel('categories');
      setCurrentEditingWorkout(null);
    }
  };

  const handleWorkoutSelection = (type, workout) => {
    if (type === 'timer') {
      setTimerSelectedWorkout(workout);
      if (user) {
        setSelectedWorkout(user.uid, workout).catch(err =>
          console.error('Failed to save selected workout:', err)
        );
      }
    } else if (type === 'stopwatch') {
      setStopwatchSelectedWorkout(workout);
    }
  };

  const handleExerciseSave = (updatedExercises, newTitle = null) => {
    const workoutType = currentEditPage;
    const workoutName = currentEditingWorkout;
    const isNew = workoutName === 'New Workout';
    const finalName = newTitle || workoutName;

    // New/default workouts follow "new workouts are public" setting; existing custom workouts preserve their visibility
    const currentData = workoutType === 'timer' ? timerWorkoutData : stopwatchWorkoutData;
    const existingWorkout = currentData.find(w => w.name === workoutName);
    const isPublic = existingWorkout?.isPublic != null ? existingWorkout.isPublic : (newWorkoutsPublic !== false);

    // Optimistic local update
    const setData = workoutType === 'timer' ? setTimerWorkoutData : setStopwatchWorkoutData;
    setData(prev => {
      if (isNew) {
        return [...prev, { name: finalName, type: workoutType, exercises: updatedExercises, isPublic }];
      }
      return prev.map(w =>
        w.name === workoutName
          ? { ...w, name: finalName, exercises: updatedExercises }
          : w
      );
    });

    // Update selected workout name if it was renamed
    if (newTitle && workoutName !== 'New Workout') {
      if (workoutType === 'timer' && timerSelectedWorkout === workoutName) {
        setTimerSelectedWorkout(finalName);
      } else if (workoutType === 'stopwatch' && stopwatchSelectedWorkout === workoutName) {
        setStopwatchSelectedWorkout(finalName);
      }
    }
    if (isNew) {
      if (workoutType === 'timer') setTimerSelectedWorkout(finalName);
      else setStopwatchSelectedWorkout(finalName);
    }

    // Update the editing workout name reference
    setCurrentEditingWorkout(finalName);

    // Persist to Firestore when logged in
    if (user) {
      const defaultNames = [...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name);
      const isDefault = defaultNames.includes(workoutName);
      saveUserWorkout(user.uid, {
        name: finalName,
        type: workoutType,
        exercises: updatedExercises,
        isDefault,
        isPublic,
        defaultName: isDefault && newTitle ? workoutName : null,
        creatorUid: null,
        creatorName: null,
        creatorPhotoURL: null,
      }).catch(err => console.error('Failed to save workout:', err));
    }
  };

  const handleDetailSave = useCallback((workoutName, exercises, newTitle, newRestTime, tags, options = {}) => {
    const { isOwned = true } = options;
    const finalName = newTitle || workoutName;
    const isNew = !workoutName;
    const safeTags = tags && tags.length > 0 ? tags : null;

    // Fork: if original was public, the remix stays public; otherwise follow "new workouts are public" setting
    if (!isOwned && !isNew) {
      const originalWorkout = timerWorkoutData.find(w => w.name === workoutName);
      const isPublic = originalWorkout?.isPublic === true ? true : (newWorkoutsPublic !== false);
      const forked = { name: finalName, type: 'timer', exercises, restTime: newRestTime ?? null, tags: safeTags, isCustom: true, forked: true, isPublic };
      setTimerWorkoutData(prev =>
        prev.map(w => w.name === workoutName ? forked : w)
      );
      setTimerSelectedWorkout(finalName);
      if (user && finalName) {
        // Soft-delete the original default first, then save the fork
        // Must be sequential to avoid race where delete overwrites the fork doc
        const defaultNames = [...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name);
        const persist = async () => {
          if (defaultNames.includes(workoutName)) {
            await deleteUserWorkout(user.uid, workoutName, true);
          }
          await saveUserWorkout(user.uid, { ...forked, isDefault: false, defaultName: null, creatorUid: null, creatorName: null, creatorPhotoURL: null });
        };
        persist().catch(err => console.error('Failed to persist forked workout:', err));
      }
      return;
    }

    // New/default workouts follow "new workouts are public" setting; existing custom workouts preserve their visibility
    const existingWorkout = timerWorkoutData.find(w => w.name === workoutName);
    const isPublic = existingWorkout?.isPublic != null ? existingWorkout.isPublic : (newWorkoutsPublic !== false);

    // Optimistic local update
    if (isNew && finalName) {
      setTimerWorkoutData(prev => [...prev, { name: finalName, type: 'timer', exercises, restTime: newRestTime ?? null, tags: safeTags, isPublic }]);
      setTimerSelectedWorkout(finalName);
    } else {
      setTimerWorkoutData(prev =>
        prev.map(w =>
          w.name === workoutName
            ? { ...w, name: finalName, exercises, restTime: newRestTime ?? null, tags: safeTags, creatorUid: null, creatorName: null, creatorPhotoURL: null }
            : w
        )
      );
      if (newTitle && newTitle !== workoutName && timerSelectedWorkout === workoutName) {
        setTimerSelectedWorkout(finalName);
      }
    }

    // Persist to Firestore when logged in
    if (user && finalName) {
      const defaultNames = [...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name);
      const isDefault = defaultNames.includes(workoutName);
      saveUserWorkout(user.uid, {
        id: existingWorkout?.id || null,
        name: finalName,
        type: 'timer',
        exercises,
        isDefault: isNew ? false : isDefault,
        isPublic,
        defaultName: isDefault && newTitle ? workoutName : null,
        restTime: newRestTime ?? null,
        tags: safeTags,
        creatorUid: null,
        creatorName: null,
        creatorPhotoURL: null,
      }).catch(err => console.error('Failed to save workout:', err));
    }
  }, [user, timerSelectedWorkout, timerWorkoutData, newWorkoutsPublic]);

  const handleVisibilityToggle = useCallback((workoutName, isPublic) => {
    setTimerWorkoutData(prev =>
      prev.map(w => w.name === workoutName ? { ...w, isPublic } : w)
    );
    if (user) {
      const workout = timerWorkoutData.find(w => w.name === workoutName);
      // Unpin if making private
      if (!isPublic && workout?.id && pinnedWorkouts.includes(workout.id)) {
        handlePinnedWorkoutsChange(pinnedWorkouts.filter(n => n !== workout.id));
      }
      if (workout) {
        saveUserWorkout(user.uid, { ...workout, isPublic }).catch(err =>
          console.error('Failed to save visibility:', err)
        );
      }
    }
  }, [user, timerWorkoutData, pinnedWorkouts, handlePinnedWorkoutsChange]);

  const handleMakePublicAndShare = useCallback(() => {
    if (!privateShareWorkout) return;
    const workout = privateShareWorkout;
    setPrivateShareWorkout(null);
    handleVisibilityToggle(workout.name, true);
    openSendWorkout({ ...workout, isPublic: true });
  }, [privateShareWorkout, handleVisibilityToggle, openSendWorkout]);

  const handleHomeStartWorkout = useCallback((workoutName) => {
    setTimerSelectedWorkout(workoutName);
    if (user) {
      setSelectedWorkout(user.uid, workoutName).catch(err =>
        console.error('Failed to save selected workout:', err)
      );
    }
    setActiveTab('timer');
  }, [user]);

  // Feed post detail popup
  const openFeedDetail = useCallback((post) => {
    const allW = [...timerWorkoutData, ...stopwatchWorkoutData];
    const allDefaults = [...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS];
    const postExercises = JSON.stringify(post.exercises || []);
    // For notifications without exercises (workout_saved), look up by name
    const hasExercises = post.exercises && post.exercises.length > 0;
    // Match by name AND exercises — same name with different exercises is a different workout
    const exactMatch = hasExercises
      ? allW.find(w => w.name === post.workoutName && JSON.stringify(w.exercises) === postExercises)
      : allW.find(w => w.name === post.workoutName);
    // Check if this exercise set matches a default workout
    const isDefaultContent = allDefaults.some(d =>
      d.name === post.workoutName && JSON.stringify(d.exercises) === postExercises
    );
    let owner = null;
    let isOwn = false;
    if (exactMatch && exactMatch.creatorUid) {
      // Taken from someone — show their info
      owner = { uid: exactMatch.creatorUid, displayName: exactMatch.creatorName, photoURL: exactMatch.creatorPhotoURL };
      isOwn = exactMatch.creatorUid === user?.uid;
    } else if (exactMatch) {
      // In library with no creator: user's own custom or unmodified default
      if (isDefaultContent) {
        owner = null; // app icon
      } else {
        owner = user ? { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL } : null;
      }
      isOwn = true;
    } else {
      // Not in library — show download. Determine the owner for the avatar.
      if (isDefaultContent) {
        owner = null; // app icon for default content
      } else {
        // Best guess: the poster or unknown
        owner = { uid: post.userId, displayName: post.displayName, photoURL: post.photoURL };
      }
      isOwn = false;
    }
    // Get tags and restTime from matched workout or defaults
    const sourceWorkout = exactMatch || allDefaults.find(d => d.name === post.workoutName && JSON.stringify(d.exercises) === postExercises);
    const tags = sourceWorkout?.tags || (sourceWorkout?.tag ? [sourceWorkout.tag] : []);
    setFeedDetailOwner(owner);
    setFeedDetailIsOwn(isOwn);
    setFeedDetailTaken(!isOwn && !!exactMatch);
    setFeedDetailTags(tags);
    setFeedDetailRestTime(sourceWorkout?.restTime ?? null);
    setFeedDetailSaving(false);
    setFeedDetailClosing(false);
    // Enrich post with workout data if missing (e.g. workout_saved notifications)
    const enrichedPost = (!hasExercises && sourceWorkout)
      ? { ...post, exercises: sourceWorkout.exercises, workoutType: sourceWorkout.type, restTime: sourceWorkout.restTime }
      : post;
    setFeedDetailPost(enrichedPost);
  }, [timerWorkoutData, stopwatchWorkoutData, user]);

  const closeFeedDetail = useCallback(() => {
    setFeedDetailClosing(true);
    setTimeout(() => {
      setFeedDetailPost(null);
      setFeedDetailClosing(false);
    }, 200);
  }, []);

  const handleFeedDetailTake = useCallback(async () => {
    if (!user || !feedDetailPost || feedDetailSaving) return;
    if (feedDetailTaken) {
      // Already taken — start the workout
      closeFeedDetail();
      setShowFeedPage(false);
      setFeedCloseRequested(false);
      handleHomeStartWorkout(feedDetailPost.workoutName);
      return;
    }
    setFeedDetailSaving(true);
    try {
      await saveUserWorkout(user.uid, {
        name: feedDetailPost.workoutName,
        type: feedDetailPost.workoutType || 'timer',
        exercises: feedDetailPost.exercises || [],
        isCustom: true,
        creatorUid: feedDetailOwner?.uid || null,
        creatorName: feedDetailOwner?.displayName || null,
        creatorPhotoURL: feedDetailOwner?.photoURL || null,
      });
      setFeedDetailTaken(true);
      refreshWorkouts();
      if (feedDetailPost.type === 'workout_shared') {
        setFeedAcceptedPostId(feedDetailPost.id);
        updateNotificationStatus(feedDetailPost.id, 'accepted').catch(err => console.error('Failed to update notification status:', err));
      }
      createSaveNotification({
        recipientUid: feedDetailOwner?.uid,
        actorUid: user.uid,
        actorName: user.displayName,
        actorPhotoURL: user.photoURL,
        workoutName: feedDetailPost.workoutName,
        source: 'activity'
      }).catch(err => console.error('Save notif failed:', err));
    } catch (err) {
      console.error('Failed to save workout:', err);
    } finally {
      setFeedDetailSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, feedDetailPost, feedDetailOwner, feedDetailSaving, feedDetailTaken, closeFeedDetail, handleHomeStartWorkout, refreshWorkouts]);

  const handleDeleteWorkout = (workoutName) => {
    const defaultNames = DEFAULT_TIMER_WORKOUTS.map(d => d.name);
    const isDefault = defaultNames.includes(workoutName);

    // Remove from local state
    setTimerWorkoutData(prev => {
      const remaining = prev.filter(w => w.name !== workoutName);
      // Select first remaining if deleted was selected (scheduled after render)
      if (timerSelectedWorkout === workoutName && remaining.length > 0) {
        setTimeout(() => setTimerSelectedWorkout(remaining[0].name), 0);
      }
      // Persist updated order (scheduled after render)
      if (user) {
        setTimeout(() => {
          setWorkoutOrder(user.uid, remaining.map(w => w.name))
            .catch(err => console.error('Failed to save workout order:', err));
        }, 0);
      }
      return remaining;
    });

    // Remove from weekly schedule if scheduled
    const hasScheduled = Object.values(weeklySchedule).some(v => v === workoutName);
    if (hasScheduled) {
      const cleaned = { ...weeklySchedule };
      for (const day in cleaned) {
        if (cleaned[day] === workoutName) cleaned[day] = null;
      }
      setWeeklyScheduleState(cleaned);
      if (user) {
        setWeeklySchedule(user.uid, cleaned).catch(err => console.error('Failed to clean schedule:', err));
      }
    }

    // Persist to Firestore
    if (user) {
      deleteUserWorkout(user.uid, workoutName, isDefault)
        .catch(err => console.error('Failed to delete workout:', err));
    }
  };

  const handleReorderWorkouts = (reordered) => {
    setTimerWorkoutData(reordered);
    if (user) {
      setWorkoutOrder(user.uid, reordered.map(w => w.name))
        .catch(err => console.error('Failed to save workout order:', err));
    }
  };

  const handleStartWorkout = () => {
    let workoutType = currentEditPage;
    const workoutName = currentEditingWorkout;

    if (!workoutType && workoutName) {
      if (timerWorkouts.includes(workoutName)) {
        workoutType = 'timer';
      } else if (stopwatchWorkouts.includes(workoutName)) {
        workoutType = 'stopwatch';
      }
    }

    if (!workoutType || (workoutType !== 'timer' && workoutType !== 'stopwatch')) {
      console.error('Invalid workout type:', workoutType, 'for workout:', workoutName);
      return;
    }

    if (workoutType === 'timer') {
      setTimerSelectedWorkout(workoutName);
    } else if (workoutType === 'stopwatch') {
      setStopwatchSelectedWorkout(workoutName);
    }

    setActiveTab(workoutType);
    setCurrentEditPage(null);
    setCurrentEditLevel('categories');
    setCurrentEditingWorkout(null);
  };

  const handleStopwatchLap = () => {
    if (stopwatchState.isRunning) {
      setStopwatchState(prev => ({
        ...prev,
        laps: [...prev.laps, prev.time]
      }));
    }
  };

  const handleWorkoutViewToggle = () => {
    if (!stopwatchState.isRunning) {
      setShowWorkoutView(!showWorkoutView);
      if (!showWorkoutView) {
        setCurrentWorkoutIndex(selectedWorkoutIndex >= 0 ? selectedWorkoutIndex : 0);
      } else {
        setSelectedWorkoutIndex(currentWorkoutIndex);
      }
    }
  };

  const handleWorkoutSwipe = (direction) => {
    if (showWorkoutView) {
      const currentExercises = getExerciseList(stopwatchSelectedWorkout);
      const maxIndex = currentExercises.length - 1;
      if (direction === 'left') {
        setCurrentWorkoutIndex(prev => prev === maxIndex ? 0 : prev + 1);
      } else if (direction === 'right') {
        setCurrentWorkoutIndex(prev => prev === 0 ? maxIndex : prev - 1);
      }
    }
  };

  const handleWorkoutSelect = (index) => {
    setSelectedWorkoutIndex(index);
  };

  const handleLapBarTap = () => {
    if (stopwatchState.laps.length > 0) {
      setShowLapTimes(true);
    }
  };

  const handleLapBarTouchStart = (e) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleLapBarTouchMove = (e) => {
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY - touchY;

    if (deltaY > 50 && stopwatchState.laps.length > 0 && !showLapTimes) {
      setShowLapTimes(true);
    } else if (deltaY < -50 && showLapTimes && !isClosingLapTimes) {
      handleCloseLapTimes();
    }
  };

  const handleLapBarTouchEnd = () => {
    setTouchStartY(0);
  };

  const handleCloseLapTimes = () => {
    if (!isClosingLapTimes) {
      setIsClosingLapTimes(true);
      setTimeout(() => {
        setShowLapTimes(false);
        setIsClosingLapTimes(false);
      }, 300);
    }
  };

  const formatLapTime = (timeInMs) => {
    const minutes = Math.floor(timeInMs / 60000);
    const seconds = Math.floor((timeInMs % 60000) / 1000);
    const centiseconds = Math.floor((timeInMs % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    if (activeTab === 'timer' && !currentEditPage) {
      return null; // Timer is always rendered outside renderContent
    }

    if (activeTab === 'stats' && !currentEditPage) {
      return (
        <StatsPage
          user={user}
          history={workoutHistory}
          loading={historyLoading}
          onLoginClick={() => setShowLoginModal(true)}
          timerWorkoutData={timerWorkoutData}
          stopwatchWorkoutData={stopwatchWorkoutData}
          prepTime={prepTime}
          globalRestTime={restTime}
          onStartWorkout={handleHomeStartWorkout}
          defaultWorkoutNames={[...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name)}
          followingIds={followingIds}
          followerIds={followerIds}
          pinnedWorkouts={pinnedWorkouts}
          onPinnedWorkoutsChange={handlePinnedWorkoutsChange}
          onWorkoutAdded={refreshWorkouts}
          onProfileClick={() => setShowSideMenu(true)}
          openProfilePopup={openProfilePopup}
          onProfilePopupOpened={() => setOpenProfilePopup(false)}
          onShareWorkout={openSendWorkout}
        />
      );
    }

    if (currentEditLevel === 'exercise-edit' && currentEditingWorkout) {
      const exercises = getExerciseList(currentEditingWorkout);
      return (
        <ExerciseEditPage
          workoutName={currentEditingWorkout}
          exercises={exercises}
          onSave={handleExerciseSave}
          onBack={handleEditPageBack}
          workoutType={currentEditPage}
          onStart={handleStartWorkout}
        />
      );
    }

    if (currentEditPage) {
      const workouts = currentEditPage === 'timer' ? timerWorkouts : stopwatchWorkouts;
      const selectedWorkout = currentEditPage === 'timer' ? timerSelectedWorkout : stopwatchSelectedWorkout;

      return (
        <EditPage
          type={currentEditPage}
          level={currentEditLevel}
          workouts={workouts}
          selectedWorkout={selectedWorkout}
          onWorkoutSelect={(workout) => handleWorkoutSelection(currentEditPage, workout)}
          onArrowClick={(workout) => handleEditWorkoutSelect(currentEditPage, workout)}
          onBack={handleEditPageBack}
          onNavigateToTab={handleNavigateToTab}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <Home
            timerWorkoutData={timerWorkoutData}
            timerSelectedWorkout={timerSelectedWorkout}
            workoutHistory={workoutHistory}
            onWorkoutSelect={handleWorkoutSelection}
            onArrowClick={handleEditWorkoutSelect}
            onNavigateToTab={handleNavigateToTab}
            onDeleteWorkout={handleDeleteWorkout}
            onReorder={handleReorderWorkouts}
            onBellClick={() => { if (user) { setFeedLastViewed(localStorage.getItem(`feedLastViewed_${user.uid}`) || null); localStorage.setItem(`feedLastViewed_${user.uid}`, new Date().toISOString()); } setHasUnread(false); setShowFeedPage(true); }}
            hasUnread={hasUnread}
            onLoginClick={() => setShowLoginModal(true)}
            onProfileClick={() => setShowSideMenu(true)}
            prepTime={prepTime}
            globalRestTime={restTime}
            onDetailSave={handleDetailSave}
            onStartWorkout={handleHomeStartWorkout}
            defaultWorkoutNames={[...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name)}
            onVisibilityToggle={handleVisibilityToggle}
            requestCloseDetail={homeDetailCloseRequested}
            showCardPhotos={showCardPhotos}
            onShareWorkout={openSendWorkout}
            onScheduleWorkout={openSchedulePopup}
            weeklySchedule={weeklySchedule}
          />
        );
      case 'stats':
        return (
          <StatsPage
            user={user}
            history={workoutHistory}
            loading={historyLoading}
            timerWorkoutData={timerWorkoutData}
            stopwatchWorkoutData={stopwatchWorkoutData}
            prepTime={prepTime}
            globalRestTime={restTime}
            onStartWorkout={handleHomeStartWorkout}
            defaultWorkoutNames={[...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name)}
            pinnedWorkouts={pinnedWorkouts}
            onPinnedWorkoutsChange={handlePinnedWorkoutsChange}
            onWorkoutAdded={refreshWorkouts}
            onProfileClick={() => setShowSideMenu(true)}
            openProfilePopup={openProfilePopup}
            onProfilePopupOpened={() => setOpenProfilePopup(false)}
            onShareWorkout={openSendWorkout}
          />
        );
      default:
        return (
          <Home
            timerWorkoutData={timerWorkoutData}
            timerSelectedWorkout={timerSelectedWorkout}
            workoutHistory={workoutHistory}
            onWorkoutSelect={handleWorkoutSelection}
            onArrowClick={handleEditWorkoutSelect}
            onNavigateToTab={handleNavigateToTab}
            onDeleteWorkout={handleDeleteWorkout}
            onReorder={handleReorderWorkouts}
            onBellClick={() => { if (user) { setFeedLastViewed(localStorage.getItem(`feedLastViewed_${user.uid}`) || null); localStorage.setItem(`feedLastViewed_${user.uid}`, new Date().toISOString()); } setHasUnread(false); setShowFeedPage(true); }}
            hasUnread={hasUnread}
            onLoginClick={() => setShowLoginModal(true)}
            onProfileClick={() => setShowSideMenu(true)}
            prepTime={prepTime}
            globalRestTime={restTime}
            onDetailSave={handleDetailSave}
            onStartWorkout={handleHomeStartWorkout}
            defaultWorkoutNames={[...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name)}
            onVisibilityToggle={handleVisibilityToggle}
            requestCloseDetail={homeDetailCloseRequested}
            showCardPhotos={showCardPhotos}
            onShareWorkout={openSendWorkout}
            onScheduleWorkout={openSchedulePopup}
            weeklySchedule={weeklySchedule}
          />
        );
    }
  };

  return (
    <main
      className={`tab-content tab-${activeTab}`}
      style={{
        '--color-active': activeColor,
        '--color-active-rgb': hexToRgb(activeColor),
        '--color-rest': restColor,
        '--color-rest-rgb': hexToRgb(restColor),
      }}
    >
      {showPwaBanner && (
        <div className="pwa-banner-wrap" ref={pwaBannerRef}>
          <div className="pwa-banner-pill" />
          <div
            className="pwa-banner"
            ref={(el) => {
              if (!el || el._swipeAttached) return;
              el._swipeAttached = true;
              let startY = 0, dy = 0;
              el.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; dy = 0; el.style.transition = 'none'; }, { passive: true });
              el.addEventListener('touchmove', (e) => {
                dy = e.touches[0].clientY - startY;
                if (dy < 0) el.style.transform = `translateY(${dy}px)`;
              }, { passive: true });
              el.addEventListener('touchend', () => {
                if (dy < -40) {
                  el.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
                  el.style.transform = 'translateY(-100%)';
                  el.style.opacity = '0';
                  setTimeout(() => { setShowPwaBanner(false); localStorage.setItem('pwa_banner_dismissed', '1'); }, 200);
                } else {
                  el.style.transition = 'transform 0.2s ease';
                  el.style.transform = 'translateY(0)';
                }
              });
            }}
          >
            <div className="pwa-banner-icon">
              <img src="/logo192.png" alt="HIITem" />
            </div>
            <div className="pwa-banner-text">
              <div className="pwa-banner-title-row">
                <span className="pwa-banner-title">HIITem</span>
                <span className="pwa-banner-now">now</span>
              </div>
              <span className="pwa-banner-body">{(() => {
                const ua = navigator.userAgent;
                const isIOS = /iPhone|iPad|iPod/i.test(ua);
                if (!isIOS) return 'Tap ⋮ → "Add to Home Screen"';
                const isSafari = !(/CriOS|FxiOS|OPiOS|EdgiOS|GSA\//i.test(ua));
                if (isSafari) return <>Tap Share <svg className="pwa-share-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then "Add to Home Screen"</>;
                return <>Open in Safari, tap Share <svg className="pwa-share-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then "Add to Home Screen"</>;
              })()}</span>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: activeTab === 'timer' && !currentEditPage ? 'block' : 'none' }}>
        <Timer
          timeLeft={timerState.timeLeft}
          isRunning={timerState.isRunning}
          targetTime={timerState.targetTime}
          selectedWorkoutIndex={timerState.selectedWorkoutIndex}
          onTimerStateChange={handleTimerStateChange}
          workouts={getExerciseList(timerSelectedWorkout)}
          selectedWorkoutName={timerSelectedWorkout}
          activeColor={activeColor}
          restColor={restColor}
          sidePlankAlertEnabled={sidePlankAlertEnabled}
          prepTime={prepTime}
          restTime={(() => {
            const selectedW = timerWorkoutData.find(w => w.name === timerSelectedWorkout);
            return selectedW?.restTime != null ? selectedW.restTime : restTime;
          })()}
          activeLastMinute={activeLastMinute}
          shuffleExercises={shuffleExercises}
          initialLoad={initialLoad}
          workoutReady={workoutReady}
          onInitialLoadDone={() => setInitialLoad(false)}
          isVisible={activeTab === 'timer' && !currentEditPage}
        />
      </div>
      {renderContent()}
      {!currentEditPage && currentEditLevel !== 'exercise-edit' && (
        <TabBar
          activeTab={activeTab}
          isTimerRunning={timerState.isRunning}
          activeColor={activeColor}
          onTabChange={(tab) => {
            if (tab === 'home' && activeTab === 'home') {
              setHomeDetailCloseRequested(true);
              setTimeout(() => setHomeDetailCloseRequested(false), 50);
            }
            setActiveTab(tab);
            if (showFeedPage) setFeedCloseRequested(true);
            if (showSideMenu) setSideMenuCloseRequested(true);
            if (showLoginModal) setLoginModalCloseRequested(true);
          }}
        />
      )}
      <FeedPage
        isOpen={showFeedPage}
        onClose={() => { setShowFeedPage(false); setFeedCloseRequested(false); }}
        requestClose={feedCloseRequested}
        onViewProfile={(profile) => {
          setViewUserProfile(profile);
        }}
        onStartWorkout={handleHomeStartWorkout}
        onViewPostWorkout={openFeedDetail}
        onWorkoutAdded={refreshWorkouts}
        onHistoryRecorded={refreshHistory}
        acceptedPostId={feedAcceptedPostId}
        allWorkouts={[...timerWorkoutData, ...stopwatchWorkoutData]}
        lastViewedAt={feedLastViewed}
        externalFollowedUid={lastFollowedUid}
      />
      {viewUserProfile && (
        <ProfilePopup
          profile={viewUserProfile}
          user={user}
          allWorkouts={[...timerWorkoutData, ...stopwatchWorkoutData]}
          onClose={() => setViewUserProfile(null)}
          onStartWorkout={handleHomeStartWorkout}
          onWorkoutAdded={refreshWorkouts}
          onShareWorkout={openSendWorkout}
          onFollowChanged={(uid) => setLastFollowedUid(uid)}
          prepTime={prepTime}
          globalRestTime={restTime}
        />
      )}
      {feedDetailPost && (
        <div
          className={`stats-detail-overlay ${feedDetailClosing ? 'closing' : ''}`}
          style={{ zIndex: 520 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeFeedDetail(); }}
        >
          <div className="stats-detail-panel feed-detail-animate">
            <div className="stats-detail-header">
              <div className="stats-detail-creator">
                {feedDetailOwner?.photoURL ? (
                  <img src={feedDetailOwner.photoURL} alt="" className="stats-detail-creator-icon" referrerPolicy="no-referrer" />
                ) : (
                  <img src="/logo192.png" alt="" className="stats-detail-creator-icon" />
                )}
              </div>
              <div className={`stats-detail-title-group ${feedDetailTags.length > 0 ? 'has-tags' : ''}`}>
                <h2 className="stats-detail-name">{feedDetailPost.workoutName}</h2>
                {feedDetailTags.length > 0 && (
                  <div className="stats-detail-tags-row">
                    {feedDetailTags.map(t => (
                      <span key={t} className="stats-detail-tag-pill">{t.toUpperCase()}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="stats-detail-header-actions">
                {feedDetailIsOwn ? (
                  <button className="stats-detail-share-btn" onClick={() => {
                    const workout = { name: feedDetailPost.workoutName, type: feedDetailPost.workoutType || 'timer', exercises: feedDetailPost.exercises || [] };
                    openSendWorkout(workout);
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                      <polyline points="16 6 12 2 8 6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </button>
                ) : (
                  <button
                    className={`stats-detail-share-btn ${feedDetailTaken ? 'taken' : ''}`}
                    onClick={handleFeedDetailTake}
                  >
                    {feedDetailSaving ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" className="stats-take-spinner">
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="42" strokeLinecap="round"/>
                      </svg>
                    ) : feedDetailTaken ? (
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
                )}
                <button className="stats-detail-close-btn" onClick={closeFeedDetail}>
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
                  <span>{Math.floor((feedDetailPost.duration || 0) / 60)}:{((feedDetailPost.duration || 0) % 60).toString().padStart(2, '0')}</span>
                  <span className="stats-detail-dot">&middot;</span>
                  <span>{feedDetailPost.exerciseCount || (feedDetailPost.exercises || []).length} exercises</span>
                </div>
                <span className="stats-detail-rest-display">
                  {feedDetailRestTime != null ? feedDetailRestTime : restTime}s rest between exercises
                </span>
              </div>
            </div>

            {feedDetailPost.exercises && feedDetailPost.exercises.length > 0 && (
              <div className="stats-detail-exercises">
                {feedDetailPost.exercises.map((exercise, i) => (
                  <div key={`${exercise}-${i}`} className="stats-detail-exercise">
                    <span className="stats-detail-exercise-num">{i + 1}</span>
                    <span className="stats-detail-exercise-name">{exercise}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="stats-detail-start-btn"
              onClick={() => {
                closeFeedDetail();
                setShowFeedPage(false);
                setFeedCloseRequested(false);
                handleHomeStartWorkout(feedDetailPost.workoutName);
              }}
            >
              Start Workout
            </button>
          </div>
        </div>
      )}
      <SideMenu
        isOpen={showSideMenu}
        onClose={() => { setShowSideMenu(false); setSideMenuCloseRequested(false); }}
        requestClose={sideMenuCloseRequested}
        autoShareEnabled={autoShareEnabled}
        onToggleAutoShare={handleToggleAutoShare}
        newWorkoutsPublic={newWorkoutsPublic}
        onToggleNewWorkoutsPublic={handleToggleNewWorkoutsPublic}
        sidePlankAlertEnabled={sidePlankAlertEnabled}
        onToggleSidePlankAlert={handleToggleSidePlankAlert}
        prepTime={prepTime}
        onPrepTimeChange={handlePrepTimeChange}
        restTime={restTime}
        onRestTimeChange={handleRestTimeChange}
        activeLastMinute={activeLastMinute}
        onToggleActiveLastMinute={handleToggleActiveLastMinute}
        shuffleExercises={shuffleExercises}
        onToggleShuffleExercises={handleToggleShuffleExercises}
        activeColor={activeColor}
        restColor={restColor}
        onColorChange={handleColorChange}
        showCardPhotos={showCardPhotos}
        onToggleShowCardPhotos={handleToggleShowCardPhotos}
        onOpenProfile={() => {
          setSideMenuCloseRequested(true);
          setActiveTab('stats');
          setOpenProfilePopup(true);
        }}
      />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => { setShowLoginModal(false); setLoginModalCloseRequested(false); }}
        requestClose={loginModalCloseRequested}
      />
      {showSharePrompt && (
        <SharePrompt
          onShare={handleSharePromptAccept}
          onDismiss={handleSharePromptDismiss}
        />
      )}
      {privateShareWorkout && (
        <div
          className="stats-follow-overlay"
          style={{ zIndex: 710 }}
          onClick={(e) => { if (e.target === e.currentTarget) setPrivateShareWorkout(null); }}
        >
          <div className="private-share-prompt">
            <div className="private-share-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <p className="private-share-title">This workout is private</p>
            <p className="private-share-desc">Make it public to share with others</p>
            <div className="private-share-actions">
              <button className="private-share-public-btn" onClick={handleMakePublicAndShare}>
                Make Public & Share
              </button>
              <button className="private-share-cancel-btn" onClick={() => setPrivateShareWorkout(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {sendWorkout && (
        <div
          className={`stats-follow-overlay ${sendWorkoutClosing ? 'closing' : ''}`}
          style={{ zIndex: 700 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeSendWorkout(); }}
        >
          <div className="stats-follow-panel" ref={sendWorkoutPanelRef}>
            <div className="stats-follow-panel-header">
              <span className="stats-send-title">Send to</span>
              <button className="stats-follow-panel-close" onClick={closeSendWorkout}>
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
              value={sendWorkoutSearch}
              onChange={(e) => {
                const val = e.target.value;
                if (!sendWorkoutSearch && val) {
                  const panel = sendWorkoutPanelRef.current;
                  if (panel) panel.style.minHeight = panel.offsetHeight + 'px';
                } else if (sendWorkoutSearch && !val) {
                  const panel = sendWorkoutPanelRef.current;
                  if (panel) panel.style.minHeight = '';
                }
                setSendWorkoutSearch(val);
              }}
            />
            <div className="stats-follow-panel-list">
              {sendWorkoutProfiles.length === 0 ? (
                <div className="stats-follow-panel-empty">Not following anyone yet</div>
              ) : (
                sendWorkoutProfiles
                  .filter(p => !sendWorkoutSearch || (p.displayName || '').toLowerCase().includes(sendWorkoutSearch.toLowerCase()))
                  .map((p, i) => (
                  <div
                    key={p.uid}
                    className="stats-follow-panel-item"
                    style={{ animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
                    onClick={() => handleSendToUser(p)}
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
                    <span className="stats-follow-panel-name" style={{ flex: 1 }}>{p.displayName}</span>
                    <div className={`stats-send-check ${sentTo[p.uid] ? 'selected' : ''}`}>
                      {sentTo[p.uid] && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              className={`stats-send-submit ${Object.keys(sentTo).length > 0 ? '' : 'disabled'}`}
              disabled={Object.keys(sentTo).length === 0}
              onClick={() => {
                if (Object.keys(sentTo).length === 0 || !user || !sendWorkout) return;
                const recipientUids = Object.keys(sentTo);
                recipientUids.forEach(uid => {
                  createShareNotification({
                    recipientUid: uid,
                    actorUid: user.uid,
                    actorName: user.displayName,
                    actorPhotoURL: user.photoURL,
                    workoutName: sendWorkout.name,
                    workoutType: sendWorkout.type,
                    exercises: sendWorkout.exercises,
                    restTime: sendWorkout.restTime ?? null,
                    tags: sendWorkout.tags || null,
                    creatorUid: sendWorkout.creatorUid || user.uid,
                    creatorName: sendWorkout.creatorName || user.displayName,
                    creatorPhotoURL: sendWorkout.creatorPhotoURL || user.photoURL,
                  }).catch(err => console.error('Share notif failed:', err));
                });
                setHasUnread(true);
                closeSendWorkout();
              }}
            >
              Send{Object.keys(sentTo).length > 0 ? ` (${Object.keys(sentTo).length})` : ''}
            </button>
          </div>
        </div>
      )}
      {scheduleWorkout && (
        <div
          className={`schedule-overlay ${scheduleClosing ? 'closing' : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeSchedulePopup(); }}
        >
          <div className="schedule-panel">
            <div className="schedule-header">
              <div className="schedule-title-group">
                <span className="schedule-label">Schedule</span>
                <span className="schedule-workout-name">{scheduleWorkout.name}</span>
              </div>
              <button className="schedule-close" onClick={closeSchedulePopup}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="schedule-days-vertical">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, i) => {
                const assigned = scheduleDraft[i];
                const isThisWorkout = assigned === scheduleWorkout.name;
                const isToday = i === new Date().getDay();
                return (
                  <button
                    key={i}
                    className={`schedule-row${isThisWorkout ? ' active' : ''}${isToday ? ' today' : ''}`}
                    onClick={() => handleScheduleDaySelect(i)}
                  >
                    <span className="schedule-row-day">{dayName}</span>
                    <div className="schedule-row-right">
                      {assigned ? (
                        <span className={`schedule-row-workout${isThisWorkout ? ' current' : ''}`}>
                          {assigned}
                        </span>
                      ) : (
                        <span className="schedule-row-rest">Rest</span>
                      )}
                      <span className={`schedule-row-check${isThisWorkout ? ' checked' : ''}`}>
                        {isThisWorkout ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                          </svg>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              className={`schedule-save-btn${JSON.stringify(scheduleDraft) === JSON.stringify(weeklySchedule) ? ' disabled' : ''}`}
              disabled={JSON.stringify(scheduleDraft) === JSON.stringify(weeklySchedule)}
              onClick={handleScheduleSave}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Main;
