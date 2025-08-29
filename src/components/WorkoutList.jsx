import React, { useRef, useEffect } from 'react';
import './WorkoutList.css';

const WorkoutList = ({ 
  workoutList, 
  workoutIndex, 
  isRunning, 
  timeLeft,
  onWorkoutSelect,
  showAllWhenPaused
}) => {
  const workoutListRef = useRef(null);

  // Scroll to top when timer starts
  useEffect(() => {
    if (isRunning && workoutListRef.current) {
      workoutListRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [isRunning]);
  return (
    <div className="workout-list" ref={workoutListRef}>
      {workoutList.map((workout, index) => {
        const isActive = index === workoutIndex && isRunning && timeLeft > 0;
        const isCompleted = index < workoutIndex || (timeLeft === 0 && index < workoutList.length);
        const isUpcoming = index > workoutIndex || (index === workoutIndex && !isRunning && timeLeft > 0);
        const currentSeconds = timeLeft % 60;
        const isWarning = isActive && currentSeconds >= 1 && currentSeconds <= 15 && timeLeft > 60;
        
        // Show all workouts when paused, or normal behavior when running
        const shouldShow = showAllWhenPaused || !isCompleted;
        
        // When paused, show all workouts regardless of completion status
        if (showAllWhenPaused) {
          return (
            <div 
              key={index}
              className={`workout-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${isWarning ? 'warning' : ''} ${!isRunning ? 'selectable' : ''}`}
              onClick={() => onWorkoutSelect && onWorkoutSelect(index)}
              style={{ cursor: !isRunning ? 'pointer' : 'default' }}
            >
              <span className="workout-number">{index + 1}</span>
              <span className="workout-text">{workout}</span>
            </div>
          );
        }
        
        // Normal behavior when running
        if (!shouldShow) return null;
        
        return (
          <div 
            key={index}
            className={`workout-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${isWarning ? 'warning' : ''} ${!isRunning ? 'selectable' : ''}`}
            onClick={() => onWorkoutSelect && onWorkoutSelect(index)}
            style={{ cursor: !isRunning ? 'pointer' : 'default' }}
          >
            <span className="workout-number">{index + 1}</span>
            <span className="workout-text">{workout}</span>
          </div>
        );
      })}
    </div>
  );
};

export default WorkoutList;
