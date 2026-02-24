import React, { useState } from 'react';
import './Home.css';
import Tab2 from '../assets/Tab2.jpg';
import Sparks from '../assets/SPARKS.gif';
import AuthButton from './AuthButton';

const Home = ({ onNavigateToEdit, timerSelectedWorkout, timerWorkouts, onWorkoutSelect, onArrowClick, onNavigateToTab }) => {
  const [expandedCard, setExpandedCard] = useState(null);

  const handleTimerClick = () => {
    if (expandedCard === 'timer') {
      setExpandedCard(null);
    } else {
      setExpandedCard('timer');
    }
  };

  const handleWorkoutSelect = (type, workout) => {
    const isAlreadySelected = type === 'timer' && timerSelectedWorkout === workout;

    if (isAlreadySelected && onNavigateToTab) {
      onNavigateToTab(type);
      setExpandedCard(null);
    } else {
      onWorkoutSelect(type, workout);
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
    const target = e.target;
    const isInteractive = target.tagName === 'BUTTON' ||
                         target.tagName === 'A' ||
                         target.closest('.home-card') ||
                         target.closest('button') ||
                         target.closest('a');

    if (expandedCard && !isInteractive) {
      setExpandedCard(null);
    }
  };

  return (
    <div className="home-container" onClick={handleOutsideClick}>
      <AuthButton />
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
            className={`home-card clickable ${expandedCard === 'timer' ? 'expanded' : ''}`}
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
                <div className="card-icon">
                  <img src={Tab2} alt="Timer" />
                </div>
                <h3>Timer</h3>
                <p className="selected-workout">{timerSelectedWorkout}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
