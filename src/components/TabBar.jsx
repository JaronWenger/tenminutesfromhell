import React, { useEffect, useState } from 'react';
import './TabBar.css';
import Tab1 from '../assets/Tab1.jpg';
import Tab2 from '../assets/Tab2.jpg';
import Tab3 from '../assets/Tab3.jpg';

const TabBar = ({ activeTab, onTabChange }) => {
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
    <div className={`tab-bar ${orientation}`}>
      <button
        className={`tab-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
      >
        <div className="tab-icon">
          <img src={Tab1} alt="Home" />
        </div>
        <span className="tab-label">Home</span>
      </button>

      <button
        className={`tab-item ${activeTab === 'timer' ? 'active' : ''}`}
        onClick={() => onTabChange('timer')}
      >
        <div className="tab-icon">
          <img src={Tab2} alt="Timer" />
        </div>
        <span className="tab-label">Timer</span>
      </button>

      <button
        className={`tab-item ${activeTab === 'stats' ? 'active' : ''}`}
        onClick={() => onTabChange('stats')}
      >
        <div className="tab-icon">
          <img src={Tab3} alt="Stats" />
        </div>
        <span className="tab-label">Stats</span>
      </button>
    </div>
  );
};

export default TabBar;
