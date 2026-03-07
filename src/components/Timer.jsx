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
  shuffleExercises = false,
  initialLoad = false,
  workoutReady = true,
  onInitialLoadDone,
  isVisible = true,
  onWorkoutLabelClick,
  hasNoExercises = false
}) => {
  // Default workouts if none provided
  const defaultWorkouts = [
    "Sit Ups",
    "Leg Raises",
    "Alternating Single Leg Raises",
    "Chair Crunches",
    "Seated In & Outs",
    "Planks",
    "Bicycles",
    "Russian Twists"
  ];

  const baseWorkoutList = hasNoExercises ? [] : (workouts.length > 0 ? workouts : defaultWorkouts);
  const [shuffledList, setShuffledList] = useState(null);
  const workoutList = shuffledList || baseWorkoutList;

  // Calculate total time dynamically: (workoutList.length * 60) + prepTime
  const calculateTotalTime = () => (workoutList.length * 60) + prepTime;
  
  // Use props if provided, otherwise use local state
  const [timeLeft, setTimeLeft] = useState(propTimeLeft !== undefined ? propTimeLeft : calculateTotalTime());
  const [isRunning, setIsRunning] = useState(propIsRunning !== undefined ? propIsRunning : false);
  const [targetTime, setTargetTime] = useState(propTargetTime !== undefined ? propTargetTime : calculateTotalTime());
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(propSelectedWorkoutIndex !== undefined ? propSelectedWorkoutIndex : 0);
  const [setCount, setSetCount] = useState(1);
  const [completedSets, setCompletedSets] = useState(0);
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
      const totalDelay = Math.max(500, 150 + (workoutList.length * 40));
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

  // Show sparks and add a credit when workout completes
  useEffect(() => {
    if (timeLeft === 0 && !isRunning && targetTime > 0) {
      setShowSparks(true);
      setSparksClosing(false);
      setCompletedSets(prev => prev + 1);
    }
  }, [timeLeft, isRunning, targetTime]);

  // Update local state when props change
  useEffect(() => {
    if (propTimeLeft !== undefined) setTimeLeft(propTimeLeft);
    if (propIsRunning !== undefined) setIsRunning(propIsRunning);
    if (propTargetTime !== undefined) setTargetTime(propTargetTime);
    if (propSelectedWorkoutIndex !== undefined) setSelectedWorkoutIndex(propSelectedWorkoutIndex);
  }, [propTimeLeft, propIsRunning, propTargetTime, propSelectedWorkoutIndex]);

  // Reset set count and completed sets when the selected workout changes
  useEffect(() => {
    setSetCount(1);
    setCompletedSets(0);
    setShuffledList(null);
  }, [selectedWorkoutName]);





  
  // Callback to update parent state
  const updateParentState = (newState) => {
    if (onTimerStateChange) {
      onTimerStateChange({
        timeLeft,
        isRunning,
        targetTime,
        selectedWorkoutIndex,
        completedSets,
        ...newState
      });
    }
  };

  const [addPulse, setAddPulse] = useState(false);
  const [shuffleStagger, setShuffleStagger] = useState(false);

  const startTimer = () => {
    if (hasNoExercises) {
      setAddPulse(true);
      setTimeout(() => setAddPulse(false), 600);
      return;
    }
    if (timeLeft > 0) {
      // Shuffle exercises on first set start if enabled
      if (shuffleExercises && !shuffledList) {
        const arr = [...baseWorkoutList];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        setShuffledList(arr);
        setShuffleStagger(true);
        setTimeout(() => setShuffleStagger(false), 150 + arr.length * 40);
      }
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
    setSetCount(prev => prev + 1);
    setIsRunning(false);
    setTimeLeft(targetTime);
    updateParentState({ isRunning: false, timeLeft: targetTime });
  };

  const handleNextSet = () => {
    if (showSparks) {
      setSparksClosing(true);
      setTimeout(() => {
        setShowSparks(false);
        setSparksClosing(false);
      }, 600);
    }
    setSetCount(prev => prev + 1);
    setTimeLeft(targetTime);
    setIsRunning(false);
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
  // Exercise advances when rest starts (active portion done), so next exercise is "staged" during rest
  const elapsed = targetTime - timeLeft - prepTime;
  const currentSeconds = timeLeft % 60;
  const inRestZone = currentSeconds >= 1 && currentSeconds <= restTime && elapsed > 0;
  const rawIndex = elapsed <= 0 ? 0 : Math.floor(elapsed / 60) + (inRestZone ? 1 : 0);
  const workoutIndex = Math.min(Math.max(0, rawIndex), workoutList.length - 1);

  // Side plank halfway flicker detection
  const currentExercise = workoutList[workoutIndex] || '';
  const isSidePlank = currentExercise.toLowerCase().includes('side plank');
  const isRestPhase = currentSeconds >= 1 && currentSeconds <= restTime && (activeLastMinute ? timeLeft > 60 : true);
  const isActivePhase = !isRestPhase;
  const activeSeconds = 60 - restTime;
  const halfwaySecond = Math.round(31 + restTime / 2);
  const isHalfwayFlicker = sidePlankAlertEnabled && isSidePlank && isActivePhase && isRunning &&
    (currentSeconds === halfwaySecond);

  return (
    <div className="timer-container">
      {completedSets > 0 && (
        <div className="timer-credits">
          {Array.from({ length: completedSets }).map((_, i) => (
            <div key={i} className="timer-credit-chip" />
          ))}
        </div>
      )}
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
        isCompleted={timeLeft === 0 && !isRunning && targetTime > 0}
        setCount={setCount}
        onNextSet={handleNextSet}
      />

      {showWorkoutContent && (
        <>
          {/* Selected Workout Title - Hidden when running but keeps spacing */}
          {selectedWorkoutName && (
            <div
              className={`timer-workout-title ${isRunning ? 'hidden' : ''} ${!animatedIn ? 'fade-in-item' : ''}`}
              style={!animatedIn ? { '--stagger-delay': '0ms' } : undefined}
              onClick={() => { if (!isRunning && onWorkoutLabelClick) onWorkoutLabelClick(); }}
            >
              {selectedWorkoutName}
            </div>
          )}

          {hasNoExercises ? (
            <div
              className={`timer-add-exercises${!animatedIn ? ' fade-in-item' : ''}${addPulse ? ' timer-add-pulse' : ''}`}
              style={{ '--pulse-color': activeColor, ...(!animatedIn ? { '--stagger-delay': '150ms' } : {}) }}
              onClick={() => { if (onWorkoutLabelClick) onWorkoutLabelClick(true); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Add Exercises</span>
            </div>
          ) : (
          <WorkoutList
            workoutList={workoutList}
            workoutIndex={workoutIndex}
            isRunning={isRunning}
            timeLeft={timeLeft}
            onWorkoutSelect={selectWorkout}
            showAllWhenPaused={!isRunning}
            staggerIn={!animatedIn || shuffleStagger}
            restTime={restTime}
            activeLastMinute={activeLastMinute}
          />
          )}
        </>
      )}
    </div>
  );
};

export default Timer;
