import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFeedPosts,
  getAllUsers,
  getFollowing,
  followUser,
  unfollowUser,
  toggleLike,
  batchCheckLikes
} from '../firebase/social';
import './FeedPage.css';

const FeedPage = ({ isOpen, onClose, requestClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [likedPosts, setLikedPosts] = useState({});
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const feedPosts = await getFeedPosts(user.uid);
      setPosts(feedPosts);
      if (feedPosts.length > 0) {
        const likes = await batchCheckLikes(
          feedPosts.map(p => p.id),
          user.uid
        );
        setLikedPosts(likes);
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [allUsers, following] = await Promise.all([
        getAllUsers(),
        getFollowing(user.uid)
      ]);
      setUsers(allUsers.filter(u => u.uid !== user.uid));
      setFollowingIds(following);
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

  if (!isOpen) return null;

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
                      <span className="feed-post-time">{timeAgo(post.createdAt)}</span>
                    </div>
                  </div>
                  <div className="feed-post-body">
                    <span className="feed-post-workout">{post.workoutName}</span>
                    <div className="feed-post-stats">
                      <span>{formatDuration(post.duration)}</span>
                      <span className="feed-post-dot">&middot;</span>
                      <span>{post.exerciseCount} exercises</span>
                    </div>
                  </div>
                  <div className="feed-post-actions">
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
            {users.length === 0 ? (
              <div className="feed-empty">
                <p>No other users yet</p>
                <span>Invite friends to join</span>
              </div>
            ) : (
              users.map(u => {
                const isFollowing = followingIds.includes(u.uid);
                return (
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
                      <span className="feed-person-stats">{u.workoutCount || 0} workouts</span>
                    </div>
                    <button
                      className={`feed-follow-btn ${isFollowing ? 'following' : ''}`}
                      onClick={() => isFollowing ? handleUnfollow(u.uid) : handleFollow(u.uid)}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FeedPage;
