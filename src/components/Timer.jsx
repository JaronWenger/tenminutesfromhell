import React, { useState, useEffect, useRef } from 'react';
import './Timer.css';
import Ring from './Ring';
import WorkoutList from './WorkoutList';

const Timer = ({ workouts = [], prepTime = 15 }) => {
  // Default workouts if none provided
  const defaultWorkouts = [
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

  const workoutList = workouts.length > 0 ? workouts : defaultWorkouts;
  
  // Calculate total time dynamically: (workoutList.length * 60) + prepTime
  const calculateTotalTime = () => (workoutList.length * 60) + prepTime;
  
  const [timeLeft, setTimeLeft] = useState(calculateTotalTime());
  const [isRunning, setIsRunning] = useState(false);
  const [targetTime, setTargetTime] = useState(calculateTotalTime());
  const intervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 0) {
            setIsRunning(false);
            releaseWakeLock();
            // Fire GTM event for workout completion
            if (window.dataLayer) {
              window.dataLayer.push({
                event: 'workout_complete',
                workout_duration: targetTime,
                workout_type: 'ten_minutes_from_hell'
              });
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, targetTime]);

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

  const startTimer = () => {
    if (timeLeft > 0) {
      setIsRunning(true);
      requestWakeLock();
    }
  };

  const stopTimer = () => {
    setIsRunning(false);
    releaseWakeLock();
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(targetTime);
  };

  const setPresetTime = (minutes) => {
    const newTime = (minutes * 60) + prepTime;
    setTargetTime(newTime);
    setTimeLeft(newTime);
    setIsRunning(false);
  };

  // Calculate which workout should be active
  const workoutIndex = Math.min(Math.floor((targetTime - timeLeft) / 60), workoutList.length - 1);

  return (
    <div className="timer-container">
      <Ring
        timeLeft={timeLeft}
        targetTime={targetTime}
        isRunning={isRunning}
        onStart={startTimer}
        onStop={stopTimer}
        onReset={resetTimer}
        onTimeClick={() => {
          setTimeLeft(prevTime => Math.max(0, prevTime - 5));
        }}
      />



      <WorkoutList
        workoutList={workoutList}
        workoutIndex={workoutIndex}
        isRunning={isRunning}
        timeLeft={timeLeft}
      />
    </div>
  );
};

export default Timer;
