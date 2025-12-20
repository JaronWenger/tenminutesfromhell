import React, { useState } from 'react';
import './Home.css';
import Tab2 from '../assets/Tab2.jpg';
import Tab3 from '../assets/Tab3.jpg';
import Sparks from '../assets/SPARKS.gif';

const Home = ({ onNavigateToEdit, timerSelectedWorkout, stopwatchSelectedWorkout, timerWorkouts, stopwatchWorkouts, onWorkoutSelect, onArrowClick, onNavigateToTab }) => {
  const [expandedCard, setExpandedCard] = useState(null);

  const handleTimerClick = () => {
    if (expandedCard === 'timer') {
      setExpandedCard(null);
    } else {
      setExpandedCard('timer');
    }
  };

  const handleStopwatchClick = () => {
    if (expandedCard === 'stopwatch') {
      setExpandedCard(null);
    } else {
      setExpandedCard('stopwatch');
    }
  };

  const handleWorkoutSelect = (type, workout) => {
    // Check if this workout is already selected
    const isAlreadySelected = (type === 'timer' && timerSelectedWorkout === workout) || 
                              (type === 'stopwatch' && stopwatchSelectedWorkout === workout);
    
    if (isAlreadySelected && onNavigateToTab) {
      // If already selected, navigate to the tab
      onNavigateToTab(type);
      setExpandedCard(null);
    } else {
      // Otherwise, just select the workout
      onWorkoutSelect(type, workout);
      // Don't collapse - stay expanded
    }
  };

  const handleHeaderClick = (e) => {
    e.stopPropagation();
    setExpandedCard(null);
  };

  const handleArrowClick = (type, workout, e) => {
    e.stopPropagation();
    onArrowClick(type, workout);
    setExpandedCard(null);
  };

  const handleWorkoutDoubleClick = (type, workout, e) => {
    e.stopPropagation();
    onArrowClick(type, workout);
    setExpandedCard(null);
  };

  const handleOutsideClick = (e) => {
    // Only collapse if clicking outside both boxes and not on interactive elements
    // Check if the click target is a button, link, or inside a card
    const target = e.target;
    const isInteractive = target.tagName === 'BUTTON' || 
                         target.tagName === 'A' || 
                         target.closest('.home-card') ||
                         target.closest('button') ||
                         target.closest('a');
    
    // Only collapse if not clicking on interactive elements and a card is expanded
    if (expandedCard && !isInteractive) {
      setExpandedCard(null);
    }
  };

  return (
    <div className="home-container" onClick={handleOutsideClick}>
      {/* Fire Background */}
      <div className="fire-background">
        <img src={Sparks} alt="Fire sparks" className="sparks-gif" />
      </div>
      
      {/* Left and right side overlays for desktop to capture clicks */}
      {expandedCard && (
        <>
          <div 
            className="home-side-overlay home-side-overlay-left"
            onClick={handleOutsideClick}
          />
          <div 
            className="home-side-overlay home-side-overlay-right"
            onClick={handleOutsideClick}
          />
        </>
      )}
      
      <div className="home-title">
        <h1 className="main-title">
          TEN MINUTES FROM<br />
          <span className="hell-text">HELL</span>
        </h1>
      </div>
      
      <div className="home-content">
        <div className="home-cards">
          <div 
            className={`home-card clickable ${expandedCard === 'timer' ? 'expanded' : ''} ${expandedCard === 'stopwatch' ? 'condensed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleTimerClick();
            }}
          >
            {expandedCard === 'timer' ? (
              <>
                <div className="expanded-header" onClick={handleHeaderClick}>
                  <img src={Tab2} alt="Timer" className="header-icon" />
                </div>
                <div className="workouts-list">
                  {(timerWorkouts || []).map((workout, index) => (
                    <div 
                      key={index}
                      className={`home-workout-item ${timerSelectedWorkout === workout ? 'selected' : ''}`}
                      style={{ animationDelay: `${index * 0.06}s` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWorkoutSelect('timer', workout);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleWorkoutDoubleClick('timer', workout, e);
                      }}
                    >
                      <div className="home-workout-number">{index + 1}</div>
                      <span className="workout-name">{workout}</span>
                      <div 
                        className="workout-arrow"
                        onClick={(e) => handleArrowClick('timer', workout, e)}
                      >→</div>
                    </div>
                  ))}
                  <div 
                    className="add-workout-plus"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArrowClick('timer', 'New Workout', e);
                    }}
                  >
                    +
                  </div>
                </div>
              </>
            ) : (
              <>
                {expandedCard === 'stopwatch' ? (
                  <div className="condensed-view">
                    <img src={Tab2} alt="Timer" className="condensed-icon" />
                  </div>
                ) : (
                  <>
                    <div className="card-icon">
                      <img src={Tab2} alt="Timer" />
                    </div>
                    <h3>Timer</h3>
                    <p className="selected-workout">{timerSelectedWorkout}</p>
                  </>
                )}
              </>
            )}
          </div>
          
          <div 
            className={`home-card clickable ${expandedCard === 'stopwatch' ? 'expanded' : ''} ${expandedCard === 'timer' ? 'condensed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleStopwatchClick();
            }}
          >
            {expandedCard === 'stopwatch' ? (
              <>
                <div className="expanded-header" onClick={handleHeaderClick}>
                  <img src={Tab3} alt="Stopwatch" className="header-icon" />
                </div>
                <div className="workouts-list">
                  {(stopwatchWorkouts || []).map((workout, index) => (
                    <div 
                      key={index}
                      className={`home-workout-item ${stopwatchSelectedWorkout === workout ? 'selected' : ''}`}
                      style={{ animationDelay: `${index * 0.06}s` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWorkoutSelect('stopwatch', workout);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleWorkoutDoubleClick('stopwatch', workout, e);
                      }}
                    >
                      <div className="home-workout-number">{index + 1}</div>
                      <span className="workout-name">{workout}</span>
                      <div 
                        className="workout-arrow"
                        onClick={(e) => handleArrowClick('stopwatch', workout, e)}
                      >→</div>
                    </div>
                  ))}
                  <div 
                    className="add-workout-plus"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArrowClick('stopwatch', 'New Workout', e);
                    }}
                  >
                    +
                  </div>
                </div>
              </>
            ) : (
              <>
                {expandedCard === 'timer' ? (
                  <div className="condensed-view">
                    <img src={Tab3} alt="Stopwatch" className="condensed-icon" />
                  </div>
                ) : (
                  <>
                    <div className="card-icon">
                      <img src={Tab3} alt="Stopwatch" />
                    </div>
                    <h3>Stopwatch</h3>
                    <p className="selected-workout">{stopwatchSelectedWorkout}</p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
