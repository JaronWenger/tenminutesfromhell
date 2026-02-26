import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './Home.css';
import Sparks from '../assets/SPARKS.gif';
import AuthButton from './AuthButton';
import { useAuth } from '../contexts/AuthContext';


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
  onLoginClick,
  onProfileClick,
  prepTime = 15,
  globalRestTime = 15,
  onDetailSave,
  onStartWorkout,
  defaultWorkoutNames = []
}) => {
  const { user } = useAuth();
  const [swipingIndex, setSwipingIndex] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Detail overlay state
  const [detailWorkout, setDetailWorkout] = useState(null);
  const [detailRect, setDetailRect] = useState(null);
  const [detailPhase, setDetailPhase] = useState(null); // null | 'entering' | 'open' | 'leaving'
  const [isEditing, setIsEditing] = useState(false);

  // Editing state
  const [editExercises, setEditExercises] = useState([]);
  const [editTitle, setEditTitle] = useState('');
  const [editRestTime, setEditRestTime] = useState(null);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const cardRefs = useRef({});
  const panelRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const titleInputRef = useRef(null);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCompletionCount = (workoutName) => {
    if (!workoutHistory || workoutHistory.length === 0) return 0;
    return workoutHistory.filter(h => h.workoutName === workoutName).length;
  };

  // ── Detail overlay ──
  const openDetail = useCallback((workout) => {
    const el = cardRefs.current[workout.name];
    const rect = el ? el.getBoundingClientRect() : null;
    setDetailRect(rect);
    setDetailWorkout(workout);
    setDetailPhase('entering');
    setIsEditing(false);
    setEditExercises([...workout.exercises]);
    setEditTitle(workout.name);
    setEditRestTime(workout.restTime ?? null);
  }, []);

  // FLIP: after panel mounts at final position, snap to card rect then animate to final
  useLayoutEffect(() => {
    if (detailPhase !== 'entering' || !panelRef.current || !detailRect) return;

    const panel = panelRef.current;
    const panelRect = panel.getBoundingClientRect();

    // Calculate transform from final position to card position
    const dx = (detailRect.left + detailRect.width / 2) - (panelRect.left + panelRect.width / 2);
    const dy = (detailRect.top + detailRect.height / 2) - (panelRect.top + panelRect.height / 2);
    const sx = detailRect.width / panelRect.width;
    const sy = detailRect.height / panelRect.height;

    // Snap to card position instantly (card-like styling)
    panel.style.transition = 'none';
    panel.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(255, 59, 48, 0.1)';
    panel.style.borderColor = 'rgba(255, 59, 48, 0.3)';

    // Force reflow so browser registers the initial state
    panel.offsetHeight; // eslint-disable-line no-unused-expressions

    // Animate to final centered position
    panel.style.transition = [
      'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
      'border-radius 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
      'background 0.28s ease 0.1s',
      'border-color 0.28s ease 0.1s'
    ].join(', ');
    panel.style.transform = 'none';
    panel.style.borderRadius = '';
    panel.style.background = '';
    panel.style.borderColor = '';

    const timer = setTimeout(() => {
      // Clear inline styles so CSS takes over
      panel.style.transition = '';
      panel.style.transform = '';
      setDetailPhase('open');
    }, 400);

    return () => clearTimeout(timer);
  }, [detailPhase, detailRect]);

  const closeDetail = useCallback(() => {
    if (detailPhase === 'leaving') return;

    const panel = panelRef.current;
    if (!panel || !detailWorkout) {
      setDetailWorkout(null);
      setDetailRect(null);
      setDetailPhase(null);
      return;
    }

    setDetailPhase('leaving');

    // Recapture card rect (may have scrolled)
    const cardEl = cardRefs.current[detailWorkout.name];
    const targetRect = cardEl ? cardEl.getBoundingClientRect() : detailRect;

    if (!targetRect) {
      // Fallback: simple fade out
      setTimeout(() => {
        setDetailWorkout(null);
        setDetailRect(null);
        setDetailPhase(null);
        setIsEditing(false);
        setIsEditingTitle(false);
        setShowAddPopup(false);
      }, 280);
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (panelRect.left + panelRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (panelRect.top + panelRect.height / 2);
    const sx = targetRect.width / panelRect.width;
    const sy = targetRect.height / panelRect.height;

    // Animate back to card position
    panel.style.transition = [
      'transform 0.22s cubic-bezier(0.2, 0, 0.6, 1)',
      'border-radius 0.22s cubic-bezier(0.2, 0, 0.6, 1)',
      'background 0.15s ease',
      'border-color 0.15s ease'
    ].join(', ');
    panel.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(255, 59, 48, 0.1)';
    panel.style.borderColor = 'rgba(255, 59, 48, 0.3)';

    setTimeout(() => {
      setDetailWorkout(null);
      setDetailRect(null);
      setDetailPhase(null);
      setIsEditing(false);
      setIsEditingTitle(false);
      setShowAddPopup(false);
    }, 230);
  }, [detailPhase, detailWorkout, detailRect]);

  const handleRowClick = (workout) => {
    if (isSwiping.current || isDragging) return;
    const isAlreadySelected = timerSelectedWorkout === workout.name;
    if (isAlreadySelected) {
      openDetail(workout);
    } else {
      onWorkoutSelect('timer', workout.name);
    }
  };

  const handleAddWorkout = () => {
    onArrowClick('timer', 'New Workout');
  };

  // ── react-beautiful-dnd ──
  const onDragStart = () => {
    setIsDragging(true);
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

  // ── Editing handlers ──
  const handleEditToggle = () => {
    if (isEditing) {
      handleSave();
    }
    setIsEditing(!isEditing);
    setIsEditingTitle(false);
    setShowAddPopup(false);
  };

  const handleSave = () => {
    if (!detailWorkout) return;
    onDetailSave(detailWorkout.name, editExercises, editTitle, editRestTime);
    setDetailWorkout(prev => ({
      ...prev,
      name: editTitle,
      exercises: [...editExercises],
      restTime: editRestTime
    }));
  };

  const handleMoveExercise = (index, direction) => {
    const newExercises = [...editExercises];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newExercises.length) return;
    [newExercises[index], newExercises[targetIndex]] = [newExercises[targetIndex], newExercises[index]];
    setEditExercises(newExercises);
  };

  const handleDeleteExercise = (index) => {
    setEditExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddExercise = () => {
    if (newExerciseName.trim()) {
      setEditExercises(prev => [...prev, newExerciseName.trim()]);
      setNewExerciseName('');
      setShowAddPopup(false);
    }
  };

  const handleAddKeyDown = (e) => {
    if (e.key === 'Enter') handleAddExercise();
    else if (e.key === 'Escape') { setShowAddPopup(false); setNewExerciseName(''); }
  };

  const handleRestTimeChange = (delta) => {
    setEditRestTime(prev => {
      const current = prev ?? globalRestTime;
      return Math.max(0, Math.min(30, current + delta));
    });
  };

  // Handle clicks outside title input
  useEffect(() => {
    if (!isEditingTitle) return;
    const handleClickOutside = (e) => {
      if (titleInputRef.current && !titleInputRef.current.contains(e.target)) {
        setIsEditingTitle(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isEditingTitle]);

  const isDefaultWorkout = detailWorkout ? defaultWorkoutNames.includes(detailWorkout.name) : false;

  const displayRestTime = detailWorkout
    ? (detailWorkout.restTime != null ? detailWorkout.restTime : globalRestTime)
    : globalRestTime;

  const contentVisible = detailPhase === 'open' || detailPhase === 'entering';

  return (
    <div className={`home-container ${detailWorkout && detailPhase !== 'leaving' ? 'home-detail-open' : ''}`}>
      <div className="home-sparks-bg">
        <img src={Sparks} alt="" className="home-sparks-img" />
      </div>

      <div className="home-header">
        <div className="home-header-auth">
          <AuthButton onLoginClick={onLoginClick} onProfileClick={onProfileClick} />
        </div>
        <span className="home-header-title">HIITem</span>
        {user && (
          <button className="home-header-bell" onClick={onBellClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        )}
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
                const totalSeconds = (workout.exercises.length * 60) + prepTime;
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
                        ref={(el) => {
                          provided.innerRef(el);
                          cardRefs.current[workout.name] = el;
                        }}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`workout-card-wrapper ${isSwipeOpen ? 'swipe-open' : ''}`}
                        style={{
                          ...provided.draggableProps.style,
                          marginBottom: '9px',
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
                          onClick={() => handleRowClick(workout)}
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

      {/* ── Detail Overlay ── */}
      {detailWorkout && (
        <div
          className={`home-detail-overlay ${detailPhase === 'leaving' ? 'closing' : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
        >
          <div
            ref={panelRef}
            className="home-detail-panel"
          >
            {/* Content fades in after expand, fades out before collapse */}
            <div className={`home-detail-content ${contentVisible ? 'visible' : ''}`}>
              {/* Header */}
              <div className="home-detail-header">
                <div className="home-detail-creator">
                  {isDefaultWorkout ? (
                    <img src={process.env.PUBLIC_URL + '/logo192.png'} alt="" className="home-detail-creator-icon home-detail-app-icon" />
                  ) : user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="home-detail-creator-icon" />
                  ) : (
                    <div className="home-detail-creator-icon home-detail-user-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="home-detail-header-actions">
                  <button className="home-detail-edit-btn" onClick={handleEditToggle}>
                    {isEditing ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                      </svg>
                    )}
                  </button>
                  <button className="home-detail-close-btn" onClick={closeDetail}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="home-detail-name-section">
                {isEditing && isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); }}
                    className="home-detail-name-input"
                    autoFocus
                  />
                ) : (
                  <h2
                    className="home-detail-name"
                    onClick={() => { if (isEditing) setIsEditingTitle(true); }}
                  >
                    {isEditing ? editTitle : detailWorkout.name}
                  </h2>
                )}
              </div>

              {/* Rest time */}
              <div className="home-detail-rest">
                {isEditing ? (
                  <div className="home-detail-rest-stepper">
                    <span className="home-detail-rest-label">Rest</span>
                    <button
                      className="home-detail-stepper-btn"
                      onClick={() => handleRestTimeChange(-5)}
                      disabled={(editRestTime ?? globalRestTime) <= 0}
                    >-</button>
                    <span className="home-detail-rest-value">{editRestTime ?? globalRestTime}s</span>
                    <button
                      className="home-detail-stepper-btn"
                      onClick={() => handleRestTimeChange(5)}
                      disabled={(editRestTime ?? globalRestTime) >= 30}
                    >+</button>
                  </div>
                ) : (
                  <span className="home-detail-rest-display">
                    {displayRestTime}s rest between exercises
                  </span>
                )}
              </div>

              {/* Exercise list */}
              <div className="home-detail-exercises">
                {(isEditing ? editExercises : detailWorkout.exercises).map((exercise, index) => (
                  <div key={`${exercise}-${index}`} className={`home-detail-exercise ${isEditing ? 'editing' : ''}`}>
                    <span className="home-detail-exercise-num">{index + 1}</span>
                    <span className="home-detail-exercise-name">{exercise}</span>
                    {isEditing && (
                      <div className="home-detail-exercise-actions">
                        <button
                          className="home-detail-move-btn"
                          onClick={() => handleMoveExercise(index, 'up')}
                          disabled={index === 0}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="18 15 12 9 6 15"/>
                          </svg>
                        </button>
                        <button
                          className="home-detail-move-btn"
                          onClick={() => handleMoveExercise(index, 'down')}
                          disabled={index === editExercises.length - 1}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </button>
                        <button
                          className="home-detail-delete-btn"
                          onClick={() => handleDeleteExercise(index)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <button
                    className="home-detail-add-exercise"
                    onClick={() => setShowAddPopup(true)}
                  >
                    + Add Exercise
                  </button>
                )}
              </div>

              {/* Start button */}
              {!isEditing && (
                <button
                  className="home-detail-start-btn"
                  onClick={() => {
                    onStartWorkout(detailWorkout.name);
                    closeDetail();
                  }}
                >
                  Start Workout
                </button>
              )}
            </div>
          </div>

          {/* Add Exercise Popup */}
          {showAddPopup && (
            <div className="home-detail-add-popup">
              <div className="home-detail-popup-overlay" onClick={() => { setShowAddPopup(false); setNewExerciseName(''); }} />
              <div className="home-detail-popup-content">
                <h3>Add Exercise</h3>
                <input
                  type="text"
                  placeholder="Exercise name..."
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  onKeyDown={handleAddKeyDown}
                  autoFocus
                  className="home-detail-popup-input"
                />
                <div className="home-detail-popup-actions">
                  <button className="home-detail-popup-cancel" onClick={() => { setShowAddPopup(false); setNewExerciseName(''); }}>Cancel</button>
                  <button className="home-detail-popup-confirm" onClick={handleAddExercise}>Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
