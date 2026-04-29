import React, { useEffect, useState } from 'react';
import './TabBar.css';
import Tab1 from '../assets/Tab1.jpg';
import Tab2 from '../assets/Tab2.jpg';
import ActivityTab from '../assets/ActivityTab.png';
import Tab4 from '../assets/Tab4.jpg';
import TargetTab from '../assets/TargetTab.png';

const TabBar = ({ activeTab, onTabChange, isTimerRunning, activeColor, user, authLoading }) => {
  const useGreyscale = isTimerRunning && activeTab === 'timer' && activeColor && activeColor !== '#ff3b30';
  const [orientation, setOrientation] = useState('portrait');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const handleOrientationChange = () => {
      if (window.screen && window.screen.orientation) {
        setOrientation(window.screen.orientation.type);
      } else {
        setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
      }
    };
    handleOrientationChange();
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    if (!authLoading) setRevealed(true);
  }, [authLoading]);

  const tabs = [
    { key: 'home',     label: 'Home',     img: Tab1 },
    ...(user ? [{ key: 'target',   label: 'Target',   img: TargetTab }] : []),
    { key: 'timer',    label: 'Timer',    img: Tab2 },
    ...(user ? [{ key: 'activity', label: 'Activity', img: ActivityTab }] : []),
    { key: 'stats',    label: 'Stats',    img: Tab4 },
  ];
  const centerIndex = tabs.findIndex(t => t.key === 'timer');

  return (
    <div className={`tab-bar ${orientation}${useGreyscale ? ' tab-bar-greyscale' : ''}`}>
      {tabs.map((tab, i) => {
        const dist = Math.abs(i - centerIndex);
        const delay = dist * 70;
        const itemStyle = revealed
          ? { animation: `tabReveal 0.4s ease-out ${delay}ms both` }
          : { opacity: 0 };
        return (
          <button
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            style={itemStyle}
            onClick={() => onTabChange(tab.key)}
          >
            <div className="tab-icon">
              <img src={tab.img} alt={tab.label} />
            </div>
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TabBar;
