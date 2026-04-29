import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllUsers,
  getFollowing,
  getSuggestedUsers,
  followUser,
  unfollowUser,
  createFollowRequest,
  cancelFollowRequest,
  getUserProfiles
} from '../firebase/social';
import './FeedPage.css';

const APP_URL = 'https://hiitem.com';
const INVITE_TEXT = 'Join me on HIITem — build and share custom HIIT workouts, follow friends, and track your progress!';

const FeedPage = ({ isOpen, onClose, requestClose, onViewProfile, externalFollowedUid, pendingFollowRequests = {}, onPendingFollowRequestsChange, onFollowCountChanged }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [peopleSubTab, setPeopleSubTab] = useState('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState([]);

  useEffect(() => {
    if (!externalFollowedUid) return;
    setFollowingIds(prev => prev.includes(externalFollowedUid) ? prev : [...prev, externalFollowedUid]);
  }, [externalFollowedUid]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [allUsers, following, suggested] = await Promise.all([
        getAllUsers(),
        getFollowing(user.uid),
        getSuggestedUsers(user.uid)
      ]);
      const isTestAccount = (u) => u.email === 'aitakapic@gmail.com' || u.displayName === 'takapic';
      setUsers(allUsers.filter(u => u.uid !== user.uid && !isTestAccount(u)));
      setFollowingIds(following);
      setSuggestedUsers(suggested);
    } catch (err) {
      console.error('Failed to load people:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) loadPeople();
  }, [isOpen, user, loadPeople]);

  useEffect(() => {
    if (requestClose && isOpen && !isClosing) {
      setIsClosing(true);
      setTimeout(() => { setIsClosing(false); onClose(); }, 280);
    }
  }, [requestClose, isOpen, isClosing, onClose]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => { setIsClosing(false); onClose(); }, 280);
  }, [onClose]);

  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);

  const handleContentTouchStart = useCallback((e) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }, []);

  const handleContentTouchEnd = useCallback((e) => {
    if (swipeStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
    const deltaY = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (deltaX > 0) handleClose();
  }, [handleClose]);

  const handleFollow = async (targetUid) => {
    if (!user) return;
    try {
      const [targetProfile] = await getUserProfiles([targetUid]);
      if (targetProfile?.isPrivate) {
        const notifId = await createFollowRequest({
          requesterUid: user.uid,
          requesterName: user.displayName,
          requesterPhotoURL: user.photoURL,
          targetUid
        });
        if (notifId && onPendingFollowRequestsChange) {
          onPendingFollowRequestsChange(prev => ({ ...prev, [targetUid]: notifId }));
        }
        return;
      }
      await followUser(user.uid, targetUid);
      setFollowingIds(prev => [...prev, targetUid]);
      onFollowCountChanged?.();
    } catch (err) {
      console.error('Failed to follow:', err);
    }
  };

  const handleCancelFollowRequest = async (targetUid) => {
    if (!user) return;
    const notifId = pendingFollowRequests[targetUid];
    if (!notifId) return;
    if (onPendingFollowRequestsChange) {
      onPendingFollowRequestsChange(prev => { const next = { ...prev }; delete next[targetUid]; return next; });
    }
    try {
      await cancelFollowRequest(notifId, user.uid);
    } catch (err) {
      console.error('Failed to cancel follow request:', err);
      if (onPendingFollowRequestsChange) {
        onPendingFollowRequestsChange(prev => ({ ...prev, [targetUid]: notifId }));
      }
    }
  };

  const handleUnfollow = async (targetUid) => {
    if (!user) return;
    try {
      await unfollowUser(user.uid, targetUid);
      setFollowingIds(prev => prev.filter(id => id !== targetUid));
      onFollowCountChanged?.();
    } catch (err) {
      console.error('Failed to unfollow:', err);
    }
  };

  const handleShareInvite = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'HIITem', text: INVITE_TEXT, url: APP_URL }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(`${INVITE_TEXT} ${APP_URL}`); alert('Invite link copied!'); }
      catch { window.prompt('Copy this invite link:', `${INVITE_TEXT} ${APP_URL}`); }
    }
  };

  const getPeopleList = () => {
    const suggestedMap = {};
    suggestedUsers.forEach(s => { suggestedMap[s.uid] = s.mutualCount; });
    const notFollowed = users.filter(u => !followingIds.includes(u.uid));
    const followed = users.filter(u => followingIds.includes(u.uid));
    notFollowed.sort((a, b) => (suggestedMap[b.uid] || 0) - (suggestedMap[a.uid] || 0));
    return [...notFollowed, ...followed].map(u => ({
      ...u,
      mutualCount: suggestedMap[u.uid] || 0,
      isFollowing: followingIds.includes(u.uid)
    }));
  };

  const filterBySearch = (list) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => (item.displayName || item.name || '').toLowerCase().includes(q));
  };

  if (!isOpen) return null;

  const peopleList = getPeopleList();

  return (
    <div className={`feed-page ${isClosing ? 'feed-page-closing' : ''}`}>
      <div className="feed-header">
        <button className="feed-back-btn" onClick={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="feed-header-title">HIITem</span>
        <div className="feed-header-spacer" />
      </div>

      {user && !loading && (
        <div className="feed-people-sticky">
          <div className="feed-search-wrap">
            <svg className="feed-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="feed-search"
              type="text"
              placeholder="Search for people"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="feed-subtabs">
            <button className={`feed-subtab ${peopleSubTab === 'suggested' ? 'active' : ''}`} onClick={() => setPeopleSubTab('suggested')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Suggested</span>
            </button>
            <button className={`feed-subtab ${peopleSubTab === 'contacts' ? 'active' : ''}`} onClick={() => setPeopleSubTab('contacts')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Contacts</span>
            </button>
            <button className={`feed-subtab ${peopleSubTab === 'qr' ? 'active' : ''}`} onClick={() => setPeopleSubTab('qr')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="8" height="8" rx="1"/>
                <rect x="14" y="2" width="8" height="8" rx="1"/>
                <rect x="2" y="14" width="8" height="8" rx="1"/>
                <rect x="14" y="14" width="4" height="4" rx="0.5"/>
                <line x1="22" y1="14" x2="22" y2="22"/>
                <line x1="18" y1="22" x2="22" y2="22"/>
              </svg>
              <span>QR Code</span>
            </button>
          </div>
        </div>
      )}

      <div className="feed-content" onTouchStart={handleContentTouchStart} onTouchEnd={handleContentTouchEnd}>
        {!user && <div className="feed-empty"><p>Sign in to find people</p></div>}
        {user && loading && <div className="feed-empty"><p>Loading...</p></div>}
        {user && !loading && (
          <>
            {peopleSubTab === 'suggested' && (
              <>
                {filterBySearch(peopleList).length === 0 ? (
                  <div className="feed-empty">
                    <p>{searchQuery ? 'No results' : 'No users yet'}</p>
                    <span>{searchQuery ? 'Try a different name' : 'Invite friends to join'}</span>
                  </div>
                ) : (
                  filterBySearch(peopleList).map(u => (
                    <div key={u.uid} className="feed-person-card" style={{ cursor: 'pointer' }}
                      onClick={() => onViewProfile && onViewProfile({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL })}
                    >
                      <div className="feed-person-avatar">
                        {u.photoURL
                          ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" />
                          : <div className="feed-person-avatar-placeholder">{(u.displayName || '?')[0].toUpperCase()}</div>
                        }
                      </div>
                      <div className="feed-person-info">
                        <span className="feed-person-name">{u.displayName}</span>
                        <span className="feed-person-stats">
                          {u.mutualCount > 0
                            ? `${u.mutualCount} mutual friend${u.mutualCount !== 1 ? 's' : ''}`
                            : `${u.workoutCount || 0} workouts`
                          }
                        </span>
                      </div>
                      <button
                        className={`feed-follow-btn ${u.isFollowing ? 'following' : pendingFollowRequests[u.uid] ? 'following' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pendingFollowRequests[u.uid]) { handleCancelFollowRequest(u.uid); return; }
                          u.isFollowing ? handleUnfollow(u.uid) : handleFollow(u.uid);
                        }}
                      >
                        {u.isFollowing ? 'Following' : pendingFollowRequests[u.uid] ? 'Requested' : 'Follow'}
                      </button>
                    </div>
                  ))
                )}
              </>
            )}
            {peopleSubTab === 'contacts' && (
              <div className="feed-contacts-invite">
                <button className="feed-bottom-invite-btn" onClick={handleShareInvite}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Invite Friends
                </button>
              </div>
            )}
            {peopleSubTab === 'qr' && (
              <div className="feed-qr-container">
                <div className="feed-qr-card">
                  <QRCodeSVG value={APP_URL} size={180} bgColor="#ffffff" fgColor="#0a0a0c" level="M" />
                </div>
                <span className="feed-qr-label">Scan to join</span>
              </div>
            )}
          </>
        )}
      </div>

      {user && !loading && peopleSubTab !== 'suggested' && (
        <div className="feed-bottom-invite">
          <button className="feed-bottom-invite-btn" onClick={handleShareInvite}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Invite Friends
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedPage;
