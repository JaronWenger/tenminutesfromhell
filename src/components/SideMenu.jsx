import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../firebase/auth';
import { getFollowing, getFollowers, getUserProfiles } from '../firebase/social';
import './SideMenu.css';

const ACTIVE_DEFAULT = '#ff3b30';
const REST_DEFAULT = '#007aff';
const OTHER_COLORS = ['#ff9500', '#34c759', '#af52de', '#ff2d55', '#5ac8fa', '#30b0c7', '#ffffff'];

const SideMenu = ({ isOpen, onClose, requestClose, autoShareEnabled, onToggleAutoShare, sidePlankAlertEnabled, onToggleSidePlankAlert, prepTime, onPrepTimeChange, restTime, onRestTimeChange, activeLastMinute, onToggleActiveLastMinute, activeColor, restColor, onColorChange, showCardPhotos, onToggleShowCardPhotos }) => {
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);
  const [colorPopup, setColorPopup] = useState(null); // null | 'active' | 'rest'
  const [followingIds, setFollowingIds] = useState([]);
  const [followerIds, setFollowerIds] = useState([]);
  const [showList, setShowList] = useState(null); // null | 'following' | 'followers'
  const [listProfiles, setListProfiles] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const listRequestRef = useRef(0);

  // Load counts when menu opens
  useEffect(() => {
    if (isOpen && user) {
      Promise.all([getFollowing(user.uid), getFollowers(user.uid)])
        .then(([following, followers]) => {
          setFollowingIds(following);
          setFollowerIds(followers);
        })
        .catch(err => console.error('Failed to load follow counts:', err));
    }
  }, [isOpen, user]);

  const handleShowList = useCallback(async (type) => {
    if (showList === type) { setShowList(null); return; }
    setShowList(type);
    setListLoading(true);
    const requestId = ++listRequestRef.current;
    const ids = type === 'following' ? followingIds : followerIds;
    try {
      const profiles = await getUserProfiles(ids);
      if (requestId === listRequestRef.current) {
        setListProfiles(profiles);
        setListLoading(false);
      }
    } catch (err) {
      if (requestId === listRequestRef.current) {
        setListProfiles([]);
        setListLoading(false);
      }
    }
  }, [showList, followingIds, followerIds]);

  // Allow parent to trigger animated close
  useEffect(() => {
    if (requestClose && isOpen && !isClosing) {
      triggerClose();
    }
  }, [requestClose, isOpen, isClosing]);

  const triggerClose = () => {
    setIsClosing(true);
    setShowList(null);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
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
      <div className={`sidemenu-panel ${isClosing ? 'sidemenu-panel-closing' : ''}`}>
        {/* Profile header */}
        <div className="sidemenu-profile">
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

        {/* Following / Followers */}
        <div className="sidemenu-follow-row">
          <button className={`sidemenu-follow-stat ${showList === 'following' ? 'active' : ''}`} onClick={() => handleShowList('following')}>
            <span className="sidemenu-follow-count">{followingIds.length}</span>
            <span className="sidemenu-follow-label">Following</span>
          </button>
          <button className={`sidemenu-follow-stat ${showList === 'followers' ? 'active' : ''}`} onClick={() => handleShowList('followers')}>
            <span className="sidemenu-follow-count">{followerIds.length}</span>
            <span className="sidemenu-follow-label">Followers</span>
          </button>
        </div>

        {/* Settings (fade out when list is shown) */}
        <div className={`sidemenu-items ${showList ? 'sidemenu-items-hidden' : ''}`}>
          <div className="sidemenu-item" onClick={handleSignOut}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="sidemenu-item-label">Sign Out</span>
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

          <div className="sidemenu-item" onClick={onToggleSidePlankAlert}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span className="sidemenu-item-label">Side plank switch side alert</span>
            <div className={`sidemenu-toggle ${sidePlankAlertEnabled === true ? 'on' : ''}`}>
              <div className="sidemenu-toggle-knob" />
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

          <div className="sidemenu-item sidemenu-item-stepper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 5.64a9 9 0 1 1-12.73 0"/>
              <line x1="12" y1="2" x2="12" y2="12"/>
            </svg>
            <span className="sidemenu-item-label">Rest time</span>
            <div className="sidemenu-stepper">
              <button
                className="sidemenu-stepper-btn"
                onClick={(e) => { e.stopPropagation(); if (restTime > 0) onRestTimeChange(restTime - 5); }}
              >
                −
              </button>
              <span className="sidemenu-stepper-value">{restTime}s</span>
              <button
                className="sidemenu-stepper-btn"
                onClick={(e) => { e.stopPropagation(); if (restTime < 30) onRestTimeChange(restTime + 5); }}
              >
                +
              </button>
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

          <div className="sidemenu-item" onClick={onToggleShowCardPhotos}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span className="sidemenu-item-label">Show profile on cards</span>
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
        </div>

        {/* Follow list (fade in when shown) */}
        {showList && (
          <div className="sidemenu-follow-list">
            {listLoading ? (
              <div className="sidemenu-follow-list-empty">Loading...</div>
            ) : listProfiles.length === 0 ? (
              <div className="sidemenu-follow-list-empty">
                {showList === 'following' ? 'Not following anyone yet' : 'No followers yet'}
              </div>
            ) : (
              listProfiles.map((p, i) => (
                <div key={p.uid} className="sidemenu-follow-list-item" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="sidemenu-follow-list-avatar">
                    {p.photoURL ? (
                      <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="sidemenu-follow-list-avatar-placeholder">
                        {(p.displayName || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="sidemenu-follow-list-name">{p.displayName}</span>
                </div>
              ))
            )}
          </div>
        )}
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
      <div className="sidemenu-backdrop" onClick={handleOverlayClick} />
    </div>
  );
};

export default SideMenu;
