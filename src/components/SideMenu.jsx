import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../firebase/auth';
import './SideMenu.css';

const ACTIVE_DEFAULT = '#ff3b30';
const REST_DEFAULT = '#007aff';
const OTHER_COLORS = ['#5AC8D4', '#DBF9B8', '#C4B5E0', '#C47A6E', '#2D7D6B', '#FF6B2B'];

const SideMenu = ({ isOpen, onClose, requestClose, autoShareEnabled, onToggleAutoShare, isPrivate, onTogglePrivate, sidePlankAlertEnabled, onToggleSidePlankAlert, prepTime, onPrepTimeChange, restTime, onRestTimeChange, activeLastMinute, onToggleActiveLastMinute, shuffleExercises, onToggleShuffleExercises, activeColor, restColor, onColorChange, showCardPhotos, onToggleShowCardPhotos, onOpenProfile }) => {
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);
  const [colorPopup, setColorPopup] = useState(null); // null | 'active' | 'rest'

  // ── Swipe left to close ──
  const swipeRef = useRef({ startX: 0, startY: 0, locked: null });
  const panelElRef = useRef(null);
  const backdropElRef = useRef(null);
  const animClearedRef = useRef(false);

  // Clear CSS entry animations after they finish so inline styles work during swipe
  useEffect(() => {
    if (!isOpen) { animClearedRef.current = false; return; }
    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;
    if (!panel) return;
    const onEnd = () => {
      panel.style.animation = 'none';
      if (backdrop) backdrop.style.animation = 'none';
      animClearedRef.current = true;
    };
    panel.addEventListener('animationend', onEnd);
    return () => panel.removeEventListener('animationend', onEnd);
  }, [isOpen]);

  const handleSwipeStart = useCallback((e) => {
    if (!e.touches || isClosing) return;
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, locked: null };
  }, [isClosing]);

  const handleSwipeMove = useCallback((e) => {
    if (!e.touches || isClosing) return;
    const s = swipeRef.current;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - s.startX;
    const dy = y - s.startY;

    if (!s.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.locked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (s.locked !== 'h' || dx > 0) return;

    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;
    if (panel) {
      panel.style.willChange = 'transform';
      panel.style.transform = `translateX(${dx}px)`;
    }
    // Fade backdrop proportionally to how far the panel has been dragged
    if (backdrop) {
      const panelW = panel ? panel.offsetWidth : 280;
      const progress = Math.min(1, Math.abs(dx) / panelW);
      backdrop.style.opacity = `${1 - progress}`;
    }
  }, [isClosing]);

  const handleSwipeEnd = useCallback((e) => {
    const s = swipeRef.current;
    if (s.locked !== 'h' || isClosing) {
      swipeRef.current.locked = null;
      return;
    }
    const endX = e.changedTouches?.[0]?.clientX ?? s.startX;
    const dx = endX - s.startX;
    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;

    if (dx <= -80) {
      if (panel) {
        panel.style.transition = 'transform 0.22s ease';
        panel.style.transform = 'translateX(-100%)';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.22s ease';
        backdrop.style.opacity = '0';
      }
      setTimeout(() => {
        if (panel) { panel.style.transform = ''; panel.style.transition = ''; panel.style.willChange = ''; panel.style.animation = ''; }
        if (backdrop) { backdrop.style.opacity = ''; backdrop.style.transition = ''; }
        onClose();
      }, 220);
    } else {
      if (panel) {
        panel.style.transition = 'transform 0.2s ease';
        panel.style.transform = 'translateX(0)';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.2s ease';
        backdrop.style.opacity = '';
      }
      setTimeout(() => {
        if (panel) { panel.style.transition = ''; panel.style.willChange = ''; }
        if (backdrop) { backdrop.style.transition = ''; }
      }, 200);
    }
    swipeRef.current.locked = null;
  }, [isClosing, onClose]);

  // Allow parent to trigger animated close
  useEffect(() => {
    if (requestClose && isOpen && !isClosing) {
      triggerClose();
    }
  }, [requestClose, isOpen, isClosing]);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 600;

  const triggerClose = () => {
    if (isClosing) return;
    const panel = panelElRef.current;
    const backdrop = backdropElRef.current;
    if (isDesktop) {
      if (panel) {
        panel.style.transition = 'opacity 0.22s ease';
        panel.style.opacity = '0';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.22s ease';
        backdrop.style.opacity = '0';
      }
    } else {
      if (panel) {
        panel.style.transition = 'transform 0.26s ease';
        panel.style.transform = 'translateX(-100%)';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.26s ease';
        backdrop.style.opacity = '0';
      }
    }
    setIsClosing(true);
    setTimeout(() => {
      if (panel) { panel.style.transform = ''; panel.style.transition = ''; panel.style.willChange = ''; panel.style.animation = ''; panel.style.opacity = ''; }
      if (backdrop) { backdrop.style.opacity = ''; backdrop.style.transition = ''; backdrop.style.animation = ''; }
      setIsClosing(false);
      onClose();
    }, isDesktop ? 220 : 260);
  };

  const handleOverlayClick = () => {
    triggerClose();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      triggerClose();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className={`sidemenu-overlay ${isClosing ? 'sidemenu-overlay-closing' : ''}`}>
      <div
        className={`sidemenu-panel ${isClosing ? 'sidemenu-panel-closing' : ''}`}
        ref={panelElRef}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
        {/* Profile header */}
        <div className="sidemenu-profile" onClick={() => onOpenProfile && onOpenProfile()} style={{ cursor: 'pointer' }}>
          <div className="sidemenu-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="sidemenu-avatar-placeholder">
                {(user.displayName || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="sidemenu-profile-info">
            <span className="sidemenu-profile-name">{user.displayName}</span>
            <span className="sidemenu-profile-email">{user.email}</span>
          </div>
        </div>

        <div className="sidemenu-items">
          <div className="sidemenu-item" onClick={handleSignOut}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="sidemenu-item-label">Sign Out</span>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={() => { window.open('https://forms.gle/9A23uv92efj2FVAcA', '_blank'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="sidemenu-item-label">Developer Feedback</span>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onTogglePrivate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="sidemenu-item-label">Private account</span>
            <div className={`sidemenu-toggle ${isPrivate === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleAutoShare}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span className="sidemenu-item-label">Auto-Share Workouts</span>
            <div className={`sidemenu-toggle ${autoShareEnabled === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleShowCardPhotos}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span className="sidemenu-item-label">Show profiles on workouts</span>
            <div className={`sidemenu-toggle ${showCardPhotos === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-color-section">
            <span className="sidemenu-color-header">Timer Colors</span>
            <div className="sidemenu-color-row">
              <span className="sidemenu-color-label">Active</span>
              <div
                className="sidemenu-color-preview"
                style={{ background: activeColor }}
                onClick={() => setColorPopup(colorPopup === 'active' ? null : 'active')}
              />
            </div>
            <div className="sidemenu-color-row">
              <span className="sidemenu-color-label">Rest</span>
              <div
                className="sidemenu-color-preview"
                style={{ background: restColor }}
                onClick={() => setColorPopup(colorPopup === 'rest' ? null : 'rest')}
              />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item sidemenu-item-stepper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="sidemenu-item-label">Prep time</span>
            <div className="sidemenu-stepper">
              <button
                className="sidemenu-stepper-btn"
                onClick={(e) => { e.stopPropagation(); if (prepTime > 0) onPrepTimeChange(prepTime - 5); }}
              >
                −
              </button>
              <span className="sidemenu-stepper-value">{prepTime}s</span>
              <button
                className="sidemenu-stepper-btn"
                onClick={(e) => { e.stopPropagation(); if (prepTime < 30) onPrepTimeChange(prepTime + 5); }}
              >
                +
              </button>
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleShuffleExercises}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
              <line x1="4" y1="4" x2="9" y2="9"/>
            </svg>
            <span className="sidemenu-item-label">Shuffle exercises</span>
            <div className={`sidemenu-toggle ${shuffleExercises === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleActiveLastMinute}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="sidemenu-item-label">Stay active last minute</span>
            <div className={`sidemenu-toggle ${activeLastMinute === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>

          <div className="sidemenu-divider" />

          <div className="sidemenu-item" onClick={onToggleSidePlankAlert}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span className="sidemenu-item-label">Side plank switch side alert</span>
            <div className={`sidemenu-toggle ${sidePlankAlertEnabled === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
            </div>
          </div>
        </div>

      </div>

      {/* Color picker popup — fixed center of screen */}
      {colorPopup && (
        <div className="sidemenu-color-popup-overlay" onClick={() => setColorPopup(null)}>
          <div className="sidemenu-color-popup" onClick={e => e.stopPropagation()}>
            <div className="sidemenu-color-popup-swatches">
              {[
                ...(colorPopup === 'active' ? [ACTIVE_DEFAULT, REST_DEFAULT] : [REST_DEFAULT, ACTIVE_DEFAULT]),
                ...OTHER_COLORS
              ].map(hex => (
                <div
                  key={hex}
                  className={`sidemenu-swatch ${(colorPopup === 'active' ? activeColor : restColor) === hex ? 'selected' : ''}`}
                  style={{ background: hex }}
                  onClick={() => { onColorChange(colorPopup, hex); setColorPopup(null); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tap outside to close */}
      <div className="sidemenu-backdrop" ref={backdropElRef} onClick={handleOverlayClick} onTouchStart={handleSwipeStart} onTouchMove={handleSwipeMove} onTouchEnd={handleSwipeEnd} />
    </div>
  );
};

export default SideMenu;
