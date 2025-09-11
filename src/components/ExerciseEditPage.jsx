import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './ExerciseEditPage.css';

const ExerciseEditPage = ({ workoutName, exercises, onSave, onBack }) => {
  const [localExercises, setLocalExercises] = useState([...exercises]);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(workoutName);

  // Check if there are changes compared to original exercises or title
  useEffect(() => {
    const hasChangesMade = JSON.stringify(localExercises) !== JSON.stringify(exercises) || editedTitle !== workoutName;
    setHasChanges(hasChangesMade);
  }, [localExercises, exercises, editedTitle, workoutName]);

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
    if (hasChanges || editedTitle !== workoutName) {
      onSave(localExercises, editedTitle);
      setHasChanges(false);
    }
  };

  const handleTitleDoubleClick = () => {
    setIsEditingTitle(true);
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
            type="text"
            value={editedTitle}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleTitleBlur}
            className="exercise-edit-title-input"
            autoFocus
          />
        ) : (
          <h1 className="exercise-edit-title" onDoubleClick={handleTitleDoubleClick}>
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
          className={`save-btn ${!hasChanges ? 'disabled' : ''}`}
          onClick={handleSave}
          disabled={!hasChanges}
        >
          {hasChanges ? 'Save Changes' : 'No Changes'}
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
