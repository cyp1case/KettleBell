# Kettlebell TV workout

Implementation plan for one agent. Follow it in order. Do not add features, screens, or controls that are not specified here. If a test fails, fix that phase and rerun the test. Do not start the next phase with a failing exit test.

If the real TV or the real Home Assistant install makes a locked decision impossible, stop and report the contradiction. Do not swap in Cast, an Apple TV app, a Lovelace card, a hidden audio player, or a downloaded copy of the video.

## Design

Follow DESIGN.md for the look of /player and /editor (colors, type, layout, overlays). DESIGN.md never changes behavior: if it conflicts with this plan, follow this plan and report the conflict. Its Open questions stay out of the build until the owner decides them.

## Words

Use these words. Do not say move, round, or phone.

| Word | Meaning |
| --- | --- |
| How-to | A saved instruction clip: name, YouTube link, start time, stop time. Exercises point to it. |
| Song | A saved music clip: name, YouTube link, start time. No stop time; the work clock cuts it. Exercises point to it. |
| Exercise | One kettlebell movement, such as a swing. Stored once: name, one how-to, one song. No durations. |
| Circuit | A saved list. Ordered slots, a work time on each slot, and one rest interval. The same exercise may fill more than one slot. A circuit does not store how many times it runs. |
| Workout | An ordered list of blocks. Each block is one circuit and how many times to run it. The same circuit may appear again later with its own count. Example: A × 2, then B × 1, then A × 2. |
| Work | The player clock for one slot. Length is that slot’s work time. The song plays. |
| Rest | The player clock between slots, and the opening how-to. Length is the circuit’s rest interval. The next exercise’s how-to plays. The opening rail label is Next. |
| Editor | `/editor` in a computer browser at home. It edits how-tos, songs, exercises, circuits, and workouts, and it sends start, pause, skip, and stop. It has no timer. |
| Player | `/player` on the TV. It is the only clock. |

## Product

The editor and the player share one database. The person saves how-tos and songs, builds exercises from them, then circuits, then a workout that runs those circuits in order, each for its own count. The TV browser stays on the player. The editor starts the workout.

The player runs the first block for its count, then the next block, and so on. Inside a block it shows that circuit’s first how-to for that circuit’s rest interval, then Work for that slot’s work time with that exercise’s song, then Rest with the next how-to. The screen does not count reps.

The editor only stores the plan. The player is the only clock. A clip that fails, ends early, or is replaced by an ad does not move the workout to the next phase. Closing the player stops the workout. It does not keep running in the database.

## Locked decisions

1. How-to clips are YouTube links the person curates. The app does not ship video files.
2. Each how-to stores a start time and a stop time in seconds. Rest length is stored once on the circuit. Playback starts at the start time and ends at the stop time or when the rest clock hits zero, whichever comes first. If the stop time comes first, the clip stays stopped and the clip-ended panel covers the video region until the phase ends. It is not replayed. Work begins at zero even if the clip never played.
3. Before the first work interval, exercise 1’s how-to plays once, for the circuit’s rest length, so circuit 1 is not blind. That opening is the intro phase in the state machine below. The rail says Next.
4. Each exercise points to one song. Every work interval for that slot seeks to the song's start time again, including later circuits. The work clock uses that slot’s work time and cuts the song. The clock does not wait for the song.
5. Rest plays the next exercise’s how-to. The rest length is the rest of the circuit being previewed. After the last slot of a pass, if another pass remains, rest previews that next pass. After the last work interval of the last pass, the session goes to the finished screen. There is no rest after that interval.
6. The TV layout is a status bar across the top, the YouTube player in the left and center, and a right rail with the time remaining. The rail’s column sits on the bottom and its height is remaining time divided by that interval’s duration. The bar does not show reps. The circuit status is the circuit name and the pass inside the current block, such as “A 2 of 2”, then “B 1 of 1”.
7. Five saved catalogs. A how-to stores its name, URL, start time, and stop time. A song stores its name, URL, and start time. An exercise stores its name, a how-to id, and a song id. A circuit stores its name, one rest length, and ordered slots. Each slot stores an exercise id and a work length. A workout stores its name and an ordered list of blocks. Each block stores a circuit id and a count of at least 1. Adjacent blocks that name the same circuit are saved as one block with the counts added. Start copies that flattened plan into the player’s memory. Edits after start do not change that copy.
8. The TV page is a browser, full screen, served from Home Assistant. The editor starts the session. Until then the TV shows Ready. Cast and Apple TV are out of scope.
9. While a session is running, the editor can pause, skip, and stop. Those are commands the player applies. Pause freezes the player’s clock and pauses the video. Resume starts that clock again and attempts to play. If the video does not resume, the clock still runs and the video area says the clip failed. Skip completes the current phase the same way the clock would. Stop tears the video down and returns to Ready.
10. The app does not count, store, or display reps.

