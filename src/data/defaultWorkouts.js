export const DEFAULT_TIMER_WORKOUTS = [
  {
    id: "default-hiit-them-abs",
    name: "8-Minute Abs",
    type: "timer",
    tags: ["Core"],
    restTime: 15,
    isDefault: true,
    isCustom: false,
    forked: false,
    isPublic: true,
    defaultId: "default-hiit-them-abs",
    creatorUid: null,
    creatorName: null,
    creatorPhotoURL: null,
    exercises: [
      "Sit Ups",
      "Leg Raises",
      "Alternating Single Leg Raises",
      "Chair Crunches",
      "Seated In & Outs",
      "Planks",
      "Bicycles",
      "Russian Twists"
    ]
  },
  {
    id: "default-core-blaster",
    name: "Core Blaster",
    type: "timer",
    tags: ["Core"],
    restTime: 15,
    isDefault: true,
    isCustom: false,
    forked: false,
    isPublic: true,
    defaultId: "default-core-blaster",
    creatorUid: null,
    creatorName: null,
    creatorPhotoURL: null,
    exercises: [
      "Star Crunches",
      "Russian Twists",
      "Leg Raises",
      "Flutter Kicks",
      "Bicycle Crunches",
      "Plank Knees to Elbows",
      "Side Plank Dips",
      "Chair Sit-Ups",
      "Seated In & Outs",
      "Boat Hold Leg Flutters"
    ]
  },
  {
    id: "default-100-push-ups",
    name: "100 Push Ups",
    type: "timer",
    tags: ["Chest"],
    restTime: 15,
    isDefault: true,
    isCustom: false,
    forked: false,
    isPublic: true,
    defaultId: "default-100-push-ups",
    creatorUid: null,
    creatorName: null,
    creatorPhotoURL: null,
    exercises: [
      "Push Ups",
      "Wide Push Ups",
      "Diamond Push Ups",
      "Explosive Push Ups",
      "Side To Side Push Ups",
      "Clapping Push Ups",
      "Archer Push Ups",
      "Open & Closed Push Ups",
      "Typewriter Push Ups",
      "Push Up Shoulder Tap"
    ]
  },
  {
    id: "default-cardio-inferno",
    name: "Cardio Inferno",
    type: "timer",
    tags: ["Full Body"],
    restTime: 15,
    isDefault: true,
    isCustom: false,
    forked: false,
    isPublic: true,
    defaultId: "default-cardio-inferno",
    creatorUid: null,
    creatorName: null,
    creatorPhotoURL: null,
    exercises: [
      "Burpees",
      "Jumping jacks",
      "High knees",
      "Mountain climbers",
      "Push-ups",
      "Squats",
      "Plank",
      "Jump squats",
      "Tricep dips",
      "Lunges"
    ]
  },
  {
    id: "default-shoulder-shred",
    name: "Shoulder Shred",
    type: "timer",
    tags: ["Shoulders"],
    restTime: 15,
    isDefault: true,
    isCustom: false,
    forked: false,
    isPublic: true,
    defaultId: "default-shoulder-shred",
    creatorUid: null,
    creatorName: null,
    creatorPhotoURL: null,
    exercises: [
      "Dumbbell Lateral Raises",
      "Dumbbell Skis",
      "Dumbbell Press",
      "Dumbbell Rear Delt Fly",
      "Pike Push Ups",
      "Handstand Hold",
      "High Side Plank Raises"
    ]
  },
  {
    id: "default-hiit-leg-day",
    name: "HIIT Leg Day",
    type: "timer",
    tags: ["Legs"],
    restTime: 15,
    isDefault: true,
    isCustom: false,
    forked: false,
    isPublic: true,
    defaultId: "default-hiit-leg-day",
    creatorUid: null,
    creatorName: null,
    creatorPhotoURL: null,
    exercises: [
      "Squats",
      "Jump squats",
      "Lunges",
      "Single leg deadlifts",
      "Wall sits",
      "Calf raises",
      "Glute bridges",
      "Side lunges",
      "Pistol squats",
      "Bulgarian split squats"
    ]
  }
];


export const isRestExercise = (name) => /\brest\b/i.test(name);

export const countActiveExercises = (exercises) =>
  (exercises || []).filter(e => !isRestExercise(e)).length;
