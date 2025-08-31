import React, { useState } from 'react';
import './EditPage.css';
import BackIcon from '../assets/back.webp';
import Tab2 from '../assets/Tab2.jpg';
import Tab3 from '../assets/Tab3.jpg';

const EditPage = ({ type, level, workouts, selectedWorkout, onWorkoutSelect, onArrowClick, onBack }) => {
  const [localSelectedWorkout, setLocalSelectedWorkout] = useState(selectedWorkout);

  // Update local state when prop changes
  React.useEffect(() => {
    setLocalSelectedWorkout(selectedWorkout);
  }, [selectedWorkout]);

  const handleWorkoutSelect = (workout) => {
    setLocalSelectedWorkout(workout);
    // Call onWorkoutSelect to persist the selection in parent
    onWorkoutSelect(workout);
  };

  const handleArrowClick = (workout, event) => {
    event.stopPropagation(); // Prevent triggering the workout selection
    onArrowClick(workout); // This will navigate to edit page
  };

  const handleBack = () => {
    console.log('Back button clicked');
    onBack();
  };

           const getPageTitle = () => {
           if (level === 'categories') {
             return type === 'timer' ? 'Timer' : 'Stopwatch';
           } else {
             return `Edit ${selectedWorkout}`;
           }
         };

  return (
    <div className="edit-page-container">
               <div className="edit-page-header">
           <button className="back-button" onClick={handleBack}>
             <img src={BackIcon} alt="Back" className="back-icon" />
           </button>
           <h1 className="edit-page-title">
             {getPageTitle()}
           </h1>
           <img src={type === 'timer' ? Tab2 : Tab3} alt={type === 'timer' ? 'Timer' : 'Stopwatch'} className="header-image" />
         </div>
      
      <div className="workouts-list">
        {workouts.map((workout, index) => (
          <div 
            key={index}
            className={`workout-item ${localSelectedWorkout === workout ? 'selected' : ''}`}
            onClick={() => handleWorkoutSelect(workout)}
          >
            <div className="workout-number">{index + 1}</div>
            <div className="workout-name">{workout}</div>
            <div 
              className="arrow-indicator"
              onClick={(e) => handleArrowClick(workout, e)}
            >
              →
            </div>
          </div>
        ))}
      </div>
      

      
      {level === 'exercises' && (
        <div className="edit-page-footer">
          <p>Selected: {localSelectedWorkout || 'None'}</p>
        </div>
      )}
    </div>
  );
};

export default EditPage;
