# HIITem

HIIT workout timer PWA with social features. Users create/share workouts, complete timed exercises (1 min each + prep countdown), follow friends, and track history via activity heatmaps.

## Tech Stack

- **Framework**: React 19.1 (CRA, plain JavaScript — no TypeScript)
- **State**: React hooks only — no Redux/Zustand
- **Backend**: Firebase 12.9 (Google OAuth, Firestore)
- **Auth**: React Context (`src/contexts/AuthContext.js`) → `{ user, loading }`
- **Styling**: Plain CSS per component (no Tailwind/CSS-in-JS)
- **Deploy**: GitHub Pages via `gh-pages` to hiitem.com

## Project Structure

```
src/
  components/
    main.jsx              # Central state hub — ALL state + handlers (~1800 lines)
    Home.jsx              # Workout list (swipe-delete, long-press reorder, detail overlay)
    Timer.jsx             # Countdown timer (Ring + WorkoutList)
    Ring.jsx              # SVG circular progress
    WorkoutList.jsx       # Exercise list during timer
    Stopwatch.jsx         # Elapsed time + lap tracking
    TabBar.jsx            # Bottom nav (Home/Timer/Stats)
    EditPage.jsx          # Workout category picker
    ExerciseEditPage.jsx  # Drag-drop exercise editor (react-beautiful-dnd)
    StatsPage.jsx         # Activity heatmap, rankings, profile popups
    FeedPage.jsx          # Activity feed overlay (posts, notifications, people)
    ProfilePopup.jsx      # User profile overlay (pinned workouts, calendar, follow)
    SideMenu.jsx          # Settings panel
    LoginModal.jsx        # Google OAuth prompt
    SharePrompt.jsx       # Auto-share opt-in modal
    AuthButton.jsx        # Sign-in/out button
  firebase/
    config.js             # Firebase init (env vars)
    auth.js               # signInWithGoogle(), signOut(), onAuthChange()
    firestore.js          # User CRUD: workouts, history, settings
    social.js             # Social: profiles, following, posts, notifications
  contexts/
    AuthContext.js         # Auth provider wrapping app
  data/
    defaultWorkouts.js    # Hardcoded workout presets (timer + stopwatch)
  assets/                 # Images (SPARKS.gif, tab icons)
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Dev server on :3000 |
| `npm run build` | Production build to /build |
| `npm test` | Jest + React Testing Library |
| `npm run deploy` | Build + CNAME + deploy to GitHub Pages |

## Firestore Data Model

### Per-User (`users/{userId}/`)
- **`customWorkouts/`** — `{ name, type, exercises[], isDefault, isCustom, forked, defaultName?, deleted?, isPublic, restTime?, tags?, creatorUid?, creatorName?, creatorPhotoURL?, updatedAt }`
- **`history/`** — `{ workoutName, workoutType, workoutId?, duration, setCount, exercises[], completedAt }`
- **`settings/preferences`** — `{ autoShare, activeColor, restColor, workoutOrder[], sidePlankAlert, prepTime, restTime, activeLastMinute, selectedWorkout, showCardPhotos, pinnedWorkouts[], weeklySchedule{}, updatedAt }`

### Social (top-level)
- **`userProfiles/{userId}`** — `{ uid, displayName, photoURL, workoutCount, createdAt, updatedAt }`
- **`following/{userId}/userFollowing/{targetId}`** — `{ followedAt, active, unfollowedAt? }`
- **`followers/{userId}/userFollowers/{followerId}`** — `{ followedAt }`
- **`posts/{postId}`** — `{ userId, workoutName, workoutType, duration, exerciseCount, exercises[], displayName, photoURL, isPublic, likeCount, createdAt }`
- **`posts/{postId}/likes/{userId}`** — `{ userId, createdAt }`
- **`notifications/{id}`** — `{ recipientUid, type, actorUid, actorName, actorPhotoURL, workoutName, status, createdAt, ... }` (see [data_model.md](.claude/docs/data_model.md))

## Workout Ownership Model

- **`creatorUid: null`** → user's own creation or unmodified default
- **`creatorUid: someUid`** → taken/shared from another user, original creator preserved
- **`isCustom: true`** → user created from scratch
- **`forked: true`** → user modified someone else's workout (becomes their own)
- **`isPublic: false`** → private, sharing blocked (only for own workouts — others' workouts in your library are always shareable)
- **Sharing preserves creator chain**: if B shares A's workout to C, `creatorUid` stays as A's UID

## Workout Identity & Mutation Rules

- **Renaming a workout does NOT create a new document** — it edits in place on the same Firestore document ID (`id` field). The `id` is stable across renames.
- **Only two operations create new Firestore documents**: (1) the Create button (`isCustom: true`), (2) remix/fork of another user's workout (`forked: true`).
- **Default workouts have no `id`** — they are hardcoded in `src/data/defaultWorkouts.js` and are never stored in Firestore unless the user modifies them (at which point they become a custom doc with an `id`).
- **Pinned workouts** are stored and resolved exclusively by `workout.id`. All default workouts have stable hardcoded IDs (e.g. `"default-the-devils-10"`) in `defaultWorkouts.js`. Never use name as a pin identifier.

## Notification Types

| Type | Trigger | Key Fields |
|------|---------|------------|
| `follow` | User follows you | From `followers/` subcollection |
| `workout_saved` | Someone saves your workout | `actorUid, workoutName, source (pinned\|activity)` |
| `workout_shared` | Someone sends you a workout | `actorUid, workoutName, exercises[], creatorUid, status (pending\|accepted\|denied)` |
| `workout_sent` | Your sent workout status | Derived from `workout_shared` where `actorUid == you` |

## Key Architecture Decisions

- **No router** — tab nav via `activeTab` state in main.jsx
- **Monolithic state hub** — main.jsx owns all state, passes props/callbacks down
- **Defaults + overrides** — `mergeWorkouts()` merges Firestore customs over hardcoded defaults; soft-deletes via `{ deleted: true }`
- **Unread badge** — lightweight Firestore check (1 doc per source) compared against `localStorage feedLastViewed_{uid}`
- **CSS scoping** — component-prefixed classes (`home-*`, `feed-*`, `stats-*`) to avoid collisions

## Critical Warnings

- **CSS collisions**: Always prefix component classes. Home uses `home-*` (`.workout-list` collided with WorkoutList.css)
- **react-beautiful-dnd + React 19**: Incompatible. Only ExerciseEditPage uses it; Home uses native touch handlers
- **Firebase API key in bundle**: Expected. Security from Firestore rules + domain restrictions
- **Firestore composite indexes**: New queries combining `where` + `orderBy` on different fields need indexes created in Firebase Console

## Environment Variables

Required in `.env`:
```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
```

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /userProfiles/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /following/{userId}/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /followers/{userId}/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    match /posts/{postId}/likes/{likeId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /notifications/{notificationId} {
      allow read: if request.auth != null && (resource.data.recipientUid == request.auth.uid || resource.data.actorUid == request.auth.uid);
      allow create: if request.auth != null && request.resource.data.actorUid == request.auth.uid;
      allow update: if request.auth != null && resource.data.recipientUid == request.auth.uid;
    }
  }
}
```

## Additional Documentation

- [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) — Recurring code patterns, animation systems, touch handling, state management
- [.claude/docs/data_model.md](.claude/docs/data_model.md) — Complete Firestore document schemas with all fields
