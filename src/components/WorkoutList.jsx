import React, { useRef, useEffect } from 'react';
import './WorkoutList.css';

const WorkoutList = ({
  workoutList,
  workoutIndex,
  isRunning,
  timeLeft,
  onWorkoutSelect,
  showAllWhenPaused,
  staggerIn = false,
  restTime = 15
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
        const isWarning = isActive && currentSeconds >= 1 && currentSeconds <= restTime && timeLeft > 60;

        return (
          <div
            key={index}
            className={`workout-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${isWarning ? 'warning' : ''} ${!isRunning ? 'selectable' : ''} ${staggerIn ? 'fade-in-item' : ''}`}
            onClick={() => onWorkoutSelect && onWorkoutSelect(index)}
            style={{
              cursor: !isRunning ? 'pointer' : 'default',
              ...(staggerIn ? { '--stagger-delay': `${100 + index * 40}ms` } : {})
            }}
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
