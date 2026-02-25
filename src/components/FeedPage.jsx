import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFeedPosts,
  getAllUsers,
  getFollowing,
  getSuggestedUsers,
  followUser,
  unfollowUser,
  toggleLike,
  batchCheckLikes
} from '../firebase/social';
import './FeedPage.css';

const APP_URL = 'https://hiitem.com';
const INVITE_TEXT = `Join me on HIITem — build and share custom HIIT workouts, follow friends, and track your progress! ${APP_URL}`;

const FeedPage = ({ isOpen, onClose, requestClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [likedPosts, setLikedPosts] = useState({});
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // People sub-tab state
  const [peopleSubTab, setPeopleSubTab] = useState('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const feedPosts = await getFeedPosts(user.uid);
      console.log('[Feed] Loaded posts:', feedPosts.length, feedPosts);
      setPosts(feedPosts);
      if (feedPosts.length > 0) {
        const likes = await batchCheckLikes(
          feedPosts.map(p => p.id),
          user.uid
        );
        setLikedPosts(likes);
      }
    } catch (err) {
      console.error('[Feed] Failed to load feed:', err.message, err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [allUsers, following, suggested] = await Promise.all([
        getAllUsers(),
        getFollowing(user.uid),
        getSuggestedUsers(user.uid)
      ]);
      console.log('[People] getAllUsers returned:', allUsers.length, 'users', allUsers.map(u => u.displayName));
      setUsers(allUsers.filter(u => u.uid !== user.uid));
      setFollowingIds(following);
      setSuggestedUsers(suggested);
    } catch (err) {
      console.error('Failed to load people:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      if (activeTab === 'feed') {
        loadFeed();
      } else {
        loadPeople();
      }
    }
  }, [isOpen, user, activeTab, loadFeed, loadPeople]);

  // Allow parent to trigger the animated close
  useEffect(() => {
    if (requestClose && isOpen && !isClosing) {
      setIsClosing(true);
      setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 280);
    }
  }, [requestClose, isOpen, isClosing, onClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
  };

  const handleFollow = async (targetUid) => {
    if (!user) return;
    try {
      await followUser(user.uid, targetUid);
      setFollowingIds(prev => [...prev, targetUid]);
    } catch (err) {
      console.error('Failed to follow:', err);
    }
  };

  const handleUnfollow = async (targetUid) => {
    if (!user) return;
    try {
      await unfollowUser(user.uid, targetUid);
      setFollowingIds(prev => prev.filter(id => id !== targetUid));
    } catch (err) {
      console.error('Failed to unfollow:', err);
    }
  };

  const handleLike = async (postId) => {
    if (!user) return;
    const wasLiked = likedPosts[postId];
    // Optimistic update
    setLikedPosts(prev => ({ ...prev, [postId]: !wasLiked }));
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, likeCount: p.likeCount + (wasLiked ? -1 : 1) }
        : p
    ));
    try {
      await toggleLike(postId, user.uid);
    } catch (err) {
      // Revert on error
      setLikedPosts(prev => ({ ...prev, [postId]: wasLiked }));
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, likeCount: p.likeCount + (wasLiked ? 1 : -1) }
          : p
      ));
      console.error('Failed to toggle like:', err);
    }
  };

  const handleImportContacts = async () => {
    try {
      const selected = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      setContacts(selected.map(c => ({
        name: c.name?.[0] || 'Unknown',
        tel: c.tel?.[0] || null
      })));
    } catch (err) {
      // User cancelled or API error
      console.error('Contact import failed:', err);
    }
  };

  const handleInviteSMS = (tel) => {
    const body = encodeURIComponent(INVITE_TEXT);
    const smsUri = tel ? `sms:${tel}?body=${body}` : `sms:?body=${body}`;
    window.open(smsUri);
  };

  const handleShareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'HIITem', text: INVITE_TEXT, url: APP_URL });
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(INVITE_TEXT);
        alert('Invite link copied!');
      } catch {
        // Fallback
        window.prompt('Copy this invite link:', INVITE_TEXT);
      }
    }
  };

  const timeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Build people list: non-followed (sorted by mutual count) first, then followed
  const getPeopleList = () => {
    const suggestedMap = {};
    suggestedUsers.forEach(s => { suggestedMap[s.uid] = s.mutualCount; });

    const notFollowed = users.filter(u => !followingIds.includes(u.uid));
    const followed = users.filter(u => followingIds.includes(u.uid));

    // Sort non-followed by mutual count desc
    notFollowed.sort((a, b) => {
      const aMutual = suggestedMap[a.uid] || 0;
      const bMutual = suggestedMap[b.uid] || 0;
      return bMutual - aMutual;
    });

    // Combine: non-followed first, then followed
    return [...notFollowed, ...followed].map(u => ({
      ...u,
      mutualCount: suggestedMap[u.uid] || 0,
      isFollowing: followingIds.includes(u.uid)
    }));
  };

  // Filter list by search query
  const filterBySearch = (list) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => {
      const name = (item.displayName || item.name || '').toLowerCase();
      return name.includes(q);
    });
  };

  if (!isOpen) return null;

  const peopleList = getPeopleList();
  const hasContactsAPI = typeof navigator !== 'undefined' && 'contacts' in navigator;

  return (
    <div className={`feed-page ${isClosing ? 'feed-page-closing' : ''}`}>
      {/* Header */}
      <div className="feed-header">
        <button className="feed-back-btn" onClick={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="feed-header-title">Activity</span>
        <div className="feed-header-spacer" />
      </div>

      {/* Tabs */}
      <div className="feed-tabs">
        <button
          className={`feed-tab ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          Feed
        </button>
        <button
          className={`feed-tab ${activeTab === 'people' ? 'active' : ''}`}
          onClick={() => setActiveTab('people')}
        >
          People
        </button>
      </div>

      {/* Content */}
      <div className="feed-content">
        {!user && (
          <div className="feed-empty">
            <p>Sign in to see activity</p>
          </div>
        )}

        {user && loading && (
          <div className="feed-empty">
            <p>Loading...</p>
          </div>
        )}

        {/* Feed Tab */}
        {user && !loading && activeTab === 'feed' && (
          <>
            {posts.length === 0 ? (
              <div className="feed-empty">
                <p>No posts yet</p>
                <span>Complete a workout or follow people to see activity here</span>
              </div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="feed-post-card">
                  <div className="feed-post-header">
                    <div className="feed-post-avatar">
                      {post.photoURL ? (
                        <img src={post.photoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="feed-post-avatar-placeholder">
                          {(post.displayName || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="feed-post-meta">
                      <span className="feed-post-name">{post.displayName}</span>
                      <span className="feed-post-time">
                        {post.createdAt ? post.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                        {post.createdAt ? ` at ${post.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                      </span>
                      <span className="feed-post-subtitle">{post.workoutName} &middot; {formatDuration(post.duration)} &middot; {post.exerciseCount} exercises</span>
                    </div>
                    <button
                      className={`feed-like-btn ${likedPosts[post.id] ? 'liked' : ''}`}
                      onClick={() => handleLike(post.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={likedPosts[post.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span>{post.likeCount || 0}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* People Tab */}
        {user && !loading && activeTab === 'people' && (
          <>
            {/* Search Bar */}
            <div className="feed-search-wrap">
              <svg className="feed-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="feed-search"
                type="text"
                placeholder="Search for people"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sub-tabs */}
            <div className="feed-subtabs">
              <button
                className={`feed-subtab ${peopleSubTab === 'suggested' ? 'active' : ''}`}
                onClick={() => setPeopleSubTab('suggested')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>Suggested</span>
              </button>
              <button
                className={`feed-subtab ${peopleSubTab === 'contacts' ? 'active' : ''}`}
                onClick={() => setPeopleSubTab('contacts')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Contacts</span>
              </button>
              <button
                className={`feed-subtab ${peopleSubTab === 'qr' ? 'active' : ''}`}
                onClick={() => setPeopleSubTab('qr')}
              >
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

            {/* Suggested Sub-tab */}
            {peopleSubTab === 'suggested' && (
              <>
                {filterBySearch(peopleList).length === 0 ? (
                  <div className="feed-empty">
                    <p>{searchQuery ? 'No results' : 'No users yet'}</p>
                    <span>{searchQuery ? 'Try a different name' : 'Invite friends to join'}</span>
                  </div>
                ) : (
                  filterBySearch(peopleList).map(u => (
                    <div key={u.uid} className="feed-person-card">
                      <div className="feed-person-avatar">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="feed-person-avatar-placeholder">
                            {(u.displayName || '?')[0].toUpperCase()}
                          </div>
                        )}
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
                        className={`feed-follow-btn ${u.isFollowing ? 'following' : ''}`}
                        onClick={() => u.isFollowing ? handleUnfollow(u.uid) : handleFollow(u.uid)}
                      >
                        {u.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Contacts Sub-tab */}
            {peopleSubTab === 'contacts' && (
              <div className="feed-contacts-invite">
                <button className="feed-bottom-invite-btn" onClick={handleShareInvite}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Invite Friends
                </button>
              </div>
            )}

            {/* QR Code Sub-tab */}
            {peopleSubTab === 'qr' && (
              <div className="feed-qr-container">
                <div className="feed-qr-card">
                  <QRCodeSVG
                    value={APP_URL}
                    size={180}
                    bgColor="#ffffff"
                    fgColor="#0a0a0c"
                    level="M"
                  />
                </div>
                <span className="feed-qr-label">Scan to join</span>
              </div>
            )}

            {/* Sticky bottom invite */}
            <div className="feed-bottom-invite">
              <button className="feed-bottom-invite-btn" onClick={handleShareInvite}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Invite Friends
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedPage;
