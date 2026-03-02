# Firestore Data Model — Complete Field Reference

## User Data: `users/{userId}/`

### `customWorkouts/{workoutId}`
```
name: string                    # Display name
type: 'timer' | 'stopwatch'    # Workout mode
exercises: string[]             # Ordered exercise names
isDefault: boolean              # Based on a hardcoded default
isCustom: boolean               # User created from scratch
forked: boolean                 # User modified someone else's workout
defaultName: string | null      # Original default name (for tracking overrides)
deleted: boolean                # Soft-delete marker (defaults only)
isPublic: boolean               # true = shareable, false = private (default: true)
restTime: number | null         # Per-workout rest override (null = use global)
tags: string[] | null           # Categories: 'Full Body', 'Chest', 'Back', etc.
creatorUid: string | null       # Original creator's UID (null = own/default)
creatorName: string | null      # Original creator's display name
creatorPhotoURL: string | null  # Original creator's photo
createdAt: timestamp
updatedAt: timestamp
```

### `history/{historyId}`
```
workoutName: string
workoutType: 'timer' | 'stopwatch'
workoutId: string | null
duration: number                # Seconds
setCount: number                # Exercise count
exercises: string[]
completedAt: timestamp
```

### `settings/preferences` (single document)
```
autoShare: boolean | null       # null = unset, true = auto-post, false = declined
activeColor: string             # Hex color for active phase '#ff3b30'
restColor: string               # Hex color for rest phase '#007aff'
workoutOrder: string[] | null   # Custom workout list order
sidePlankAlert: boolean
prepTime: number                # Prep countdown seconds (default 15)
restTime: number                # Global rest between exercises (default 15)
activeLastMinute: boolean       # Visual indicator for last minute
selectedWorkout: string | null  # Last selected timer workout name
showCardPhotos: boolean         # Show creator photos on workout cards
pinnedWorkouts: string[]        # Names of workouts pinned to profile
weeklySchedule: {               # Day-of-week → workout name
  0: string | null,             # Sunday
  1: string | null,             # Monday
  ...
  6: string | null              # Saturday
}
updatedAt: timestamp
```

## Social: Top-Level Collections

### `userProfiles/{userId}`
```
uid: string
displayName: string
photoURL: string | null
workoutCount: number            # Incremented on post creation
createdAt: timestamp
updatedAt: timestamp
```

### `following/{userId}/userFollowing/{targetId}`
```
followedAt: timestamp
active: boolean                 # false when unfollowed (soft-delete)
unfollowedAt: timestamp | null  # Set when unfollowed
```
**Why soft-delete**: Feed filters posts from unfollowed users by `unfollowedAt` cutoff — posts from before unfollow still show.

### `followers/{userId}/userFollowers/{followerId}`
```
followedAt: timestamp
```

### `posts/{postId}`
```
userId: string                  # Who posted
displayName: string
photoURL: string | null
workoutName: string
workoutType: 'timer' | 'stopwatch'
duration: number                # Seconds
exerciseCount: number
exercises: string[]
isPublic: boolean               # If false, hidden from other users' feeds
likeCount: number
createdAt: timestamp
```

### `posts/{postId}/likes/{userId}`
```
userId: string
createdAt: timestamp
```

### `notifications/{notificationId}`

All notification types share one collection, differentiated by `type` field.

#### Type: `workout_saved`
```
recipientUid: string            # Workout owner
type: 'workout_saved'
actorUid: string                # Who saved it
actorName: string
actorPhotoURL: string | null
workoutName: string
source: 'pinned' | 'activity'  # Where they saved from
createdAt: timestamp
```

#### Type: `workout_shared`
```
recipientUid: string            # Who receives the share
type: 'workout_shared'
actorUid: string                # Who sent it
actorName: string
actorPhotoURL: string | null
workoutName: string
workoutType: 'timer' | 'stopwatch'
exercises: string[]
restTime: number | null
tags: string[] | null
creatorUid: string              # ORIGINAL creator (preserved through share chain)
creatorName: string
creatorPhotoURL: string | null
status: 'pending' | 'accepted' | 'denied'
createdAt: timestamp
```

## Required Composite Indexes

| Collection | Fields | Used By |
|------------|--------|---------|
| `notifications` | `recipientUid ASC, type ASC, createdAt DESC` | getSaveNotifications, getShareNotifications |
| `notifications` | `actorUid ASC, type ASC, createdAt DESC` | getSentShareNotifications, hasNewNotifications |
| `posts` | `userId ASC, createdAt DESC` | getFeedPosts, hasNewNotifications |

## Preset Tags (for workout categorization)

```
'Full Body', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
'Arms', 'Core', 'Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'
```
Defined in Home.jsx as `PRESET_TAGS`.