## Decisions closed for the implementer

These were not given as separate answers. They are binding unless the owner overrides them before phase 1.

- The intro uses the circuit’s rest length and slot 1’s how-to start time. It is not a second kind of timer.
- On the last work interval of the last circuit, Up next reads Finish.
- Start is refused while the player’s heartbeat is fresh and it is not on Ready. The editor says a session is already on the TV. If the player has not checked in for a few seconds, the TV is treated as gone and Start is allowed again.
- Start is also refused when the workout has no blocks, a block count is below 1, or a circuit in the plan has no slots.
- One TV, one session.
- Two pages, one process, one SQLite file. `/editor` is used from a computer browser at home. `/player` is the TV page. There is no native app, no Lovelace card, and no second server.
- Deleting an exercise lists the circuits that contain it. Confirm removes every slot that points at it. Other slots, their work times, and the rest stay. Exercise slots are not merged. Swing at 30 seconds and swing at 30 seconds stay two slots. If a circuit has no slots left, that circuit is deleted, and the workout rule below runs. Cancel changes nothing.
- Deleting a circuit lists the workouts that contain it. Confirm removes every block that points at it. Adjacent blocks that then name the same circuit become one block, and their counts add. A × 2, B × 1, A × 2 becomes A × 4 when B is deleted. A workout with no blocks left is deleted. Cancel changes nothing.
- A how-to or song that any exercise points to cannot be deleted. The editor lists those exercises. Change or delete them first.
- A session already running keeps its copy through any delete.
- The database stores workouts and a command slot. It does not store a running clock. The editor writes the plan and the commands. The player reads them, runs the state machine in the page, and writes only a heartbeat plus ready, running, or finished.
- A how-to or song needs a URL that parses before it can be saved. Start time may be 0. A how-to's stop time is after its start time. An exercise needs a how-to and a song. A URL that dies after save does not block the clock.
- The first visit to the player may need one tap on the TV so the browser will play sound. The clock does not wait for that tap.
- A YouTube clip that reaches its own end before the interval ends does not end the interval. The clip-ended panel covers the video region until the phase ends, so YouTube's end screen and suggestions are never visible.
- The app stays on the LAN. Do not expose it to the internet.
- Do not download, cache, or rehost YouTube media. Do not hide the player to get audio only. Do not build an ad skipper. The person’s skip button completes our interval. It does not click YouTube’s ad UI.

## Non-goals

- Rep counting, tap targets, cameras, wearables.
- A different song on every interval, a playlist that advances, or one song for the whole workout.
- Casting, AirPlay, the Apple TV Home Assistant app, or a dashboard card as the player.
- Accounts, cloud sync, more than one TV.
- Editing the live session in place.
- Stats, history, calories, or weight.
- AI filling the how-to and song catalogs. Later, not in this build.

## Normative timeline

Circuit: Swing at 30 seconds, then Squat at 60 seconds. Rest 20 seconds. Workout count: 2. This table is the spec for labels, phase order, and the two different work times. Tests must match it.

