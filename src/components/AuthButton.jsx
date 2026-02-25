import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthButton.css';

const AuthButton = ({ onProfileClick, onLoginClick }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  const handleClick = () => {
    if (user) {
      if (onProfileClick) onProfileClick();
    } else {
      if (onLoginClick) onLoginClick();
    }
  };

  return (
    <button className="auth-button" onClick={handleClick}>
      {user ? (
        user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="auth-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="auth-avatar-placeholder">
            {(user.displayName || '?')[0].toUpperCase()}
          </span>
        )
      ) : (
        <svg className="auth-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      )}
    </button>
  );
};

export default AuthButton;
