import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './StatsPage.css';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const StatsPage = ({ user, history, loading, onLoginClick }) => {
  const calendarScrollRef = useRef(null);

  const scrollToEnd = useCallback(() => {
    const el = calendarScrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToEnd, 50);
    return () => clearTimeout(timer);
  }, [scrollToEnd]);

  // Selected week (null = current week)
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [highlightedWeek, setHighlightedWeek] = useState(null);
  const highlightTimerRef = useRef(null);

  // Chart scrub state
  const [scrubIndex, setScrubIndex] = useState(null);
  const chartContainerRef = useRef(null);

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

    const exerciseMap = {};
    entries.forEach(e => {
      (e.exercises || []).forEach(name => {
        exerciseMap[name] = (exerciseMap[name] || 0) + 1;
      });
    });
    const exerciseRankings = Object.entries(exerciseMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const workoutMap = {};
    entries.forEach(e => {
      if (e.workoutName) {
        workoutMap[e.workoutName] = (workoutMap[e.workoutName] || 0) + 1;
      }
    });
    const workoutRankings = Object.entries(workoutMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { totalHours, totalMinutes, totalSeconds, totalWorkouts: entries.length, dailyMap, exerciseRankings, workoutRankings };
  }, [history]);

  // Week chart: minutes trained per day (Sun–Sat) for selected or current week
  const weekChart = useMemo(() => {
    const today = new Date();
    let sunday;
    if (selectedWeekStart) {
      sunday = new Date(selectedWeekStart);
    } else {
      const dayOfWeek = today.getDay(); // 0=Sun
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

    // Check if a week starting at `sunday` has any workout
    const weekHasWorkout = (sunday) => {
      for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (stats.dailyMap[key]) return true;
      }
      return false;
    };

    // Current streak
    let streak = 0;
    let check = new Date(thisSunday);
    while (weekHasWorkout(check)) {
      streak++;
      check.setDate(check.getDate() - 7);
    }

    // Record: scan all weeks to find longest consecutive streak
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
    const endDay = new Date(today);
    endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

    const startDay = new Date(endDay);
    startDay.setDate(startDay.getDate() - (52 * 7) + 1);

    const weeks = [];
    const monthLabels = [];
    let currentDate = new Date(startDay);
    let weekIndex = 0;

    while (currentDate <= endDay) {
      const week = [];
      const weekSunday = new Date(currentDate);
      const sundayKey = `${weekSunday.getFullYear()}-${String(weekSunday.getMonth() + 1).padStart(2, '0')}-${String(weekSunday.getDate()).padStart(2, '0')}`;
      for (let day = 0; day < 7; day++) {
        if (currentDate <= endDay) {
          const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          const isFuture = currentDate > today;
          week.push({
            date: key,
            count: stats.dailyMap[key] || 0,
            isFuture,
            sundayKey
          });

          if (currentDate.getDate() <= 7 && day === 0) {
            const isJan = currentDate.getMonth() === 0;
            monthLabels.push({
              weekIndex,
              label: isJan
                ? `${currentDate.getFullYear()}`
                : currentDate.toLocaleString('default', { month: 'short' })
            });
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
      weekIndex++;
    }

    return { weeks, monthLabels, numWeeks: weeks.length };
  }, [stats.dailyMap]);

  const getHeatColor = (count, isFuture) => {
    if (isFuture) return 'var(--heat-empty)';
    if (count === 0) return 'var(--heat-empty)';
    if (count === 1) return 'var(--heat-1)';
    if (count === 2) return 'var(--heat-2)';
    if (count === 3) return 'var(--heat-3)';
    return 'var(--heat-4)';
  };

  // Mock data
  const mockStats = {
    totalHours: 42,
    totalMinutes: 15,
    totalWorkouts: 156,
    workoutRankings: [
      { name: 'Full Body Burn', count: 42 },
      { name: 'Core Crusher', count: 35 },
      { name: 'HIIT Cardio', count: 28 },
      { name: 'Leg Day', count: 24 },
      { name: 'Upper Body Blast', count: 17 },
    ],
    exerciseRankings: [
      { name: 'Burpees', count: 87 },
      { name: 'Push-ups', count: 72 },
      { name: 'Mountain Climbers', count: 65 },
      { name: 'Box Jumps', count: 54 },
      { name: 'Kettlebell Swings', count: 48 },
      { name: 'Squat Jumps', count: 41 },
      { name: 'Plank Hold', count: 36 },
      { name: 'Lunges', count: 29 },
    ]
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
    const endDay = new Date(today);
    endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));
    const startDay = new Date(endDay);
    startDay.setDate(startDay.getDate() - (52 * 7) + 1);

    const weeks = [];
    const monthLabels = [];
    let currentDate = new Date(startDay);
    let weekIndex = 0;

    while (currentDate <= endDay) {
      const week = [];
      for (let day = 0; day < 7; day++) {
        if (currentDate <= endDay) {
          const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          const isFuture = currentDate > today;
          week.push({ date: key, count: mockDailyMap[key] || 0, isFuture });
          if (currentDate.getDate() <= 7 && day === 0) {
            const isJan = currentDate.getMonth() === 0;
            monthLabels.push({
              weekIndex,
              label: isJan
                ? `${currentDate.getFullYear()}`
                : currentDate.toLocaleString('default', { month: 'short' })
            });
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
      weekIndex++;
    }
    return { weeks, monthLabels, numWeeks: weeks.length };
  }, [mockDailyMap]);

  const displayStats = user ? stats : mockStats;
  const displayCalendar = user ? calendarData : mockCalendarData;
  const displayWeekChart = user ? weekChart : mockWeekChart;
  const displayWeekStreak = user ? weekStreak : mockWeekStreak;
  const displayStreakRecord = user ? weekStreakRecord : mockWeekStreak;

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

  const renderContent = () => (
    <div className="stats-content">
      {/* Hero Stat — Total Time Only */}
      <div className="stats-hero">
        <div className="stats-hero-number">
          {displayStats.totalHours > 0 && (
            <><span className="hero-value">{displayStats.totalHours}</span><span className="hero-unit">h </span></>
          )}
          <span className="hero-value">{displayStats.totalMinutes}</span>
          <span className="hero-unit">m</span>
        </div>
        <div className="stats-hero-label">Time Training</div>
      </div>

      {/* Activity Calendar */}
      <div className="stats-section">
        <h3 className="stats-section-title">Activity</h3>
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
                <div key={wi} className={`calendar-week ${week[0]?.sundayKey === highlightedWeek ? 'selected' : ''}`}>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className="calendar-cell"
                      style={{ backgroundColor: getHeatColor(day.count, day.isFuture) }}
                      title={`${day.date}: ${day.count} workout${day.count !== 1 ? 's' : ''}`}
                      onClick={() => handleCellClick(day.sundayKey)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
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
            {/* Y-axis gridlines + labels */}
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
            {/* Scrub vertical line */}
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
            {/* Line */}
            {linePath && (
              <path d={linePath} fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            )}
            {/* Points */}
            {linePoints.map((p) => (
              <circle
                key={p.i}
                cx={p.x}
                cy={p.y}
                r={4}
                fill={p.minutes > 0 ? '#e74c3c' : '#333'}
              />
            ))}
            {/* Day labels */}
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

      {/* Streak Stats */}
      <div className="stats-streak-inline">
        <span className="streak-inline-item">Week Streak: <strong>{displayWeekStreak}</strong></span>
        <span className="streak-inline-sep">·</span>
        <span className="streak-inline-item">Record: <strong>{displayStreakRecord}</strong></span>
      </div>

      {/* Workout Count */}
      <div className="stats-section">
        <h3 className="stats-section-title">Workouts</h3>
        <div className="exercise-rankings">
          {(user ? displayStats.workoutRankings : mockStats.workoutRankings).map((w, i) => {
            const scrubWorkouts = scrubIndex !== null ? (displayWeekChart[scrubIndex]?.workouts || []) : [];
            const isHighlighted = scrubWorkouts.includes(w.name);
            return (
              <div key={i} className="ranking-row">
                <span className="ranking-name" style={isHighlighted ? { color: '#e74c3c', opacity: 1 } : undefined}>{w.name}</span>
                <span className="ranking-count">×{w.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exercise Rankings */}
      <div className="stats-section">
        <h3 className="stats-section-title">Exercises</h3>
        <div className="exercise-rankings">
          {(user ? displayStats.exerciseRankings : mockStats.exerciseRankings).map((ex, i) => (
            <div key={i} className="ranking-row">
              <span className="ranking-name">{ex.name}</span>
              <span className="ranking-count">×{ex.count}</span>
            </div>
          ))}
        </div>
      </div>
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
