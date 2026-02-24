# Architectural Patterns

Recurring patterns observed across multiple files in this codebase.

## 1. Centralized State Hub

All application state lives in `src/components/main.jsx`. Child components receive state via props and communicate changes via callback props. No component manages its own persistent state — only UI-local state (e.g., swipe offsets, expanded panels).

**Pattern**: Parent owns state, children get `value` + `onChange` props.

**Examples**:
- `main.jsx:18` — `timerWorkoutData` state, passed to Home and Timer
- `main.jsx:40-48` — `timerState` object, passed as individual props to Timer
- `main.jsx:384-390` — `handleWorkoutSelection` callback, passed as `onWorkoutSelect`

## 2. Dual State Sync (Parent ↔ Child)

Children maintain local copies of parent state via useState, then sync with useEffect when props change. Local state allows immediate UI updates; callbacks push changes to parent.

**Pattern**: Local state initialized from props → useEffect syncs prop changes → handler calls `updateParentState()`.

**Examples**:
- `Timer.jsx:37-40` — Local `timeLeft`, `isRunning` state from props
- `Timer.jsx:43-48` — useEffect syncs when props change
- `Timer.jsx:56-66` — `updateParentState()` merges local state before calling parent callback

## 3. Firestore Optimistic Updates

State is updated locally first (instant UI feedback), then persisted to Firestore asynchronously. Errors are caught and logged but don't roll back the local state.

**Pattern**: `setState(newValue)` → `if (user) { firestoreCall().catch(console.error) }`

**Examples**:
- `main.jsx:399-438` — `handleExerciseSave`: updates local state, then `saveUserWorkout()` in background
- `main.jsx:452-471` — `handleDeleteWorkout`: removes from state, then `deleteUserWorkout()` async
- `main.jsx:184-197` — Timer completion: records history async, refreshes on success

## 4. Default + Override Merge

Hardcoded default workouts are the baseline. Firestore stores user customizations as overrides. On load, `mergeWorkouts()` layers customs over defaults, supporting renames (`defaultName` field) and soft deletes (`deleted: true` marker).

**Pattern**: Load defaults → fetch customs → merge by name/defaultName → filter deleted → append net-new customs.

**Key file**: `main.jsx:119-152` — `mergeWorkouts()` function
**Data source**: `src/data/defaultWorkouts.js` — 6 timer + 6 stopwatch presets

## 5. Touch Gesture State Machine

Touch interactions use a ref-based state machine: track start position → calculate deltas on move → commit or cancel on end. Refs prevent re-renders during gesture; state updates only on commit.

**Pattern**: `useRef` for coordinates/flags, `useState` only for committed visual state.

**Home.jsx swipe-to-delete**:
- `Home.jsx:63-68` — touchStart records X/Y into refs
- `Home.jsx:70-83` — touchMove calculates deltaX, sets swipeOffset state only when threshold crossed
- `Home.jsx:85-93` — touchEnd snaps to -80px or resets

**Home.jsx long-press reorder**:
- `Home.jsx:68` — 400ms setTimeout starts drag mode
- `Home.jsx:76-87` — touchMove during drag checks bounding rects of all cards
- `Home.jsx:95-105` — touchEnd commits reorder via `onReorder()`

**Conflict resolution**: `isDragging` ref gates swipe handlers; `isSwiping` ref gates click handlers.

## 6. Interval + Ref Cleanup

Timers and stopwatches use `setInterval` stored in a `useRef`, with cleanup in the useEffect return. This prevents stale closures and memory leaks.

**Pattern**: `ref.current = setInterval(...)` in effect body → `clearInterval(ref.current)` in cleanup.

**Examples**:
- `main.jsx:165-216` — Timer interval (1s ticks), clears on pause/unmount
- `main.jsx:222-242` — Stopwatch interval (10ms ticks), same pattern

## 7. Wake Lock Lifecycle

Screen wake lock is acquired when a timer/stopwatch starts, released when it stops or completes. Errors are silently caught (not all browsers support it).

**Pattern**: `requestWakeLock()` on `isRunning: true` → `releaseWakeLock()` on `isRunning: false` or completion.

**Key files**:
- `main.jsx:245-264` — `requestWakeLock()` / `releaseWakeLock()` helpers
- `main.jsx:267-280` — `handleTimerStateChange` triggers lock based on running transition

## 8. Tab Navigation Without Router

Navigation is a single `activeTab` string state in main.jsx. `renderContent()` switches on this value to render the correct component. Edit pages use `currentEditPage` + `currentEditLevel` for nested navigation.

**Pattern**: `activeTab` for top-level tabs → `currentEditPage`/`currentEditLevel` for drill-down → `handleEditPageBack` pops levels.

**Key file**: `main.jsx:581-684` — `renderContent()` switch statement

## 9. CSS Component Scoping

Each component has its own `.css` file. Class names must be scoped to avoid collisions since CRA doesn't use CSS Modules.

**Convention**: Prefix classes with component context when generic names risk collision.

**Lesson learned**: Home.css originally used `.workout-list` which collided with WorkoutList.css, breaking Timer page layout. Fixed by renaming to `.home-workout-list`.

## 10. Auth-Gated Persistence

All Firestore operations are guarded by `if (user)` checks. The app works fully offline/logged-out with hardcoded defaults — Firebase is additive, not required.

**Pattern**: Feature works with local state → `if (user) { persist() }` adds cloud sync.

**Examples**:
- `main.jsx:428-438` — Save workout only if logged in
- `main.jsx:466-470` — Delete workout only if logged in
- `main.jsx:184-197` — Record history only if logged in
