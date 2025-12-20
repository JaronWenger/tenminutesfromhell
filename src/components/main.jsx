import React, { useState, useEffect, useRef } from 'react';
import Timer from './Timer';
import Home from './Home';
import Stopwatch from './Stopwatch';
import TabBar from './TabBar';
import EditPage from './EditPage';
import ExerciseEditPage from './ExerciseEditPage';

const Main = () => {
  const [activeTab, setActiveTab] = useState('home');
  
  // Workout categories for each section
  const timerWorkouts = [
    "The Devils 10",
    "Abs 2",
    "Core Blaster",
    "Leg Day Hell",
    "Full Body Burn",
    "Cardio Inferno"
  ];

  const stopwatchWorkouts = [
    "Back & Bis",
    "Shoulders",
    "Chest & Tris",
    "Legs & Glutes",
    "Upper Body Power",
    "Strength & Endurance"
  ];

  // Exercise lists for each workout
  const devils10Exercises = [
    "Russian Twist",
    "Seated in and outs",
    "Boat hold",
    "Jack knifes",
    "Sit up twist",
    "Leg raises",
    "Chair sit ups",
    "Plank knees to elbows",
    "Side planks dips",
    "Bicycle",
    "Boat hold leg flutters"
  ];

  const abs2Exercises = [
    "Leg raises",
    "Single leg raises",
    "Chair crunches",
    "In and outs",
    "Sit ups",
    "Planks",
    "Bicycles",
    "Russian twists"
  ];

  const backAndBisExercises = [
    "10 pull ups (or muscle ups)",
    "Bent over one arm curls",
    "Dead lift",
    "10 pull ups",
    "Bent over curls",
    "Shrugs",
    "Bicep curls",
    "Concentrated curls",
    "10 pull ups"
  ];

  const shouldersExercises = [
    "Normal handstand hold",
    "Handstand pushups (Max against wall)",
    "Pike pushups",
    "Shoulder flies outwards",
    "Shoulder flies front",
    "Bent over shoulder flies outwards",
    "Parallets handstand hold",
    "Parallets ground to handstand wall cheat",
    "Handstand against wall 1 minute"
  ];

  const chestAndTrisExercises = [
    "Inclined press",
    "Jumping pushups",
    "Curl press",
    "Close pushups",
    "Flies",
    "Dips",
    "Close inclined press",
    "Archer pushups",
    "Bench dips"
  ];

  // New Timer Workout Exercises
  const coreBlasterExercises = [
    "Mountain climbers",
    "Plank to pushup",
    "Dead bug",
    "Hollow body hold",
    "Side plank dips",
    "Bicycle crunches",
    "Leg raises",
    "Russian twists",
    "Plank jacks",
    "Sit-up to stand"
  ];

  const legDayHellExercises = [
    "Squats",
    "Jump squats",
    "Lunges",
    "Single leg deadlifts",
    "Wall sits",
    "Calf raises",
    "Glute bridges",
    "Side lunges",
    "Pistol squats",
    "Bulgarian split squats"
  ];

  const fullBodyBurnExercises = [
    "Burpees",
    "Jumping jacks",
    "High knees",
    "Mountain climbers",
    "Push-ups",
    "Squats",
    "Plank",
    "Jump squats",
    "Tricep dips",
    "Lunges"
  ];

  const cardioInfernoExercises = [
    "Jumping jacks",
    "High knees",
    "Butt kicks",
    "Mountain climbers",
    "Burpees",
    "Jump squats",
    "Plank jacks",
    "Star jumps",
    "Skaters",
    "Sprint in place"
  ];

  // New Stopwatch Workout Exercises
  const legsAndGlutesExercises = [
    "Squats",
    "Deadlifts",
    "Lunges",
    "Glute bridges",
    "Calf raises",
    "Wall sits",
    "Single leg deadlifts",
    "Bulgarian split squats",
    "Hip thrusts"
  ];

  const upperBodyPowerExercises = [
    "Pull-ups",
    "Push-ups",
    "Dips",
    "Pike push-ups",
    "Inverted rows",
    "Diamond push-ups",
    "Archer push-ups",
    "Handstand push-ups",
    "Muscle-ups"
  ];

  const strengthAndEnduranceExercises = [
    "Deadlifts",
    "Squats",
    "Pull-ups",
    "Push-ups",
    "Plank holds",
    "Burpees",
    "Mountain climbers",
    "Jump squats",
    "Dips"
  ];
  
  // Calculate total time: (workoutList.length * 60) + prepTime
  const calculateTotalTime = () => (devils10Exercises.length * 60) + 15; // 15 seconds prep
  
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
  
  // Workout view state (phone only)
  const [showWorkoutView, setShowWorkoutView] = useState(false);
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(-1);

  // Edit page state
  const [currentEditPage, setCurrentEditPage] = useState(null);
  const [currentEditLevel, setCurrentEditLevel] = useState('categories'); // 'categories', 'exercises', or 'exercise-edit'
  const [currentEditingWorkout, setCurrentEditingWorkout] = useState(null);
  const [timerSelectedWorkout, setTimerSelectedWorkout] = useState('The Devils 10');
  const [stopwatchSelectedWorkout, setStopwatchSelectedWorkout] = useState('Back & Bis');

  // Function to get the appropriate exercise list based on selected workout
  const getExerciseList = (workoutName) => {
    switch (workoutName) {
      // Timer workouts
      case 'The Devils 10':
        return devils10Exercises;
      case 'Abs 2':
        return abs2Exercises;
      case 'Core Blaster':
        return coreBlasterExercises;
      case 'Leg Day Hell':
        return legDayHellExercises;
      case 'Full Body Burn':
        return fullBodyBurnExercises;
      case 'Cardio Inferno':
        return cardioInfernoExercises;
      // Stopwatch workouts
      case 'Back & Bis':
        return backAndBisExercises;
      case 'Shoulders':
        return shouldersExercises;
      case 'Chest & Tris':
        return chestAndTrisExercises;
      case 'Legs & Glutes':
        return legsAndGlutesExercises;
      case 'Upper Body Power':
        return upperBodyPowerExercises;
      case 'Strength & Endurance':
        return strengthAndEnduranceExercises;
      // New workout case
      case 'New Workout':
        return []; // Empty array for new workout
      default:
        return devils10Exercises; // fallback to timer workout
    }
  };

  // Recalculate timer when workout selection changes
  useEffect(() => {
    const currentExercises = getExerciseList(timerSelectedWorkout);
    const newTotalTime = (currentExercises.length * 60) + 15;
    setTimerState(prev => ({
      ...prev,
      timeLeft: newTotalTime,
      targetTime: newTotalTime
    }));
  }, [timerSelectedWorkout]);

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
      setCurrentEditLevel('categories');
      setCurrentEditingWorkout(null);
    } else {
      setCurrentEditPage(null);
    }
  };

  const handleNavigateToTab = (type) => {
    setCurrentEditPage(null);
    setActiveTab(type);
  };

  const handleEditWorkoutSelect = (type, workout) => {
    if (currentEditLevel === 'categories') {
      // Handle "New Workout" case
      if (workout === 'New Workout') {
        // Set currentEditPage if type is provided (coming from Home)
        if (type) {
          setCurrentEditPage(type);
        }
        setCurrentEditLevel('exercise-edit');
        setCurrentEditingWorkout('New Workout');
        return;
      }
      
      // Select the workout category and go directly to exercise editing
      if (type === 'timer') {
        setTimerSelectedWorkout(workout);
      } else if (type === 'stopwatch') {
        setStopwatchSelectedWorkout(workout);
      }
      // Set currentEditPage if type is provided (coming from Home)
      if (type) {
        setCurrentEditPage(type);
      }
      setCurrentEditLevel('exercise-edit');
      setCurrentEditingWorkout(workout);
    } else {
      // This is the exercise edit level - save and go back to categories
      setCurrentEditLevel('categories');
      setCurrentEditingWorkout(null);
    }
  };

  const handleWorkoutSelection = (type, workout) => {
    // Just select the workout without navigating to exercise edit
    if (type === 'timer') {
      setTimerSelectedWorkout(workout);
    } else if (type === 'stopwatch') {
      setStopwatchSelectedWorkout(workout);
    }
  };

  const handleExerciseSave = (updatedExercises, newTitle = null) => {
    // Here you would save the updated exercises to your workout data
    console.log('Saving exercises for', currentEditingWorkout, ':', updatedExercises);
    if (newTitle) {
      console.log('New title:', newTitle);
    }
    
    // Update the exercise lists based on which workout is being edited
    if (currentEditingWorkout === 'The Devils 10') {
      // Update the devils10Exercises array (you might want to store this in state)
      console.log('Updated The Devils 10 exercises:', updatedExercises);
    } else if (currentEditingWorkout === 'Abs 2') {
      // Update the abs2Exercises array (you might want to store this in state)
      console.log('Updated Abs 2 exercises:', updatedExercises);
    } else if (currentEditingWorkout === 'Back & Bis') {
      // Update the backAndBisExercises array (you might want to store this in state)
      console.log('Updated Back & Bis exercises:', updatedExercises);
    } else if (currentEditingWorkout === 'Shoulders') {
      // Update the shouldersExercises array (you might want to store this in state)
      console.log('Updated Shoulders exercises:', updatedExercises);
    } else if (currentEditingWorkout === 'Chest & Tris') {
      // Update the chestAndTrisExercises array (you might want to store this in state)
      console.log('Updated Chest & Tris exercises:', updatedExercises);
    }
    
    // Stay on the same page - don't navigate away
    // The changes are saved but user remains on the edit page
  };

  const handleStartWorkout = () => {
    // Save the workout type before clearing state
    let workoutType = currentEditPage;
    const workoutName = currentEditingWorkout;
    
    // If workoutType is null, try to determine it from the workout name
    if (!workoutType && workoutName) {
      if (timerWorkouts.includes(workoutName)) {
        workoutType = 'timer';
      } else if (stopwatchWorkouts.includes(workoutName)) {
        workoutType = 'stopwatch';
      }
    }
    
    // Only proceed if we have a valid workout type
    if (!workoutType || (workoutType !== 'timer' && workoutType !== 'stopwatch')) {
      console.error('Invalid workout type:', workoutType, 'for workout:', workoutName);
      return;
    }
    
    // Select the workout in the main page
    if (workoutType === 'timer') {
      setTimerSelectedWorkout(workoutName);
    } else if (workoutType === 'stopwatch') {
      setStopwatchSelectedWorkout(workoutName);
    }
    
    // Set active tab FIRST, then clear edit state
    // This ensures the tab is set before React re-renders
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
    // If activeTab is timer/stopwatch AND we're not in edit mode, show the tab
    // This allows navigation from edit pages to tabs
    if ((activeTab === 'timer' || activeTab === 'stopwatch') && !currentEditPage) {
      switch (activeTab) {
        case 'timer':
          return (
            <Timer 
              timeLeft={timerState.timeLeft}
              isRunning={timerState.isRunning}
              targetTime={timerState.targetTime}
              selectedWorkoutIndex={timerState.selectedWorkoutIndex}
              onTimerStateChange={handleTimerStateChange}
              workouts={getExerciseList(timerSelectedWorkout)}
            />
          );
        case 'stopwatch':
          return (
            <Stopwatch 
              time={stopwatchState.time}
              isRunning={stopwatchState.isRunning}
              laps={stopwatchState.laps}
              onStopwatchStateChange={handleStopwatchStateChange}
              showWorkoutView={showWorkoutView}
              currentWorkoutIndex={currentWorkoutIndex}
              onWorkoutSwipe={handleWorkoutSwipe}
              selectedWorkoutIndex={selectedWorkoutIndex}
              onWorkoutSelect={handleWorkoutSelect}
              workoutList={getExerciseList(stopwatchSelectedWorkout)}
            />
          );
        default:
          break;
      }
    }
    
    // Show exercise edit page if active (when not navigating to timer/stopwatch)
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

    // Show edit page if active (when not navigating to timer/stopwatch)
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
            stopwatchSelectedWorkout={stopwatchSelectedWorkout}
            timerWorkouts={timerWorkouts}
            stopwatchWorkouts={stopwatchWorkouts}
            onWorkoutSelect={handleWorkoutSelection}
            onArrowClick={handleEditWorkoutSelect}
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
          />
        );
      case 'stopwatch':
        return (
          <Stopwatch 
            time={stopwatchState.time}
            isRunning={stopwatchState.isRunning}
            laps={stopwatchState.laps}
            onStopwatchStateChange={handleStopwatchStateChange}
            showWorkoutView={showWorkoutView}
            currentWorkoutIndex={currentWorkoutIndex}
            onWorkoutSwipe={handleWorkoutSwipe}
            selectedWorkoutIndex={selectedWorkoutIndex}
            onWorkoutSelect={handleWorkoutSelect}
            workoutList={getExerciseList(stopwatchSelectedWorkout)}
          />
        );
      default:
        return (
          <Home 
            onNavigateToEdit={handleNavigateToEdit}
            timerSelectedWorkout={timerSelectedWorkout}
            stopwatchSelectedWorkout={stopwatchSelectedWorkout}
            timerWorkouts={timerWorkouts}
            stopwatchWorkouts={stopwatchWorkouts}
            onWorkoutSelect={handleWorkoutSelection}
            onArrowClick={handleEditWorkoutSelect}
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
            lapTimes: stopwatchState.laps.map(lap => formatLapTime(lap)),
            showWorkoutView: showWorkoutView,
            currentWorkoutIndex: currentWorkoutIndex,
            onWorkoutViewToggle: handleWorkoutViewToggle,
            onWorkoutSwipe: handleWorkoutSwipe,
            onClearSets: handleClearSets
          } : null}
        />
      )}
    </main>
  );
};

export default Main;