| Phase | Video | Left status | Up next | Circuit | Rail |
| --- | --- | --- | --- | --- | --- |
| Intro | Swing how-to at its start time | Now — | Swing | 1 of 2 | Next 0:20 |
| Work | Swing song at its start time | Now Swing | Squat | 1 of 2 | Work 0:30 |
| Rest | Squat how-to at its start time | Last Swing | Squat | 1 of 2 | Rest 0:20 |
| Work | Squat song at its start time | Now Squat | Swing | 1 of 2 | Work 1:00 |
| Rest | Swing how-to at its start time | Last Squat | Swing | 2 of 2 | Rest 0:20 |
| Work | Swing song at its start time | Now Swing | Squat | 2 of 2 | Work 0:30 |
| Rest | Squat how-to at its start time | Last Swing | Squat | 2 of 2 | Rest 0:20 |
| Work | Squat song at its start time | Now Squat | Finish | 2 of 2 | Work 1:00 |
| Finished | none | Finished, workout name | | | no clock |

Circuit 2 must not play Swing’s how-to twice in a row. The rest at the end of circuit 1 is the only preview before circuit 2’s Swing. The squat work rail is 1:00 in both circuits. The swing work rail is 0:30 in both.

Status bar slots, left to right: exercise slot (Now, Last, or an em dash), Up next, Circuit. No fourth slot.

The video region’s caption is the exercise whose clip is on screen (the how-to exercise during intro and rest, the current exercise during work). Do not add a song-title field.

The rail column is full at the start of a phase and empty as the phase completes. Height equals remaining divided by that phase’s duration. Pause freezes the column.

Digits show the remaining time, rounded up to the next second, as `M:SS`. At the moment the phase completes, the next phase’s full duration appears. The screen must not sit on `0:00`.

## State machine

This machine runs inside `/player` only. The editor does not implement it and does not display a timer.

States: `ready`, `intro`, `work`, `rest`, `finished`.

The player flattens the workout before running it. A × 2, B × 1, A × 2 becomes five passes: A, A, B, A, A. Each pass carries that circuit’s slots, work times, and rest. The circuit status is the name and the pass number inside the current block, not a count across the whole workout.

Session fields: snapshot, pass index, slot index (0-based), phase id, duration, end time, paused flag, remaining time while paused, video failure flag.

Every phase has a new phase id. Completing a phase (clock or skip) is ignored if that phase id was already completed. This is the double-advance guard.

| From | Event | To |
| --- | --- | --- |
| ready | start, snapshot has at least one pass | intro for pass 1, slot 0 |
| ready | start, snapshot empty or invalid | ready, error on the editor |
| intro, work, rest, finished | start | no change, error on the editor |
| intro | clock or skip | work, same slot, same pass |
| work | clock or skip, and a slot remains in this pass | rest previewing the next slot; rest length is this circuit’s rest |
| work | clock or skip, last slot, a pass remains | rest previewing slot 0 of the next pass; rest length is the next circuit’s rest |
| work | clock or skip, last slot, last pass | finished |
| rest | clock or skip | work for the slot this rest was previewing |
| intro, work, rest | pause | same phase, clock disarmed, video paused |
| paused phase | resume | same phase, clock armed from the stored remaining time, play attempted |
| intro, work, rest, finished | stop | ready, player destroyed |
| finished | done | ready |

Pause and skip do nothing in `ready` and `finished`. Resume does nothing when the phase is not paused.

When the player accepts start, it copies into memory the workout name, the blocks in order, each circuit’s rest, each slot’s work time and order, each exercise’s name, and its how-to and song (links, start times, and the how-to’s stop time). Later edits do not change that copy.

## Pages and database

One process serves both pages and the API. One SQLite file holds the workouts and one command row. Do not add a message bus, a websocket, a second database, or a server-side timer.

| Page | Writes | Reads |
| --- | --- | --- |
| `/editor` | how-tos, songs, exercises, circuits, slots, workouts, the command (`start` with a workout id, `pause`, `resume`, `skip`, `stop`, `done`) | those catalogs, the player heartbeat (so the buttons match Ready, running, or finished) |
| `/player` | heartbeat, status `ready` / `running` / `finished`, and it clears a command after applying it | the command, and the workout named by `start` |

