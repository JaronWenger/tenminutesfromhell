import React, { useMemo } from 'react';
import './StatsPage.css';

const StatsPage = ({ user, history, loading, onLoginClick }) => {
  const stats = useMemo(() => {
    const entries = history || [];

    // Total training time in seconds
    const totalSeconds = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

    // Daily activity map (dateString -> count)
    const dailyMap = {};
    entries.forEach(e => {
      const d = e.completedAt || e.date;
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyMap[key] = (dailyMap[key] || 0) + 1;
    });

    // Exercise frequency
    const exerciseMap = {};
    entries.forEach(e => {
      (e.exercises || []).forEach(name => {
        exerciseMap[name] = (exerciseMap[name] || 0) + 1;
      });
    });
    const exerciseRankings = Object.entries(exerciseMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { totalHours, totalMinutes, totalSeconds, dailyMap, exerciseRankings };
  }, [history]);

  // Build calendar grid data for last 12 months
  const calendarData = useMemo(() => {
    const today = new Date();
    // Go back ~52 weeks from end of this week
    const endDay = new Date(today);
    // Advance to Saturday (end of week row)
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
          week.push({
            date: key,
            count: stats.dailyMap[key] || 0,
            isFuture
          });

          // Track month labels (first day of month that falls on Sunday-ish)
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

    return { weeks, monthLabels };
  }, [stats.dailyMap]);

  const getHeatColor = (count, isFuture) => {
    if (isFuture) return 'var(--heat-empty)';
    if (count === 0) return 'var(--heat-empty)';
    if (count === 1) return 'var(--heat-1)';
    if (count === 2) return 'var(--heat-2)';
    if (count === 3) return 'var(--heat-3)';
    return 'var(--heat-4)';
  };

  // Mock data for logged-out placeholder
  const mockStats = {
    totalHours: 42,
    totalMinutes: 15,
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

  // Generate fake heatmap data for logged-out state
  const mockDailyMap = useMemo(() => {
    const map = {};
    const today = new Date();
    // Simple seeded PRNG for deterministic but random-looking results
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
      // ~35% chance of activity on any given day
      if (r < 0.18) map[key] = 1;
      else if (r < 0.27) map[key] = 2;
      else if (r < 0.32) map[key] = 3;
      else if (r < 0.35) map[key] = 4;
    }
    return map;
  }, []);

  // Build mock calendar that uses fake daily map
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
            monthLabels.push({ weekIndex, label: currentDate.toLocaleString('default', { month: 'short' }) });
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
      weekIndex++;
    }
    return { weeks, monthLabels };
  }, [mockDailyMap]);

  const displayStats = user ? stats : mockStats;
  const displayCalendar = user ? calendarData : mockCalendarData;

  const renderContent = () => (
    <div className="stats-content">
      {/* Hero Stat */}
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
        <div className="calendar-scroll">
          <div className="calendar-grid">
            <div className="calendar-month-labels">
              {displayCalendar.monthLabels.map((m, i) => (
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
              {displayCalendar.weeks.map((week, wi) => (
                <div key={wi} className="calendar-week">
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
      </div>

      {/* Exercise Rankings */}
      <div className="stats-section">
        <h3 className="stats-section-title">Exercise Rankings</h3>
        <div className="exercise-rankings">
          {(user ? displayStats.exerciseRankings : mockStats.exerciseRankings).map((ex, i) => (
            <div key={i} className="ranking-row">
              <span className="ranking-name">{ex.name}</span>
              <span className="ranking-count">{ex.count}</span>
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
