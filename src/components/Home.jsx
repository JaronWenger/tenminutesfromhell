import React, { useState, useRef, useCallback } from 'react';
import './Home.css';
import Sparks from '../assets/SPARKS.gif';
import AuthButton from './AuthButton';

const Home = ({
  timerWorkoutData,
  timerSelectedWorkout,
  workoutHistory,
  onWorkoutSelect,
  onArrowClick,
  onNavigateToTab,
  onDeleteWorkout,
  onReorder
}) => {
  const [swipingIndex, setSwipingIndex] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const longPressTimer = useRef(null);
  const dragStartY = useRef(0);
  const cardRefs = useRef([]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCompletionCount = (workoutName) => {
    if (!workoutHistory || workoutHistory.length === 0) return 0;
    return workoutHistory.filter(h => h.workoutName === workoutName).length;
  };

  const handleRowClick = (workoutName) => {
    if (isSwiping.current || dragIndex !== null) return;
    const isAlreadySelected = timerSelectedWorkout === workoutName;
    if (isAlreadySelected) {
      onNavigateToTab('timer');
    } else {
      onWorkoutSelect('timer', workoutName);
    }
  };

  const handleEdit = (workoutName, e) => {
    e.stopPropagation();
    if (dragIndex !== null) return;
    onArrowClick('timer', workoutName);
  };

  const handleAddWorkout = () => {
    onArrowClick('timer', 'New Workout');
  };

  // ── Swipe-to-delete ──
  const handleTouchStart = useCallback((index, e) => {
    if (dragIndex !== null) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isSwiping.current = false;

    // Long press to start drag
    longPressTimer.current = setTimeout(() => {
      setDragIndex(index);
      setDragOverIndex(index);
      dragStartY.current = touch.clientY;
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, [dragIndex]);

  const handleTouchMove = useCallback((index, e) => {
    const touch = e.touches[0];

    // If dragging, handle reorder
    if (dragIndex !== null) {
      e.preventDefault();
      // Find which card we're over
      const cards = cardRefs.current;
      for (let i = 0; i < cards.length; i++) {
        if (!cards[i]) continue;
        const rect = cards[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (touch.clientY < midY) {
          setDragOverIndex(i);
          return;
        }
      }
      setDragOverIndex(cards.length - 1);
      return;
    }

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // Cancel long press if finger moved
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      clearTimeout(longPressTimer.current);
    }

    if (Math.abs(deltaY) > Math.abs(deltaX) && !isSwiping.current) return;

    if (deltaX < -10) {
      isSwiping.current = true;
      setSwipingIndex(index);
      setSwipeOffset(Math.max(deltaX, -80));
    } else if (swipingIndex === index) {
      setSwipeOffset(0);
      setSwipingIndex(null);
    }
  }, [dragIndex, swipingIndex]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);

    // If dragging, commit reorder
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const reordered = Array.from(timerWorkoutData);
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dragOverIndex, 0, moved);
      onReorder(reordered);
    }
    setDragIndex(null);
    setDragOverIndex(null);

    // Swipe snap
    if (swipeOffset < -40) {
      setSwipeOffset(-80);
    } else {
      setSwipeOffset(0);
      setSwipingIndex(null);
    }
    setTimeout(() => { isSwiping.current = false; }, 50);
  }, [dragIndex, dragOverIndex, swipeOffset, timerWorkoutData, onReorder]);

  const handleDelete = (workoutName) => {
    setSwipingIndex(null);
    setSwipeOffset(0);
    onDeleteWorkout(workoutName);
  };

  // Build display order during drag
  const getDisplayOrder = () => {
    if (dragIndex === null || dragOverIndex === null) return timerWorkoutData;
    const items = Array.from(timerWorkoutData);
    const [moved] = items.splice(dragIndex, 1);
    items.splice(dragOverIndex, 0, moved);
    return items;
  };

  const displayItems = getDisplayOrder();

  return (
    <div className="home-container">
      <div className="home-sparks-bg">
        <img src={Sparks} alt="" className="home-sparks-img" />
      </div>

      <div className="home-header">
        <span className="home-header-title">TEN MINUTES FROM HELL</span>
        <div className="home-header-auth">
          <AuthButton />
        </div>
      </div>

      <div className="home-workout-list">
        {displayItems.map((workout, index) => {
          const totalSeconds = (workout.exercises.length * 60) + 15;
          const completions = getCompletionCount(workout.name);
          const isSelected = timerSelectedWorkout === workout.name;
          const isSwipeOpen = swipingIndex !== null && timerWorkoutData[swipingIndex]?.name === workout.name;
          const isBeingDragged = dragIndex !== null && timerWorkoutData[dragIndex]?.name === workout.name;

          return (
            <div
              key={workout.name}
              className={`workout-card-wrapper ${isSwipeOpen ? 'swipe-open' : ''}`}
              ref={el => cardRefs.current[index] = el}
            >
              <div
                className={`workout-card ${isSelected ? 'selected' : ''} ${isBeingDragged ? 'dragging' : ''}`}
                style={
                  !isBeingDragged && isSwipeOpen
                    ? {
                        transform: `translateX(${swipeOffset}px)`,
                        transition: isSwiping.current ? 'none' : 'transform 0.25s ease'
                      }
                    : undefined
                }
                onClick={() => handleRowClick(workout.name)}
                onTouchStart={(e) => handleTouchStart(index, e)}
                onTouchMove={(e) => handleTouchMove(index, e)}
                onTouchEnd={() => handleTouchEnd()}
              >
                <div className="workout-card-left">
                  <span className="workout-card-name">{workout.name}</span>
                  <div className="workout-card-detail">
                    <span className="workout-card-time">{formatTime(totalSeconds)}</span>
                    <span className="workout-card-dot">&middot;</span>
                    <span className="workout-card-exercises">{workout.exercises.length} exercises</span>
                    {completions > 0 && (
                      <>
                        <span className="workout-card-dot">&middot;</span>
                        <span className="workout-card-completions">{completions}x</span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className="workout-card-edit"
                  onClick={(e) => handleEdit(workout.name, e)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                  </svg>
                </div>
              </div>
              {isSwipeOpen && (
                <div
                  className="workout-card-delete"
                  onClick={() => handleDelete(workout.name)}
                >
                  Delete
                </div>
              )}
            </div>
          );
        })}

        <div className="workout-card-add" onClick={handleAddWorkout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New Workout</span>
        </div>
      </div>
    </div>
  );
};

export default Home;
