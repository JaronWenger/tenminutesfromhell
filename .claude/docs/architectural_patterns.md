# Architectural Patterns

Recurring patterns across multiple files in this codebase.

## 1. Centralized State Hub

All app state lives in `main.jsx` (~1800 lines). Children receive state via props and communicate via callbacks. No child manages persistent state — only UI-local state (swipe offsets, expanded panels).

**Files**: main.jsx → Home.jsx, StatsPage.jsx, FeedPage.jsx, Timer.jsx, ProfilePopup.jsx

## 2. Default + Override Merge System

Hardcoded defaults from `defaultWorkouts.js` are the baseline. Firestore stores user customizations. On load, `mergeWorkouts()` (main.jsx:374) layers customs over defaults.

**Merge logic**:
1. Collect `{ deleted: true }` markers → filter out those defaults
2. For each default, find custom override by `name` or `defaultName`
3. Track overrides in `usedAsOverride` Set to prevent duplicates
4. Append remaining custom workouts (not used as overrides, not deleted)

**Soft-delete**: Removing a default stores `{ deleted: true, defaultName }` — not a real delete. This allows re-adding defaults later.

## 3. Workout Ownership Chain

When workouts are shared/taken, `creatorUid` preserves the original author:
- User creates workout → `creatorUid: null` (or their own UID)
- User takes from profile → `creatorUid: originalCreator`
- User shares to friend → notification carries `creatorUid` of original creator, not sharer
- Friend accepts → saved with original `creatorUid`
- User forks/remixes → `forked: true`, becomes their own workout

**Key rule**: Sharing never claims ownership. Only create or remix makes it yours.

## 4. Optimistic UI Updates

State updates locally first for instant feedback, then persists to Firestore async. Errors logged but don't roll back (Firestore syncs on next load).

**Pattern**: `setState(newValue)` → `if (user) { firestoreCall().catch(console.error) }`

**Examples**: Like toggles (FeedPage.jsx:170), visibility toggles (main.jsx:948), workout saves (main.jsx:399)

## 5. FLIP Animation (Detail Overlays)

Workout detail panels animate from card position to fullscreen using FLIP (First, Last, Invert, Play).

**Used in**: Home.jsx, StatsPage.jsx, ProfilePopup.jsx

**Steps**:
1. Capture card bounding rect (`detailRect`)
2. Render full panel, get its rect
3. Calculate `translate(dx, dy) scale(sx, sy)` from panel to card
4. Apply transform, force repaint (`offsetHeight`), transition to `transform: none`

## 6. Touch Gesture State Machine

Swipe/drag interactions use refs (not state) during gesture to avoid re-renders. State updates only on commit.

**Pattern**: `useRef` for coordinates/flags during touch → `useState` only for committed position

**Home.jsx**: Swipe-to-delete (horizontal) + long-press reorder (vertical). Conflict resolved via `isDragging`/`isSwiping` ref gates.

**FeedPage.jsx**: Swipe-to-close on detail overlays.

## 7. Notification Deduplication

Multiple identical notifications (same sender + workout) are deduplicated in fetch functions using a Set with composite key `${actorUid}_${workoutName}`. Since queries use `orderBy('createdAt', 'desc')`, the most recent is naturally kept.

**Functions**: `getSaveNotifications`, `getShareNotifications`, `getSentShareNotifications` in social.js

## 8. Unread Notification Badge (Lightweight Polling)

Instead of loading the full feed, `hasNewNotifications()` (social.js) fetches 1 doc from each feed source with `limit(1)`, compares timestamp to `lastViewedAt` from localStorage.

**Sources checked**: save notifications, share notifications, sent notifications, own posts, followed users' posts

**Triggers**: App load, tab switch to home, every 60s interval, after posting/sending

**localStorage key**: `feedLastViewed_{userId}`

## 9. Auth-Gated Persistence

App works fully offline with hardcoded defaults. Firebase is additive — all Firestore calls gated by `if (user)`.

**Pattern**: Feature works with local state → `if (user) { persist() }` adds cloud sync

## 10. Panel Height Animation

Smooth panel expansion when content changes (e.g., toggling sections, accepting shared workouts).

**Pattern** (ProfilePopup.jsx, others):
1. Capture current height
2. Set `transition: none`, measure `scrollHeight`
3. Set height to current, force repaint
4. Enable transition, set height to target
5. On `transitionend`, remove fixed height

## 11. Interval + Ref Cleanup

Timers/stopwatches use `setInterval` stored in `useRef`, cleaned up in effect return. Prevents stale closures and memory leaks.

**Pattern**: `ref.current = setInterval(...)` in effect → `clearInterval(ref.current)` in cleanup

## 12. Wake Lock Lifecycle

Screen wake lock acquired on timer/stopwatch start, released on stop/completion. Errors silently caught (not all browsers support it).

**Location**: main.jsx — `requestWakeLock()` / `releaseWakeLock()` helpers

## 13. CSS Component Scoping

Each component has its own `.css` file. Class names prefixed by component context since CRA doesn't use CSS Modules.

| Prefix | Component |
|--------|-----------|
| `home-` | Home.jsx |
| `feed-` | FeedPage.jsx |
| `stats-` | StatsPage.jsx + ProfilePopup.jsx (shared styles) |
| `timer-` | Timer.jsx |
| `stopwatch-` | Stopwatch.jsx |
| `tab-` | TabBar.jsx |
| `side-` | SideMenu.jsx |
| `schedule-` | Schedule popup (in main.jsx) |
| `private-share-` | Private share prompt (in main.jsx) |

**Lesson**: `.workout-list` collided between Home.css and WorkoutList.css. Renamed to `.home-workout-list`.

## 14. Ref-Based Lookup to Avoid Effect Retriggers

When a `useEffect` needs access to a prop that changes frequently (like `allWorkouts`), store it in a ref to avoid retriggering the effect.

**Pattern**: `const ref = useRef(prop); ref.current = prop;` — then use `ref.current` inside effects

**Used in**: ProfilePopup.jsx, Home.jsx
