import React from 'react';
import './WorkoutList.css';

const WorkoutList = ({ 
  workoutList, 
  workoutIndex, 
  isRunning, 
  timeLeft 
}) => {
  return (
    <div className="workout-list">
      {workoutList.map((workout, index) => {
        const isActive = index === workoutIndex && isRunning && timeLeft > 0;
        const isCompleted = index < workoutIndex || (timeLeft === 0 && index < workoutList.length);
        const isUpcoming = index > workoutIndex || (index === workoutIndex && !isRunning && timeLeft > 0);
        const currentSeconds = timeLeft % 60;
        const isWarning = isActive && currentSeconds >= 1 && currentSeconds <= 15 && timeLeft > 60;
        
        return (
          <div 
            key={index}
            className={`workout-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${isWarning ? 'warning' : ''}`}
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
