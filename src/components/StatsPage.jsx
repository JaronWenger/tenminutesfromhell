import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { getUserProfiles } from '../firebase/social';
import './StatsPage.css';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const StatsPage = ({
  user,
  history,
  loading,
  onLoginClick,
  timerWorkoutData = [],
  stopwatchWorkoutData = [],
  prepTime = 15,
  globalRestTime = 15,
  onStartWorkout,
  defaultWorkoutNames = [],
  followingIds: propFollowingIds = [],
  followerIds: propFollowerIds = [],
  pinnedWorkouts = [],
  onPinnedWorkoutsChange
}) => {
  const calendarScrollRef = useRef(null);

  // Selected year for heatmap
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

  // Selected week (null = current week)
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [highlightedWeek, setHighlightedWeek] = useState(null);
  const highlightTimerRef = useRef(null);

  // Chart scrub state
  const [scrubIndex, setScrubIndex] = useState(null);
  const chartContainerRef = useRef(null);

  // Following/followers from props (cached in main.jsx)
  const followingIds = propFollowingIds;
  const followerIds = propFollowerIds;
  const followingCount = followingIds.length;
  const followersCount = followerIds.length;

  // Follow list popup
  const [followListType, setFollowListType] = useState(null); // null | 'following' | 'followers'
  const [followListProfiles, setFollowListProfiles] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListClosing, setFollowListClosing] = useState(false);

  // Detail popup state (FLIP animation)
  const [detailWorkout, setDetailWorkout] = useState(null);
  const [detailPhase, setDetailPhase] = useState(null); // null | 'entering' | 'open' | 'leaving'
  const [detailRect, setDetailRect] = useState(null);
  const panelRef = useRef(null);
  const cardRefs = useRef({});

  // Close year dropdown on outside click
  useEffect(() => {
    if (!yearDropdownOpen) return;
    const handler = (e) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setYearDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [yearDropdownOpen]);


  const handleCellClick = useCallback((sundayKey) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentSunday = new Date(today);
    currentSunday.setDate(today.getDate() - dayOfWeek);
    const currentSundayKey = `${currentSunday.getFullYear()}-${String(currentSunday.getMonth() + 1).padStart(2, '0')}-${String(currentSunday.getDate()).padStart(2, '0')}`;

    if (sundayKey === currentSundayKey) {
      setSelectedWeekStart(null);
    } else {
      const parts = sundayKey.split('-');
      setSelectedWeekStart(new Date(+parts[0], +parts[1] - 1, +parts[2]));
    }
    setHighlightedWeek(sundayKey);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedWeek(null), 300);
  }, []);

  // Daily duration map (date key -> total seconds)
  const dailyDurationMap = useMemo(() => {
    const entries = history || [];
    const map = {};
    entries.forEach(e => {
      const d = e.completedAt || e.date;
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (e.duration || 0);
    });
    return map;
  }, [history]);

  // Daily workout names map (date key -> array of workout names)
  const dailyWorkoutsMap = useMemo(() => {
    const entries = history || [];
    const map = {};
    entries.forEach(e => {
      const d = e.completedAt || e.date;
      if (!d || !e.workoutName) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(e.workoutName);
    });
    return map;
  }, [history]);

  // Years that have workout data (always includes current year)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear]);
    (history || []).forEach(e => {
      const d = e.completedAt || e.date;
      if (d) years.add(d.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [history]);

  const stats = useMemo(() => {
    const entries = history || [];

    const totalSeconds = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

    const dailyMap = {};
    entries.forEach(e => {
      const d = e.completedAt || e.date;
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyMap[key] = (dailyMap[key] || 0) + 1;
    });

    return { totalHours, totalMinutes, totalSeconds, totalWorkouts: entries.length, dailyMap };
  }, [history]);

  // Week chart: minutes trained per day (Sun-Sat) for selected or current week
  const weekChart = useMemo(() => {
    const today = new Date();
    let sunday;
    if (selectedWeekStart) {
      sunday = new Date(selectedWeekStart);
    } else {
      const dayOfWeek = today.getDay();
      sunday = new Date(today);
      sunday.setDate(today.getDate() - dayOfWeek);
    }

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isFuture = d > today;
      days.push({
        label: DAY_LABELS[i],
        minutes: isFuture ? null : Math.round((dailyDurationMap[key] || 0) / 60),
        seconds: isFuture ? 0 : (dailyDurationMap[key] || 0),
        workouts: dailyWorkoutsMap[key] || [],
        date: d,
        isToday: d.toDateString() === today.toDateString(),
        isFuture
      });
    }
    return days;
  }, [dailyDurationMap, dailyWorkoutsMap, selectedWeekStart]);

  // Week streak + record
  const { weekStreak, weekStreakRecord } = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const thisSunday = new Date(today);
    thisSunday.setDate(today.getDate() - dayOfWeek);
    thisSunday.setHours(0, 0, 0, 0);

    const weekHasWorkout = (sunday) => {
      for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (stats.dailyMap[key]) return true;
      }
      return false;
    };

    let streak = 0;
    let check = new Date(thisSunday);
    while (weekHasWorkout(check)) {
      streak++;
      check.setDate(check.getDate() - 7);
    }

    let record = streak;
    const entries = Object.keys(stats.dailyMap);
    if (entries.length > 0) {
      const dates = entries.map(k => new Date(k + 'T00:00:00'));
      const earliest = new Date(Math.min(...dates));
      const earliestSunday = new Date(earliest);
      earliestSunday.setDate(earliestSunday.getDate() - earliestSunday.getDay());

      let scanWeek = new Date(earliestSunday);
      let currentRun = 0;
      while (scanWeek <= thisSunday) {
        if (weekHasWorkout(scanWeek)) {
          currentRun++;
          if (currentRun > record) record = currentRun;
        } else {
          currentRun = 0;
        }
        scanWeek.setDate(scanWeek.getDate() + 7);
      }
    }

    return { weekStreak: streak, weekStreakRecord: record };
  }, [stats.dailyMap]);

  // Build calendar grid
  const calendarData = useMemo(() => {
    const today = new Date();
    const year = selectedYear;

    // Jan 1 of selected year
    const jan1 = new Date(year, 0, 1);
    // Start from the Sunday on or before Jan 1
    const startDay = new Date(jan1);
    startDay.setDate(jan1.getDate() - jan1.getDay());

    // Dec 31 of current year
    const dec31 = new Date(year, 11, 31);
    // End on the Saturday on or after Dec 31
    const endDay = new Date(dec31);
    endDay.setDate(dec31.getDate() + (6 - dec31.getDay()));

    const weeks = [];
    const monthLabels = [];
    let currentDate = new Date(startDay);
    let weekIndex = 0;
    let todayWeekIndex = 0;

    while (currentDate <= endDay) {
      const week = [];
      const weekSunday = new Date(currentDate);
      const sundayKey = `${weekSunday.getFullYear()}-${String(weekSunday.getMonth() + 1).padStart(2, '0')}-${String(weekSunday.getDate()).padStart(2, '0')}`;
      for (let day = 0; day < 7; day++) {
        if (currentDate <= endDay) {
          const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          const isFuture = currentDate > today;
          if (currentDate.toDateString() === today.toDateString()) {
            todayWeekIndex = weekIndex;
          }
          week.push({
            date: key,
            count: stats.dailyMap[key] || 0,
            isFuture,
            sundayKey
          });

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
  }, [stats.dailyMap, selectedYear]);

  const getHeatColor = (count, isFuture) => {
    if (isFuture) return 'var(--heat-empty)';
    if (count === 0) return 'var(--heat-empty)';
    if (count === 1) return 'var(--heat-1)';
    if (count === 2) return 'var(--heat-2)';
    if (count === 3) return 'var(--heat-3)';
    return 'var(--heat-4)';
  };

  // Mock data for logged-out state
  const mockStats = {
    totalHours: 42,
    totalMinutes: 15,
    totalWorkouts: 156,
  };

  const mockWeekChart = [
    { label: 'S', minutes: 15, isToday: false, isFuture: false },
    { label: 'M', minutes: 22, isToday: false, isFuture: false },
    { label: 'T', minutes: 11, isToday: false, isFuture: false },
    { label: 'W', minutes: 0, isToday: false, isFuture: false },
    { label: 'T', minutes: 33, isToday: false, isFuture: false },
    { label: 'F', minutes: 11, isToday: true, isFuture: false },
    { label: 'S', minutes: null, isToday: false, isFuture: true },
  ];
  const mockWeekStreak = 12;

  const mockDailyMap = useMemo(() => {
    const map = {};
    const today = new Date();
    let seed = 12345;
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const r = rand();
      if (r < 0.18) map[key] = 1;
      else if (r < 0.27) map[key] = 2;
      else if (r < 0.32) map[key] = 3;
      else if (r < 0.35) map[key] = 4;
    }
    return map;
  }, []);

  const mockCalendarData = useMemo(() => {
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
          week.push({ date: key, count: mockDailyMap[key] || 0, isFuture });
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
  }, [mockDailyMap]);

  const displayStats = user ? stats : mockStats;
  const displayCalendar = user ? calendarData : mockCalendarData;
  const displayWeekChart = user ? weekChart : mockWeekChart;
  const displayWeekStreak = user ? weekStreak : mockWeekStreak;
  const displayStreakRecord = user ? weekStreakRecord : mockWeekStreak;

  // Scroll heatmap so today's week is on the right edge
  useEffect(() => {
    const el = calendarScrollRef.current;
    if (!el) return;
    const cellWidth = 14; // 11px cell + 3px gap
    const todayIdx = displayCalendar.todayWeekIndex ?? 0;
    const scrollTarget = (todayIdx + 1) * cellWidth - el.clientWidth;
    el.scrollLeft = Math.max(0, scrollTarget);
  }, [displayCalendar]);

  // SVG line chart helpers
  const chartW = 320;
  const chartH = 126;
  const padLeft = 28;
  const padRight = 12;
  const padTop = 12;
  const padBot = 28;
  const plotH = chartH - padTop - padBot;
  const pastDays = displayWeekChart.filter(d => d.minutes !== null);
  const maxMin = Math.max(...pastDays.map(d => d.minutes), 1);

  const getX = (i) => padLeft + (i / 6) * (chartW - padLeft - padRight);
  const getY = (mins) => padTop + plotH - (mins / maxMin) * plotH;

  // Y-axis ticks
  const yTicks = maxMin <= 5
    ? Array.from({ length: maxMin + 1 }, (_, i) => i)
    : [0, Math.round(maxMin / 2), maxMin];

  // Build line path + points only for non-future days
  const linePoints = displayWeekChart
    .map((d, i) => d.minutes !== null ? { x: getX(i), y: getY(d.minutes), ...d, i } : null)
    .filter(Boolean);

  const linePath = linePoints.length > 1
    ? linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : '';

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getScrubIndex = useCallback((clientX) => {
    const el = chartContainerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const svgX = ratio * chartW;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < 7; i++) {
      const x = padLeft + (i / 6) * (chartW - padLeft - padRight);
      const dist = Math.abs(svgX - x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    return closest;
  }, [chartW, padLeft, padRight]);

  const handleScrubStart = useCallback((clientX) => {
    setScrubIndex(getScrubIndex(clientX));
  }, [getScrubIndex]);

  const handleScrubMove = useCallback((clientX) => {
    setScrubIndex(getScrubIndex(clientX));
  }, [getScrubIndex]);

  const handleScrubEnd = useCallback(() => {
    setScrubIndex(null);
  }, []);

  // All workouts
  const allWorkouts = useMemo(() => {
    return [...timerWorkoutData, ...stopwatchWorkoutData];
  }, [timerWorkoutData, stopwatchWorkoutData]);

  // Only owned workouts for the pin picker (forked defaults or custom)
  const ownedWorkouts = useMemo(() => {
    return allWorkouts.filter(w => w.forked || !defaultWorkoutNames.includes(w.name));
  }, [allWorkouts, defaultWorkoutNames]);

  // Resolved pinned workout objects (filter out stale names)
  const pinnedWorkoutObjects = useMemo(() => {
    return pinnedWorkouts
      .map(name => allWorkouts.find(w => w.name === name))
      .filter(Boolean);
  }, [pinnedWorkouts, allWorkouts]);

  // Pin picker popup state
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [pinPickerClosing, setPinPickerClosing] = useState(false);
  const [pinLimitFlash, setPinLimitFlash] = useState(false);
  const [pinPulseHint, setPinPulseHint] = useState(false);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openFollowList = async (type) => {
    setFollowListType(type);
    setFollowListLoading(true);
    setFollowListClosing(false);
    setFollowListProfiles([]);
    try {
      const ids = type === 'following' ? followingIds : followerIds;
      const profiles = await getUserProfiles(ids);
      setFollowListProfiles(profiles);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
    setFollowListLoading(false);
  };

  const closeFollowList = () => {
    setFollowListClosing(true);
    setTimeout(() => {
      setFollowListType(null);
      setFollowListClosing(false);
      setFollowListProfiles([]);
    }, 200);
  };

  const openDetail = useCallback((workout) => {
    const el = cardRefs.current[workout.name];
    const rect = el ? el.getBoundingClientRect() : null;
    setDetailRect(rect);
    setDetailWorkout(workout);
    setDetailPhase('entering');
  }, []);

  // FLIP open animation
  useLayoutEffect(() => {
    if (detailPhase !== 'entering' || !panelRef.current) return;

    if (!detailRect) {
      setDetailPhase('open');
      return;
    }

    const panel = panelRef.current;
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

    const panel = panelRef.current;
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

  const handleShare = async (workout) => {
    const shareText = `${workout.name} - ${workout.exercises.length} exercises`;
    if (navigator.share) {
      try {
        await navigator.share({ title: workout.name, text: shareText });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const detailOpen = detailWorkout && detailPhase !== 'leaving';

  const openPinPicker = () => {
    setShowPinPicker(true);
    setPinPickerClosing(false);
  };

  const closePinPicker = () => {
    setPinPickerClosing(true);
    setTimeout(() => {
      setShowPinPicker(false);
      setPinPickerClosing(false);
    }, 200);
  };

  const handlePinToggle = (workoutName) => {
    if (pinnedWorkouts.includes(workoutName)) {
      const updated = pinnedWorkouts.filter(n => n !== workoutName);
      if (onPinnedWorkoutsChange) onPinnedWorkoutsChange(updated);
      return;
    }
    if (pinnedWorkouts.length >= 3) {
      setPinLimitFlash(true);
      setPinPulseHint(true);
      setTimeout(() => { setPinLimitFlash(false); setPinPulseHint(false); }, 600);
      return;
    }
    const updated = [...pinnedWorkouts, workoutName];
    if (onPinnedWorkoutsChange) onPinnedWorkoutsChange(updated);
    closePinPicker();
  };


  const renderPinnedCard = (workout) => {
    const totalSeconds = (workout.exercises.length * 60) + prepTime;
    return (
      <div
        key={workout.name}
        ref={(el) => { cardRefs.current[workout.name] = el; }}
        className="stats-workout-card"
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
          </div>
        </div>
        <button
          className="stats-card-action-btn"
          onClick={(e) => { e.stopPropagation(); handleShare(workout); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      </div>
    );
  };

  const renderContent = () => (
    <div className={`stats-container ${detailOpen ? 'stats-detail-open' : ''}`}>
      {/* Profile Header — sticky */}
      <div className="stats-profile-header">
        <div className="stats-profile-left">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="stats-profile-pic" referrerPolicy="no-referrer" />
          ) : (
            <div className="stats-profile-pic stats-profile-pic-fallback">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          )}
          <div className="stats-profile-info">
            <span className="stats-profile-name">{user?.displayName || 'Guest'}</span>
            <div className="stats-follow-row">
              <button className="stats-follow-stat" onClick={() => openFollowList('following')}>
                <span className="stats-follow-num">{followingCount}</span>
                <span className="stats-follow-label">Following</span>
              </button>
              <button className="stats-follow-stat" onClick={() => openFollowList('followers')}>
                <span className="stats-follow-num">{followersCount}</span>
                <span className="stats-follow-label">Followers</span>
              </button>
            </div>
          </div>
        </div>
        <div className="stats-profile-right">
          <div className="stats-profile-time">
            {displayStats.totalHours > 0 && (
              <><span className="stats-profile-time-value">{displayStats.totalHours}</span><span className="stats-profile-time-unit">h </span></>
            )}
            <span className="stats-profile-time-value">{displayStats.totalMinutes}</span>
            <span className="stats-profile-time-unit">m</span>
          </div>
          <div className="stats-profile-time-label">Time Training</div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="stats-scroll-body">
        <div className="stats-content">
          {/* Activity Calendar */}
          <div className="stats-section">
            <h3 className="stats-section-title">Activity
              {availableYears.length <= 1 ? (
                <span className="stats-year-label">{selectedYear}</span>
              ) : (
                <div className="stats-year-dropdown" ref={yearDropdownRef}>
                  <button
                    className="stats-year-toggle"
                    onClick={() => setYearDropdownOpen(prev => !prev)}
                  >
                    {selectedYear}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points={yearDropdownOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
                    </svg>
                  </button>
                  {yearDropdownOpen && (
                    <div className="stats-year-menu">
                      {availableYears.map(y => (
                        <button
                          key={y}
                          className={`stats-year-option ${y === selectedYear ? 'active' : ''}`}
                          onClick={() => { setSelectedYear(y); setYearDropdownOpen(false); }}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </h3>
            <div className="calendar-scroll" ref={calendarScrollRef}>
              <div
                className="calendar-grid"
                style={{ minWidth: `${displayCalendar.numWeeks * 14}px` }}
              >
                <div
                  className="calendar-month-labels"
                  style={{ gridTemplateColumns: `repeat(${displayCalendar.numWeeks}, 1fr)` }}
                >
                  {displayCalendar.monthLabels.map((m, i) => (
                    <span
                      key={i}
                      className={`month-label ${/^\d{4}$/.test(m.label) ? 'year-label' : ''}`}
                      style={{ gridColumnStart: m.weekIndex + 1 }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
                <div className="calendar-cells">
                  {displayCalendar.weeks.map((week, wi) => (
                    <div
                      key={wi}
                      className={`calendar-week ${week[0]?.sundayKey === highlightedWeek ? 'selected' : ''}`}
                      onClick={() => week[0]?.sundayKey && handleCellClick(week[0].sundayKey)}
                    >
                      {week.map((day, di) => (
                        <div
                          key={di}
                          className="calendar-cell"
                          style={{ backgroundColor: getHeatColor(day.count, day.isFuture) }}
                          title={`${day.date}: ${day.count} workout${day.count !== 1 ? 's' : ''}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="stats-streak-sub">Week Streak: {displayWeekStreak} &middot; Best: {displayStreakRecord}</div>
          </div>

          {/* This Week Line Chart */}
          <div className="stats-section">
            <h3 className="stats-section-title">
              {scrubIndex !== null ? (() => {
                const d = displayWeekChart[scrubIndex]?.date;
                if (!d) return DAY_NAMES[scrubIndex];
                return d.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' });
              })() : (selectedWeekStart ? (() => {
                const end = new Date(selectedWeekStart);
                end.setDate(end.getDate() + 6);
                const fmt = (d) => d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
                return `${fmt(selectedWeekStart)} – ${fmt(end)}`;
              })() : 'This Week')}
              <span className="stats-section-title-detail">
                {(() => {
                  if (scrubIndex !== null) {
                    const m = displayWeekChart[scrubIndex]?.minutes ?? 0;
                    return `${m}m`;
                  }
                  const weekSecs = displayWeekChart.reduce((sum, d) => sum + (d.seconds || 0), 0);
                  if (weekSecs === 0) return '';
                  const h = Math.floor(weekSecs / 3600);
                  const m = Math.floor((weekSecs % 3600) / 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                })()}
              </span>
            </h3>
            <div
              className="week-line-chart"
              ref={chartContainerRef}
              onTouchStart={(e) => { e.preventDefault(); handleScrubStart(e.touches[0].clientX); }}
              onTouchMove={(e) => { e.preventDefault(); handleScrubMove(e.touches[0].clientX); }}
              onTouchEnd={handleScrubEnd}
              onMouseDown={(e) => handleScrubStart(e.clientX)}
              onMouseMove={(e) => { if (e.buttons === 1) handleScrubMove(e.clientX); }}
              onMouseUp={handleScrubEnd}
              onMouseLeave={handleScrubEnd}
            >
              <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" className="week-line-svg">
                {yTicks.map((val) => (
                  <g key={val}>
                    <line
                      x1={0}
                      x2={chartW}
                      y1={getY(val)}
                      y2={getY(val)}
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="1"
                    />
                    <text
                      x={2}
                      y={getY(val) + 1}
                      textAnchor="start"
                      dominantBaseline="middle"
                      fill="rgba(255,255,255,0.3)"
                      fontSize="9"
                    >
                      {val}
                    </text>
                  </g>
                ))}
                {scrubIndex !== null && (
                  <line
                    x1={getX(scrubIndex)}
                    x2={getX(scrubIndex)}
                    y1={padTop}
                    y2={chartH - padBot}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                )}
                {linePath && (
                  <path d={linePath} fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                )}
                {linePoints.map((p) => (
                  <circle
                    key={p.i}
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={p.minutes > 0 ? '#e74c3c' : '#333'}
                  />
                ))}
                {displayWeekChart.map((d, i) => (
                  <text
                    key={i}
                    x={getX(i)}
                    y={chartH - 2}
                    textAnchor="middle"
                    fill={d.isToday ? '#e74c3c' : 'rgba(255,255,255,0.3)'}
                    fontSize="10"
                    fontWeight={d.isToday ? '600' : '500'}
                  >
                    {d.label}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          {/* Pinned Workouts */}
          <div className="stats-section">
            <h3 className="stats-section-title">Pinned Workouts <span className="stats-section-title-detail">{pinnedWorkouts.length}/3</span></h3>
            <div className="stats-workout-cards">
              {pinnedWorkoutObjects.map(renderPinnedCard)}
              <div className="stats-pin-add" onClick={openPinPicker}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>Pin Workout</span>
              </div>
            </div>
          </div>

          {/* Pin Picker Popup */}
          {showPinPicker && (
            <div
              className={`stats-pin-picker-overlay ${pinPickerClosing ? 'closing' : ''}`}
              onClick={(e) => { if (e.target === e.currentTarget) closePinPicker(); }}
            >
              <div className="stats-pin-picker-panel">
                <div className="stats-pin-picker-header">
                  <span className="stats-pin-picker-title">Choose a Workout <span className={`stats-pin-picker-count ${pinLimitFlash ? 'flash-red' : ''}`}>{pinnedWorkouts.length}/3</span></span>
                  <button className="stats-pin-picker-close" onClick={closePinPicker}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div className="stats-pin-picker-list">
                  {ownedWorkouts.map(w => {
                    const alreadyPinned = pinnedWorkouts.includes(w.name);
                    return (
                      <button
                        key={w.name}
                        className={`stats-pin-picker-item ${alreadyPinned ? 'pinned' : ''}${alreadyPinned && pinPulseHint ? ' pulse-hint' : ''}`}
                        onClick={() => handlePinToggle(w.name)}
                      >
                        {w.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Popup */}
      {detailWorkout && (
        <div
          className={`stats-detail-overlay ${detailPhase === 'leaving' ? 'closing' : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
        >
          <div className="stats-detail-panel" ref={panelRef}>
            <div className="stats-detail-header">
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
                <button className="stats-detail-share-btn" onClick={() => handleShare(detailWorkout)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                </button>
                <button className="stats-detail-close-btn" onClick={closeDetail}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="stats-detail-meta">
              <span>{formatTime((detailWorkout.exercises.length * 60) + prepTime)}</span>
              <span className="stats-detail-dot">&middot;</span>
              <span>{detailWorkout.exercises.length} exercises</span>
              <span className="stats-detail-dot">&middot;</span>
              <span>Rest {detailWorkout.restTime != null ? detailWorkout.restTime : globalRestTime}s</span>
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
                closeDetail();
                if (onStartWorkout) onStartWorkout(detailWorkout.name);
              }}
            >
              Start Workout
            </button>
          </div>
        </div>
      )}

      {/* Follow List Popup */}
      {followListType && (
        <div
          className={`stats-follow-overlay ${followListClosing ? 'closing' : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeFollowList(); }}
        >
          <div className="stats-follow-panel">
            <div className="stats-follow-panel-header">
              <span className="stats-follow-panel-title">
                {followListType === 'following' ? 'Following' : 'Followers'}
              </span>
              <button className="stats-follow-panel-close" onClick={closeFollowList}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="stats-follow-panel-list">
              {followListLoading ? (
                <div className="stats-follow-panel-empty">Loading...</div>
              ) : followListProfiles.length === 0 ? (
                <div className="stats-follow-panel-empty">
                  {followListType === 'following' ? 'Not following anyone yet' : 'No followers yet'}
                </div>
              ) : (
                followListProfiles.map((p, i) => (
                  <div key={p.uid} className="stats-follow-panel-item" style={{ animationDelay: `${i * 40}ms` }}>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="stats-page">
        <div className="stats-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="stats-page">
      {!user && (
        <>
          <div className="stats-blur-wrapper">
            {renderContent()}
          </div>
          <div className="stats-signin-overlay">
            <button className="stats-signin-btn" onClick={onLoginClick}>
              Sign in to track your stats
            </button>
          </div>
        </>
      )}
      {user && renderContent()}
    </div>
  );
};

export default StatsPage;
