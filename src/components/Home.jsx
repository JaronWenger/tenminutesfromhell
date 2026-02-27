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
  defaultWorkoutNames = [],
  onVisibilityToggle
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
  const [popupClosing, setPopupClosing] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [justAddedIndex, setJustAddedIndex] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState(Infinity);

  // Native exercise drag reorder (all visuals via direct DOM, no React re-renders during drag)
  const exerciseDragRef = useRef({ active: false, fromIndex: null, toIndex: null, rowHeight: 0 });
  const exerciseRowRefs = useRef([]);
  const pageOffsetRef = useRef(0);
  const rowHeightRef = useRef(34);
  const dragJustEndedRef = useRef(false);

  // Clear drag inline styles after React re-renders (before browser paint) to avoid flash
  useLayoutEffect(() => {
    if (!dragJustEndedRef.current) return;
    dragJustEndedRef.current = false;
    exerciseRowRefs.current.forEach((row) => {
      if (!row) return;
      const card = row.querySelector('.home-detail-exercise');
      if (!card) return;
      card.style.transform = '';
      card.style.transition = '';
      card.style.zIndex = '';
      card.style.position = '';
    });
  }, [editExercises]);

  const addBtnRef = useRef(null);
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
    setCurrentPage(0);
    setIsEditing(false);
    setEditExercises([...workout.exercises]);
    setEditTitle(workout.name);
    setEditRestTime(workout.restTime ?? null);
  }, []);

  // FLIP: after panel mounts at final position, snap to card rect then animate to final
  useLayoutEffect(() => {
    if (detailPhase !== 'entering' || !panelRef.current) return;

    // No source card (e.g. new workout) — skip FLIP, just open
    if (!detailRect) {
      setDetailPhase('open');
      return;
    }

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

  // Measure max available space for exercises and calculate perPage
  useEffect(() => {
    if (detailPhase !== 'open' || !panelRef.current) return;
    const measure = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const style = getComputedStyle(panel);
      const paddingV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const header = panel.querySelector('.home-detail-header');
      const meta = panel.querySelector('.home-detail-meta');
      const btn = panel.querySelector('.home-detail-start-btn');
      // Measure actual row height from first exercise, fallback to 34px
      const firstRow = panel.querySelector('.home-detail-exercise');
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 34;
      rowHeightRef.current = rowH;
      const fixedH = (header?.offsetHeight || 0) + 2
        + (meta?.offsetHeight || 0) + 4
        + (btn?.offsetHeight || 0) + 16; // exercises margin
      const maxPanelH = window.innerHeight - 80 - 90;
      const availableNoPag = maxPanelH - paddingV - fixedH;
      const fitWithout = Math.max(3, Math.floor(availableNoPag / rowH));
      const exercises = isEditing ? editExercises : (detailWorkout?.exercises || []);
      if (exercises.length <= fitWithout) {
        setPerPage(fitWithout);
      } else {
        // Need pagination — reserve 36px for the pagination bar
        const availableWithPag = availableNoPag - 36;
        setPerPage(Math.max(3, Math.floor(availableWithPag / rowH)));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [detailPhase, isEditing, editExercises, detailWorkout]);

  // Clamp currentPage when exercise count or perPage changes
  useEffect(() => {
    if (perPage === Infinity) return;
    const exercises = isEditing ? editExercises : (detailWorkout?.exercises || []);
    const total = Math.ceil(exercises.length / perPage);
    if (total > 0 && currentPage >= total) setCurrentPage(total - 1);
  }, [editExercises, detailWorkout, perPage, currentPage, isEditing]);

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

    // Recapture card rect (may have scrolled); for new workouts, animate back to add button
    const cardEl = detailWorkout.name ? cardRefs.current[detailWorkout.name] : null;
    const addEl = addBtnRef.current;
    const targetRect = cardEl ? cardEl.getBoundingClientRect() : (addEl ? addEl.getBoundingClientRect() : detailRect);

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
    onWorkoutSelect('timer', workout.name);
    openDetail(workout);
  };

  const handleAddWorkout = () => {
    const newWorkout = { name: '', type: 'timer', exercises: [], isNew: true };
    const rect = addBtnRef.current ? addBtnRef.current.getBoundingClientRect() : null;
    setDetailWorkout(newWorkout);
    setDetailRect(rect);
    setDetailPhase('entering');
    setCurrentPage(0);
    setIsEditing(true);
    setIsEditingTitle(true);
    setEditExercises([]);
    setEditTitle('');
    setEditRestTime(null);
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

  // Native touch/pointer drag for exercise reorder (100% DOM manipulation, zero React re-renders during drag)
  const handleExerciseDragStart = useCallback((index, e, offset = 0) => {
    if (e.target.closest('.home-detail-delete-btn')) return;

    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    let isDragging = false;
    const draggedRow = exerciseRowRefs.current[index];
    const draggedCard = draggedRow?.querySelector('.home-detail-exercise');
    const rowH = draggedRow ? draggedRow.getBoundingClientRect().height : 40;

    // Capture original midpoints before any transforms are applied
    const originalMids = exerciseRowRefs.current.map((el) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });

    exerciseDragRef.current = { active: false, fromIndex: index, toIndex: index, rowHeight: rowH };

    // Shift non-dragged exercise cards via direct DOM manipulation (numbers stay static)
    const applyShifts = (fromIdx, toIdx) => {
      exerciseRowRefs.current.forEach((row, i) => {
        if (!row || i === fromIdx) return;
        const card = row.querySelector('.home-detail-exercise');
        if (!card) return;
        let shift = 0;
        if (fromIdx !== toIdx) {
          if (fromIdx < toIdx && i > fromIdx && i <= toIdx) shift = -rowH;
          else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) shift = rowH;
        }
        card.style.transform = `translateY(${shift}px)`;
        card.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
      });
    };

    const handleMove = (ev) => {
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const deltaY = Math.abs(y - startY);

      if (!isDragging && deltaY > 8) {
        isDragging = true;
        exerciseDragRef.current.active = true;
        if (draggedCard) {
          draggedCard.classList.add('exercise-dragging-card');
          draggedCard.style.zIndex = '10';
          draggedCard.style.position = 'relative';
        }
        if (navigator.vibrate) navigator.vibrate(30);
      }

      if (isDragging) {
        if (ev.cancelable) ev.preventDefault();
        // Move dragged card via DOM (follows finger), number stays put
        if (draggedCard) {
          draggedCard.style.transform = `translateY(${y - startY}px) scale(1.03)`;
        }
        // Use original (pre-transform) midpoints for closest-target detection
        let closest = index;
        let closestDist = Infinity;
        originalMids.forEach((mid, i) => {
          const dist = Math.abs(y - mid);
          if (dist < closestDist) { closestDist = dist; closest = i; }
        });
        if (closest !== exerciseDragRef.current.toIndex) {
          exerciseDragRef.current.toIndex = closest;
          applyShifts(index, closest);
        }
      }
    };

    const handleEnd = () => {
      // Remove the lifted look from the dragged card
      if (draggedCard) draggedCard.classList.remove('exercise-dragging-card');

      if (isDragging) {
        const { fromIndex, toIndex } = exerciseDragRef.current;
        if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
          // Reorder happened — keep inline styles so items stay in place visually.
          // useLayoutEffect will clear them after React re-renders (before paint).
          dragJustEndedRef.current = true;
          const actualFrom = offset + fromIndex;
          const actualTo = offset + toIndex;
          setEditExercises(prev => {
            const next = [...prev];
            const [moved] = next.splice(actualFrom, 1);
            next.splice(actualTo, 0, moved);
            return next;
          });
          setSelectedExerciseIndex(prev => {
            if (prev === null) return null;
            if (prev === actualFrom) return actualTo;
            if (actualFrom < prev && actualTo >= prev) return prev - 1;
            if (actualFrom > prev && actualTo <= prev) return prev + 1;
            return prev;
          });
        } else {
          // No reorder (dropped in same spot) — clear card styles immediately
          exerciseRowRefs.current.forEach((row) => {
            if (!row) return;
            const card = row.querySelector('.home-detail-exercise');
            if (!card) return;
            card.style.transform = '';
            card.style.transition = '';
            card.style.zIndex = '';
            card.style.position = '';
          });
        }
      }
      exerciseDragRef.current = { active: false, fromIndex: null, toIndex: null, rowHeight: 0 };
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };

    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
  }, []);

  // Dismiss swipe when tapping outside
  useEffect(() => {
    if (swipingIndex === null) return;
    const handleOutsideTap = (e) => {
      const wrapper = cardRefs.current[timerWorkoutData[swipingIndex]?.name];
      if (wrapper && !wrapper.contains(e.target)) {
        setSwipingIndex(null);
        setSwipeOffset(0);
      }
    };
    document.addEventListener('touchstart', handleOutsideTap);
    document.addEventListener('mousedown', handleOutsideTap);
    return () => {
      document.removeEventListener('touchstart', handleOutsideTap);
      document.removeEventListener('mousedown', handleOutsideTap);
    };
  }, [swipingIndex, timerWorkoutData]);

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

  const isNewWorkout = detailWorkout?.isNew;

  // Unlock panel height whenever we leave edit mode
  useLayoutEffect(() => {
    if (!isEditing && panelRef.current) {
      panelRef.current.style.height = '';
    }
  }, [isEditing]);

  // ── Editing handlers ──
  const handleEditToggle = () => {
    if (isEditing) {
      if (!editTitle.trim() || (isNewWorkout && editExercises.length === 0)) return;
      handleSave();
    } else {
      // Lock panel height before entering edit mode so pagination doesn't resize it
      if (panelRef.current) panelRef.current.style.height = panelRef.current.offsetHeight + 'px';
    }
    setIsEditing(!isEditing);
    setCurrentPage(0);
    setIsEditingTitle(false);
    setShowAddPopup(false);
    setSelectedExerciseIndex(null);
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

  const handleDeleteExercise = (actualIndex) => {
    const localIndex = actualIndex - pageOffsetRef.current;
    const row = exerciseRowRefs.current[localIndex];
    if (row) {
      row.classList.add('exercise-removing');
      setTimeout(() => {
        setEditExercises(prev => prev.filter((_, i) => i !== actualIndex));
        if (selectedExerciseIndex === actualIndex) setSelectedExerciseIndex(null);
        else if (selectedExerciseIndex !== null && actualIndex < selectedExerciseIndex) setSelectedExerciseIndex(selectedExerciseIndex - 1);
      }, 250);
    } else {
      setEditExercises(prev => prev.filter((_, i) => i !== actualIndex));
      if (selectedExerciseIndex === actualIndex) setSelectedExerciseIndex(null);
      else if (selectedExerciseIndex !== null && actualIndex < selectedExerciseIndex) setSelectedExerciseIndex(selectedExerciseIndex - 1);
    }
  };

  const closeAddPopup = useCallback(() => {
    if (popupClosing) return;
    setPopupClosing(true);
    setTimeout(() => {
      setShowAddPopup(false);
      setPopupClosing(false);
      setNewExerciseName('');
      setEditingExerciseIndex(null);
    }, 200);
  }, [popupClosing]);

  const handleAddExercise = () => {
    if (newExerciseName.trim()) {
      if (editingExerciseIndex !== null) {
        setEditExercises(prev => prev.map((ex, i) => i === editingExerciseIndex ? newExerciseName.trim() : ex));
      } else {
        const newIndex = editExercises.length;
        setEditExercises(prev => [...prev, newExerciseName.trim()]);
        setJustAddedIndex(newIndex);
        setTimeout(() => setJustAddedIndex(null), 350);
        if (perPage !== Infinity) {
          setCurrentPage(Math.ceil((editExercises.length + 1) / perPage) - 1);
        }
      }
      setNewExerciseName('');
      setEditingExerciseIndex(null);
      setPopupClosing(true);
      setTimeout(() => {
        setShowAddPopup(false);
        setPopupClosing(false);
      }, 200);
    }
  };

  const handleAddKeyDown = (e) => {
    if (e.key === 'Enter') handleAddExercise();
    else if (e.key === 'Escape') closeAddPopup();
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
        if (!editTitle.trim()) return;
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

  // Pagination computations (clamp page at render time so UI never shows empty)
  const activeExercises = isEditing ? editExercises : (detailWorkout?.exercises || []);
  const effectivePerPage = (!isEditing || perPage === Infinity) ? activeExercises.length : perPage;
  const totalPages = effectivePerPage > 0 ? Math.max(1, Math.ceil(activeExercises.length / effectivePerPage)) : 1;
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
  const pageOffset = safePage * effectivePerPage;
  const pageExercises = activeExercises.slice(pageOffset, pageOffset + effectivePerPage);
  pageOffsetRef.current = pageOffset;

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
        <Droppable droppableId="home-workouts" direction="vertical" isDropDisabled={!!detailWorkout}>
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/>
                              <path d="M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}

              {user && (
                <div ref={addBtnRef} className="workout-card-add" onClick={handleAddWorkout}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span>New Workout</span>
                </div>
              )}
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
              {/* Title row: icon + name + edit/close */}
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
                <div className="home-detail-title-group">
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
                  {user && !isDefaultWorkout && !(isEditing && isEditingTitle) && (
                    <button
                      className="home-detail-visibility-btn"
                      onClick={() => {
                        const newVal = !detailWorkout.isPublic;
                        onVisibilityToggle(detailWorkout.name, newVal);
                        setDetailWorkout(prev => ({ ...prev, isPublic: newVal }));
                      }}
                    >
                      <span className={`home-detail-visibility-icon ${detailWorkout.isPublic ? 'hidden' : ''}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </span>
                      <span className={`home-detail-visibility-icon ${detailWorkout.isPublic ? '' : 'hidden'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
                        </svg>
                      </span>
                    </button>
                  )}
                </div>
                <div className="home-detail-header-actions">
                  {user && (
                    <button
                      className="home-detail-edit-btn"
                      onClick={handleEditToggle}
                      disabled={isEditing && (!editTitle.trim() || (isNewWorkout && editExercises.length === 0))}
                    >
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
                  )}
                  <button className="home-detail-close-btn" onClick={() => { if (isEditing) { if (isNewWorkout) { closeDetail(); } else { handleSave(); setIsEditing(false); setIsEditingTitle(false); setShowAddPopup(false); setSelectedExerciseIndex(null); } } else { closeDetail(); } }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Stats + Rest time — fixed height, crossfade between view/edit */}
              <div className="home-detail-meta">
                <div className={`home-detail-meta-view ${isEditing ? 'hidden' : ''}`}>
                  <div className="home-detail-stats">
                    <span>{formatTime((detailWorkout.exercises.length * 60) + prepTime)}</span>
                    <span className="home-detail-stats-dot">&middot;</span>
                    <span>{detailWorkout.exercises.length} exercises</span>
                  </div>
                  <span className="home-detail-rest-display">
                    {displayRestTime}s rest between exercises
                  </span>
                </div>
                <div className={`home-detail-meta-edit ${isEditing ? '' : 'hidden'}`}>
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
                </div>
              </div>

              {/* Exercise list */}
              {isEditing ? (
                <div className="home-detail-exercises editing">
                  {pageExercises.map((exercise, localIndex) => {
                      const actualIndex = pageOffset + localIndex;
                      return (
                        <div
                          key={`ex-${actualIndex}`}
                          ref={(el) => { exerciseRowRefs.current[localIndex] = el; }}
                          className={`home-detail-exercise-row${actualIndex === justAddedIndex ? ' exercise-just-added' : ''}`}
                          onTouchStart={(e) => handleExerciseDragStart(localIndex, e, pageOffset)}
                          onMouseDown={(e) => handleExerciseDragStart(localIndex, e, pageOffset)}
                        >
                          <span className="home-detail-exercise-num">{actualIndex + 1}</span>
                          <div
                            className={`home-detail-exercise${selectedExerciseIndex === actualIndex ? ' selected' : ''}`}
                            onClick={() => {
                              setEditingExerciseIndex(actualIndex);
                              setNewExerciseName(exercise);
                              setShowAddPopup(true);
                            }}
                          >
                            <span className="home-detail-exercise-name">{exercise}</span>
                            <button
                              className="home-detail-duplicate-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const insertAt = actualIndex + 1;
                                setEditExercises(prev => [...prev.slice(0, insertAt), exercise, ...prev.slice(insertAt)]);
                                setJustAddedIndex(insertAt);
                                setTimeout(() => setJustAddedIndex(null), 350);
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                            <button
                              className="home-detail-delete-btn"
                              onClick={(e) => { e.stopPropagation(); handleDeleteExercise(actualIndex); }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                  })}
                </div>
              ) : (
                <div className="home-detail-exercises">
                  {pageExercises.map((exercise, localIndex) => {
                    const actualIndex = pageOffset + localIndex;
                    return (
                      <div key={`${exercise}-${actualIndex}`} className="home-detail-exercise">
                        <span className="home-detail-exercise-num">{actualIndex + 1}</span>
                        <span className="home-detail-exercise-name">{exercise}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="home-detail-pagination">
                  <button
                    className="home-detail-pagination-arrow"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <div className="home-detail-pagination-dots">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <div
                        key={i}
                        className={`home-detail-pagination-dot${i === safePage ? ' active' : ''}`}
                        onClick={() => setCurrentPage(i)}
                      />
                    ))}
                  </div>
                  <button
                    className="home-detail-pagination-arrow"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              )}

              {/* Bottom button */}
              <button
                className="home-detail-start-btn"
                onClick={() => {
                  if (isEditing) {
                    if (isNewWorkout && !editTitle.trim()) {
                      setEditTitle('My Workout');
                      setIsEditingTitle(false);
                    }
                    setEditingExerciseIndex(null);
                    setNewExerciseName('');
                    setShowAddPopup(true);
                  } else {
                    onStartWorkout(detailWorkout.name);
                    closeDetail();
                  }
                }}
              >
                {isEditing ? 'Add Exercise' : 'Start Workout'}
              </button>
            </div>
          </div>

          {/* Add Exercise Popup */}
          {showAddPopup && (
            <div className={`home-detail-add-popup ${popupClosing ? 'closing' : ''}`}>
              <div className="home-detail-popup-overlay" onClick={closeAddPopup} />
              <div className="home-detail-popup-content">
                <h3>{editingExerciseIndex !== null ? 'Edit Exercise' : 'Add Exercise'}</h3>
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
                  <button className="home-detail-popup-cancel" onClick={closeAddPopup}>Cancel</button>
                  <button className="home-detail-popup-confirm" onClick={handleAddExercise}>{editingExerciseIndex !== null ? 'Save' : 'Add'}</button>
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
