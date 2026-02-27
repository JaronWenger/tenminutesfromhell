import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Ring.css';

const Ring = ({
  timeLeft,
  targetTime,
  isRunning,
  onStart,
  onStop,
  onReset,
  onTimeClick,
  activeColor = '#ff3b30',
  restColor = '#007aff',
  flickering = false,
  restTime = 15,
  activeLastMinute = true,
  drawIn = false,
  revealTime = false
}) => {
  const [drawInPhase, setDrawInPhase] = useState(drawIn ? 'title' : 'done');
  // Flicker: alternate between active/rest colors rapidly
  const [flickerToggle, setFlickerToggle] = useState(false);
  const flickerRef = useRef(null);

  // Parent says auth is ready — start the fadeout/reveal immediately
  useEffect(() => {
    if (!revealTime || drawInPhase !== 'title') return;
    setDrawInPhase('fadeout');
    const timer = setTimeout(() => setDrawInPhase('time'), 300);
    return () => clearTimeout(timer);
  }, [revealTime]);

  useEffect(() => {
    if (flickering) {
      flickerRef.current = setInterval(() => {
        setFlickerToggle(prev => !prev);
      }, 250);
    } else {
      if (flickerRef.current) clearInterval(flickerRef.current);
      setFlickerToggle(false);
    }
    return () => { if (flickerRef.current) clearInterval(flickerRef.current); };
  }, [flickering]);

  const progress = ((targetTime - timeLeft) / targetTime) * 100;
  const circumference = 2 * Math.PI * 120;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine progress color based on seconds within current minute
  const getProgressColor = () => {
    if (!isRunning && timeLeft > 0) {
      return '#ffffff';
    }
    if (flickering) {
      return flickerToggle ? restColor : activeColor;
    }
    const currentSeconds = timeLeft % 60;

    // Rest/prep seconds 1-15 of each minute (except the last minute)
    if (currentSeconds >= 1 && currentSeconds <= restTime && (activeLastMinute ? timeLeft > 60 : true)) {
      return restColor;
    } else {
      return activeColor;
    }
  };

  // Helper to convert hex to rgba for glow filter
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timer-display">
      <svg className="progress-ring" width="300" height="300">
        <circle
          className={`progress-ring-bg ${drawIn ? 'draw-in' : ''}`}
          stroke="#2c2c2e"
          strokeWidth="8"
          fill="transparent"
          r="120"
          cx="150"
          cy="150"
        />
        <circle
          className="progress-ring-fill"
          stroke={getProgressColor()}
          strokeWidth="8"
          fill="transparent"
          r="120"
          cx="150"
          cy="150"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 150 150)"
          style={{ filter: `drop-shadow(0 0 12px ${hexToRgba(getProgressColor(), 0.4)})` }}
        />
      </svg>

      {drawIn && (drawInPhase === 'title' || drawInPhase === 'fadeout') && (
        <div className="ring-brand-title">
          {'HIITem'.split('').map((char, i) => (
            <span key={i} className={drawInPhase === 'fadeout' ? 'brand-letter-out' : 'brand-letter'} style={drawInPhase === 'fadeout' ? { animationDelay: `${i * 60}ms` } : undefined}>{char}</span>
          ))}
        </div>
      )}
      {!(drawIn && drawInPhase === 'title') && (
        <div
          className={`time-text ${drawIn && (drawInPhase === 'fadeout' || drawInPhase === 'time') ? 'draw-in-time' : ''}`}
          onClick={onTimeClick}
          style={{ cursor: 'pointer' }}
        >
          {drawIn && drawInPhase === 'fadeout'
            ? formatTime(timeLeft).split('').map((char, i) => (
                <span key={i} className="digit-stagger" style={{ animationDelay: `${i * 60}ms` }}>{char}</span>
              ))
            : formatTime(timeLeft)
          }
        </div>
      )}

      {!isRunning && !(drawIn && drawInPhase === 'title') && (
        <button
          className={`play-btn ${drawIn && (drawInPhase === 'fadeout' || drawInPhase === 'time') ? 'draw-in-time' : ''}`}
          onClick={onStart}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ marginLeft: '-1px' }}>
            <path d="M7.5 4.5c0-1.08 1.22-1.71 2.1-1.08l10.2 7.5c.76.56.76 1.6 0 2.16l-10.2 7.5c-.88.63-2.1 0-2.1-1.08V4.5z"/>
          </svg>
        </button>
      )}
      
      {!isRunning && timeLeft < targetTime && (
        <button className="reset-btn" onClick={onReset}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
      )}
      
      {isRunning && (
        <button className="pause-btn" onClick={onStop}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default Ring;
