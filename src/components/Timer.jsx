import React, { useState, useEffect, useRef } from 'react';
import './Timer.css';
import Ring from './Ring';
import WorkoutList from './WorkoutList';

const Timer = ({ 
  workouts = [], 
  prepTime = 15,
  timeLeft: propTimeLeft,
  isRunning: propIsRunning,
  targetTime: propTargetTime,
  selectedWorkoutIndex: propSelectedWorkoutIndex,
  onTimerStateChange
}) => {
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
  
  // Use props if provided, otherwise use local state
  const [timeLeft, setTimeLeft] = useState(propTimeLeft !== undefined ? propTimeLeft : calculateTotalTime());
  const [isRunning, setIsRunning] = useState(propIsRunning !== undefined ? propIsRunning : false);
  const [targetTime, setTargetTime] = useState(propTargetTime !== undefined ? propTargetTime : calculateTotalTime());
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(propSelectedWorkoutIndex !== undefined ? propSelectedWorkoutIndex : 0);
  
  const intervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Update local state when props change
  useEffect(() => {
    if (propTimeLeft !== undefined) setTimeLeft(propTimeLeft);
    if (propIsRunning !== undefined) setIsRunning(propIsRunning);
    if (propTargetTime !== undefined) setTargetTime(propTargetTime);
    if (propSelectedWorkoutIndex !== undefined) setSelectedWorkoutIndex(propSelectedWorkoutIndex);
  }, [propTimeLeft, propIsRunning, propTargetTime, propSelectedWorkoutIndex]);

  // Callback to update parent state
  const updateParentState = (newState) => {
    if (onTimerStateChange) {
      onTimerStateChange({
        timeLeft,
        isRunning,
        targetTime,
        selectedWorkoutIndex,
        ...newState
      });
    }
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          const newTime = prevTime <= 0 ? 0 : prevTime - 1;
          
          // Update parent state
          updateParentState({ timeLeft: newTime });
          
          if (newTime <= 0) {
            setIsRunning(false);
            updateParentState({ isRunning: false });
            releaseWakeLock();
            // Fire GTM event for workout completion
            if (window.dataLayer) {
              window.dataLayer.push({
                event: 'workout_complete',
                workout_duration: targetTime,
                workout_type: 'ten_minutes_from_hell'
              });
            }
          }
          return newTime;
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
      updateParentState({ isRunning: true });
      requestWakeLock();
    }
  };

  const stopTimer = () => {
    setIsRunning(false);
    updateParentState({ isRunning: false });
    releaseWakeLock();
  };

  const selectWorkout = (index) => {
    if (!isRunning) {
      setSelectedWorkoutIndex(index);
      updateParentState({ selectedWorkoutIndex: index });
      // Calculate new time based on selected workout
      const newTimeLeft = targetTime - (index * 60);
      const finalTimeLeft = Math.max(0, newTimeLeft);
      setTimeLeft(finalTimeLeft);
      updateParentState({ timeLeft: finalTimeLeft });
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(targetTime);
    updateParentState({ isRunning: false, timeLeft: targetTime });
  };

  const setPresetTime = (minutes) => {
    const newTime = (minutes * 60) + prepTime;
    setTargetTime(newTime);
    setTimeLeft(newTime);
    setIsRunning(false);
    updateParentState({ targetTime: newTime, timeLeft: newTime, isRunning: false });
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
          const newTimeLeft = Math.max(0, timeLeft - 5);
          setTimeLeft(newTimeLeft);
          updateParentState({ timeLeft: newTimeLeft });
        }}
      />

      <WorkoutList
        workoutList={workoutList}
        workoutIndex={workoutIndex}
        isRunning={isRunning}
        timeLeft={timeLeft}
        onWorkoutSelect={selectWorkout}
        showAllWhenPaused={!isRunning}
      />
    </div>
  );
};

export default Timer;
