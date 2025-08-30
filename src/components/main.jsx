import React, { useState, useEffect, useRef } from 'react';
import Timer from './Timer';
import Home from './Home';
import Stopwatch from './Stopwatch';
import TabBar from './TabBar';

const Main = () => {
  const [activeTab, setActiveTab] = useState('home');
  
  // Default workouts for calculation
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
  
  // Calculate total time: (workoutList.length * 60) + prepTime
  const calculateTotalTime = () => (defaultWorkouts.length * 60) + 15; // 15 seconds prep
  
  // Timer state
  const [timerState, setTimerState] = useState({
    timeLeft: calculateTotalTime(), // Use calculated time instead of hardcoded 600
    isRunning: false,
    targetTime: calculateTotalTime(),
    selectedWorkoutIndex: 0
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
  }, [timerState.isRunning]);

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
    setStopwatchState(prev => ({ ...prev, ...newState }));
  };

  // Stopwatch control handlers
  const handleStopwatchStart = () => {
    setStopwatchState(prev => ({ ...prev, isRunning: true }));
  };

  const handleStopwatchStop = () => {
    setStopwatchState(prev => ({ ...prev, isRunning: false }));
  };

  const handleStopwatchReset = () => {
    setStopwatchState(prev => ({ ...prev, time: 0, isRunning: false, laps: [] }));
    setShowLapTimes(false);
  };

  const handleStopwatchLap = () => {
    if (stopwatchState.isRunning) {
      setStopwatchState(prev => ({
        ...prev,
        laps: [...prev.laps, prev.time]
      }));
    }
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
    switch (activeTab) {
      case 'home':
        return <Home />;
      case 'timer':
        return (
          <Timer 
            timeLeft={timerState.timeLeft}
            isRunning={timerState.isRunning}
            targetTime={timerState.targetTime}
            selectedWorkoutIndex={timerState.selectedWorkoutIndex}
            onTimerStateChange={handleTimerStateChange}
          />
        );
      case 'stopwatch':
        return (
          <Stopwatch 
            time={stopwatchState.time}
            isRunning={stopwatchState.isRunning}
            laps={stopwatchState.laps}
            onStopwatchStateChange={handleStopwatchStateChange}
          />
        );
      default:
        return <Home />;
    }
  };

  return (
    <main className="tab-content">
      {renderContent()}
      <TabBar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        stopwatchControls={activeTab === 'stopwatch' ? {
          isRunning: stopwatchState.isRunning,
          onStart: handleStopwatchStart,
          onStop: handleStopwatchStop,
          onReset: handleStopwatchReset,
          onLap: handleStopwatchLap,
          lapCount: stopwatchState.laps.length,
          showLapTimes: showLapTimes,
          isClosingLapTimes: isClosingLapTimes,
          onLapBarTap: handleLapBarTap,
          onLapBarTouchStart: handleLapBarTouchStart,
          onLapBarTouchMove: handleLapBarTouchMove,
          onLapBarTouchEnd: handleLapBarTouchEnd,
          onCloseLapTimes: handleCloseLapTimes,
          lapTimes: stopwatchState.laps.map(lap => formatLapTime(lap))
        } : null}
      />
    </main>
  );
};

export default Main;
