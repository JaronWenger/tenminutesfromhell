import React from 'react';
import './Ring.css';

const Ring = ({ 
  timeLeft, 
  targetTime, 
  isRunning, 
  onStart, 
  onStop, 
  onReset, 
  onTimeClick 
}) => {
  const progress = ((targetTime - timeLeft) / targetTime) * 100;
  const circumference = 2 * Math.PI * 120;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine progress color based on seconds within current minute
  const getProgressColor = () => {
    const currentSeconds = timeLeft % 60;
    
    // Red for seconds 1-15 of each minute (except the last minute)
    if (currentSeconds >= 1 && currentSeconds <= 15 && timeLeft > 60) {
      return '#ff3b30'; // Red for seconds 1-15 of each minute
    } else {
      return '#007aff'; // Blue for the rest (including the entire last minute)
    }
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
          className="progress-ring-bg"
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
        />
      </svg>

      <div
        className="time-text"
        onClick={onTimeClick}
        style={{ cursor: 'pointer' }}
      >
        {formatTime(timeLeft)}
      </div>

      {!isRunning && (
        <button 
          className="play-btn" 
          onClick={onStart}
        >
          ▶
        </button>
      )}
      
      {!isRunning && timeLeft < targetTime && (
        <button className="reset-btn" onClick={onReset}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/>
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
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
