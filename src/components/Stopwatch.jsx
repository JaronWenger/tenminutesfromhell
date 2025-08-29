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
  const intervalRef = useRef(null);

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

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(prevTime => {
          const newTime = prevTime + 10;
          updateParentState({ time: newTime });
          return newTime;
        });
      }, 10);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

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
      <div className="stopwatch-display">
        <div className="time-display">
          {formatTime(time)}
        </div>
      </div>

      <div className="stopwatch-controls">
        <button 
          className={`control-btn ${isRunning ? 'stop' : 'start'}`}
          onClick={isRunning ? stopStopwatch : startStopwatch}
        >
          {isRunning ? 'Stop' : 'Start'}
        </button>
        
        <button 
          className="control-btn reset"
          onClick={resetStopwatch}
          disabled={time === 0}
        >
          Reset
        </button>
        
        <button 
          className="control-btn lap"
          onClick={addLap}
          disabled={!isRunning}
        >
          Lap
        </button>
      </div>

      {laps.length > 0 && (
        <div className="laps-container">
          <h3>Laps</h3>
          <div className="laps-list">
            {laps.map((lapTime, index) => (
              <div key={index} className="lap-item">
                <span className="lap-number">#{laps.length - index}</span>
                <span className="lap-time">{formatTime(lapTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Stopwatch;
