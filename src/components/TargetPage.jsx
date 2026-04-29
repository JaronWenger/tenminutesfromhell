import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthButton from './AuthButton';
import { DEFAULT_TIMER_WORKOUTS, countActiveExercises } from '../data/defaultWorkouts';
import PP from '../assets/PP.png';
import './TargetPage.css';
import './Home.css';
import './StatsPage.css';

const AXES = [
  { key: 'Shoulders', tags: ['Shoulders'],                                  angle: -90 },
  { key: 'Chest',     tags: ['Chest'],                                      angle: -30 },
  { key: 'Arms',      tags: ['Biceps', 'Triceps', 'Arms'],                  angle: 30  },
  { key: 'Core',      tags: ['Core'],                                       angle: 90  },
  { key: 'Legs',      tags: ['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'], angle: 150 },
  { key: 'Back',      tags: ['Back'],                                       angle: 210 },
];

const PERIODS = [
  { label: '7D',  days: 7  },
  { label: '30D', days: 30 },
  { label: 'All', days: null },
];

const toRad = deg => (deg * Math.PI) / 180;

const getMs = d =>
  d instanceof Date ? d.getTime() : d?.seconds ? d.seconds * 1000 : (d || 0);

const CX = 150, CY = 150, R = 95;
const RING_FRACS = [0.2, 0.4, 0.6, 0.8, 1.0];

const ringPoints = r =>
  AXES.map(a => {
    const rad = toRad(a.angle);
    return `${CX + R * r * Math.cos(rad)},${CY + R * r * Math.sin(rad)}`;
  }).join(' ');

