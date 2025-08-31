import React from 'react';
import './Home.css';
import Banner from '../assets/Banner.webp';
import Tab2 from '../assets/Tab2.jpg';
import Tab3 from '../assets/Tab3.jpg';

const Home = ({ onNavigateToEdit, timerSelectedWorkout, stopwatchSelectedWorkout }) => {
  return (
    <div className="home-container">
      <div className="home-banner">
        <img src={Banner} alt="Ten Minutes From Hell Banner" className="banner-image" />
      </div>
      
      <div className="home-content">
        <div className="home-cards">
          <div 
            className="home-card clickable"
            onClick={() => onNavigateToEdit('timer')}
          >
            <div className="card-icon">
              <img src={Tab2} alt="Timer" />
            </div>
            <h3>Timer</h3>
            <p className="selected-workout">{timerSelectedWorkout}</p>
          </div>
          
          <div 
            className="home-card clickable"
            onClick={() => onNavigateToEdit('stopwatch')}
          >
            <div className="card-icon">
              <img src={Tab3} alt="Stopwatch" />
            </div>
            <h3>Stopwatch</h3>
            <p className="selected-workout">{stopwatchSelectedWorkout}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
