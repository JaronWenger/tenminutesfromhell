import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './ExerciseEditPage.css';

const ExerciseEditPage = ({ workoutName, exercises, onSave, onBack, workoutType, onStart }) => {
  const [localExercises, setLocalExercises] = useState([...exercises]);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(workoutName);
  // Track the last saved state to compare against
  const [lastSavedExercises, setLastSavedExercises] = useState([...exercises]);
  const [lastSavedTitle, setLastSavedTitle] = useState(workoutName);
  // Ref for the title input to detect clicks outside
  const titleInputRef = useRef(null);

  // Check if there are changes compared to last saved state
  useEffect(() => {
    const hasChangesMade = JSON.stringify(localExercises) !== JSON.stringify(lastSavedExercises) || editedTitle !== lastSavedTitle;
    setHasChanges(hasChangesMade);
  }, [localExercises, lastSavedExercises, editedTitle, lastSavedTitle]);

  // Handle clicks outside the title input to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isEditingTitle && titleInputRef.current && !titleInputRef.current.contains(event.target)) {
        setIsEditingTitle(false);
      }
    };

    if (isEditingTitle) {
      // Add event listener when editing
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isEditingTitle]);

  const handleAddExercise = () => {
    setShowAddPopup(true);
  };

  const handleSubmitNewExercise = () => {
    if (newExerciseName.trim()) {
      setLocalExercises([...localExercises, newExerciseName.trim()]);
      setNewExerciseName('');
      setShowAddPopup(false);
    }
  };

  const handleCancelAdd = () => {
    setNewExerciseName('');
    setShowAddPopup(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmitNewExercise();
    } else if (e.key === 'Escape') {
      handleCancelAdd();
    }
  };

  const handleDeleteExercise = (index) => {
    const newExercises = localExercises.filter((_, i) => i !== index);
    setLocalExercises(newExercises);
  };

  const handleSave = () => {
    if (hasChanges || editedTitle !== lastSavedTitle) {
      onSave(localExercises, editedTitle);
      // Update the last saved state to match current state
      setLastSavedExercises([...localExercises]);
      setLastSavedTitle(editedTitle);
      // This will make hasChanges become false on next render
    }
  };

  const handleButtonClick = () => {
    if (hasChanges || editedTitle !== lastSavedTitle) {
      // Save changes but stay on the page - DO NOT navigate
      handleSave();
      // Don't call onStart - just save and let the button change to "Start"
    } else {
      // No changes, navigate to tab
      if (onStart) {
        onStart();
      }
    }
  };

  const handleTitleDoubleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleClick = (e) => {
    // On mobile/touch devices, allow single tap to edit
    // On desktop, only double-click works (this handler won't interfere)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      // This is a touch device - allow single tap
      setIsEditingTitle(true);
    }
    // On desktop, do nothing here - let onDoubleClick handle it
  };

  const handleTitleChange = (e) => {
    setEditedTitle(e.target.value);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setIsEditingTitle(false);
    } else if (e.key === 'Escape') {
      setEditedTitle(workoutName);
      setIsEditingTitle(false);
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(localExercises);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setLocalExercises(items);
  };

  return (
    <div className="exercise-edit-container">
      <div className="exercise-edit-header">
        <button className="close-button" onClick={onBack}>
          <span className="close-icon">×</span>
        </button>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editedTitle}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleTitleBlur}
            className="exercise-edit-title-input"
            autoFocus
          />
        ) : (
          <h1 
            className="exercise-edit-title" 
            onClick={handleTitleClick}
            onDoubleClick={handleTitleDoubleClick}
          >
            {editedTitle}
          </h1>
        )}
      </div>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="exercises" direction="vertical">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="exercises-list"
            >
              {localExercises.map((exercise, index) => (
                <Draggable 
                  key={`${exercise}-${index}`} 
                  draggableId={`${exercise}-${index}`} 
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`exercise-item ${snapshot.isDragging ? 'dragging' : ''}`}
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.8 : 1,
                        margin: 0,
                        padding: 0
                      }}
                    >
                      <div className="exercise-number">{index + 1}</div>
                      <div className="exercise-name">{exercise}</div>
                      <button 
                        className="delete-exercise-btn"
                        onClick={() => handleDeleteExercise(index)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      <div className="exercise-edit-actions">
        <button className="add-exercise-btn" onClick={handleAddExercise}>
          + Add Exercise
        </button>
        <button 
          className="save-btn"
          onClick={handleButtonClick}
        >
          {hasChanges ? 'Save Changes' : 'Start'}
        </button>
      </div>

      {/* Add Exercise Popup */}
      {showAddPopup && (
        <div className="add-exercise-popup">
          <div className="popup-overlay" onClick={handleCancelAdd}></div>
          <div className="popup-content">
            <h3>Add New Exercise</h3>
            <input
              type="text"
              placeholder="Enter exercise name..."
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="exercise-name-input"
            />
            <div className="popup-actions">
              <button className="popup-btn cancel-btn" onClick={handleCancelAdd}>
                Cancel
              </button>
              <button className="popup-btn confirm-btn" onClick={handleSubmitNewExercise}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseEditPage;
