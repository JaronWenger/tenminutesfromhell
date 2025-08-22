import React, { useState, useEffect, useRef } from 'react';
import './Timer.css';

const Timer = () => {
  const [timeLeft, setTimeLeft] = useState(675); // 11:15 in seconds (11*60 + 15)
  const [isRunning, setIsRunning] = useState(false);
  const [targetTime, setTargetTime] = useState(675); // 11:15 default
  const intervalRef = useRef(null);

  const workouts = [
    "Russian Twist",
    "Boat hold or seated in and outs",
    "Glut boat hold",
    "Jack knifes",
    "Sit up twist (weight over head)",
    "Leg raises (weight in feet)",
    "Chair sit ups (weight in one arm)",
    "Plank knees to elbows",
    "Side planks dips",
    "Bicycle",
    "Boat hold leg flutters"
  ];

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 0) {
            setIsRunning(false);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const startTimer = () => {
    if (timeLeft > 0) {
      setIsRunning(true);
    }
  };

  const stopTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(targetTime);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((targetTime - timeLeft) / targetTime) * 100;
  const circumference = 2 * Math.PI * 120;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine progress color based on seconds within current minute
  const getProgressColor = () => {
    const currentSeconds = timeLeft % 60;
    
    if (currentSeconds >= 1 && currentSeconds <= 15) {
      return '#ff3b30'; // Red for seconds 1-15 of each minute
    } else {
      return '#007aff'; // Blue for the rest (including 11:00 which is second 0)
    }
  };

  const setPresetTime = (minutes) => {
    const newTime = minutes * 60;
    setTargetTime(newTime);
    setTimeLeft(newTime);
    setIsRunning(false);
  };

  // Calculate which workout should be active
  const currentMinute = Math.floor(timeLeft / 60);
  const currentSecond = timeLeft % 60;
  const workoutIndex = Math.floor((targetTime - timeLeft) / 60);

  return (
    <div className="timer-container">
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
        <div className="time-text">
          {formatTime(timeLeft)}
        </div>
        
        {!isRunning && (
          <button className="play-btn" onClick={startTimer}>
            ▶
          </button>
        )}
        
        {!isRunning && timeLeft < targetTime && (
          <button className="reset-btn" onClick={resetTimer}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/>
              <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        )}
        
        {isRunning && (
          <button className="pause-btn" onClick={stopTimer}>
            ⏸
          </button>
        )}
      </div>



      <div className="workout-list">
        {workouts.map((workout, index) => {
          const isActive = index === workoutIndex && isRunning;
          const isCompleted = index < workoutIndex;
          const isUpcoming = index > workoutIndex || (index === workoutIndex && !isRunning);
          const currentSeconds = timeLeft % 60;
          const isWarning = isActive && currentSeconds >= 1 && currentSeconds <= 15;
          
          return (
            <div 
              key={index}
              className={`workout-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${isWarning ? 'warning' : ''}`}
            >
              <span className="workout-number">{index + 1}</span>
              <span className="workout-text">{workout}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timer;
