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
  restTime = 15,
  activeLastMinute = true
}) => {
  const workoutListRef = useRef(null);

  // Reset scroll to top when timer starts
  useEffect(() => {
    if (isRunning && workoutListRef.current) {
      workoutListRef.current.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    }
  }, [isRunning]);
  return (
    <div className="workout-list" ref={workoutListRef}>
      {workoutList.map((workout, index) => {
        const isLastRest = !activeLastMinute && isRunning && timeLeft > 0 && timeLeft <= restTime;
        const isActive = index === workoutIndex && isRunning && timeLeft > 0 && !isLastRest;
        const isCompleted = index < workoutIndex || (timeLeft === 0 && index < workoutList.length) || (isLastRest && index === workoutIndex);
        const isUpcoming = index > workoutIndex || (index === workoutIndex && !isRunning && timeLeft > 0);
        const currentSeconds = timeLeft % 60;
        const isExerciseRest = /\brest\b/i.test(workout);
        const isWarning = isActive && (isExerciseRest || (currentSeconds >= 1 && currentSeconds <= restTime && (activeLastMinute ? timeLeft > 60 : true)));

        return (
          <div
            key={index}
            className={`workout-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${isWarning ? 'warning' : ''} ${!isRunning || isUpcoming ? 'selectable' : ''} ${staggerIn ? 'fade-in-item' : ''}`}
            onClick={() => onWorkoutSelect && (!isRunning || isUpcoming) && onWorkoutSelect(index)}
            style={{
              cursor: (!isRunning || isUpcoming) ? 'pointer' : 'default',
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
