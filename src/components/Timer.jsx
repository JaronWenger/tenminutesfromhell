import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Timer.css';
import Ring from './Ring';
import WorkoutList from './WorkoutList';
import Sparks from '../assets/SPARKS.gif';

const Timer = ({
  workouts = [],
  prepTime = 15,
  timeLeft: propTimeLeft,
  isRunning: propIsRunning,
  targetTime: propTargetTime,
  selectedWorkoutIndex: propSelectedWorkoutIndex,
  onTimerStateChange,
  selectedWorkoutName = '',
  activeColor = '#ff3b30',
  restColor = '#007aff',
  sidePlankAlertEnabled = true,
  restTime = 15,
  activeLastMinute = true,
  initialLoad = false,
  workoutReady = true,
  onInitialLoadDone,
  isVisible = true
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
  const [showSparks, setShowSparks] = useState(initialLoad);
  const [sparksClosing, setSparksClosing] = useState(false);
  const introSparksRef = useRef(initialLoad);
  const [animatedIn, setAnimatedIn] = useState(!initialLoad);
  const [showWorkoutContent, setShowWorkoutContent] = useState(!initialLoad);
  const [revealTime, setRevealTime] = useState(!initialLoad);
  const [minTimePassed, setMinTimePassed] = useState(!initialLoad);

  // Minimum 0.9s wait (75% of circle draw) before revealing
  useEffect(() => {
    if (!initialLoad) return;
    const timer = setTimeout(() => setMinTimePassed(true), 600);
    return () => clearTimeout(timer);
  }, [initialLoad]);

  // Reveal when both auth is ready AND minimum time has passed
  useEffect(() => {
    if (workoutReady && minTimePassed && !revealTime) {
      setRevealTime(true);
      setShowWorkoutContent(true);
    }
  }, [workoutReady, minTimePassed, revealTime]);

  // After workout content is shown and animations play, mark initialLoad done
  useEffect(() => {
    if (showWorkoutContent && !animatedIn) {
      const totalDelay = 150 + (workoutList.length * 40);
      const timer = setTimeout(() => {
        setAnimatedIn(true);
        if (onInitialLoadDone) onInitialLoadDone();
      }, totalDelay);
      return () => clearTimeout(timer);
    }
  }, [showWorkoutContent, animatedIn, workoutList.length, onInitialLoadDone]);

  // Fade out intro sparks when user hits play or navigates away
  useEffect(() => {
    if (introSparksRef.current && (isRunning || !isVisible)) {
      introSparksRef.current = false;
      setSparksClosing(true);
      setTimeout(() => {
        setShowSparks(false);
        setSparksClosing(false);
      }, 600);
    }
  }, [isRunning, isVisible]);

  // Show sparks when workout completes
  useEffect(() => {
    if (timeLeft === 0 && !isRunning && targetTime > 0) {
      setShowSparks(true);
      setSparksClosing(false);
    }
  }, [timeLeft, isRunning, targetTime]);

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

  const startTimer = () => {
    if (timeLeft > 0) {
      setIsRunning(true);
      updateParentState({ isRunning: true });
    }
  };

  const stopTimer = () => {
    setIsRunning(false);
    updateParentState({ isRunning: false });
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
    if (showSparks) {
      setSparksClosing(true);
      setTimeout(() => {
        setShowSparks(false);
        setSparksClosing(false);
      }, 600);
    }
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

  // Side plank halfway flicker detection
  const currentExercise = workoutList[workoutIndex] || '';
  const isSidePlank = currentExercise.toLowerCase().includes('side plank');
  const currentSeconds = timeLeft % 60;
  const isRestPhase = currentSeconds >= 1 && currentSeconds <= restTime && (activeLastMinute ? timeLeft > 60 : true);
  const isActivePhase = !isRestPhase;
  const activeSeconds = 60 - restTime;
  const halfwaySecond = Math.round(31 + restTime / 2);
  const isHalfwayFlicker = sidePlankAlertEnabled && isSidePlank && isActivePhase && isRunning &&
    (currentSeconds === halfwaySecond);

  return (
    <div className="timer-container">
      {showSparks && (
        <div className={`timer-sparks-bg ${sparksClosing ? 'timer-sparks-closing' : ''}`}>
          <img src={Sparks} alt="" className="timer-sparks-img" />
        </div>
      )}
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
        activeColor={activeColor}
        restColor={restColor}
        flickering={isHalfwayFlicker}
        restTime={restTime}
        activeLastMinute={activeLastMinute}
        drawIn={initialLoad}
        revealTime={revealTime}
      />

      {showWorkoutContent && (
        <>
          {/* Selected Workout Title - Hidden when running but keeps spacing */}
          {selectedWorkoutName && (
            <div
              className={`timer-workout-title ${isRunning ? 'hidden' : ''} ${!animatedIn ? 'fade-in-item' : ''}`}
              style={!animatedIn ? { '--stagger-delay': '0ms' } : undefined}
            >
              {selectedWorkoutName}
            </div>
          )}

          <WorkoutList
            workoutList={workoutList}
            workoutIndex={workoutIndex}
            isRunning={isRunning}
            timeLeft={timeLeft}
            onWorkoutSelect={selectWorkout}
            showAllWhenPaused={!isRunning}
            staggerIn={!animatedIn}
            restTime={restTime}
          />
        </>
      )}
    </div>
  );
};

export default Timer;
