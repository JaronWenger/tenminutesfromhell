import React, { useState, useEffect, useRef } from 'react';
import './Stopwatch.css';

const Stopwatch = ({ 
  time: propTime,
  isRunning: propIsRunning,
  laps: propLaps,
  onStopwatchStateChange
}) => {
  // Use props if provided, otherwise use local state
  const [time, setTime] = useState(propTime !== undefined ? propTime : 0);
  const [isRunning, setIsRunning] = useState(propIsRunning !== undefined ? propIsRunning : false);
  const [laps, setLaps] = useState(propLaps !== undefined ? propLaps : []);

  // Stationary workout list
  const workoutList = [
    "10 Pull Ups",
    "Bent over one arm row",
    "Dead lift",
    "10 pull ups",
    "Bent over rows",
    "Shrugs",
    "Bicep curls",
    "Aidan Curls",
    "10 Pull Ups"
  ];

  // Update local state when props change
  useEffect(() => {
    if (propTime !== undefined) setTime(propTime);
    if (propIsRunning !== undefined) setIsRunning(propIsRunning);
    if (propLaps !== undefined) setLaps(propLaps);
  }, [propTime, propIsRunning, propLaps]);

  // Callback to update parent state
  const updateParentState = (newState) => {
    if (onStopwatchStateChange) {
      onStopwatchStateChange({
        time,
        isRunning,
        laps,
        ...newState
      });
    }
  };

  const startStopwatch = () => {
    setIsRunning(true);
    updateParentState({ isRunning: true });
  };

  const stopStopwatch = () => {
    setIsRunning(false);
    updateParentState({ isRunning: false });
  };

  const resetStopwatch = () => {
    setIsRunning(false);
    setTime(0);
    setLaps([]);
    updateParentState({ isRunning: false, time: 0, laps: [] });
  };

  const addLap = () => {
    if (isRunning) {
      const newLaps = [...laps, time];
      setLaps(newLaps);
      updateParentState({ laps: newLaps });
    }
  };

  const formatTime = (timeInMs) => {
    const minutes = Math.floor(timeInMs / 60000);
    const seconds = Math.floor((timeInMs % 60000) / 1000);
    const centiseconds = Math.floor((timeInMs % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="stopwatch-container">
      {/* Timer Display at Top */}
      <div className="stopwatch-display">
        <div className="time-display">
          {formatTime(time)}
        </div>
      </div>

      {/* New Workout List Section */}
      <div className="stopwatch-workout-section">
        <h3 className="workout-section-title">Back & Bis</h3>
        {workoutList.map((workout, index) => (
          <div key={index} className="workout-grid-item">
            <span className="workout-grid-number">{index + 1}</span>
            <span className="workout-grid-name">{workout}</span>
          </div>
        ))}
      </div>




    </div>
  );
};

export default Stopwatch;
