# Ten Minutes From Hell

High-intensity interval workout timer PWA. Users select a workout, each exercise runs for 1 minute with a 15-second prep countdown, and the app tracks completion history.

## Tech Stack

- **Framework**: React 19.1 (Create React App, plain JavaScript — no TypeScript)
- **State**: React hooks only (useState, useEffect, useContext, useCallback, useRef, useMemo). No Redux/Zustand.
- **Backend**: Firebase 12.9 (Auth via Google OAuth, Firestore for persistence)
- **Auth**: React Context (`src/contexts/AuthContext.js`) provides `{ user, loading }` globally
- **Styling**: Plain CSS files per component (no Tailwind, no CSS-in-JS)
- **Drag-drop**: `react-beautiful-dnd` 13.1 in ExerciseEditPage; native touch handlers in Home
- **Deploy**: GitHub Pages via `gh-pages` to hiitem.com

## Project Structure

```
src/
  components/          # All React components + their CSS
    main.jsx           # Central state hub — ALL app state lives here (~700 lines)
    Home.jsx            # Workout list (swipe-delete, long-press reorder)
    Timer.jsx           # Countdown timer (Ring + WorkoutList)
    Ring.jsx            # SVG circular progress with red/blue color coding
    WorkoutList.jsx     # Exercise list (active/completed/upcoming states)
    Stopwatch.jsx       # Elapsed time + lap tracking
    TabBar.jsx          # Bottom navigation (Home/Timer/Stats)
    EditPage.jsx        # Workout category picker
    ExerciseEditPage.jsx # Drag-drop exercise editor
    StatsPage.jsx       # Activity heatmap, exercise rankings
    AuthButton.jsx      # Google sign-in/out
  firebase/
    config.js          # Firebase init (reads REACT_APP_FIREBASE_* env vars)
    auth.js            # signInWithGoogle(), signOut(), onAuthChange()
    firestore.js       # CRUD: getUserWorkouts, saveUserWorkout, deleteUserWorkout,
                       #       recordWorkoutHistory, getUserHistory
  contexts/
    AuthContext.js     # Auth provider wrapping entire app
  data/
    defaultWorkouts.js # 6 timer + 6 stopwatch hardcoded workout presets
  assets/              # Images (SPARKS.gif, tab icons)
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Dev server on :3000 |
| `npm run build` | Production build to /build |
| `npm test` | Jest + React Testing Library |
| `npm run deploy` | Build + add CNAME + deploy to GitHub Pages |

## Firestore Data Model

All user data lives under `users/{userId}/`:
- **`customWorkouts/`** — `{ name, type, exercises[], isDefault, defaultName?, deleted?, updatedAt }`
- **`history/`** — `{ workoutName, workoutType, duration, setCount, exercises[], completedAt }`

Security rules: authenticated users can only read/write their own `users/{uid}/**` documents.

## Key Architecture Decisions

- **No router** — tab navigation via `activeTab` state in `main.jsx`
- **Monolithic state hub** — `main.jsx` owns all state and passes props/callbacks down
- **Defaults + overrides** — `mergeWorkouts()` in `main.jsx:119` merges Firestore custom workouts over hardcoded defaults; soft-deletes defaults with `{ deleted: true }` markers
- **No state persistence** — local state resets on refresh; Firestore is source of truth for logged-in users
- **CSS class scoping** — Home uses `home-*` prefixed classes to avoid collisions with WorkoutList/Timer styles

## Environment Variables

Required in `.env` (see `.env.example`):
```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
```

## Critical Warnings

- **CSS class collisions**: Home.css and WorkoutList.css both had `.workout-list`. Home now uses `.home-workout-list`. Always prefix Home-specific classes with `home-`.
- **react-beautiful-dnd + React 19**: Incompatible (throws `isDropDisabled` invariant). Home.jsx uses native touch handlers instead. Only ExerciseEditPage still uses rbd.
- **Firebase API key in bundle**: Expected for client-side Firebase. Security comes from Firestore rules + API key domain restrictions, not key secrecy.

## Additional Documentation

- [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) — Recurring patterns: state management, touch interactions, Firestore persistence, component communication
