import React, { useState } from 'react';
import Timer from './Timer';
import Home from './Home';
import Stopwatch from './Stopwatch';
import TabBar from './TabBar';

const Main = () => {
  const [activeTab, setActiveTab] = useState('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home />;
      case 'timer':
        return <Timer />;
      case 'stopwatch':
        return <Stopwatch />;
      default:
        return <Home />;
    }
  };

  return (
    <main className="tab-content">
      {renderContent()}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};

export default Main;
