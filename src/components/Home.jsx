import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './Home.css';
import Sparks from '../assets/SPARKS.gif';
import AuthButton from './AuthButton';
import { useAuth } from '../contexts/AuthContext';


const PRESET_TAGS = ['Full Body', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Arms', 'Core', 'Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'];

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
  onVisibilityToggle,
  requestCloseDetail = false,
  showCardPhotos = true
}) => {
  const { user } = useAuth();
  const [swipingIndex, setSwipingIndex] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [cardMenuIndex, setCardMenuIndex] = useState(null);

  // Detail overlay state
  const [detailWorkout, setDetailWorkout] = useState(null);
  const [detailRect, setDetailRect] = useState(null);
  const [detailPhase, setDetailPhase] = useState(null); // null | 'entering' | 'open' | 'leaving'
  const [isEditing, setIsEditing] = useState(false);

  // Editing state
  const [editExercises, setEditExercises] = useState([]);
  const editHistoryRef = useRef([]);
  const editFutureRef = useRef([]);
  const isUndoRedoRef = useRef(false);
  const prevExercisesRef = useRef(null);
  const [, forceHistoryUpdate] = useState(0);
  const [editTitle, setEditTitle] = useState('');
  const [editRestTime, setEditRestTime] = useState(null);
  const [editTags, setEditTags] = useState([]);
  const [showTagPopup, setShowTagPopup] = useState(false);
  const [tagPopupClosing, setTagPopupClosing] = useState(false);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [popupClosing, setPopupClosing] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [justAddedIndex, setJustAddedIndex] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(null);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmClosing, setDeleteConfirmClosing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMetrics, setViewMetrics] = useState(null); // { overhead, rowH, maxPanelH, paginationH }

  // Predict what the view-mode panel height would be for the current exercise count.
  // As exercises are added/removed in edit mode, the panel grows/shrinks to match view mode.
  // Only when exercises exceed max panel capacity does pagination kick in.
  const predictedPanelH = viewMetrics && isEditing
    ? Math.min(viewMetrics.overhead + editExercises.length * viewMetrics.rowH, viewMetrics.maxPanelH)
    : null;
  const perPage = (() => {
    if (!viewMetrics || !isEditing || predictedPanelH === null) return Infinity;
    const { overhead, rowH, paginationH } = viewMetrics;
    const exerciseArea = predictedPanelH - overhead;
    if (editExercises.length * rowH <= exerciseArea) return Infinity;
    return Math.max(3, Math.floor((exerciseArea - paginationH) / rowH));
  })();

  // Native exercise drag reorder (all visuals via direct DOM, no React re-renders during drag)
  const exerciseDragRef = useRef({ active: false, fromIndex: null, toIndex: null, rowHeight: 0 });
  const exerciseRowRefs = useRef([]);
  const pageOffsetRef = useRef(0);
  const dragJustEndedRef = useRef(false);
  const suppressExerciseClickRef = useRef(false);
  const edgeHoverTimerRef = useRef(null);
  const crossPageDragRef = useRef({ perPage: Infinity, totalPages: 1, currentPage: 0, exerciseCount: 0 });
  const dragMutableRef = useRef(null); // mutable drag state accessible across cross-page transitions
  const crossPagePendingRef = useRef(null); // signals DOM recapture needed after cross-page move

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

  // After cross-page drag transition: recapture DOM state so drag continues on the new page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!crossPagePendingRef.current) return;
    const { newLocalIndex, lastY } = crossPagePendingRef.current;
    crossPagePendingRef.current = null;

    const dm = dragMutableRef.current;
    if (!dm || !dm.isDragging) return;

    // Truncate refs to current page size to avoid stale elements from previous page
    const cpd = crossPageDragRef.current;
    const pageSize = Math.min(cpd.perPage, cpd.exerciseCount - cpd.currentPage * cpd.perPage);
    exerciseRowRefs.current.length = pageSize;

    // Recapture midpoints from new page's DOM elements
    dm.originalMids = exerciseRowRefs.current.map(el => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });

    // Recapture container bounds
    const container = exerciseRowRefs.current[0]?.parentElement;
    if (container) {
      const cr = container.getBoundingClientRect();
      dm.containerTop = cr.top;
      dm.containerBottom = cr.bottom;
    }

    dm.fromLocalIndex = newLocalIndex;
    dm.offset = pageOffsetRef.current;
    dm.edgeDirection = null;

    // Get new dragged card element on the target page
    const newRow = exerciseRowRefs.current[newLocalIndex];
    dm.draggedCard = newRow?.querySelector('.home-detail-exercise');

    if (dm.draggedCard) {
      // Set startY to the card's natural center so translateY moves it to the finger
      const cardRect = dm.draggedCard.getBoundingClientRect();
      dm.startY = cardRect.top + cardRect.height / 2;

      dm.draggedCard.classList.add('exercise-dragging-card');
      dm.draggedCard.style.zIndex = '10';
      dm.draggedCard.style.position = 'relative';
      // Immediately position the card at the finger
      dm.draggedCard.style.transform = `translateY(${lastY - dm.startY}px) scale(1.03)`;
    }

    // Reset drag tracking for the new page
    exerciseDragRef.current = {
      active: true,
      fromIndex: newLocalIndex,
      toIndex: newLocalIndex,
      rowHeight: dm.rowH,
    };
  }, [editExercises, currentPage]);

  const addBtnRef = useRef(null);
  const cardRefs = useRef({});
  const panelRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const swipeOffsetRef = useRef(0);
  const swipingIndexRef = useRef(null);
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
    setEditTags(workout.tags || (workout.tag ? [workout.tag] : []));
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

  // Measure view metrics for new workouts (no view mode to measure from).
  // Runs before paint so the user never sees the un-sized panel.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (detailPhase !== 'open' || !isEditing || viewMetrics || !panelRef.current) return;
    const panel = panelRef.current;
    const exercisesEl = panel.querySelector('.home-detail-exercises');
    const exercisesH = exercisesEl ? exercisesEl.getBoundingClientRect().height : 0;
    const overhead = panel.getBoundingClientRect().height - exercisesH;
    const firstExercise = panel.querySelector('.home-detail-exercise');
    const rowH = firstExercise ? firstExercise.getBoundingClientRect().height : 32;
    const overlayEl = panel.parentElement;
    const overlayCS = getComputedStyle(overlayEl);
    const maxPanelH = overlayEl.clientHeight
      - parseFloat(overlayCS.paddingTop)
      - parseFloat(overlayCS.paddingBottom);
    setViewMetrics({ overhead, rowH, maxPanelH, paginationH: 38 });
  }, [detailPhase, isEditing, viewMetrics]);

  // Update maxPanelH on window resize while in edit mode
  useEffect(() => {
    if (!isEditing || !viewMetrics) return;
    const handleResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const overlayEl = panel.parentElement;
      if (!overlayEl) return;
      const overlayCS = getComputedStyle(overlayEl);
      const maxPanelH = overlayEl.clientHeight
        - parseFloat(overlayCS.paddingTop)
        - parseFloat(overlayCS.paddingBottom);
      setViewMetrics(prev => prev ? { ...prev, maxPanelH } : null);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isEditing, viewMetrics]);

  // Clear viewMetrics when exiting edit mode
  useEffect(() => {
    if (!isEditing) setViewMetrics(null);
  }, [isEditing]);

  // Undo/redo history tracking for exercise edits
  useEffect(() => {
    if (!isEditing) {
      editHistoryRef.current = [];
      editFutureRef.current = [];
      prevExercisesRef.current = null;
      return;
    }
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      prevExercisesRef.current = editExercises;
      return;
    }
    if (prevExercisesRef.current !== null) {
      editHistoryRef.current.push(prevExercisesRef.current);
      editFutureRef.current = [];
      forceHistoryUpdate(c => c + 1);
    }
    prevExercisesRef.current = editExercises;
  }, [editExercises, isEditing]);

  const handleUndo = useCallback(() => {
    if (editHistoryRef.current.length === 0) return;
    isUndoRedoRef.current = true;
    editFutureRef.current.push(editExercises);
    const prev = editHistoryRef.current.pop();
    setEditExercises(prev);
    forceHistoryUpdate(c => c + 1);
  }, [editExercises]);

  const handleRedo = useCallback(() => {
    if (editFutureRef.current.length === 0) return;
    isUndoRedoRef.current = true;
    editHistoryRef.current.push(editExercises);
    const next = editFutureRef.current.pop();
    setEditExercises(next);
    forceHistoryUpdate(c => c + 1);
  }, [editExercises]);

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

  // Allow parent to close the detail overlay (e.g. tab bar tap)
  useEffect(() => {
    if (requestCloseDetail && detailWorkout) {
      closeDetail();
    }
  }, [requestCloseDetail]);

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
    setEditTags([]);
  };

  // ── react-beautiful-dnd ──
  const onDragStart = () => {
    setIsDragging(true);
    isDraggingRef.current = true;
    // Kill any in-progress swipe
    const card = swipeCardElRef.current;
    const wrapper = swipeWrapperElRef.current;
    if (card) { card.style.transform = ''; card.style.transition = ''; }
    if (wrapper) { wrapper.classList.remove('swipe-left', 'swipe-right', 'swipe-full'); }
    swipeTouchIndexRef.current = null;
    swipeCardElRef.current = null;
    swipeWrapperElRef.current = null;
    swipeOffsetRef.current = 0;
    swipingIndexRef.current = null;
    isSwiping.current = false;
    setSwipingIndex(null);
    setSwipeOffset(0);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const onDragEnd = (result) => {
    setIsDragging(false);
    isDraggingRef.current = false;
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const reordered = Array.from(timerWorkoutData);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorder(reordered);
  };

  // Native touch/pointer drag for exercise reorder (100% DOM manipulation, zero React re-renders during drag)
  // Uses dragMutableRef so state survives cross-page transitions while the drag continues.
  const handleExerciseDragStart = useCallback((index, e, offset = 0) => {
    if (e.target.closest('.home-detail-delete-btn')) return;

    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const draggedRow = exerciseRowRefs.current[index];
    const draggedCard = draggedRow?.querySelector('.home-detail-exercise');
    const rowH = draggedRow ? draggedRow.getBoundingClientRect().height : 40;

    const originalMids = exerciseRowRefs.current.map((el) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });

    const exerciseContainer = draggedRow?.parentElement;
    let containerTop = 0;
    let containerBottom = 0;
    if (exerciseContainer) {
      const cr = exerciseContainer.getBoundingClientRect();
      containerTop = cr.top;
      containerBottom = cr.bottom;
    }

    // Mutable drag state — updated by useLayoutEffect on cross-page transitions
    const dm = {
      isDragging: false,
      startY,
      fromLocalIndex: index,
      draggedCard,
      originalMids,
      containerTop,
      containerBottom,
      rowH,
      offset,
      edgeDirection: null,
      lastY: startY,
    };
    dragMutableRef.current = dm;
    exerciseDragRef.current = { active: false, fromIndex: index, toIndex: index, rowHeight: rowH };

    const applyShifts = (fromIdx, toIdx) => {
      exerciseRowRefs.current.forEach((row, i) => {
        if (!row || i === fromIdx) return;
        const card = row.querySelector('.home-detail-exercise');
        if (!card) return;
        let shift = 0;
        if (fromIdx !== toIdx) {
          if (fromIdx < toIdx && i > fromIdx && i <= toIdx) shift = -dm.rowH;
          else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) shift = dm.rowH;
        }
        card.style.transform = `translateY(${shift}px)`;
        card.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
      });
    };

    const clearEdgeTimer = () => {
      if (edgeHoverTimerRef.current) {
        clearTimeout(edgeHoverTimerRef.current);
        edgeHoverTimerRef.current = null;
      }
      dm.edgeDirection = null;
    };

    const performCrossPageDrag = (direction) => {
      const { perPage, totalPages, currentPage } = crossPageDragRef.current;
      if (totalPages <= 1) return;

      const targetPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
      if (targetPage < 0 || targetPage >= totalPages) return;

      const actualFrom = dm.offset + exerciseDragRef.current.fromIndex;
      // Next → first slot of target page; Prev → last slot of target page
      const insertAt = direction === 'next'
        ? targetPage * perPage
        : (targetPage + 1) * perPage - 1;
      const newLocalIndex = direction === 'next' ? 0 : perPage - 1;

      // Clean up current page's drag visuals
      if (dm.draggedCard) {
        dm.draggedCard.classList.remove('exercise-dragging-card');
        dm.draggedCard.style.transform = '';
        dm.draggedCard.style.transition = '';
        dm.draggedCard.style.zIndex = '';
        dm.draggedCard.style.position = '';
      }
      exerciseRowRefs.current.forEach((row) => {
        if (!row) return;
        const card = row.querySelector('.home-detail-exercise');
        if (!card) return;
        card.style.transform = '';
        card.style.transition = '';
        card.style.zIndex = '';
        card.style.position = '';
      });

      // Signal useLayoutEffect to recapture DOM after re-render
      crossPagePendingRef.current = { newLocalIndex, lastY: dm.lastY };

      // Move the exercise and change page (batched re-render)
      setEditExercises(prev => {
        const next = [...prev];
        const [moved] = next.splice(actualFrom, 1);
        next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, moved);
        return next;
      });
      setCurrentPage(targetPage);

      if (navigator.vibrate) navigator.vibrate(20);
      // Drag stays alive — listeners remain, useLayoutEffect will recapture DOM
    };

    const handleMove = (ev) => {
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      dm.lastY = y;
      const deltaY = Math.abs(y - dm.startY);

      if (!dm.isDragging && deltaY > 8) {
        dm.isDragging = true;
        exerciseDragRef.current.active = true;
        if (dm.draggedCard) {
          dm.draggedCard.classList.add('exercise-dragging-card');
          dm.draggedCard.style.zIndex = '10';
          dm.draggedCard.style.position = 'relative';
        }
        if (navigator.vibrate) navigator.vibrate(30);
      }

      if (dm.isDragging) {
        if (ev.cancelable) ev.preventDefault();
        if (dm.draggedCard) {
          dm.draggedCard.style.transform = `translateY(${y - dm.startY}px) scale(1.03)`;
        }

        let closest = dm.fromLocalIndex;
        let closestDist = Infinity;
        dm.originalMids.forEach((mid, i) => {
          const dist = Math.abs(y - mid);
          if (dist < closestDist) { closestDist = dist; closest = i; }
        });
        if (closest !== exerciseDragRef.current.toIndex) {
          exerciseDragRef.current.toIndex = closest;
          applyShifts(dm.fromLocalIndex, closest);
        }

        // Cross-page edge detection (vertical: top/bottom of container, horizontal: screen edges)
        const { totalPages, currentPage } = crossPageDragRef.current;
        if (totalPages > 1) {
          const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
          const edgeThreshold = dm.rowH * 0.75;
          const screenEdge = 30; // px from screen edge for horizontal trigger
          const nearTop = y < dm.containerTop + edgeThreshold && currentPage > 0;
          const nearBottom = y > dm.containerBottom - edgeThreshold && currentPage < totalPages - 1;
          const nearLeft = x < screenEdge && currentPage > 0;
          const nearRight = x > window.innerWidth - screenEdge && currentPage < totalPages - 1;
          const newDirection = (nearTop || nearLeft) ? 'prev' : (nearBottom || nearRight) ? 'next' : null;

          if (newDirection !== dm.edgeDirection) {
            clearEdgeTimer();
            if (newDirection) {
              dm.edgeDirection = newDirection;
              edgeHoverTimerRef.current = setTimeout(() => {
                performCrossPageDrag(newDirection);
              }, 800);
            }
          }
        }
      }
    };

    const handleEnd = () => {
      clearEdgeTimer();
      crossPagePendingRef.current = null;

      if (dm.draggedCard) dm.draggedCard.classList.remove('exercise-dragging-card');

      if (dm.isDragging) {
        suppressExerciseClickRef.current = true;
        setTimeout(() => { suppressExerciseClickRef.current = false; }, 50);

        const { fromIndex, toIndex } = exerciseDragRef.current;
        if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
          dragJustEndedRef.current = true;
          const actualFrom = dm.offset + fromIndex;
          const actualTo = dm.offset + toIndex;
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
      dragMutableRef.current = null;
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

  // Helper to reset swipe DOM + state
  const resetSwipeDom = useCallback((wrapper) => {
    if (!wrapper) return;
    const card = wrapper.querySelector('.workout-card');
    if (card) { card.style.transform = ''; card.style.transition = ''; }
    wrapper.classList.remove('swipe-left', 'swipe-right', 'swipe-full');
  }, []);

  const resetSwipe = useCallback(() => {
    if (swipingIndexRef.current !== null) {
      const workout = timerWorkoutData[swipingIndexRef.current];
      const wrapper = workout ? cardRefs.current[workout.name] : null;
      if (wrapper) resetSwipeDom(wrapper);
    }
    swipeOffsetRef.current = 0;
    swipingIndexRef.current = null;
    setSwipingIndex(null);
    setSwipeOffset(0);
  }, [timerWorkoutData, resetSwipeDom]);

  // Dismiss swipe when tapping outside
  useEffect(() => {
    if (swipingIndex === null) return;
    const handleOutsideTap = (e) => {
      const wrapper = cardRefs.current[timerWorkoutData[swipingIndex]?.name];
      if (wrapper && !wrapper.contains(e.target)) {
        resetSwipe();
      }
    };
    document.addEventListener('touchstart', handleOutsideTap);
    document.addEventListener('mousedown', handleOutsideTap);
    return () => {
      document.removeEventListener('touchstart', handleOutsideTap);
      document.removeEventListener('mousedown', handleOutsideTap);
    };
  }, [swipingIndex, timerWorkoutData]);

  // Dismiss card menu when clicking outside
  useEffect(() => {
    if (cardMenuIndex === null) return;
    const handleClick = (e) => {
      if (!e.target.closest('.workout-card-menu-popup') && !e.target.closest('.workout-card-menu-btn')) {
        setCardMenuIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [cardMenuIndex]);

  // ── Swipe touch handlers (mobile only, DOM-driven during gesture) ──
  const swipeTouchIndexRef = useRef(null);
  const swipeCardElRef = useRef(null);
  const swipeWrapperElRef = useRef(null);
  const swipeDirectionLocked = useRef(null); // 'horizontal' | 'vertical' | null

  const handleSwipeStart = (index, e) => {
    if (isDragging || !e.touches) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
    swipeTouchIndexRef.current = index;
    swipeDirectionLocked.current = null;
    // Grab DOM elements for direct manipulation
    const workout = timerWorkoutData[index];
    const wrapper = workout ? cardRefs.current[workout.name] : null;
    swipeWrapperElRef.current = wrapper;
    swipeCardElRef.current = wrapper ? wrapper.querySelector('.workout-card') : null;
  };

  // Attached via ref with { passive: false } so we can preventDefault to block scroll
  const handleSwipeMoveNonPassive = useCallback((e) => {
    if (!e.touches || swipeTouchIndexRef.current === null || isDraggingRef.current) return;
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const deltaX = clientX - touchStartX.current;
    const deltaY = clientY - touchStartY.current;

    // Lock direction on first significant movement
    if (!swipeDirectionLocked.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      swipeDirectionLocked.current = Math.abs(deltaX) >= Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (swipeDirectionLocked.current === 'vertical') return;

    e.preventDefault(); // Block scroll for horizontal swipe
    isSwiping.current = true;
    const clamped = Math.max(-80, Math.min(80, deltaX));
    swipeOffsetRef.current = clamped;

    // Direct DOM: only transform + wrapper class
    const card = swipeCardElRef.current;
    const wrapper = swipeWrapperElRef.current;
    if (card) card.style.transform = `translateX(${clamped}px)`;
    if (wrapper) {
      wrapper.classList.toggle('swipe-left', clamped < 0);
      wrapper.classList.toggle('swipe-right', clamped > 0);
      wrapper.classList.toggle('swipe-full', Math.abs(clamped) >= 80);
    }
  }, []);

  const handleSwipeEnd = () => {
    if (isDragging) return;
    swipeTouchIndexRef.current = null;
    swipeDirectionLocked.current = null;
    const card = swipeCardElRef.current;
    const wrapper = swipeWrapperElRef.current;

    // Always snap back to normal
    if (card) {
      card.style.transition = 'transform 0.25s ease';
      card.style.transform = 'translateX(0px)';
    }
    setTimeout(() => {
      if (card) { card.style.transform = ''; card.style.transition = ''; }
      if (wrapper) { wrapper.classList.remove('swipe-left', 'swipe-right', 'swipe-full'); }
    }, 260);

    swipeOffsetRef.current = 0;
    swipingIndexRef.current = null;
    setSwipingIndex(null);
    setSwipeOffset(0);
    swipeCardElRef.current = null;
    swipeWrapperElRef.current = null;
    setTimeout(() => { isSwiping.current = false; }, 50);
  };

  // Attach non-passive touchmove to the workout list so horizontal swipes beat scroll
  const workoutListElRef = useRef(null);
  const workoutListRef = useCallback((el) => {
    if (workoutListElRef.current) {
      workoutListElRef.current.removeEventListener('touchmove', handleSwipeMoveNonPassive);
    }
    workoutListElRef.current = el;
    if (el) {
      el.addEventListener('touchmove', handleSwipeMoveNonPassive, { passive: false });
    }
  }, [handleSwipeMoveNonPassive]);

  const handleDelete = (workoutName) => {
    resetSwipe();
    onDeleteWorkout(workoutName);
  };

  const isNewWorkout = detailWorkout?.isNew;

  // ── Editing handlers ──
  const handleEditToggle = () => {
    if (isEditing) {
      if (!editTitle.trim() || (isNewWorkout && editExercises.length === 0)) return;
      handleSave();
    } else {
      // Measure view-mode metrics so edit mode can predict panel size
      const panel = panelRef.current;
      if (panel) {
        const exercisesEl = panel.querySelector('.home-detail-exercises');
        const exercisesH = exercisesEl ? exercisesEl.getBoundingClientRect().height : 0;
        const overhead = panel.getBoundingClientRect().height - exercisesH;
        const firstExercise = panel.querySelector('.home-detail-exercise');
        const rowH = firstExercise ? firstExercise.getBoundingClientRect().height : 32;
        const overlayEl = panel.parentElement;
        const overlayCS = getComputedStyle(overlayEl);
        const maxPanelH = overlayEl.clientHeight
          - parseFloat(overlayCS.paddingTop)
          - parseFloat(overlayCS.paddingBottom);
        setViewMetrics({ overhead, rowH, maxPanelH, paginationH: 38 });
      }
    }
    setIsEditing(!isEditing);
    setCurrentPage(0);
    setIsEditingTitle(false);
    setShowAddPopup(false);
    setSelectedExerciseIndex(null);
  };

  const handleSave = () => {
    if (!detailWorkout) return;
    onDetailSave(detailWorkout.name, editExercises, editTitle, editRestTime, editTags);
    setDetailWorkout(prev => ({
      ...prev,
      name: editTitle,
      exercises: [...editExercises],
      restTime: editRestTime,
      tags: [...editTags]
    }));
  };

  const handleDeleteExercise = (actualIndex) => {
    setEditExercises(prev => prev.filter((_, i) => i !== actualIndex));
    if (selectedExerciseIndex === actualIndex) setSelectedExerciseIndex(null);
    else if (selectedExerciseIndex !== null && actualIndex < selectedExerciseIndex) setSelectedExerciseIndex(selectedExerciseIndex - 1);
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
        // Don't dismiss if tapping a check/save button — let its onClick handle it
        if (e.target.closest('.home-detail-edit-btn') || e.target.closest('.home-detail-save-circle') || e.target.closest('.home-detail-start-btn')) return;
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
  crossPageDragRef.current = { perPage: effectivePerPage, totalPages, currentPage: safePage, exerciseCount: activeExercises.length };

  return (
    <div className={`home-container ${detailWorkout && detailPhase !== 'leaving' ? 'home-detail-open' : ''} ${isDragging ? 'home-reordering' : ''}`}>
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
              ref={(el) => { provided.innerRef(el); workoutListRef(el); }}
              className="home-workout-list"
            >
              {timerWorkoutData.map((workout, index) => {
                const totalSeconds = (workout.exercises.length * 60) + prepTime;
                const completions = getCompletionCount(workout.name);
                const isSelected = timerSelectedWorkout === workout.name;
                const isSwipeActive = swipingIndex === index;

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
                        className="workout-card-wrapper"
                        style={{
                          ...provided.draggableProps.style,
                          marginBottom: '9px',
                          padding: 0
                        }}
                      >
                        <div
                          className={`workout-card ${isSelected ? 'selected' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                          onClick={() => handleRowClick(workout)}
                          onTouchStart={(e) => handleSwipeStart(index, e)}
                          onTouchEnd={() => handleSwipeEnd()}
                        >
                          {showCardPhotos && (
                            defaultWorkoutNames.includes(workout.name) ? (
                              <img src={process.env.PUBLIC_URL + '/logo192.png'} alt="" className="workout-card-avatar" />
                            ) : user?.photoURL ? (
                              <img src={user.photoURL} alt="" className="workout-card-avatar" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="workout-card-avatar workout-card-avatar-fallback">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                              </div>
                            )
                          )}
                          <div className="workout-card-left">
                            <div className="workout-card-name-row">
                              <span className="workout-card-name">{workout.name}</span>
                              {(workout.tags || (workout.tag ? [workout.tag] : [])).map(t => (
                                <span key={t} className="workout-card-tag">{t.toUpperCase()}</span>
                              ))}
                            </div>
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
                          {/* Mobile start button */}
                          <button
                            className="workout-card-start-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartWorkout(workout.name);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          </button>
                          {/* Desktop 3-dot menu */}
                          <button
                            className="workout-card-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardMenuIndex(cardMenuIndex === index ? null : index);
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2"/>
                              <circle cx="12" cy="12" r="2"/>
                              <circle cx="12" cy="19" r="2"/>
                            </svg>
                          </button>
                        </div>
                        {/* Desktop menu popup */}
                        {cardMenuIndex === index && (
                          <div className="workout-card-menu-popup">
                            <button
                              className="workout-card-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardMenuIndex(null);
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                                <polyline points="16 6 12 2 8 6"/>
                                <line x1="12" y1="2" x2="12" y2="15"/>
                              </svg>
                              Share
                            </button>
                            <button
                              className="workout-card-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardMenuIndex(null);
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              Schedule
                            </button>
                            <button
                              className="workout-card-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardMenuIndex(null);
                                onStartWorkout(workout.name);
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              Start
                            </button>
                          </div>
                        )}
                        {/* Mobile swipe actions (hidden by CSS, shown via swipe-left/swipe-right class on wrapper) */}
                        <div className="workout-card-action workout-card-action-left">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        </div>
                        <div className="workout-card-action workout-card-action-right">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                            <polyline points="16 6 12 2 8 6"/>
                            <line x1="12" y1="2" x2="12" y2="15"/>
                          </svg>
                        </div>
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
            style={predictedPanelH !== null ? { height: predictedPanelH } : undefined}
          >
            {/* Content fades in after expand, fades out before collapse */}
            <div className={`home-detail-content ${contentVisible ? 'visible' : ''}`}>
              {/* Header: icon + (title / tags) + actions */}
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
                <div className={`home-detail-title-group ${(isEditing ? editTags.length > 0 : (detailWorkout.tags || (detailWorkout.tag ? [detailWorkout.tag] : [])).length > 0) ? 'has-tags' : ''}`}>
                  {isEditing && isEditingTitle ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { setIsEditingTitle(false); e.target.blur(); } }}
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
                  {/* Tags at bottom of title group */}
                  {(() => {
                    const viewTags = detailWorkout.tags || (detailWorkout.tag ? [detailWorkout.tag] : []);
                    const showTags = (isEditing && !isEditingTitle) || viewTags.length > 0;
                    return showTags ? (
                      <div className="home-detail-tags-row">
                        {isEditing ? (
                          editTags.map(t => (
                            <span
                              key={t}
                              className="home-detail-tag-pill editable"
                              onClick={() => setEditTags(prev => prev.filter(x => x !== t))}
                            >
                              {t.toUpperCase()} &times;
                            </span>
                          ))
                        ) : (
                          viewTags.map(t => (
                            <span key={t} className="home-detail-tag-pill">{t.toUpperCase()}</span>
                          ))
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="home-detail-header-actions">
                  {user && (
                    <button
                      className="home-detail-edit-btn"
                      onClick={() => { if (isEditingTitle) { setIsEditingTitle(false); } else { handleEditToggle(); } }}
                      disabled={isEditing && !isEditingTitle && (!editTitle.trim() || (isNewWorkout && editExercises.length === 0))}
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

              {/* Stats + Rest time — crossfade between view/edit */}
              <div className="home-detail-meta">
                <div className={`home-detail-meta-view ${isEditing ? 'hidden' : ''}`}>
                  <div className="home-detail-meta-view-left">
                    <div className="home-detail-stats">
                      <span>{formatTime((detailWorkout.exercises.length * 60) + prepTime)}</span>
                      <span className="home-detail-stats-dot">&middot;</span>
                      <span>{detailWorkout.exercises.length} exercises</span>
                    </div>
                    <span className="home-detail-rest-display">
                      {displayRestTime}s rest between exercises
                    </span>
                  </div>
                  {user && !isDefaultWorkout && (
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
                <div className={`home-detail-meta-edit ${isEditing ? '' : 'hidden'}`}>
                  <span
                    className="home-detail-add-tag-btn"
                    onClick={() => setShowTagPopup(true)}
                  >
                    + Tag
                  </span>
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
                <div
                  className="home-detail-exercises editing"
                >
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
                              if (suppressExerciseClickRef.current) return;
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
              {isEditing ? (
                <div className="home-detail-bottom-row">
                  {editHistoryRef.current.length > 0 ? (
                    <div className="home-detail-undo-redo">
                      <button
                        className="home-detail-undo-btn"
                        onClick={handleUndo}
                        disabled={editHistoryRef.current.length === 0}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10"/>
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                      </button>
                      <button
                        className="home-detail-redo-btn"
                        onClick={handleRedo}
                        disabled={editFutureRef.current.length === 0}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10"/>
                          <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
                        </svg>
                      </button>
                    </div>
                  ) : !isDefaultWorkout && !isNewWorkout ? (
                    <button
                      className="home-detail-delete-workout-btn"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  ) : (
                    <div className="home-detail-undo-redo" />
                  )}
                  <button
                    className="home-detail-start-btn"
                    onClick={() => {
                      if (isNewWorkout && !editTitle.trim()) {
                        setEditTitle('My Workout');
                      }
                      setIsEditingTitle(false);
                      setEditingExerciseIndex(null);
                      setNewExerciseName('');
                      setShowAddPopup(true);
                    }}
                  >
                    Add Exercise
                  </button>
                  <button
                    className="home-detail-save-circle"
                    onClick={() => { if (isEditingTitle) { setIsEditingTitle(false); } else { handleEditToggle(); } }}
                    disabled={!editTitle.trim() || (isNewWorkout && editExercises.length === 0)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="home-detail-bottom-row" onClick={closeDetail}>
                  <button
                    className="home-detail-start-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartWorkout(detailWorkout.name);
                      closeDetail();
                    }}
                  >
                    Start Workout
                  </button>
                </div>
              )}
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

          {/* Tag Picker Popup */}
          {showTagPopup && (
            <div className={`home-detail-add-popup ${tagPopupClosing ? 'closing' : ''}`}>
              <div className="home-detail-popup-overlay" onClick={() => {
                setTagPopupClosing(true);
                setTimeout(() => { setShowTagPopup(false); setTagPopupClosing(false); }, 200);
              }} />
              <div className="home-detail-tag-popup-content">
                <div className="home-detail-tag-picker">
                  {PRESET_TAGS.map(tag => (
                    <button
                      key={tag}
                      className={`home-detail-tag-option ${editTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => {
                        setEditTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        );
                        setTagPopupClosing(true);
                        setTimeout(() => { setShowTagPopup(false); setTagPopupClosing(false); }, 200);
                      }}
                    >
                      {tag.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Delete Workout Confirmation */}
          {showDeleteConfirm && (
            <div className={`home-detail-delete-confirm ${deleteConfirmClosing ? 'closing' : ''}`}>
              <div
                className="home-detail-delete-confirm-backdrop"
                onClick={() => {
                  setDeleteConfirmClosing(true);
                  setTimeout(() => { setShowDeleteConfirm(false); setDeleteConfirmClosing(false); }, 150);
                }}
              />
              <div className="home-detail-delete-confirm-box">
                <p className="home-detail-delete-confirm-title">Delete Workout?</p>
                <p className="home-detail-delete-confirm-msg">This can't be undone.</p>
                <div className="home-detail-delete-confirm-actions">
                  <button
                    className="home-detail-delete-confirm-cancel"
                    onClick={() => {
                      setDeleteConfirmClosing(true);
                      setTimeout(() => { setShowDeleteConfirm(false); setDeleteConfirmClosing(false); }, 150);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="home-detail-delete-confirm-delete"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmClosing(false);
                      onDeleteWorkout(detailWorkout.name);
                      closeDetail();
                    }}
                  >
                    Delete
                  </button>
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
