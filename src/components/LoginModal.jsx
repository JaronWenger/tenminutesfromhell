import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signUpWithEmail, signInWithEmail } from '../firebase/auth';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose, requestClose }) => {
  const [screen, setScreen] = useState('picker'); // 'picker' | 'email'
  const [isSignUp, setIsSignUp] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScreen('picker');
      setIsSignUp(true);
      setDisplayName('');
      setEmail('');
      setPassword('');
      setError('');
      setLoading(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  // Allow parent to trigger animated close
  useEffect(() => {
    if (requestClose && isOpen && !isClosing) {
      handleClose();
    }
  }, [requestClose, isOpen, isClosing]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
  };

  const handleGoogle = async () => {
    try {
      setError('');
      await signInWithGoogle();
      handleClose();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getErrorMessage(err.code));
      }
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName.trim() || 'Anonymous');
      } else {
        await signInWithEmail(email, password);
      }
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code) => {
    switch (code) {
      case 'auth/email-already-in-use': return 'An account with this email already exists';
      case 'auth/invalid-email': return 'Invalid email address';
      case 'auth/weak-password': return 'Password must be at least 6 characters';
      case 'auth/user-not-found': return 'No account found with this email';
      case 'auth/wrong-password': return 'Incorrect password';
      case 'auth/invalid-credential': return 'Invalid email or password';
      case 'auth/too-many-requests': return 'Too many attempts. Try again later';
      default: return 'Something went wrong. Please try again';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`login-modal ${isClosing ? 'login-modal-closing' : ''}`}>
      {/* Header */}
      <div className="login-header">
        {screen === 'email' ? (
          <button className="login-back-btn" onClick={() => { setScreen('picker'); setError(''); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        ) : (
          <button className="login-close-btn" onClick={handleClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        <span className="login-header-title">Sign in</span>
        <div className="login-header-spacer" />
      </div>

      <div className="login-content">
        {/* Method Picker */}
        {screen === 'picker' && (
          <>
            <div className="login-picker-top">
              <span className="login-brand-title">HIITem</span>
              <button className="login-method-btn login-google-btn" onClick={handleGoogle}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <div className="login-divider">
              <span>or</span>
            </div>

            <div className="login-picker-bottom">
              <button className="login-method-btn login-email-btn" onClick={() => setScreen('email')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Continue with Email
              </button>
              {error && <p className="login-error">{error}</p>}
            </div>
          </>
        )}

        {/* Email Form */}
        {screen === 'email' && (
          <form className="login-email-form" onSubmit={handleEmailSubmit}>
            <div className="login-mode-tabs">
              <button
                type="button"
                className={`login-mode-tab ${isSignUp ? 'active' : ''}`}
                onClick={() => { setIsSignUp(true); setError(''); }}
              >
                Sign Up
              </button>
              <button
                type="button"
                className={`login-mode-tab ${!isSignUp ? 'active' : ''}`}
                onClick={() => { setIsSignUp(false); setError(''); }}
              >
                Sign In
              </button>
            </div>

            {isSignUp && (
              <input
                className="login-input"
                type="text"
                placeholder="Display Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            )}
            <input
              className="login-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              className="login-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />

            {error && <p className="login-error">{error}</p>}

            <button className="login-submit-btn" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>

            <p className="login-toggle" onClick={() => { setIsSignUp(!isSignUp); setError(''); }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
