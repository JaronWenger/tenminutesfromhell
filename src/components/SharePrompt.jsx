import React from 'react';
import './SharePrompt.css';

const SharePrompt = ({ onShare, onDismiss }) => {
  return (
    <div className="share-prompt-overlay" onClick={onDismiss}>
      <div className="share-prompt-card" onClick={(e) => e.stopPropagation()}>
        <div className="share-prompt-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </div>
        <h3 className="share-prompt-title">Share Your Workouts?</h3>
        <p className="share-prompt-text">
          Automatically share completed workouts to the activity feed so friends can see your progress.
        </p>
        <div className="share-prompt-buttons">
          <button className="share-prompt-btn share-prompt-btn-primary" onClick={onShare}>
            Share My Workouts
          </button>
          <button className="share-prompt-btn share-prompt-btn-secondary" onClick={onDismiss}>
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePrompt;
