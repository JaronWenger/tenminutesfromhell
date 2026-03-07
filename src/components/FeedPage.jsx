import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFeedPosts,
  getAllUsers,
  getFollowing,
  getSuggestedUsers,
  followUser,
  unfollowUser,
  toggleReaction,
  batchCheckReactions,
  getEmojiReactors,
  updateNotificationStatus,
  joinPost,
  leavePost,
  createFollowRequest,
  acceptFollowRequest,
  denyFollowRequest,
  cancelFollowRequest,
  getUserProfiles
} from '../firebase/social';
import { saveUserWorkout, recordWorkoutHistory } from '../firebase/firestore';
import './FeedPage.css';

const APP_URL = 'https://hiitem.com';
const REACTION_EMOJIS = ['🏆', '🦍', '🦧', '🐦‍🔥', '🦦', '🔥'];
const INVITE_TEXT = 'Join me on HIITem — build and share custom HIIT workouts, follow friends, and track your progress!';

const FeedPage = ({ isOpen, onClose, requestClose, onViewProfile, onStartWorkout, onViewPostWorkout, onWorkoutAdded, onHistoryRecorded, acceptedPostId, allWorkouts = [], lastViewedAt, externalFollowedUid, pendingFollowRequests = {}, onPendingFollowRequestsChange, initialTab, onFollowCountChanged }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [userReactions, setUserReactions] = useState({});
  const [openPickerId, setOpenPickerId] = useState(null);
  const [reactionTooltip, setReactionTooltip] = useState(null); // { postId, emoji, reactors, loading }
  const longPressTimer = useRef(null);
  const longPressActivated = useRef(false);
  const tooltipRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shareActions, setShareActions] = useState({}); // notifId → 'accepting' | 'accepted' | 'denied'
  const [requestActions, setRequestActions] = useState({}); // notifId → 'accepted' | 'denied'
  const [expandedTogetherId, setExpandedTogetherId] = useState(null);

  // People sub-tab state
  const [peopleSubTab, setPeopleSubTab] = useState('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState([]);

  // Switch to initial tab when specified (e.g. opening directly to People tab)
  useEffect(() => {
    if (initialTab && isOpen) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // Sync external follow actions (e.g. from ProfilePopup) into local followingIds
  useEffect(() => {
    if (!externalFollowedUid) return;
    setFollowingIds(prev => prev.includes(externalFollowedUid) ? prev : [...prev, externalFollowedUid]);
  }, [externalFollowedUid]);

  const lastViewedDate = lastViewedAt ? new Date(lastViewedAt) : null;
  const isNewPost = (post) => {
    if (!lastViewedDate || !post.createdAt) return false;
    const postDate = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt);
    return postDate > lastViewedDate;
  };

  // Close reaction picker on outside tap
  useEffect(() => {
    if (!openPickerId) return;
    const close = () => setOpenPickerId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openPickerId]);

  // Dismiss reaction tooltip on outside tap/click (delayed so the triggering event doesn't dismiss it)
  useEffect(() => {
    if (!reactionTooltip) return;
    let touchHandler, mouseHandler;
    const timer = setTimeout(() => {
      touchHandler = () => setReactionTooltip(null);
      mouseHandler = () => setReactionTooltip(null);
      document.addEventListener('touchstart', touchHandler);
      document.addEventListener('mousedown', mouseHandler);
    }, 100);
    return () => {
      clearTimeout(timer);
      if (touchHandler) document.removeEventListener('touchstart', touchHandler);
      if (mouseHandler) document.removeEventListener('mousedown', mouseHandler);
    };
  }, [reactionTooltip]);

  // Clamp tooltip within viewport after it renders
  useLayoutEffect(() => {
    if (!reactionTooltip || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    const PAD = 10;
    if (rect.right > window.innerWidth - PAD) {
      el.style.left = (window.innerWidth - PAD - rect.width / 2) + 'px';
    } else if (rect.left < PAD) {
      el.style.left = (PAD + rect.width / 2) + 'px';
    }
  }, [reactionTooltip]);

  const handleChipLongPress = async (chipEl, postId, emoji) => {
    longPressActivated.current = true;
    const rect = chipEl.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;
    setReactionTooltip({ postId, emoji, reactors: null, x, y });
    try {
      const reactors = await getEmojiReactors(postId, emoji);
      setReactionTooltip(prev =>
        prev?.postId === postId && prev?.emoji === emoji ? { ...prev, reactors } : prev
      );
    } catch (err) {
      setReactionTooltip(null);
    }
  };

  // Grace period ticker — re-renders every second while any post has an active grace window
  const [, forceGraceTick] = useState(0);
  useEffect(() => {
    const workoutPosts = posts.filter(p => !p.type && p.lastCompletedAt);
    const anyActive = workoutPosts.some(p => Date.now() - p.lastCompletedAt.getTime() < 300000);
    if (!anyActive) return;
    const id = setInterval(() => forceGraceTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [posts]);

  const isGraceActive = (post) => {
    if (!post.lastCompletedAt) return false;
    return Date.now() - post.lastCompletedAt.getTime() < 300000;
  };


  const handleJoin = useCallback(async (e, post) => {
    e.stopPropagation();
    if (!user) return;
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, joinedUsers: { ...p.joinedUsers, [user.uid]: { displayName: user.displayName, photoURL: user.photoURL || null } } }
      : p
    ));
    try {
      await joinPost(post.id, user.uid, { displayName: user.displayName, photoURL: user.photoURL });
      await recordWorkoutHistory(user.uid, {
        workoutName: post.workoutName,
        workoutType: post.workoutType || 'timer',
        duration: post.duration,
        setCount: 1,
        exercises: post.exercises || [],
        restTime: post.restTime,
        prepTime: post.prepTime,
        activeLastMinute: post.activeLastMinute,
      });
      if (onHistoryRecorded) onHistoryRecorded();
    } catch (err) {
      console.error('Failed to join workout:', err);
    }
  }, [user, onWorkoutAdded]);

  const handleLeave = useCallback(async (e, post) => {
    e.stopPropagation();
    if (!user) return;
    // Optimistic update — remove self from joinedUsers
    setPosts(prev => prev.map(p => {
      if (p.id !== post.id) return p;
      const { [user.uid]: _, ...rest } = p.joinedUsers || {};
      return { ...p, joinedUsers: rest };
    }));
    setExpandedTogetherId(null);
    try {
      await leavePost(post.id, user.uid);
    } catch (err) {
      console.error('Failed to leave workout:', err);
    }
  }, [user]);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [feedPosts, following] = await Promise.all([
        getFeedPosts(user.uid),
        getFollowing(user.uid)
      ]);
      const welcomePost = {
        id: 'welcome',
        type: 'welcome',
        displayName: 'HIITem',
        photoURL: null,
        createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date(),
      };
      setPosts([...feedPosts, welcomePost]);
      setFollowingIds(following);
      const workoutPosts = feedPosts.filter(p => !p.type);
      if (workoutPosts.length > 0) {
        const reactions = await batchCheckReactions(
          workoutPosts.map(p => p.id),
          user.uid
        );
        setUserReactions(reactions);
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

  // Sync accepted status from detail view
  useEffect(() => {
    if (acceptedPostId) {
      setShareActions(prev => ({ ...prev, [acceptedPostId]: 'accepted' }));
    }
  }, [acceptedPostId]);

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

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
  }, [onClose]);

  // Swipe navigation between tabs
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
    if (deltaX < 0) {
      // Swipe left: Activity → People
      if (activeTab === 'feed') setActiveTab('people');
    } else {
      // Swipe right: People → Activity, Activity → close
      if (activeTab === 'people') setActiveTab('feed');
      else if (activeTab === 'feed') handleClose();
    }
  }, [activeTab, handleClose]);

  const handleFollow = async (targetUid) => {
    if (!user) return;
    try {
      // Check if target has a private account
      const [targetProfile] = await getUserProfiles([targetUid]);
      if (targetProfile?.isPrivate) {
        // Send follow request instead of immediate follow
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
    // Optimistic update
    if (onPendingFollowRequestsChange) {
      onPendingFollowRequestsChange(prev => {
        const next = { ...prev };
        delete next[targetUid];
        return next;
      });
    }
    try {
      await cancelFollowRequest(notifId, user.uid);
    } catch (err) {
      console.error('Failed to cancel follow request:', err);
      // Revert on failure
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

  const handleReact = async (postId, emoji) => {
    if (!user) return;
    setOpenPickerId(null);
    const current = userReactions[postId] || [];
    const hasEmoji = current.includes(emoji);
    const next = hasEmoji ? current.filter(e => e !== emoji) : [...current, emoji];
    // Save original post for rollback
    const originalPost = posts.find(p => p.id === postId);
    // Optimistic update
    setUserReactions(prev => ({ ...prev, [postId]: next }));
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const counts = { ...(p.reactionCounts || {}) };
      counts[emoji] = Math.max(0, (counts[emoji] || 0) + (hasEmoji ? -1 : 1));
      let emojiOrder = [...(p.emojiOrder || [])];
      if (!hasEmoji && !emojiOrder.includes(emoji)) {
        emojiOrder = [...emojiOrder, emoji];
      } else if (hasEmoji && counts[emoji] === 0) {
        emojiOrder = emojiOrder.filter(e => e !== emoji);
      }
      return { ...p, reactionCounts: counts, emojiOrder };
    }));
    try {
      await toggleReaction(postId, user.uid, emoji, user.displayName);
    } catch (err) {
      // Revert on error
      setUserReactions(prev => ({ ...prev, [postId]: current }));
      if (originalPost) setPosts(prev => prev.map(p => p.id !== postId ? p : originalPost));
    }
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
        await navigator.clipboard.writeText(`${INVITE_TEXT} ${APP_URL}`);
        alert('Invite link copied!');
      } catch {
        // Fallback
        window.prompt('Copy this invite link:', `${INVITE_TEXT} ${APP_URL}`);
      }
    }
  };

  const isSharedWorkoutInLibrary = useCallback((post) => {
    return allWorkouts.some(w => w.name === post.workoutName);
  }, [allWorkouts]);

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAcceptSharedWorkout = async (post) => {
    if (!user || shareActions[post.id]) return;
    setShareActions(prev => ({ ...prev, [post.id]: 'accepting' }));
    try {
      await saveUserWorkout(user.uid, {
        name: post.workoutName,
        type: post.workoutType || 'timer',
        exercises: post.exercises || [],
        isCustom: true,
        restTime: post.restTime ?? null,
        tags: post.tags || null,
        creatorUid: post.creatorUid || post.userId,
        creatorName: post.creatorName || post.displayName,
        creatorPhotoURL: post.creatorPhotoURL || post.photoURL,
      });
      await updateNotificationStatus(post.id, 'accepted');
      setShareActions(prev => ({ ...prev, [post.id]: 'accepted' }));
      if (onWorkoutAdded) onWorkoutAdded();
    } catch (err) {
      console.error('Failed to accept shared workout:', err);
      setShareActions(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    }
  };

  const handleDenySharedWorkout = async (post) => {
    if (!user || shareActions[post.id]) return;
    setShareActions(prev => ({ ...prev, [post.id]: 'denied' }));
    try {
      await updateNotificationStatus(post.id, 'denied');
    } catch (err) {
      console.error('Failed to deny shared workout:', err);
      setShareActions(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    }
  };

  const handleAcceptFollowRequest = async (post) => {
    if (!user || requestActions[post.id]) return;
    setRequestActions(prev => ({ ...prev, [post.id]: 'accepted' }));
    try {
      await acceptFollowRequest(post.id, post.userId, user.uid, user.displayName, user.photoURL);
      onFollowCountChanged?.();
    } catch (err) {
      console.error('Failed to accept follow request:', err);
      setRequestActions(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    }
  };

  const handleDenyFollowRequest = async (post) => {
    if (!user || requestActions[post.id]) return;
    setRequestActions(prev => ({ ...prev, [post.id]: 'denied' }));
    try {
      await denyFollowRequest(post.id);
    } catch (err) {
      console.error('Failed to deny follow request:', err);
      setRequestActions(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    }
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

  return (
    <div className={`feed-page ${isClosing ? 'feed-page-closing' : ''}`}>
      {/* Header */}
      <div className="feed-header">
        <button className="feed-back-btn" onClick={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="feed-filter-bar">
          <button
            className={`feed-filter-chip ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            Activity
          </button>
          <button
            className={`feed-filter-chip ${activeTab === 'people' ? 'active' : ''}`}
            onClick={() => setActiveTab('people')}
          >
            People
          </button>
        </div>
        <div className="feed-header-spacer" />
      </div>

      {/* Content */}
      <div
        className="feed-content"
        onTouchStart={handleContentTouchStart}
        onTouchEnd={handleContentTouchEnd}
      >
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
              posts.map(post => {
                if (post.type === 'welcome') return (
                <div key={post.id} className="feed-post-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('people')}>
                  <div className="feed-post-header">
                    <div className="feed-post-avatar" style={{ overflow: 'hidden', width: 40, height: 40, borderRadius: '50%' }}>
                      <img src={process.env.PUBLIC_URL + '/logo192.png'} alt="" referrerPolicy="no-referrer" style={{ transform: 'scale(1.15)', border: 'none' }} />
                    </div>
                    <div className="feed-post-meta">
                      <span className="feed-post-name">HIITem</span>
                      <span className="feed-post-time">
                        {post.createdAt ? post.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                      </span>
                      <span className="feed-post-subtitle">Welcome{user?.displayName ? ` ${user.displayName.split(' ')[0]}` : ''}! Complete a workout and share with your friends <span style={{ opacity: 1, color: 'white' }}>🔥</span></span>
                    </div>
                  </div>
                </div>
                );
                if (post.type === 'follow') return (
                <div
                  key={post.id}
                  className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL })}
                >
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
                      <span className="feed-post-subtitle">Started following you</span>
                    </div>
                    <button
                      className={`feed-follow-btn ${followingIds.includes(post.userId) ? 'following' : pendingFollowRequests[post.userId] ? 'following' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (pendingFollowRequests[post.userId]) { handleCancelFollowRequest(post.userId); return; }
                        followingIds.includes(post.userId) ? handleUnfollow(post.userId) : handleFollow(post.userId);
                      }}
                    >
                      {followingIds.includes(post.userId) ? 'Following' : pendingFollowRequests[post.userId] ? 'Requested' : 'Follow'}
                    </button>
                  </div>
                </div>
                );
                if (post.type === 'follow_request_accepted') return (
                <div
                  key={post.id}
                  className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL })}
                >
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
                      <span className="feed-post-subtitle">Accepted your follow request</span>
                    </div>
                  </div>
                </div>
                );
                if (post.type === 'follow_request') return (
                <div
                  key={post.id}
                  className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL })}
                >
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
                      <span className="feed-post-subtitle">Wants to follow you</span>
                    </div>
                  </div>
                  {(requestActions[post.id] === 'accepted' || post.status === 'accepted') ? (
                    <div className="feed-share-actions">
                      <span className="feed-share-status accepted">Accepted</span>
                    </div>
                  ) : (requestActions[post.id] === 'denied' || post.status === 'denied') ? (
                    <div className="feed-share-actions">
                      <span className="feed-share-status denied">Denied</span>
                    </div>
                  ) : (
                    <div className="feed-share-actions">
                      <button
                        className="feed-share-deny-btn"
                        onClick={(e) => { e.stopPropagation(); handleDenyFollowRequest(post); }}
                      >
                        Deny
                      </button>
                      <button
                        className="feed-share-accept-btn"
                        onClick={(e) => { e.stopPropagation(); handleAcceptFollowRequest(post); }}
                      >
                        Accept
                      </button>
                    </div>
                  )}
                </div>
                );
                if (post.type === 'workout_saved') return (
                <div
                  key={post.id}
                  className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onViewPostWorkout && onViewPostWorkout(post)}
                >
                  <div className="feed-post-header">
                    <div
                      className="feed-post-avatar"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); }}
                    >
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
                      <span className="feed-post-subtitle">Saved <strong>{post.workoutName}</strong> &middot; from {post.source === 'pinned' ? 'Pinned' : 'Activity'}</span>
                    </div>
                    <div className="feed-save-notif-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                  </div>
                </div>
                );
                if (post.type === 'workout_shared') return (
                <div
                  key={post.id}
                  className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onViewPostWorkout && onViewPostWorkout(post)}
                >
                  <div className="feed-post-header">
                    <div
                      className="feed-post-avatar"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); }}
                    >
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
                      <span className="feed-post-subtitle">Sent you <strong>{post.workoutName}</strong> &middot; {post.exercises?.length || 0} exercises</span>
                    </div>
                  </div>
                  {(shareActions[post.id] === 'accepted' || post.status === 'accepted' || isSharedWorkoutInLibrary(post)) ? (
                    <div className="feed-share-actions">
                      <span className="feed-share-status accepted">{(shareActions[post.id] === 'accepted' || post.status === 'accepted') ? 'Added to library' : 'Already in library'}</span>
                    </div>
                  ) : (shareActions[post.id] === 'denied' || post.status === 'denied') ? (
                    <div className="feed-share-actions">
                      <span className="feed-share-status denied">Declined</span>
                    </div>
                  ) : (
                    <div className="feed-share-actions">
                      <button
                        className="feed-share-deny-btn"
                        onClick={(e) => { e.stopPropagation(); handleDenySharedWorkout(post); }}
                      >
                        Deny
                      </button>
                      <button
                        className={`feed-share-accept-btn ${shareActions[post.id] === 'accepting' ? 'saving' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleAcceptSharedWorkout(post); }}
                        disabled={shareActions[post.id] === 'accepting'}
                      >
                        {shareActions[post.id] === 'accepting' ? 'Saving...' : 'Accept'}
                      </button>
                    </div>
                  )}
                </div>
                );
                if (post.type === 'workout_sent') return (
                <div
                  key={post.id}
                  className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onViewPostWorkout && onViewPostWorkout(post)}
                >
                  <div className="feed-post-header">
                    <div
                      className="feed-post-avatar"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.recipientName, photoURL: post.recipientPhotoURL }); }}
                    >
                      {post.recipientPhotoURL ? (
                        <img src={post.recipientPhotoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="feed-post-avatar-placeholder">
                          {(post.recipientName || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="feed-post-meta">
                      <span className="feed-post-name">{post.recipientName}</span>
                      <span className="feed-post-time">
                        {post.createdAt ? post.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                        {post.createdAt ? ` at ${post.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                      </span>
                      <span className="feed-post-subtitle">
                        You sent <strong>{post.workoutName}</strong> &middot; {post.status === 'accepted' ? (
                          <span className="feed-sent-status accepted">Accepted</span>
                        ) : post.status === 'denied' ? (
                          <span className="feed-sent-status denied">Declined</span>
                        ) : (
                          <span className="feed-sent-status pending">Pending</span>
                        )}
                      </span>
                    </div>
                    <div className="feed-save-notif-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </div>
                  </div>
                </div>
                );
                return (
                <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }} onClick={() => onViewPostWorkout && onViewPostWorkout(post)}>
                  <div className="feed-post-header">
                    <div
                      className="feed-post-avatar"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); }}
                    >
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
                      {post.setsCompleted > 1 && (
                        <span className="feed-post-sets">
                          {Array.from({ length: post.setsCompleted }).map((_, i) => (
                            <span key={i} className="feed-post-credit-chip" />
                          ))}
                          {post.setsCompleted} sets
                        </span>
                      )}
                    </div>
                    <div className="feed-post-actions" onClick={e => e.stopPropagation()}>
                      {user && post.userId !== user.uid &&
                        post.lastCompletedAt &&
                        (Date.now() - post.lastCompletedAt.getTime()) < 301500 &&
                        !(post.joinedUsers && post.joinedUsers[user.uid]) && (
                        <button
                          className={`feed-join-btn${!isGraceActive(post) ? ' feed-join-fading' : ''}`}
                          onClick={(e) => handleJoin(e, post)}
                        >JOIN</button>
                      )}
                      <div className="feed-reaction-add-wrap">
                        <button
                          className="feed-reaction-add"
                          onClick={() => setOpenPickerId(id => id === post.id ? null : post.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                          </svg>
                        </button>
                        {openPickerId === post.id && (
                          <div className="feed-reaction-picker">
                            {REACTION_EMOJIS.map(e => (
                              <button
                                key={e}
                                className={`feed-reaction-picker-btn${(userReactions[post.id] || []).includes(e) ? ' selected' : ''}`}
                                onClick={() => handleReact(post.id, e)}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {Object.keys(post.joinedUsers || {}).length > 0 && (
                    <div
                      className={`feed-post-together${expandedTogetherId === post.id ? ' feed-together-open' : ''}`}
                      onClick={e => { e.stopPropagation(); setExpandedTogetherId(id => id === post.id ? null : post.id); }}
                    >
                      <div className="feed-together-avatars">
                        {post.photoURL
                          ? <img src={post.photoURL} alt="" className="feed-together-avatar" referrerPolicy="no-referrer"
                              onClick={expandedTogetherId === post.id ? e => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); } : undefined} />
                          : <div className="feed-together-avatar feed-together-avatar-placeholder"
                              onClick={expandedTogetherId === post.id ? e => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); } : undefined}>
                              {(post.displayName || '?')[0].toUpperCase()}
                            </div>
                        }
                        {Object.entries(post.joinedUsers).map(([uid, profile]) => (
                          profile.photoURL
                            ? <img key={uid} src={profile.photoURL} alt="" className="feed-together-avatar" referrerPolicy="no-referrer"
                                onClick={expandedTogetherId === post.id ? e => { e.stopPropagation(); onViewProfile && onViewProfile({ uid, displayName: profile.displayName, photoURL: profile.photoURL }); } : undefined} />
                            : <div key={uid} className="feed-together-avatar feed-together-avatar-placeholder"
                                onClick={expandedTogetherId === post.id ? e => { e.stopPropagation(); onViewProfile && onViewProfile({ uid, displayName: profile.displayName, photoURL: profile.photoURL }); } : undefined}>
                                {(profile.displayName || '?')[0].toUpperCase()}
                              </div>
                        ))}
                      </div>
                      <div className="feed-together-text">
                        <span className="feed-together-names">
                          {post.displayName}{Object.entries(post.joinedUsers).map(([uid, profile]) => ` & ${uid === user?.uid ? 'you' : profile.displayName}`).join('')}
                        </span>
                        <span className="feed-together-label">completed together</span>
                      </div>
                      {expandedTogetherId === post.id && user && post.joinedUsers?.[user.uid] && isGraceActive(post) && (
                        <button
                          className="feed-leave-btn"
                          onClick={(e) => handleLeave(e, post)}
                        >Leave</button>
                      )}
                    </div>
                  )}
                  {/* Reactions footer — always rendered, CSS drives expand/collapse */}
                  {(() => {
                    const hasReactions = Object.entries(post.reactionCounts || {}).some(([, c]) => c > 0);
                    return (
                      <div
                        className={`feed-post-reactions-footer${hasReactions ? ' has-reactions' : ''}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="feed-reactions-inner">
                          {(post.emojiOrder || Object.keys(post.reactionCounts || {}))
                            .filter(emoji => (post.reactionCounts?.[emoji] || 0) > 0)
                            .map(emoji => { const count = post.reactionCounts[emoji]; return (
                              <button
                                key={emoji}
                                className={`feed-reaction-chip${(userReactions[post.id] || []).includes(emoji) ? ' active' : ''}`}
                                onClick={() => {
                                  if (longPressActivated.current) { longPressActivated.current = false; return; }
                                  handleReact(post.id, emoji);
                                }}
                                onTouchStart={(e) => {
                                  const el = e.currentTarget;
                                  longPressTimer.current = setTimeout(() => handleChipLongPress(el, post.id, emoji), 250);
                                }}
                                onTouchEnd={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                                onTouchMove={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                                onTouchCancel={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                                onMouseDown={(e) => {
                                  const el = e.currentTarget;
                                  longPressTimer.current = setTimeout(() => handleChipLongPress(el, post.id, emoji), 250);
                                }}
                                onMouseUp={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                                onMouseLeave={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                              >
                                <span>{emoji}</span>
                                <span className="feed-reaction-count">{count}</span>
                              </button>
                            ); })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                );
              })
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
                    <div key={u.uid} className="feed-person-card" style={{ cursor: 'pointer' }}
                      onClick={() => onViewProfile && onViewProfile({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL })}
                    >
                      <div
                        className="feed-person-avatar"
                      >
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

      {/* Reaction tooltip — fixed overlay to escape overflow:hidden containers */}
      {reactionTooltip && (
        <div
          ref={tooltipRef}
          className="feed-reaction-tooltip"
          style={{ left: reactionTooltip.x, top: reactionTooltip.y - 10 }}
        >
          {reactionTooltip.reactors === null
            ? <span className="feed-reaction-tooltip-name">...</span>
            : reactionTooltip.reactors.length === 0
              ? <span className="feed-reaction-tooltip-name">No one yet</span>
              : reactionTooltip.reactors.map((r, i) => (
                  <span key={i} className="feed-reaction-tooltip-name">
                    {r.displayName}
                  </span>
                ))
          }
        </div>
      )}
    </div>
  );
};

export default FeedPage;