const TargetPage = ({ workoutHistory = [], timerWorkoutData = [], onLoginClick, onProfileClick, onPeopleClick, onWorkoutTap, onAddWorkout, onStartWorkout }) => {
  const { user } = useAuth();
  const [period, setPeriod] = useState(1);

  const { tagById, tagByName } = useMemo(() => {
    const byId = {};
    const byName = {};
    // Seed with static defaults so old history entries (stored with default IDs) always resolve
    DEFAULT_TIMER_WORKOUTS.forEach(w => {
      if (w.id) byId[w.id] = w.tags || [];
      if (w.name) byName[w.name.toLowerCase()] = w.tags || [];
    });
    // User's loaded workouts override (Firestore IDs + any custom tags)
    timerWorkoutData.forEach(w => {
      const tags = w.tags || byName[w.name?.toLowerCase()] || [];
      if (w.id) byId[w.id] = tags;
      if (w.name) byName[w.name.toLowerCase()] = tags;
    });
    return { tagById: byId, tagByName: byName };
  }, [timerWorkoutData]);

  const filtered = useMemo(() => {
    const days = PERIODS[period].days;
    if (!days) return workoutHistory;
    const cutoff = Date.now() - days * 86400000;
    return workoutHistory.filter(h => getMs(h.completedAt) >= cutoff);
  }, [workoutHistory, period]);

  const { normalized, raw } = useMemo(() => {
    const counts = {};
    AXES.forEach(a => { counts[a.key] = 0; });

    filtered.forEach(h => {
      const tags = tagById[h.workoutId] || tagByName[h.workoutName?.toLowerCase()] || [];
      const isFullBody = tags.includes('Full Body');
      const sets = h.setCount || 1;
      AXES.forEach(a => {
        if (isFullBody || a.tags.some(t => tags.includes(t))) counts[a.key] += sets;
      });
    });

    const norm = {};
    AXES.forEach(a => { norm[a.key] = Math.min(counts[a.key] / 5, 1); });
    return { normalized: norm, raw: counts };
  }, [filtered, tagById, tagByName]);

  const dataPoints = AXES.map(a => {
    const val = Math.max(normalized[a.key], 0.04);
    const rad = toRad(a.angle);
    return `${CX + R * val * Math.cos(rad)},${CY + R * val * Math.sin(rad)}`;
  }).join(' ');

  const totalWorkouts = filtered.length;
  const [showCompleted, setShowCompleted] = useState(() => {
    try { return localStorage.getItem('targetShowCompleted') === 'true'; } catch { return false; }
  });
  const [selectedAxis, setSelectedAxis] = useState(() => {
    try { return localStorage.getItem('targetSelectedAxis') ?? 'Core'; } catch { return 'Core'; }
  });

  const setShowCompletedPersist = (val) => {
    const next = typeof val === 'function' ? val(showCompleted) : val;
    setShowCompleted(next);
    try { localStorage.setItem('targetShowCompleted', String(next)); } catch {}
  };

  const handleAxisSelect = (key) => {
    const next = selectedAxis === key ? null : key;
    setSelectedAxis(next);
    try { if (next) localStorage.setItem('targetSelectedAxis', next); else localStorage.removeItem('targetSelectedAxis'); } catch {}
  };

  const svgRef = useRef(null);
  const [ringPulse, setRingPulse] = useState({ key: 0, delays: new Array(30).fill(0) });
  const triggerRingPulse = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const tapX = (e.clientX - rect.left) * (300 / rect.width);
    const tapY = (e.clientY - rect.top) * (300 / rect.height);
    const dists = [];
    RING_FRACS.forEach(r => {
      const verts = AXES.map(a => {
        const rad = toRad(a.angle);
        return { x: CX + R * r * Math.cos(rad), y: CY + R * r * Math.sin(rad) };
      });
      for (let i = 0; i < 6; i++) {
        const v0 = verts[i], v1 = verts[(i + 1) % 6];
        const mx = (v0.x + v1.x) / 2, my = (v0.y + v1.y) / 2;
        dists.push(Math.sqrt((tapX - mx) ** 2 + (tapY - my) ** 2));
      }
    });
    const maxDist = Math.max(...dists);
    const delays = dists.map(d => (d / maxDist) * 0.38);
    setRingPulse(prev => ({ key: prev.key + 1, delays }));
  };

  const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const suggestedCards = useMemo(() => {
    if (!selectedAxis) return [];
    const axis = AXES.find(a => a.key === selectedAxis);
    if (!axis) return [];
    return DEFAULT_TIMER_WORKOUTS.filter(w => {
      const tags = w.tags || [];
      return tags.includes('Full Body') || axis.tags.some(t => tags.includes(t));
    }).map(w => {
      const live = timerWorkoutData.find(lw => lw.name === w.name) || w;
      const exercises = live.exercises || w.exercises || [];
      const restTime = live.restTime ?? w.restTime ?? 15;
      const activeCount = countActiveExercises(exercises);
      const activeSeconds = activeCount * (60 - restTime) + (activeCount > 0 ? restTime : 0);
      return { ...live, exercises, activeSeconds };
    });
  }, [selectedAxis, timerWorkoutData]);

  const completedCards = useMemo(() => {
    const axis = AXES.find(a => a.key === selectedAxis);
    return filtered
      .filter(h => {
        if (!axis) return true;
        const tags = tagById[h.workoutId] || tagByName[h.workoutName?.toLowerCase()] || [];
        return tags.includes('Full Body') || axis.tags.some(t => tags.includes(t));
      })
      .map(h => {
        const workout = timerWorkoutData.find(w => w.id === h.workoutId)
          || timerWorkoutData.find(w => w.name === h.workoutName);
        const tags = tagById[h.workoutId] || tagByName[h.workoutName?.toLowerCase()] || [];
        const exercises = workout?.exercises || h.exercises || [];
        const restTime = workout?.restTime ?? 15;
        const activeCount = countActiveExercises(exercises);
        const activeSeconds = activeCount * (60 - restTime) + (activeCount > 0 ? restTime : 0);
        const d = h.completedAt instanceof Date ? h.completedAt : null;
        const dateDay = d ? d.getDate() : null;
        const dateMonth = d ? d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : null;
        return { name: h.workoutName || workout?.name || '—', tags, exercises, activeSeconds, setCount: h.setCount || 1, id: h.id, dateDay, dateMonth, workout };
      });
  }, [filtered, selectedAxis, tagById, tagByName, timerWorkoutData]);

  return (
    <div className="target-page">
      <div className="home-header">
        <div className="home-header-auth">
          <AuthButton onLoginClick={onLoginClick} onProfileClick={onProfileClick} />
        </div>
        <span className="home-header-title">HIITem</span>
        {user && (
          <button className="home-header-bell" onClick={onPeopleClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </button>
        )}
      </div>

      <div className="target-chart-section">
        <div className="target-period-selector">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              className={`target-period-btn ${period === i ? 'active' : ''}`}
              onClick={() => setPeriod(i)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="target-chart-wrap">
          <svg ref={svgRef} viewBox="0 0 300 300" className="target-svg">
            {RING_FRACS.map((r, ri) => {
              const verts = AXES.map(a => {
                const rad = toRad(a.angle);
                return { x: CX + R * r * Math.cos(rad), y: CY + R * r * Math.sin(rad) };
              });
              return verts.map((v, si) => {
                const v2 = verts[(si + 1) % 6];
                const segIdx = ri * 6 + si;
                return (
                  <line
                    key={`seg-${ri}-${si}-${ringPulse.key}`}
                    x1={v.x} y1={v.y} x2={v2.x} y2={v2.y}
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth="1"
                    className={ringPulse.key > 0 ? 'target-ring-pulse' : ''}
                    style={ringPulse.key > 0 ? { animationDelay: `${ringPulse.delays[segIdx]}s` } : {}}
                  />
                );
              });
            })}
            {AXES.map(a => {
              const rad = toRad(a.angle);
              const isSelected = selectedAxis === a.key;
              return (
                <line
                  key={`${a.key}-${isSelected}`}
                  x1={isSelected ? CX + R * Math.cos(rad) : CX}
                  y1={isSelected ? CY + R * Math.sin(rad) : CY}
                  x2={isSelected ? CX : CX + R * Math.cos(rad)}
                  y2={isSelected ? CY : CY + R * Math.sin(rad)}
                  stroke={isSelected ? 'rgba(255,59,48,0.6)' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={isSelected ? 1.5 : 1}
                  className={isSelected ? 'target-axis-draw' : ''}
                />
              );
            })}
            <polygon
              points={dataPoints}
              fill="rgba(255,59,48,0.18)"
              stroke="#ff3b30"
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,59,48,0.55))' }}
            />
            <polygon
              points={ringPoints(1.0)}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onPointerDown={triggerRingPulse}
              onClick={() => {
                if (selectedAxis) {
                  handleAxisSelect(selectedAxis);
                  setShowCompletedPersist(true);
                } else {
                  setShowCompletedPersist(p => !p);
                }
              }}
            />
            {AXES.map(a => {
              const rad = toRad(a.angle);
              const dist = R + 24;
              const lx = CX + dist * Math.cos(rad);
              const ly = CY + dist * Math.sin(rad);
              const isSelected = selectedAxis === a.key;
              const pillW = a.key.length * 6.5 + 20;
              const pillH = 20;
              const pillCX = lx;
              const pillCY = ly;
              return (
                <g
                  key={a.key}
                  onClick={() => handleAxisSelect(a.key)}
                  onPointerDown={triggerRingPulse}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={pillCX - pillW / 2}
                    y={pillCY - pillH / 2}
                    width={pillW}
                    height={pillH}
                    rx={pillH / 2}
                    fill={isSelected ? 'rgba(255,59,48,0.18)' : 'rgba(255,255,255,0.04)'}
                    stroke={isSelected ? 'rgba(255,59,48,0.6)' : 'rgba(255,255,255,0.12)'}
                    strokeWidth="1"
                  />
                  <text
                    x={pillCX}
                    y={pillCY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isSelected ? '#ff3b30' : 'rgba(255,255,255,0.55)'}
                    fontSize="11"
                    fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                    fontWeight={isSelected ? '700' : '500'}
                    style={isSelected ? { filter: 'drop-shadow(0 0 6px rgba(255,59,48,0.7))' } : {}}
                  >
                    {a.key}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {selectedAxis && suggestedCards.length > 0 && (
        <h3 className="stats-section-title target-completed-title">{selectedAxis.toUpperCase()}</h3>
      )}
      {!selectedAxis && showCompleted && completedCards.length > 0 && (
        <h3 className="stats-section-title target-completed-title">COMPLETED</h3>
      )}

      <div className="target-list-section">
        {selectedAxis && suggestedCards.length > 0 && (
          <div key={`suggested-${selectedAxis}`} className="stats-workout-cards target-cards-animate">
            {suggestedCards.map(w => (
              <div key={w.id || w.name} className="stats-workout-card" onClick={() => onWorkoutTap?.({ ...w, exercises: w.exercises || [] })}>
                <img src={PP} alt="HIITem" className="workout-card-avatar" />
                <div className="stats-card-left">
                  <div className="stats-card-name-row">
                    <span className="stats-card-name">{w.name}</span>
                    {(w.tags || []).map(t => (
                      <span key={t} className="stats-card-tag">{t.toUpperCase()}</span>
                    ))}
                  </div>
                  {w.exercises.length > 0 && (
                    <div className="stats-card-detail">
                      <span className="stats-card-time">{formatTime(w.activeSeconds)} Active</span>
                      <span className="stats-card-dot">&middot;</span>
                      <span>{w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
                <button
                  className="workout-card-start-btn always-visible"
                  onClick={(e) => { e.stopPropagation(); if (w.hideByDefault) onAddWorkout?.(w); onStartWorkout?.(w.name, w.id, w.exercises); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {!selectedAxis && showCompleted && completedCards.length > 0 && (
          <div key={`completed-${showCompleted}`} className="stats-workout-cards target-cards-animate">
            {completedCards.map(c => (
              <div key={c.id} className="stats-workout-card" style={{ justifyContent: 'space-between' }} onClick={() => {
                  const w = c.workout
                    || timerWorkoutData.find(w => w.name === c.name)
                    || DEFAULT_TIMER_WORKOUTS.find(w => w.name === c.name);
                  if (w) onWorkoutTap?.({ ...w, exercises: w.exercises || [] });
                }}>
                <div className="stats-card-left">
                  <div className="stats-card-name-row">
                    <span className="stats-card-name">{c.name}</span>
                    {c.tags.map(t => (
                      <span key={t} className="stats-card-tag">{t.toUpperCase()}</span>
                    ))}
                  </div>
                  {c.exercises.length > 0 && (
                    <div className="stats-card-detail">
                      <span className="stats-card-time">{formatTime(c.activeSeconds)} Active Minutes</span>
                      <span className="stats-card-dot">&middot;</span>
                      <span>{c.exercises.length} exercise{c.exercises.length !== 1 ? 's' : ''}</span>
                      {c.setCount >= 2 && (
                        <>
                          <span className="stats-card-dot">&middot;</span>
                          <span className="stats-card-completions">{c.setCount} sets</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {c.dateDay && (
                  <div className="target-card-date">
                    <span className="target-card-date-day">{c.dateDay}</span>
                    <span className="target-card-date-month">{c.dateMonth}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalWorkouts === 0 && !selectedAxis && (
          <div className="target-empty">
            <p>No workouts yet</p>
            <span>Complete tagged workouts to see your muscle distribution</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TargetPage;
