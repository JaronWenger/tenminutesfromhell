import React, { useEffect, useState } from 'react';
import './TabBar.css';
import Tab1 from '../assets/Tab1.jpg';
import Tab2 from '../assets/Tab2.jpg';
import Tab3 from '../assets/Tab3.jpg';

const TabBar = ({ activeTab, onTabChange, stopwatchControls }) => {
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const handleOrientationChange = () => {
      // Get the current screen orientation
      if (window.screen && window.screen.orientation) {
        setOrientation(window.screen.orientation.type);
      } else {
        // Fallback for older browsers
        setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
      }
    };

    // Set initial orientation
    handleOrientationChange();

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return (
    <div className={`tab-bar ${orientation} ${activeTab === 'stopwatch' ? 'stopwatch-mode' : ''}`}>
      <button 
        className={`tab-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => {
          onTabChange('home');
          if (stopwatchControls && stopwatchControls.showLapTimes) {
            stopwatchControls.onCloseLapTimes();
          }
        }}
      >
        <div className="tab-icon">
          <img src={Tab1} alt="Home" />
        </div>
        <span className="tab-label">Home</span>
      </button>
      
      <button 
        className={`tab-item ${activeTab === 'timer' ? 'active' : ''}`}
        onClick={() => {
          onTabChange('timer');
          if (stopwatchControls && stopwatchControls.showLapTimes) {
            stopwatchControls.onCloseLapTimes();
          }
        }}
      >
        <div className="tab-icon">
          <img src={Tab2} alt="Timer" />
        </div>
        <span className="tab-label">Timer</span>
      </button>
      
      <button 
        className={`tab-item ${activeTab === 'stopwatch' ? 'active' : ''}`}
        onClick={() => {
          onTabChange('stopwatch');
          if (stopwatchControls && stopwatchControls.showLapTimes) {
            stopwatchControls.onCloseLapTimes();
          }
        }}
      >
        <div className="tab-icon">
          <img src={Tab3} alt="Stopwatch" />
        </div>
        <span className="tab-label">Stopwatch</span>
      </button>
      
      {activeTab === 'stopwatch' && stopwatchControls && (
        <>
          <div className="stopwatch-controls">
            <button className="control-btn reset" onClick={stopwatchControls.onReset}>
              Reset
            </button>
            <button 
              className={`control-btn ${stopwatchControls.isRunning ? 'stop' : 'start'}`}
              onClick={stopwatchControls.isRunning ? stopwatchControls.onStop : stopwatchControls.onStart}
            >
              {stopwatchControls.isRunning ? 'Stop' : 'Start'}
            </button>
            <button 
              className="control-btn lap" 
              onClick={stopwatchControls.isRunning ? stopwatchControls.onLap : stopwatchControls.onWorkoutViewToggle}
            >
              {stopwatchControls.isRunning ? 'Lap' : 'View'}
            </button>
          </div>
          {stopwatchControls.lapCount > 0 && (
            <div 
              className="lap-progress-bar"
              onClick={stopwatchControls.showLapTimes ? stopwatchControls.onCloseLapTimes : stopwatchControls.onLapBarTap}
            >
              {Array.from({ length: stopwatchControls.lapCount }, (_, index) => (
                <div 
                  key={index} 
                  className="lap-segment"
                  style={{ 
                    width: `${100 / stopwatchControls.lapCount}%`,
                    left: `${(index * 100) / stopwatchControls.lapCount}%`
                  }}
                />
              ))}
            </div>
          )}
          {stopwatchControls.lapCount > 0 && (
            <div 
              className="lap-progress-bar-desktop"
              onClick={stopwatchControls.showLapTimes ? stopwatchControls.onCloseLapTimes : stopwatchControls.onLapBarTap}
            >
              {Array.from({ length: stopwatchControls.lapCount }, (_, index) => (
                <div 
                  key={`desktop-${index}`} 
                  className="lap-segment-desktop"
                  style={{ 
                    width: `${100 / stopwatchControls.lapCount}%`,
                    left: `${(index * 100) / stopwatchControls.lapCount}%`
                  }}
                />
              ))}
            </div>
          )}
          {stopwatchControls.showLapTimes && (
            <div 
              className={`lap-times-panel ${stopwatchControls.isClosingLapTimes ? 'fade-out' : ''}`}
              onClick={stopwatchControls.onCloseLapTimes}
            >
              <div className="lap-progress-bar-popup">
                {Array.from({ length: stopwatchControls.lapCount }, (_, index) => (
                  <div 
                    key={index} 
                    className="lap-segment-popup"
                    style={{ 
                      width: `${100 / stopwatchControls.lapCount}%`,
                      left: `${(index * 100) / stopwatchControls.lapCount}%`
                    }}
                  />
                ))}
              </div>
              <div className="lap-times-list">
                {stopwatchControls.lapTimes.map((lapTime, index) => (
                  <div key={index} className="lap-time-item">
                    <span className="lap-number">#{stopwatchControls.lapTimes.length - index}</span>
                    <span className="lap-time">{lapTime}</span>
                  </div>
                ))}
                {stopwatchControls.showWorkoutView && (
                  <button 
                    className="lap-times-reset-btn"
                    onClick={stopwatchControls.onClearSets}
                  >
                    ↻
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TabBar;
