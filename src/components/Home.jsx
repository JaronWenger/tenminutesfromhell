import React, { useState, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './Home.css';
import Sparks from '../assets/SPARKS.gif';
import AuthButton from './AuthButton';

const APP_TITLES = [
  'TEN MINUTES FROM HELL',
  'HIITBOSS',
  'MEGAHIIT',
  'HITTHYPE',
  'HITTem',
  'HITTMODE',
  'HITTSHRED',
  'winHIIT'
];

const Home = ({
  timerWorkoutData,
  timerSelectedWorkout,
  workoutHistory,
  onWorkoutSelect,
  onArrowClick,
  onNavigateToTab,
  onDeleteWorkout,
  onReorder,
  onBellClick,
  onProfileClick
}) => {
  const [swipingIndex, setSwipingIndex] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [titleIndex, setTitleIndex] = useState(0);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

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
    if (isSwiping.current || isDragging) return;
    const isAlreadySelected = timerSelectedWorkout === workoutName;
    if (isAlreadySelected) {
      onNavigateToTab('timer');
    } else {
      onWorkoutSelect('timer', workoutName);
    }
  };

  const handleEdit = (workoutName, e) => {
    e.stopPropagation();
    if (isDragging) return;
    onArrowClick('timer', workoutName);
  };

  const handleAddWorkout = () => {
    onArrowClick('timer', 'New Workout');
  };

  // ── react-beautiful-dnd ──
  const onDragStart = () => {
    setIsDragging(true);
    // Clear any open swipe
    setSwipingIndex(null);
    setSwipeOffset(0);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const onDragEnd = (result) => {
    setIsDragging(false);
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const reordered = Array.from(timerWorkoutData);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorder(reordered);
  };

  // ── Swipe-to-delete touch handlers ──
  const handleTouchStart = (index, e) => {
    if (isDragging) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (index, e) => {
    if (isDragging) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && !isSwiping.current) return;

    if (deltaX < -10) {
      isSwiping.current = true;
      setSwipingIndex(index);
      setSwipeOffset(Math.max(deltaX, -80));
    } else if (swipingIndex === index) {
      setSwipeOffset(0);
      setSwipingIndex(null);
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) return;
    if (swipeOffset < -40) {
      setSwipeOffset(-80);
    } else {
      setSwipeOffset(0);
      setSwipingIndex(null);
    }
    setTimeout(() => { isSwiping.current = false; }, 50);
  };

  const handleDelete = (workoutName) => {
    setSwipingIndex(null);
    setSwipeOffset(0);
    onDeleteWorkout(workoutName);
  };

  return (
    <div className="home-container">
      <div className="home-sparks-bg">
        <img src={Sparks} alt="" className="home-sparks-img" />
      </div>

      <div className="home-header">
        <div className="home-header-auth">
          <AuthButton onProfileClick={onProfileClick} />
        </div>
        <span
          className="home-header-title"
          onClick={() => setTitleIndex((titleIndex + 1) % APP_TITLES.length)}
        >
          {APP_TITLES[titleIndex]}
        </span>
        <button className="home-header-bell" onClick={onBellClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </div>

      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Droppable droppableId="home-workouts" direction="vertical">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="home-workout-list"
            >
              {timerWorkoutData.map((workout, index) => {
                const totalSeconds = (workout.exercises.length * 60) + 15;
                const completions = getCompletionCount(workout.name);
                const isSelected = timerSelectedWorkout === workout.name;
                const isSwipeOpen = swipingIndex === index;

                return (
                  <Draggable
                    key={workout.name}
                    draggableId={workout.name}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`workout-card-wrapper ${isSwipeOpen ? 'swipe-open' : ''}`}
                        style={{
                          ...provided.draggableProps.style,
                          marginBottom: '6px',
                          padding: 0
                        }}
                      >
                        <div
                          className={`workout-card ${isSelected ? 'selected' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                          style={
                            !snapshot.isDragging && isSwipeOpen
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
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}

              <div className="workout-card-add" onClick={handleAddWorkout}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>New Workout</span>
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default Home;