The player polls about twice a second for a command. The clock between polls is local. A failed poll does not freeze the clock and does not change phase. Commands wait until the next poll that succeeds, then the player applies one command and clears it.

If a start command arrives while the player is already running, the player ignores it. If the heartbeat is stale, the editor may send start again. A player that wakes up and finds a newer run id drops its old copy and returns to Ready.

Closing `/player` stops the clock. Nothing in the database keeps advancing phases.

## Clock and video

- Work phase length is that slot’s work time. Rest and intro use the circuit’s rest length. Neither is the length of the YouTube video.
- Store lengths as whole seconds, at least 1. Circuit count is a whole number, at least 1. Start times are whole seconds, at least 0. A how-to's stop time is a whole second after its start time.
- The player arms its own end time when a phase starts, and disarms it on pause. Display remaining time from that local end time. On resume, arm a new end time from the remaining time stored at pause.
- One YouTube IFrame player exists for the whole session. Create it when the session starts. On each phase entry, load that phase's clip at its saved start time with one call (`loadVideoById` with `startSeconds`, plus `endSeconds` for a how-to). That call replaces the clip already playing, including one that failed or ended. Destroy the player on stop and on finished. Ignore any player event from a clip the session has already left. Two clips must not be audible at once.
- Player `onError`, a failed load, or autoplay rejection marks the clip failed and does not retry in a loop. One load attempt per phase.
- Player `ENDED` (the clip reached its own end or the how-to's stop time) does not complete the phase. On `ENDED`, show the clip-ended panel: a plain panel over the whole video region with the caption exercise's name. It stays until the next phase loads its clip. It is not shown for a clip that failed; that keeps the clip-failed state.
- The iframe fills the video region and is not covered by the status bar or the rail.
- Parse video ids from `youtube.com/watch?v=`, `youtu.be/`, and `/embed/`. If the URL contains `t` or `start`, prefill the start-time field. The stored start time is what the player uses. Reject a URL that does not yield a video id.
- If the browser has not yet had a user gesture, show Tap once to allow sound over the video region. On that tap, request fullscreen and a screen wake lock, and if time remains in the current phase, seek to the start time plus elapsed seconds and play. If that seek fails, keep the clip-failed state. The clock has been running the whole time.

## Editor page

`/editor` is used in a computer browser. There is no phone layout. Five catalogs:

- How-tos: create, edit, delete. Name, URL, start time, stop time. Delete is refused while an exercise points to it, and the editor lists those exercises.
- Songs: create, edit, delete. Name, URL, start time. Delete is refused the same way.
- Exercises: create, edit, delete. A name, a how-to picked from the How-tos catalog, and a song picked from the Songs catalog. Delete confirms with the circuit names that will lose that exercise, and with any circuit or workout that would be deleted because it would be empty.
- Circuits: name, rest interval, ordered slots. Each slot is an exercise plus a work time. Reorder and repeat exercises. Delete confirms with the workouts that contain it, including a workout that would be deleted because it would be empty, and a workout whose blocks would merge.
- Workouts: name and an ordered list of blocks. Each block is a circuit and a count. The list shows that sequence, for example A × 2, B × 1, A × 2. Start is on that row. Open a workout to change the name or the blocks. The list stays compact (name, block sequence, Start). Selecting a row shows that workout's circuits, rests and slot work times in a detail panel beside the list, per DESIGN.md.

Save is refused when a name is empty, a URL does not parse, a how-to's stop time is not after its start time, an exercise has no how-to or no song, a work time or rest is below 1 second, or a block count is below 1. On save, adjacent blocks that name the same circuit collapse into one block and their counts add. A workout needs at least one block.

Start writes the `start` command with the workout id. The button is available when the workout can start and the player heartbeat is fresh and status is `ready`, or when the heartbeat is stale.

Session controls while the player reports running: Pause or Resume, Skip, Stop. While the player reports finished: one control, Done. While Ready: no pause, skip, or stop. The editor does not show the countdown.

## Failure catalog

Each row is a required behavior and a test. Automated tests cover the state machine with no YouTube. Rows marked TV are manual on the real television, in phase 1 or phase 4.

| # | Condition | Required behavior | Proof |
| --- | --- | --- | --- |
| 1 | Second video id errors, or is private, or will not embed | The player clock finishes the phase. Video area says the clip failed. Next phase still starts. | TV. Fixture with one bad id. |
| 2 | Clip is shorter than the interval | Phase continues until the player clock ends. YouTube `ENDED` does not start the next phase. The clip-ended panel covers the video region; no YouTube suggestions are visible. | TV. 20s rest, clip that ends in a few seconds. |
| 3 | Ad or intro plays instead of the movement | Clock still cuts at zero. Skip completes the phase early. The app does not click inside YouTube’s ad UI. | TV. Observe, then press skip. |
| 4 | Autoplay with sound is blocked | Prompt is visible. Clock runs. After one TV tap, playback seeks into the remaining window or shows clip failed. | TV. Fresh browser profile. |
| 5 | Seek is ignored and the clip plays from 0 | One load attempt. Clock still cuts. | TV. |
| 6 | Phase change | Previous clip is silent within one second. Only one iframe exists. | TV. Listen at a work-to-rest boundary. |
| 7 | Skip arrives in the same moment as the clock | One transition, one new phase id. The following exercise is not skipped. | Automated. Two completions for one phase id. |
| 8 | Resume and the player will not play | Clock runs. Clip failed is shown. | TV. |
| 9 | Command poll fails across a boundary | The player clock still changes phase. A pause or skip written during the outage is applied once on the next successful poll, and only if that phase id is still current. | TV. Block the command poll for longer than one interval, and press skip during it. |
| 10 | Server process stops mid-session | The open player keeps its clock and its video. Reloading `/player` returns to Ready. | TV. |
| 11 | Workout edited after start | Running labels, ids, and lengths stay on the snapshot. The next start uses the edited workout. | Automated. |
| 12 | Start with no blocks, an empty circuit, a count below 1, or start while not ready | Refused. TV unchanged. Editor shows why. | Automated. |
| 13 | Pause, wait, resume | Remaining time continues from the stored value. It does not jump by the paused duration. | Automated. |
| 14 | Skip in intro | Enters work for slot 1, circuit 1. Work duration is that slot’s work time, 30 seconds in the fixture. | Automated. |
| 15 | Skip on the last work of the last circuit | Finished. No rest phase. | Automated. |
| 16 | Rail at start, middle, and end | Column full, about half, then the next phase at full. Digits do not rest on 0:00. | TV. |
| 17 | Status labels for the fixture above | Match the normative table, including circuit 2 on the rest between circuits, Work 0:30 for Swing, Work 1:00 for Squat, and Finish on the last work. | Automated for the labels. TV for the layout. |
| 18 | iframe geometry | Status bar and rail do not overlap the iframe. | TV. |
| 19 | TV screensaver or sleep | Phase 0 records the device setting that keeps the browser awake. Wake lock is requested on the tap. If the screen still sleeps, phase 1 is not done. | TV. |
| 20 | Save with a missing URL, a bad URL, a how-to stop time not after its start, an exercise with no how-to or song, a slot work time of 0, a rest of 0, or a circuit count of 0 | Save refused. Nothing partial is written. | Automated. |
| 22 | Workout is A × 2, B × 1, A × 2, and B is deleted | The workout becomes A × 4. A running snapshot still contains B. | Automated. |
| 23 | Confirm delete of the only exercise in a circuit | That circuit is deleted. A workout whose blocks all pointed at it is deleted. A workout that also had other blocks keeps those blocks, merging adjacent matches. Cancel before confirm changes nothing. A running snapshot is unchanged. | Automated. |
| 24 | Two swing slots, 30 seconds then 30 seconds, and the exercise between them is deleted | Both swing slots remain. They are not merged. | Automated. |
| 21 | Player page is closed | The clock stops. The database does not advance the phase. After the heartbeat goes stale, the editor allows Start. | Automated. |
| 25 | Delete a how-to or song that an exercise points to | Refused. The editor lists the exercises. Nothing changes. | Automated. |
| 26 | How-to stop time comes before the rest ends | Clip stops at the stop time and the clip-ended panel covers the video region. It is not replayed. The rest runs to its full length. | TV. 20s rest, how-to with a 10-second span. |

## Hosting

Phase 0 records the real Home Assistant install and the real TV browser in `host.json` at the repo root:

```json
{
  "haInstall": "os | supervised | container | core | unknown",
  "tvBrowser": "what the person will leave full screen",
  "audioGestureConfirmed": false,
  "sleepSetting": ""
}
```

Then pick one hosting shape. Do not build both.

- `os` or `supervised`: one add-on, one process, one SQLite file. A browser opens `/editor` through Home Assistant ingress, behind Home Assistant login. The TV bookmarks `/player` on a direct LAN URL, with a long random token stored on disk, because TV browsers handle the Home Assistant login poorly.
- `container` or `core`: that same process runs beside Home Assistant on the LAN. `/editor` is linked from Home Assistant with a sidebar iframe or a bookmark. The TV uses the tokenized `/player` URL.
- `unknown`: stop. Do not guess.

Bind to the LAN. Refuse a configuration that listens on the public internet. The token is a capability for the player page, not a user account.

## Phases

### Phase 0 — Host record

Write `host.json`. Confirm a browser can stay full screen on the HDMI path and name the setting that stops sleep. Set `audioGestureConfirmed` only after a throwaway page on that browser plays a YouTube clip with sound following one tap.

Exit: `host.json` has an install value other than `unknown`, a named browser, and `audioGestureConfirmed` true. If no browser is on the HDMI path, stop. This phase writes no player.

### Phase 1 — Playback spike on the TV

Build the player layout with the fixture baked in (Swing 30 seconds, Squat 60 seconds, rest 20 seconds, 2 circuits) and the clock inside the player page. No editor in this phase. Include Ready, the tap-for-sound prompt, clip failed, the clip-ended panel, the status bar, the visible iframe, and the dropping rail. Lay out the player per the TV section of DESIGN.md.

Exit: TV proofs for catalog rows 1, 2, 4, 5, 6, 16, 18, 19, and 26 pass on the device named in `host.json`. A desktop browser pass is not enough. Leave the proofs as a short checklist file `phase-1-tv.md` with pass or fail per row and the date.

### Phase 2 — Session engine

Implement the state machine in the player. Add the command row. Put pause, skip, and stop on `/editor` against the baked fixture. The editor writes a command. The player applies it. The editor has no timer.

Exit: automated tests cover catalog rows 7, 11, 12, 13, 14, 15, 17, and 21. Tests use no network and no YouTube. All of them pass.

### Phase 3 — Editor and save

Persist how-tos, songs, exercises, circuits, slots, and workouts in the same SQLite file. Finish `/editor`. Start writes the command. The player copies that workout into memory and enters intro. Wire hosting from `host.json` (add-on or beside-HA). Do not change phase rules in this phase. Lay out /editor per the Editor section of DESIGN.md.

Exit: catalog rows 20, 22, 23, 24, and 25 pass. A manual check shows the catalogs surviving a process restart, a start refusing a second time, and an edit during a run leaving the TV on the snapshot.

### Phase 4 — Dress rehearsal

Run the normative fixture as a saved workout on the TV, started from the editor. Then run the failure rows that need the real page: 1, 3, 6, 8, 9, and 10.

Exit: `phase-4-tv.md` records pass or fail for those rows on the device in `host.json`. Every row passes. The finished screen shows the workout name and waits for Done.

## Order rule

Phase 1 exists so a bad TV browser is discovered before the editor exists. Do not build persistence, accounts, or extra screens to make the spike look finished. Do not weaken a test to match what the TV happened to do.
