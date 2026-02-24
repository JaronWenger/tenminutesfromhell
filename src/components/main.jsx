import React, { useState, useEffect, useRef, useCallback } from 'react';
import Timer from './Timer';
import Home from './Home';
import Stopwatch from './Stopwatch';
import StatsPage from './StatsPage';
import TabBar from './TabBar';
import EditPage from './EditPage';
import ExerciseEditPage from './ExerciseEditPage';
import { DEFAULT_TIMER_WORKOUTS, DEFAULT_STOPWATCH_WORKOUTS } from '../data/defaultWorkouts';
import { useAuth } from '../contexts/AuthContext';
import { getUserWorkouts, saveUserWorkout, recordWorkoutHistory, getUserHistory } from '../firebase/firestore';

const Main = () => {
  const [activeTab, setActiveTab] = useState('home');
  const { user } = useAuth();

  // Workout data as state (defaults, overridable by Firestore)
  const [timerWorkoutData, setTimerWorkoutData] = useState(DEFAULT_TIMER_WORKOUTS);
  const [stopwatchWorkoutData, setStopwatchWorkoutData] = useState(DEFAULT_STOPWATCH_WORKOUTS);

  // Derive name arrays from workout data
  const timerWorkouts = timerWorkoutData.map(w => w.name);
  const stopwatchWorkouts = stopwatchWorkoutData.map(w => w.name);

  // Exercise lookup by workout name
  const getExerciseList = useCallback((workoutName) => {
    if (workoutName === 'New Workout') return [];
    const allWorkouts = [...timerWorkoutData, ...stopwatchWorkoutData];
    const found = allWorkouts.find(w => w.name === workoutName);
    return found ? found.exercises : [];
  }, [timerWorkoutData, stopwatchWorkoutData]);

  // Calculate total time from exercise count
  const calculateTotalTime = useCallback((workoutName) => {
    const exercises = getExerciseList(workoutName || 'The Devils 10');
    return (exercises.length * 60) + 15;
  }, [getExerciseList]);

  // Timer state
  const [timerState, setTimerState] = useState(() => {
    const initial = (DEFAULT_TIMER_WORKOUTS[0].exercises.length * 60) + 15;
    return {
      timeLeft: initial,
      isRunning: false,
      targetTime: initial,
      selectedWorkoutIndex: 0
    };
  });

  // Stopwatch state
  const [stopwatchState, setStopwatchState] = useState({
    time: 0,
    isRunning: false,
    laps: []
  });

  // Lap times panel state
  const [showLapTimes, setShowLapTimes] = useState(false);
  const [isClosingLapTimes, setIsClosingLapTimes] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

  // Workout view state (phone only)
  const [showWorkoutView, setShowWorkoutView] = useState(false);
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(-1);

  // Edit page state
  const [currentEditPage, setCurrentEditPage] = useState(null);
  const [currentEditLevel, setCurrentEditLevel] = useState('categories');
  const [currentEditingWorkout, setCurrentEditingWorkout] = useState(null);
  const [timerSelectedWorkout, setTimerSelectedWorkout] = useState('The Devils 10');
  const [stopwatchSelectedWorkout, setStopwatchSelectedWorkout] = useState('Back & Bis');

  // Stats page state
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load user workouts and history from Firestore when user logs in
  useEffect(() => {
    if (!user) {
      // Reset to defaults when logged out
      setTimerWorkoutData(DEFAULT_TIMER_WORKOUTS);
      setStopwatchWorkoutData(DEFAULT_STOPWATCH_WORKOUTS);
      setWorkoutHistory([]);
      return;
    }

    let cancelled = false;
    const loadWorkouts = async () => {
      try {
        const custom = await getUserWorkouts(user.uid);
        if (cancelled) return;
        if (custom.length > 0) {
          const merged = mergeWorkouts(custom);
          setTimerWorkoutData(merged.timer);
          setStopwatchWorkoutData(merged.stopwatch);
        }
      } catch (err) {
        console.error('Failed to load workouts:', err);
      }
    };
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const history = await getUserHistory(user.uid);
        if (!cancelled) setWorkoutHistory(history);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    loadWorkouts();
    loadHistory();
    return () => { cancelled = true; };
  }, [user]);

  // Merge custom workouts with defaults
  const mergeWorkouts = (customWorkouts) => {
    const timerDefaults = [...DEFAULT_TIMER_WORKOUTS];
    const stopwatchDefaults = [...DEFAULT_STOPWATCH_WORKOUTS];

    const timerResult = timerDefaults.map(d => {
      const override = customWorkouts.find(
        c => c.defaultName === d.name || (!c.defaultName && c.name === d.name)
      );
      return override ? { ...d, ...override, exercises: override.exercises } : d;
    });

    const stopwatchResult = stopwatchDefaults.map(d => {
      const override = customWorkouts.find(
        c => c.defaultName === d.name || (!c.defaultName && c.name === d.name)
      );
      return override ? { ...d, ...override, exercises: override.exercises } : d;
    });

    // Add any fully custom workouts (not overriding defaults)
    const defaultNames = [...timerDefaults, ...stopwatchDefaults].map(d => d.name);
    customWorkouts.forEach(c => {
      const isOverride = defaultNames.includes(c.name) || defaultNames.includes(c.defaultName);
      if (!isOverride) {
        if (c.type === 'timer') timerResult.push(c);
        else stopwatchResult.push(c);
      }
    });

    return { timer: timerResult, stopwatch: stopwatchResult };
  };

  // Recalculate timer when workout selection changes
  useEffect(() => {
    const newTotalTime = calculateTotalTime(timerSelectedWorkout);
    setTimerState(prev => ({
      ...prev,
      timeLeft: newTotalTime,
      targetTime: newTotalTime
    }));
  }, [timerSelectedWorkout, calculateTotalTime]);

  // Timer interval ref
  const timerIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Timer interval management
  useEffect(() => {
    if (timerState.isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerState(prev => {
          if (prev.timeLeft <= 0) {
            // Release wake lock when timer completes
            if (wakeLockRef.current) {
              wakeLockRef.current.release();
              wakeLockRef.current = null;
            }
            // Fire GTM event for workout completion
            if (window.dataLayer) {
              window.dataLayer.push({
                event: 'workout_complete',
                workout_duration: prev.targetTime,
                workout_type: 'ten_minutes_from_hell'
              });
            }
            // Record workout history to Firestore
            if (user) {
              const exercises = getExerciseList(timerSelectedWorkout);
              recordWorkoutHistory(user.uid, {
                workoutName: timerSelectedWorkout,
                workoutType: 'timer',
                duration: prev.targetTime,
                setCount: exercises.length,
                exercises
              }).then(() => {
                // Refresh history for stats page
                getUserHistory(user.uid)
                  .then(setWorkoutHistory)
                  .catch(err => console.error('Failed to refresh history:', err));
              }).catch(err => console.error('Failed to record history:', err));
            }
            return { ...prev, timeLeft: 0, isRunning: false };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerState.isRunning, user, timerSelectedWorkout, getExerciseList]);

  // Stopwatch interval ref
  const stopwatchIntervalRef = useRef(null);

  // Stopwatch interval management
  useEffect(() => {
    if (stopwatchState.isRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchState(prev => ({
          ...prev,
          time: prev.time + 10
        }));
      }, 10);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [stopwatchState.isRunning]);

  // Wake lock management
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

  // Timer state change handler
  const handleTimerStateChange = (newState) => {
    setTimerState(prev => {
      const updated = { ...prev, ...newState };

      // Handle wake lock
      if (newState.isRunning && !prev.isRunning) {
        requestWakeLock();
      } else if (!newState.isRunning && prev.isRunning) {
        releaseWakeLock();
      }

      return updated;
    });
  };

  // Stopwatch state change handler
  const handleStopwatchStateChange = (newState) => {
    setStopwatchState(prev => {
      const updated = { ...prev, ...newState };

      // Handle wake lock
      if (newState.isRunning && !prev.isRunning) {
        requestWakeLock();
      } else if (!newState.isRunning && prev.isRunning) {
        releaseWakeLock();
      }

      return updated;
    });
  };

  // Stopwatch control handlers
  const handleStopwatchStart = () => {
    handleStopwatchStateChange({ isRunning: true });
  };

  const handleStopwatchStop = () => {
    handleStopwatchStateChange({ isRunning: false });
  };

  const handleStopwatchReset = () => {
    // Record history before resetting
    if (user && stopwatchState.time > 0) {
      const exercises = getExerciseList(stopwatchSelectedWorkout);
      recordWorkoutHistory(user.uid, {
        workoutName: stopwatchSelectedWorkout,
        workoutType: 'stopwatch',
        duration: Math.round(stopwatchState.time / 1000),
        setCount: stopwatchState.laps.length,
        exercises
      }).catch(err => console.error('Failed to record history:', err));
    }
    handleStopwatchStateChange({ time: 0, isRunning: false, laps: [] });
    setShowLapTimes(false);
  };

  const handleClearSets = () => {
    setStopwatchState(prev => ({ ...prev, laps: [] }));
    setShowLapTimes(false);
  };

  // Edit page handlers
  const handleNavigateToEdit = (type) => {
    setCurrentEditPage(type);
    setCurrentEditLevel('categories');
  };

  const handleEditPageBack = () => {
    if (currentEditLevel === 'exercise-edit') {
      if (activeTab === 'home') {
        setCurrentEditPage(null);
        setCurrentEditLevel('categories');
        setCurrentEditingWorkout(null);
        setActiveTab('home');
      } else {
        setCurrentEditLevel('categories');
        setCurrentEditingWorkout(null);
      }
    } else {
      setCurrentEditPage(null);
      setCurrentEditLevel('categories');
      setCurrentEditingWorkout(null);
      setActiveTab('home');
    }
  };

  const handleNavigateToTab = (type) => {
    setCurrentEditPage(null);
    setActiveTab(type);
  };

  const handleEditWorkoutSelect = (type, workout) => {
    if (type && !currentEditPage) {
      setCurrentEditPage(type);
      setCurrentEditLevel('categories');
    }

    if (currentEditLevel === 'categories') {
      if (workout === 'New Workout') {
        setCurrentEditLevel('exercise-edit');
        setCurrentEditingWorkout('New Workout');
        return;
      }

      if (type === 'timer') {
        setTimerSelectedWorkout(workout);
      } else if (type === 'stopwatch') {
        setStopwatchSelectedWorkout(workout);
      }
      setCurrentEditLevel('exercise-edit');
      setCurrentEditingWorkout(workout);
    } else {
      setCurrentEditLevel('categories');
      setCurrentEditingWorkout(null);
    }
  };

  const handleWorkoutSelection = (type, workout) => {
    if (type === 'timer') {
      setTimerSelectedWorkout(workout);
    } else if (type === 'stopwatch') {
      setStopwatchSelectedWorkout(workout);
    }
  };

  const handleExerciseSave = (updatedExercises, newTitle = null) => {
    const workoutType = currentEditPage;
    const workoutName = currentEditingWorkout;
    const isNew = workoutName === 'New Workout';
    const finalName = newTitle || workoutName;

    // Optimistic local update
    const setData = workoutType === 'timer' ? setTimerWorkoutData : setStopwatchWorkoutData;
    setData(prev => {
      if (isNew) {
        return [...prev, { name: finalName, type: workoutType, exercises: updatedExercises }];
      }
      return prev.map(w =>
        w.name === workoutName
          ? { ...w, name: finalName, exercises: updatedExercises }
          : w
      );
    });

    // Update selected workout name if it was renamed
    if (newTitle && workoutName !== 'New Workout') {
      if (workoutType === 'timer' && timerSelectedWorkout === workoutName) {
        setTimerSelectedWorkout(finalName);
      } else if (workoutType === 'stopwatch' && stopwatchSelectedWorkout === workoutName) {
        setStopwatchSelectedWorkout(finalName);
      }
    }
    if (isNew) {
      if (workoutType === 'timer') setTimerSelectedWorkout(finalName);
      else setStopwatchSelectedWorkout(finalName);
    }

    // Update the editing workout name reference
    setCurrentEditingWorkout(finalName);

    // Persist to Firestore when logged in
    if (user) {
      const defaultNames = [...DEFAULT_TIMER_WORKOUTS, ...DEFAULT_STOPWATCH_WORKOUTS].map(d => d.name);
      const isDefault = defaultNames.includes(workoutName);
      saveUserWorkout(user.uid, {
        name: finalName,
        type: workoutType,
        exercises: updatedExercises,
        isDefault,
        defaultName: isDefault && newTitle ? workoutName : null
      }).catch(err => console.error('Failed to save workout:', err));
    }
  };

  const handleStartWorkout = () => {
    let workoutType = currentEditPage;
    const workoutName = currentEditingWorkout;

    if (!workoutType && workoutName) {
      if (timerWorkouts.includes(workoutName)) {
        workoutType = 'timer';
      } else if (stopwatchWorkouts.includes(workoutName)) {
        workoutType = 'stopwatch';
      }
    }

    if (!workoutType || (workoutType !== 'timer' && workoutType !== 'stopwatch')) {
      console.error('Invalid workout type:', workoutType, 'for workout:', workoutName);
      return;
    }

    if (workoutType === 'timer') {
      setTimerSelectedWorkout(workoutName);
    } else if (workoutType === 'stopwatch') {
      setStopwatchSelectedWorkout(workoutName);
    }

    setActiveTab(workoutType);
    setCurrentEditPage(null);
    setCurrentEditLevel('categories');
    setCurrentEditingWorkout(null);
  };

  const handleStopwatchLap = () => {
    if (stopwatchState.isRunning) {
      setStopwatchState(prev => ({
        ...prev,
        laps: [...prev.laps, prev.time]
      }));
    }
  };

  const handleWorkoutViewToggle = () => {
    if (!stopwatchState.isRunning) {
      setShowWorkoutView(!showWorkoutView);
      if (!showWorkoutView) {
        setCurrentWorkoutIndex(selectedWorkoutIndex >= 0 ? selectedWorkoutIndex : 0);
      } else {
        setSelectedWorkoutIndex(currentWorkoutIndex);
      }
    }
  };

  const handleWorkoutSwipe = (direction) => {
    if (showWorkoutView) {
      const currentExercises = getExerciseList(stopwatchSelectedWorkout);
      const maxIndex = currentExercises.length - 1;
      if (direction === 'left') {
        setCurrentWorkoutIndex(prev => prev === maxIndex ? 0 : prev + 1);
      } else if (direction === 'right') {
        setCurrentWorkoutIndex(prev => prev === 0 ? maxIndex : prev - 1);
      }
    }
  };

  const handleWorkoutSelect = (index) => {
    setSelectedWorkoutIndex(index);
  };

  const handleLapBarTap = () => {
    if (stopwatchState.laps.length > 0) {
      setShowLapTimes(true);
    }
  };

  const handleLapBarTouchStart = (e) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleLapBarTouchMove = (e) => {
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY - touchY;

    if (deltaY > 50 && stopwatchState.laps.length > 0 && !showLapTimes) {
      setShowLapTimes(true);
    } else if (deltaY < -50 && showLapTimes && !isClosingLapTimes) {
      handleCloseLapTimes();
    }
  };

  const handleLapBarTouchEnd = () => {
    setTouchStartY(0);
  };

  const handleCloseLapTimes = () => {
    if (!isClosingLapTimes) {
      setIsClosingLapTimes(true);
      setTimeout(() => {
        setShowLapTimes(false);
        setIsClosingLapTimes(false);
      }, 300);
    }
  };

  const formatLapTime = (timeInMs) => {
    const minutes = Math.floor(timeInMs / 60000);
    const seconds = Math.floor((timeInMs % 60000) / 1000);
    const centiseconds = Math.floor((timeInMs % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    if (activeTab === 'timer' && !currentEditPage) {
      return (
        <Timer
          timeLeft={timerState.timeLeft}
          isRunning={timerState.isRunning}
          targetTime={timerState.targetTime}
          selectedWorkoutIndex={timerState.selectedWorkoutIndex}
          onTimerStateChange={handleTimerStateChange}
          workouts={getExerciseList(timerSelectedWorkout)}
          selectedWorkoutName={timerSelectedWorkout}
        />
      );
    }

    if (activeTab === 'stats' && !currentEditPage) {
      return (
        <StatsPage
          user={user}
          history={workoutHistory}
          loading={historyLoading}
        />
      );
    }

    if (currentEditLevel === 'exercise-edit' && currentEditingWorkout) {
      const exercises = getExerciseList(currentEditingWorkout);
      return (
        <ExerciseEditPage
          workoutName={currentEditingWorkout}
          exercises={exercises}
          onSave={handleExerciseSave}
          onBack={handleEditPageBack}
          workoutType={currentEditPage}
          onStart={handleStartWorkout}
        />
      );
    }

    if (currentEditPage) {
      const workouts = currentEditPage === 'timer' ? timerWorkouts : stopwatchWorkouts;
      const selectedWorkout = currentEditPage === 'timer' ? timerSelectedWorkout : stopwatchSelectedWorkout;

      return (
        <EditPage
          type={currentEditPage}
          level={currentEditLevel}
          workouts={workouts}
          selectedWorkout={selectedWorkout}
          onWorkoutSelect={(workout) => handleWorkoutSelection(currentEditPage, workout)}
          onArrowClick={(workout) => handleEditWorkoutSelect(currentEditPage, workout)}
          onBack={handleEditPageBack}
          onNavigateToTab={handleNavigateToTab}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <Home
            onNavigateToEdit={handleNavigateToEdit}
            timerSelectedWorkout={timerSelectedWorkout}
            timerWorkouts={timerWorkouts}
            onWorkoutSelect={handleWorkoutSelection}
            onArrowClick={handleEditWorkoutSelect}
            onNavigateToTab={handleNavigateToTab}
          />
        );
      case 'timer':
        return (
          <Timer
            timeLeft={timerState.timeLeft}
            isRunning={timerState.isRunning}
            targetTime={timerState.targetTime}
            selectedWorkoutIndex={timerState.selectedWorkoutIndex}
            onTimerStateChange={handleTimerStateChange}
            workouts={getExerciseList(timerSelectedWorkout)}
            selectedWorkoutName={timerSelectedWorkout}
          />
        );
      case 'stats':
        return (
          <StatsPage
            user={user}
            history={workoutHistory}
            loading={historyLoading}
          />
        );
      default:
        return (
          <Home
            onNavigateToEdit={handleNavigateToEdit}
            timerSelectedWorkout={timerSelectedWorkout}
            timerWorkouts={timerWorkouts}
            onWorkoutSelect={handleWorkoutSelection}
            onArrowClick={handleEditWorkoutSelect}
            onNavigateToTab={handleNavigateToTab}
          />
        );
    }
  };

  return (
    <main className="tab-content">
      {renderContent()}
      {!currentEditPage && currentEditLevel !== 'exercise-edit' && (
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </main>
  );
};

export default Main;
