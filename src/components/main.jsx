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
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};

export default Main;
