import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import PP from '../assets/PP.png';
import { useAuth } from '../contexts/AuthContext';
import AuthButton from './AuthButton';
import {
  getFeedPosts,
  getFollowing,
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
import { recordWorkoutHistory, addLibraryRef, createWorkoutV2, getWorkoutV2 } from '../firebase/firestore';
import './FeedPage.css';
import './ActivityPage.css';
import './Home.css';

const REACTION_EMOJIS = ['🏆', '🦍', '🦧', '🐦‍🔥', '🦦', '🔥'];

const ActivityPage = ({
  onPeopleClick,
  onLoginClick,
  onProfileClick,
  onViewProfile,
  onViewPostWorkout,
  onWorkoutAdded,
  onHistoryRecorded,
  acceptedPostId,
  allWorkouts = [],
  lastViewedAt,
  externalFollowedUid,
  pendingFollowRequests = {},
  onPendingFollowRequestsChange,
  onFollowCountChanged,
  isVisible,
  prefetchReady = false,
}) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [userReactions, setUserReactions] = useState({});
  const [openPickerId, setOpenPickerId] = useState(null);
  const [reactionTooltip, setReactionTooltip] = useState(null);
  const longPressTimer = useRef(null);
  const longPressActivated = useRef(false);
  const tooltipRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorDateRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef(null);
  const [shareActions, setShareActions] = useState({});
  const [requestActions, setRequestActions] = useState({});
  const [expandedTogetherId, setExpandedTogetherId] = useState(null);

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

  useEffect(() => {
    if (!openPickerId) return;
    const close = () => setOpenPickerId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openPickerId]);

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
    setReactionTooltip({ postId, emoji, reactors: null, x: rect.left + rect.width / 2, y: rect.top });
    try {
      const reactors = await getEmojiReactors(postId, emoji);
      setReactionTooltip(prev =>
        prev?.postId === postId && prev?.emoji === emoji ? { ...prev, reactors } : prev
      );
    } catch {
      setReactionTooltip(null);
    }
  };

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
  }, [user, onHistoryRecorded]);

  const handleLeave = useCallback(async (e, post) => {
    e.stopPropagation();
    if (!user) return;
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
    cursorDateRef.current = null;
    setHasMore(true);
    try {
      let [feedPosts, following] = await Promise.all([
        getFeedPosts(user.uid, 10),
        getFollowing(user.uid)
      ]);
      const postsWithWorkoutId = feedPosts.filter(p => p.workoutId);
      if (postsWithWorkoutId.length > 0) {
        const uniqueIds = [...new Set(postsWithWorkoutId.map(p => p.workoutId))];
        const liveDocs = await Promise.all(uniqueIds.map(id => getWorkoutV2(id).catch(() => null)));
        const liveMap = {};
        liveDocs.forEach((doc, i) => { if (doc) liveMap[uniqueIds[i]] = doc; });
        feedPosts = feedPosts.map(p => {
          if (p.workoutId && liveMap[p.workoutId]) {
            const live = liveMap[p.workoutId];
            return { ...p, exercises: live.exercises, exerciseCount: live.exercises?.length, workoutName: live.name };
          }
          return p;
        });
      }
      // Set cursor to oldest post's date for pagination
      const postsWithDate = feedPosts.filter(p => p.createdAt);
      if (postsWithDate.length > 0) {
        cursorDateRef.current = postsWithDate[postsWithDate.length - 1].createdAt;
      }
      setHasMore(feedPosts.length >= 10);
      setPosts(feedPosts);
      setFollowingIds(following);
      const workoutPosts = feedPosts.filter(p => !p.type);
      if (workoutPosts.length > 0) {
        const reactions = await batchCheckReactions(workoutPosts.map(p => p.id), user.uid);
        setUserReactions(reactions);
      }
    } catch (err) {
      console.error('[Activity] Failed to load feed:', err.message, err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!user || !cursorDateRef.current || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      let morePosts = await getFeedPosts(user.uid, 20, cursorDateRef.current);
      if (morePosts.length === 0) {
        setHasMore(false);
        return;
      }
      const postsWithWorkoutId = morePosts.filter(p => p.workoutId);
      if (postsWithWorkoutId.length > 0) {
        const uniqueIds = [...new Set(postsWithWorkoutId.map(p => p.workoutId))];
        const liveDocs = await Promise.all(uniqueIds.map(id => getWorkoutV2(id).catch(() => null)));
        const liveMap = {};
        liveDocs.forEach((doc, i) => { if (doc) liveMap[uniqueIds[i]] = doc; });
        morePosts = morePosts.map(p => {
          if (p.workoutId && liveMap[p.workoutId]) {
            const live = liveMap[p.workoutId];
            return { ...p, exercises: live.exercises, exerciseCount: live.exercises?.length, workoutName: live.name };
          }
          return p;
        });
      }
      const postsWithDate = morePosts.filter(p => p.createdAt);
      if (postsWithDate.length > 0) {
        cursorDateRef.current = postsWithDate[postsWithDate.length - 1].createdAt;
      }
      setHasMore(morePosts.length >= 20);
      setPosts(prev => [...prev, ...morePosts]);
      const workoutPosts = morePosts.filter(p => !p.type);
      if (workoutPosts.length > 0) {
        const reactions = await batchCheckReactions(workoutPosts.map(p => p.id), user.uid);
        setUserReactions(prev => ({ ...prev, ...reactions }));
      }
    } catch (err) {
      console.error('[Activity] Failed to load more:', err);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [user, hasMore]);

  useEffect(() => {
    hasLoadedRef.current = false;
    cursorDateRef.current = null;
    setHasMore(true);
  }, [user]);

  useEffect(() => {
    if ((isVisible || prefetchReady) && user && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFeed();
    }
  }, [isVisible, prefetchReady, user, loadFeed]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  useEffect(() => {
    if (acceptedPostId) {
      setShareActions(prev => ({ ...prev, [acceptedPostId]: 'accepted' }));
    }
  }, [acceptedPostId]);

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

  const handleReact = async (postId, emoji) => {
    if (!user) return;
    setOpenPickerId(null);
    const current = userReactions[postId] || [];
    const hasEmoji = current.includes(emoji);
    const next = hasEmoji ? current.filter(e => e !== emoji) : [...current, emoji];
    const originalPost = posts.find(p => p.id === postId);
    setUserReactions(prev => ({ ...prev, [postId]: next }));
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const counts = { ...(p.reactionCounts || {}) };
      counts[emoji] = Math.max(0, (counts[emoji] || 0) + (hasEmoji ? -1 : 1));
      let emojiOrder = [...(p.emojiOrder || [])];
      if (!hasEmoji && !emojiOrder.includes(emoji)) emojiOrder = [...emojiOrder, emoji];
      else if (hasEmoji && counts[emoji] === 0) emojiOrder = emojiOrder.filter(e => e !== emoji);
      return { ...p, reactionCounts: counts, emojiOrder };
    }));
    try {
      await toggleReaction(postId, user.uid, emoji, user.displayName);
    } catch {
      setUserReactions(prev => ({ ...prev, [postId]: current }));
      if (originalPost) setPosts(prev => prev.map(p => p.id !== postId ? p : originalPost));
    }
  };

  const isSharedWorkoutInLibrary = useCallback((post) => {
    if (post.workoutId) return allWorkouts.some(w => w.id === post.workoutId);
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
      if (post.workoutId) {
        const existingDoc = await getWorkoutV2(post.workoutId);
        if (existingDoc) {
          await addLibraryRef(user.uid, post.workoutId, 'shared');
        } else {
          const newId = await createWorkoutV2(user.uid, {
            name: post.workoutName, type: post.workoutType || 'timer',
            exercises: post.exercises || [], isCustom: true,
            restTime: post.restTime ?? null, tags: post.tags || null,
            creatorUid: post.creatorUid || post.userId,
            creatorName: post.creatorName || post.displayName,
            creatorPhotoURL: post.creatorPhotoURL || post.photoURL,
          });
          await addLibraryRef(user.uid, newId, 'shared');
        }
      } else {
        const newId = await createWorkoutV2(user.uid, {
          name: post.workoutName, type: post.workoutType || 'timer',
          exercises: post.exercises || [], isCustom: true,
          restTime: post.restTime ?? null, tags: post.tags || null,
          creatorUid: post.creatorUid || post.userId,
          creatorName: post.creatorName || post.displayName,
          creatorPhotoURL: post.creatorPhotoURL || post.photoURL,
        });
        await addLibraryRef(user.uid, newId, 'shared');
      }
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

  return (
    <div className="activity-page" style={{ display: isVisible ? undefined : 'none' }}>
      <div className="home-header">
        <div className="home-header-auth">
          <AuthButton onLoginClick={onLoginClick} onProfileClick={onProfileClick} />
        </div>
        <span className="home-header-title">HIITem</span>
        {user && (
          <button className="home-header-bell" onClick={onPeopleClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </button>
        )}
      </div>

      <div className="activity-content">
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
        {user && !loading && (
          <>
            {posts.length === 0 ? (
              <div className="feed-empty">
                <p>No posts yet</p>
                <span>Complete a workout or follow people to see activity here</span>
              </div>
            ) : (
              <>
              {posts.map(post => {
                if (post.type === 'follow') return (
                  <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }}
                    onClick={() => onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL })}
                  >
                    <div className="feed-post-header">
                      <div className="feed-post-avatar">
                        {post.photoURL ? <img src={post.photoURL} alt="" referrerPolicy="no-referrer" /> : <div className="feed-post-avatar-placeholder">{(post.displayName || '?')[0].toUpperCase()}</div>}
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
                  <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }}
                    onClick={() => onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL })}
                  >
                    <div className="feed-post-header">
                      <div className="feed-post-avatar">
                        {post.photoURL ? <img src={post.photoURL} alt="" referrerPolicy="no-referrer" /> : <div className="feed-post-avatar-placeholder">{(post.displayName || '?')[0].toUpperCase()}</div>}
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
                  <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }}
                    onClick={() => onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL })}
                  >
                    <div className="feed-post-header">
                      <div className="feed-post-avatar">
                        {post.photoURL ? <img src={post.photoURL} alt="" referrerPolicy="no-referrer" /> : <div className="feed-post-avatar-placeholder">{(post.displayName || '?')[0].toUpperCase()}</div>}
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
                      <div className="feed-share-actions"><span className="feed-share-status accepted">Accepted</span></div>
                    ) : (requestActions[post.id] === 'denied' || post.status === 'denied') ? (
                      <div className="feed-share-actions"><span className="feed-share-status denied">Denied</span></div>
                    ) : (
                      <div className="feed-share-actions">
                        <button className="feed-share-deny-btn" onClick={(e) => { e.stopPropagation(); handleDenyFollowRequest(post); }}>Deny</button>
                        <button className="feed-share-accept-btn" onClick={(e) => { e.stopPropagation(); handleAcceptFollowRequest(post); }}>Accept</button>
                      </div>
                    )}
                  </div>
                );
                if (post.type === 'workout_saved') return (
                  <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }}
                    onClick={() => onViewPostWorkout && onViewPostWorkout(post)}
                  >
                    <div className="feed-post-header">
                      <div className="feed-post-avatar" style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); }}
                      >
                        {post.photoURL ? <img src={post.photoURL} alt="" referrerPolicy="no-referrer" /> : <div className="feed-post-avatar-placeholder">{(post.displayName || '?')[0].toUpperCase()}</div>}
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
                  <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }}
                    onClick={() => onViewPostWorkout && onViewPostWorkout(post)}
                  >
                    <div className="feed-post-header">
                      <div className="feed-post-avatar" style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); }}
                      >
                        {post.photoURL ? <img src={post.photoURL} alt="" referrerPolicy="no-referrer" /> : <div className="feed-post-avatar-placeholder">{(post.displayName || '?')[0].toUpperCase()}</div>}
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
                      <div className="feed-share-actions"><span className="feed-share-status denied">Declined</span></div>
                    ) : (
                      <div className="feed-share-actions">
                        <button className="feed-share-deny-btn" onClick={(e) => { e.stopPropagation(); handleDenySharedWorkout(post); }}>Deny</button>
                        <button className={`feed-share-accept-btn ${shareActions[post.id] === 'accepting' ? 'saving' : ''}`}
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
                  <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }}
                    onClick={() => onViewPostWorkout && onViewPostWorkout(post)}
                  >
                    <div className="feed-post-header">
                      <div className="feed-post-avatar" style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.recipientName, photoURL: post.recipientPhotoURL }); }}
                      >
                        {post.recipientPhotoURL ? <img src={post.recipientPhotoURL} alt="" referrerPolicy="no-referrer" /> : <div className="feed-post-avatar-placeholder">{(post.recipientName || '?')[0].toUpperCase()}</div>}
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
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <div key={post.id} className={`feed-post-card${isNewPost(post) ? ' feed-new-post' : ''}`} style={{ cursor: 'pointer' }} onClick={() => onViewPostWorkout && onViewPostWorkout(post)}>
                    <div className="feed-post-header">
                      <div className="feed-post-avatar" style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: post.userId, displayName: post.displayName, photoURL: post.photoURL }); }}
                      >
                        {post.photoURL ? <img src={post.photoURL} alt="" referrerPolicy="no-referrer" /> : <div className="feed-post-avatar-placeholder">{(post.displayName || '?')[0].toUpperCase()}</div>}
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
                            {Array.from({ length: post.setsCompleted }).map((_, i) => <span key={i} className="feed-post-credit-chip" />)}
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
                          <button className="feed-reaction-add" onClick={() => setOpenPickerId(id => id === post.id ? null : post.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                            </svg>
                          </button>
                          {openPickerId === post.id && (
                            <div className="feed-reaction-picker">
                              {REACTION_EMOJIS.map(e => (
                                <button key={e}
                                  className={`feed-reaction-picker-btn${(userReactions[post.id] || []).includes(e) ? ' selected' : ''}`}
                                  onClick={() => handleReact(post.id, e)}
                                >{e}</button>
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
                          <button className="feed-leave-btn" onClick={(e) => handleLeave(e, post)}>Leave</button>
                        )}
                      </div>
                    )}
                    {(() => {
                      const hasReactions = Object.entries(post.reactionCounts || {}).some(([, c]) => c > 0);
                      return (
                        <div className={`feed-post-reactions-footer${hasReactions ? ' has-reactions' : ''}`} onClick={e => e.stopPropagation()}>
                          <div className="feed-reactions-inner">
                            {(post.emojiOrder || Object.keys(post.reactionCounts || {}))
                              .filter(emoji => (post.reactionCounts?.[emoji] || 0) > 0)
                              .map(emoji => { const count = post.reactionCounts[emoji]; return (
                                <button key={emoji}
                                  className={`feed-reaction-chip${(userReactions[post.id] || []).includes(emoji) ? ' active' : ''}`}
                                  onClick={() => { if (longPressActivated.current) { longPressActivated.current = false; return; } handleReact(post.id, emoji); }}
                                  onTouchStart={(e) => { const el = e.currentTarget; longPressTimer.current = setTimeout(() => handleChipLongPress(el, post.id, emoji), 250); }}
                                  onTouchEnd={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                                  onTouchMove={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                                  onTouchCancel={() => { clearTimeout(longPressTimer.current); setReactionTooltip(null); }}
                                  onMouseDown={(e) => { const el = e.currentTarget; longPressTimer.current = setTimeout(() => handleChipLongPress(el, post.id, emoji), 250); }}
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
              })}
              {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
              {isLoadingMore && <div className="activity-load-more">Loading...</div>}
              {!hasMore && !isLoadingMore && (
                <div className="feed-post-card" style={{ cursor: 'pointer' }} onClick={() => onPeopleClick && onPeopleClick()}>
                  <div className="feed-post-header">
                    <div
                      className="feed-post-avatar"
                      onClick={(e) => { e.stopPropagation(); onViewProfile && onViewProfile({ uid: 'hiitem', displayName: 'HIITem', photoURL: PP }); }}
                    >
                      <img src={PP} alt="" />
                    </div>
                    <div className="feed-post-meta">
                      <span className="feed-post-name">HIITem</span>
                      <span className="feed-post-time">
                        {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                      </span>
                      <span className="feed-post-subtitle">Welcome{user?.displayName ? ` ${user.displayName.split(' ')[0]}` : ''}! Complete a workout and share with your friends <span style={{ opacity: 1, color: 'white' }}>🔥</span></span>
                    </div>
                    <button className="feed-welcome-people-btn" onClick={(e) => { e.stopPropagation(); onPeopleClick && onPeopleClick(); }}>
                      People<span style={{ marginLeft: 4, fontSize: '1em', lineHeight: 0 }}>→</span>
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </>
        )}
      </div>

      {reactionTooltip && (
        <div ref={tooltipRef} className="feed-reaction-tooltip" style={{ left: reactionTooltip.x, top: reactionTooltip.y - 10 }}>
          {reactionTooltip.reactors === null
            ? <span className="feed-reaction-tooltip-name">...</span>
            : reactionTooltip.reactors.length === 0
              ? <span className="feed-reaction-tooltip-name">No one yet</span>
              : reactionTooltip.reactors.map((r, i) => <span key={i} className="feed-reaction-tooltip-name">{r.displayName}</span>)
          }
        </div>
      )}
    </div>
  );
};

export default ActivityPage;
