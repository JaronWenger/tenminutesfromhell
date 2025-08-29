import React from 'react';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <h1 className="home-title">Ten Minutes From Hell</h1>
          <p className="home-subtitle">Quick, intense workouts for busy people</p>
        </div>
        
        <div className="home-cards">
          <div className="home-card">
            <div className="card-icon">⏱️</div>
            <h3>Timer</h3>
            <p>Set up custom workout intervals</p>
          </div>
          
          <div className="home-card">
            <div className="card-icon">⏲️</div>
            <h3>Stopwatch</h3>
            <p>Track your workout duration</p>
          </div>
        </div>
        
        <div className="home-footer">
          <p>Choose a tab below to get started</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
