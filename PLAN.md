# Kettlebell TV workout

Implementation plan for one agent. Follow it in order. Do not add features, screens, or controls that are not specified here. If a test fails, fix that phase and rerun the test. Do not start the next phase with a failing exit test.

If the real TV or the real Home Assistant install makes a locked decision impossible, stop and report the contradiction. Do not swap in Cast, an Apple TV app, a native or kiosk TV app, a Lovelace card, a hidden audio player, or a downloaded copy of the video.

## Design

Follow DESIGN.md for the look of /player and /editor (colors, type, layout, video states). DESIGN.md never changes behavior: if it conflicts with this plan, follow this plan and report the conflict. Its Open questions stay out of the build until the owner decides them.

## Words

Use these words. Do not say move, round, or phone.

| Word | Meaning |
| --- | --- |
| How-to | A saved instruction clip: name, YouTube link, start time, stop time. Exercises point to it. |
| Song | A saved music clip: name, YouTube link, start time. No stop time; the work clock cuts it. Exercises point to it. |
| Exercise | One kettlebell movement, such as a swing. Stored once: name, one how-to, one song. No durations. |
| Circuit | A saved list. Ordered slots, a work time on each slot, and one rest interval. The same exercise may fill more than one slot. A circuit does not store how many times it runs. |
| Block | One entry in a workout: a circuit and a count, at least 1. |
| Workout | An ordered list of blocks. The same circuit may appear again later with its own count. Example: A × 2, then B × 1, then A × 2. |
| Pass | One run through a circuit's slots. A block with count 2 is two passes. |
| Intro | The opening phase of a session. The first slot's how-to plays. Length is the first circuit's rest interval. Rail label Next. |
| Work | The player clock for one slot. Length is that slot’s work time. The song plays. |
| Rest | The player clock between slots and between passes. The next slot's how-to plays. Length is the rest interval of the circuit being previewed. |
| Editor | `/editor` in a computer browser. It edits the five catalogs and sends start, pause, resume, skip, stop, and done. It has no timer. |
| Player | `/player` in the TV's web browser. It is the only clock. |

## Product

The editor and the player share one database. The person saves how-tos and songs, builds exercises from them, then circuits, then a workout that runs those circuits in order, each for its own count. The TV browser stays on the player. The editor starts the workout.

A session opens with one intro: the first slot's how-to. Then Work for that slot with its song, then Rest with the next slot's how-to, and so on through every pass of every block. There is one intro per session, not one per block. The screen does not count reps.

The editor only stores the plan and sends commands. The player is the only clock. A clip that fails, ends early, or is replaced by an ad does not move the workout to the next phase. Closing the player stops the workout. It does not keep running in the database.

## Locked decisions

1. How-to clips are YouTube links the person curates. The app does not ship video files.
2. Each how-to stores a start time and a stop time in seconds. Rest length is stored once on the circuit. Playback starts at the start time and ends at the stop time or when the rest clock hits zero, whichever comes first. If the stop time comes first, the clip is cued back to its start time (a still frame, not playing) and the caption says the clip ended until the phase ends. It is not replayed. Work begins at zero even if the clip never played.
3. Before the first work interval, the first slot's how-to plays once, for the first circuit's rest length, so the first pass is not blind. That opening is the intro phase. The rail says Next.
4. Each exercise points to one song. Every work interval for that slot loads the song at its start time again, including later passes. The work clock uses that slot’s work time and cuts the song. The clock does not wait for the song.
5. Rest plays the next slot's how-to. The rest length is the rest of the circuit being previewed. After the last slot of a pass, if another pass remains, rest previews the first slot of that next pass, which may be a different circuit. After the last work interval of the last pass, the session goes to the finished screen. There is no rest after that interval.
6. The TV layout is a status bar across the top, the YouTube player in the left and center, and a right rail with the time remaining. The rail’s column sits on the bottom and its height is remaining time divided by that interval’s duration. The bar does not show reps. The circuit status is the circuit name and the pass inside the current block, such as “A 2 of 2”, then “B 1 of 1”.
7. Nothing is ever drawn on top of the YouTube player: no panel, overlay, prompt, or border inside its rectangle. YouTube's Required Minimum Functionality forbids it. Video states (clip ended, clip failed, press for sound) show in the caption line under the player.
8. Five saved catalogs. A how-to stores its name, URL, start time, and stop time. A song stores its name, URL, and start time. An exercise stores its name, a how-to id, and a song id. A circuit stores its name, one rest length, and ordered slots. Each slot stores an exercise id and a work length. A workout stores its name and an ordered list of blocks. Each block stores a circuit id and a count. Adjacent blocks that name the same circuit are saved as one block with the counts added. Start copies that flattened plan into the player’s memory. Edits after start do not change that copy.
9. The TV page is a plain web page in the TV's own browser (an Amazon Fire TV Stick; Silk unless Phase 0 finds it unusable), full screen, served from Home Assistant. The editor starts the session. Until then the TV shows Ready. Cast, Apple TV, native TV apps, and kiosk apps are out of scope.
10. While a session is running, the editor can pause, resume, skip, and stop. Those are commands the player applies, per the command table below. Pause freezes the player’s clock and pauses the video. Resume starts that clock again and plays the clip unless it already ended or failed. Skip completes the current phase the same way the clock would. Stop tears the video down and returns to Ready.
11. The app does not count, store, or display reps.

## Decisions closed for the implementer

These are binding unless the owner overrides them before phase 1.

- The intro uses the first circuit’s rest length and the first slot’s how-to start and stop times. It is not a second kind of timer.
- On the last work interval of the last pass, Up next reads Finish.
- Start needs a fresh heartbeat from a player on Ready. Otherwise the server refuses it with a reason the editor shows word for word (see Editor page).
- One TV, one session, one active player. The most recently loaded `/player` is the active one. An older `/player` that learns it is not active destroys its YouTube player, stops polling, and shows Ready. It does not clear the session.
- Two pages, one process, one SQLite file. `/editor` is used from a computer browser. `/player` is the TV page. There is no native app, no Lovelace card, and no second server.
- A circuit always has at least one slot. Saving a circuit with no slots is refused.
- Deleting an exercise lists the circuits that lose it, any circuit deleted because it would be empty, every workout whose blocks merge (with before and after sequences), and any workout deleted because it would be empty. Confirm removes every slot that points at it. Other slots, their work times, and the rest stay. Exercise slots are not merged. Swing at 30 seconds and swing at 30 seconds stay two slots. Cancel changes nothing.
- Deleting a circuit lists the workouts that contain it, the merges, and any workout deleted because it would be empty. Confirm removes every block that points at it. Adjacent blocks that then name the same circuit become one block, and their counts add. A × 2, B × 1, A × 2 becomes A × 4 when B is deleted. A workout with no blocks left is deleted. Cancel changes nothing.
- A delete runs in one transaction. Confirm recomputes the preview inside that transaction and refuses (409, "Things changed. Review the delete again.") if it differs from what the person saw.
- A how-to or song that any exercise points to cannot be deleted. The editor lists those exercises. Change or delete them first.
- A session already running keeps its copy through any delete or edit.
- The database stores the five catalogs, slots, blocks, one command row, and the player heartbeat. It does not store a running clock.
- A URL that dies after save does not block the clock.
- Sound: the TV browser blocks sound until the page has had a key press. Phase 0 checks the browser for a per-site setting that allows sound for `/player`. If it holds, the person never presses anything. If not, Ready shows one focused button, Press OK to enable sound, until a key is pressed; the editor shows TV needs a press. The clock never waits for sound.
- A YouTube clip that reaches its own end before the interval ends does not end the interval. The clip is cued back to its start time and the caption says it ended. YouTube's end screen and suggestions are never shown.
- `/player` and its APIs stay on the LAN. The editor may also be reached through Home Assistant's remote access, behind Home Assistant login. Nothing else is exposed.
- Do not download, cache, or rehost YouTube media. Do not hide the player to get audio only. Do not build an ad skipper. The person’s skip button completes our interval. It does not click YouTube’s ad UI.

## Non-goals

- Rep counting, tap targets, cameras, wearables.
- A different song on every interval, a playlist that advances, or one song for the whole workout.
- Casting, AirPlay, the Apple TV Home Assistant app, a native or kiosk TV app, Home Assistant pressing keys on the TV, or a dashboard card as the player.
- Accounts, cloud sync, more than one TV.
- Editing the live session in place.
- Stats, history, calories, or weight.
- AI filling the how-to and song catalogs. Later, not in this build.

## Normative timeline

Fixture 1. Workout: one block, circuit A × 2. Circuit A: Swing at 30 seconds, then Squat at 60 seconds, rest 20 seconds. This table is the spec for labels, phase order, and the two different work times. Tests must match it exactly.

| Phase | Video | Left status | Up next | Circuit | Rail |
| --- | --- | --- | --- | --- | --- |
| Intro | Swing how-to at its start time | Now — | Swing | A 1 of 2 | Next 0:20 |
| Work | Swing song at its start time | Now Swing | Squat | A 1 of 2 | Work 0:30 |
| Rest | Squat how-to at its start time | Last Swing | Squat | A 1 of 2 | Rest 0:20 |
| Work | Squat song at its start time | Now Squat | Swing | A 1 of 2 | Work 1:00 |
| Rest | Swing how-to at its start time | Last Squat | Swing | A 2 of 2 | Rest 0:20 |
| Work | Swing song at its start time | Now Swing | Squat | A 2 of 2 | Work 0:30 |
| Rest | Squat how-to at its start time | Last Swing | Squat | A 2 of 2 | Rest 0:20 |
| Work | Squat song at its start time | Now Squat | Finish | A 2 of 2 | Work 1:00 |
| Finished | none | Status bar and rail hidden. Centered: Finished and the workout name. | | | no clock |

Pass 2 must not play Swing’s how-to twice in a row. The rest at the end of pass 1 is the only preview before pass 2’s Swing. The squat work rail is 1:00 in both passes. The swing work rail is 0:30 in both.

Fixture 2 pins the boundary between circuits. Workout: A × 2, then B × 1. Circuit A as above. Circuit B: Press at 40 seconds, rest 45 seconds. From the last work of A onward:

| Phase | Video | Left status | Up next | Circuit | Rail |
| --- | --- | --- | --- | --- | --- |
| Work | Squat song at its start time | Now Squat | Press | A 2 of 2 | Work 1:00 |
| Rest | Press how-to at its start time | Last Squat | Press | B 1 of 1 | Rest 0:45 |
| Work | Press song at its start time | Now Press | Finish | B 1 of 1 | Work 0:40 |
| Finished | none | Status bar and rail hidden. Centered: Finished and the workout name. | | | no clock |

Status bar slots, left to right: exercise slot (Now, Last, or an em dash), Up next, Circuit. No fourth slot. A long name is cut with an ellipsis; “2 of 2” is never cut.

The caption under the player names the exercise whose clip is on screen (the how-to exercise during intro and rest, the current exercise during work), followed by the video state when there is one: clip ended, clip failed, or press OK for sound. Do not add a song-title field.

The rail column is full at the start of a phase and empty as the phase completes. Height equals remaining divided by that phase’s duration. Pause freezes the column.

Digits show the remaining time, rounded up to the next second, as `M:SS`. At the moment the phase completes, the next phase’s full duration appears. The screen must not sit on `0:00`.

## State machine

This machine runs inside `/player` only. The editor does not implement it and does not display a timer.

States: `ready`, `intro`, `work`, `rest`, `finished`. Intro, work, and rest each run or are paused.

The flattened snapshot lists passes in order. A × 2, B × 1, A × 2 becomes five passes: A, A, B, A, A. Each pass carries its circuit’s name, slots, work times, and rest, and its number inside its block. The circuit status is that name and number, not a count across the whole workout.

Session fields: run id, snapshot, pass index, slot index (0-based), phase id, duration, end time, paused flag, remaining time while paused, clip state (loading, playing, ended, failed), load token, last applied command seq.

Every phase has a new phase id. Completing a phase (clock or skip) is ignored if that phase id was already completed. This is the double-advance guard.

Clock and skip transitions:

| From | Event | To |
| --- | --- | --- |
| intro | clock or skip | work, first slot, same pass |
| work | clock or skip, and a slot remains in this pass | rest previewing the next slot; length is this circuit’s rest |
| work | clock or skip, last slot, a pass remains | rest previewing the first slot of the next pass; length is that pass’s circuit rest |
| work | clock or skip, last slot, last pass | finished |
| rest | clock or skip | work for the slot this rest was previewing |

Command table. Every command is cleared and acknowledged, whether applied or ignored. Pause, resume, and skip carry the phase id the editor last saw; if it is not the current phase id, the command is ignored.

| Command | ready | running phase | paused phase | finished |
| --- | --- | --- | --- | --- |
| start | intro for the first pass, running | ignored (server refuses first) | ignored (server refuses first) | ignored (server refuses first) |
| pause | ignored | paused: clock disarmed, video paused | ignored | ignored |
| resume | ignored | ignored | running: clock armed from stored remaining; play only if clip state is loading or playing | ignored |
| skip | ignored | phase completes as if the clock ended | phase completes; the next phase enters paused at full length, its clip cued, not playing | ignored |
| stop | ignored | ready, player destroyed | ready, player destroyed | ready, player destroyed |
| done | ignored | ignored | ignored | ready |

Before applying any command, the player runs the clock check first, so a phase whose time is up completes before the command is applied.

## Pages and database

One process serves both pages and the API. One SQLite file holds the catalogs, one command row, and the player heartbeat. Do not add a message bus, a websocket, a second database, or a server-side timer.

| Page | Writes | Reads |
| --- | --- | --- |
| `/editor` | how-tos, songs, exercises, circuits, slots, workouts, and commands through the API | the catalogs, and the heartbeat with its freshness, so the controls match the TV |
| `/player` | the heartbeat, and the acknowledgement of each command | the command row |

The command row holds: seq (server-assigned, increasing), kind, created at (server clock), the target phase id for pause, resume, and skip, and for start the run id and the snapshot.

- Start is checked by the server when the editor sends it: a fresh heartbeat on Ready, a workout with blocks, every circuit with slots. The server flattens the workout inside one read transaction, stores the snapshot JSON and a new run id in the command row, and answers the editor at once with success or the reason. The player runs only that snapshot.
- The server refuses a new command while the previous one is not yet acknowledged ("Wait a moment, the TV hasn't picked up the last command"). Commands are never queued and never overwritten.
- The player polls about twice a second. Each poll carries the heartbeat and returns the command row. The player applies a command only if its seq is newer than the last one it applied, then acknowledges that seq. Clearing is compare-and-clear on seq.
- A command older than 10 seconds by the server clock is dropped without being applied. A freshly loaded player drops any pending command.
- The heartbeat holds: player instance id, run id, status (`ready`, `running`, `finished`), paused, current phase id, last applied seq, sound blocked. The server stamps it with its own receive time. It is fresh when that time is at most 5 seconds old. The TV's clock is never used for freshness.
- A `current_run` record holds the run id, workout name, and block sequence of the session on the TV. Start sets it; stop and done clear it. The editor reads it to show the running workout after a reload.
- A player whose run id differs from `current_run` drops its snapshot, destroys its YouTube player, and returns to Ready.
- The server records the instance id of the newest player to send its first heartbeat as the active one. Every poll response includes `active: true/false`. A player told it is not active destroys its YouTube player, stops polling, and shows Ready. It does not clear the session.
- The player checks the snapshot as a guard: if it has no passes or a pass has no slots, the player acknowledges the start, stays on Ready, and logs it.
- Start refusal reasons, word for word: “The TV isn't connected.”, “The TV isn't on Ready.”, “This workout has no blocks.”, “Circuit <name> has no slots.”
- The clock between polls is local. A failed poll does not freeze the clock and does not change phase.

Closing `/player` stops the clock. Nothing in the database keeps advancing phases.

## Clock and video

- Work phase length is that slot’s work time. Rest uses the rest of the circuit being previewed. Intro uses the first circuit’s rest. None of these is the length of the YouTube video.
- The clock uses `performance.now()`. When the clock completes a phase, the next phase’s end time is the previous end time plus its duration. On a skip, the next end time is now plus its duration. If a tick runs 1 second or more late (a frozen or throttled tab), the next phase starts from now instead, and the delay is logged. At most one phase completes per tick.
- On pause, store the remaining time and disarm. On resume, arm a new end time from the stored remaining time. Display remaining time from the local end time. If YouTube reports PLAYING while the phase is paused, pause the video again.
- One YouTube IFrame player exists for the whole session. Create it when the session starts with `disablekb: 1`, `controls: 0`, `rel: 0`, `playsinline: 1`, and set the iframe’s `tabindex` to -1. On each phase entry, load that phase’s clip with one call: `loadVideoById` with `startSeconds`, plus `endSeconds` for a how-to; `cueVideoById` instead when the phase enters paused. That call replaces whatever clip is there, including one that failed or ended. Destroy the player on stop and on finished. Two clips must never be audible at once.
- Each load gets a load token (the phase id). The player accepts YouTube events for a load only after the first UNSTARTED, BUFFERING, or CUED event that follows it, and only when the video id matches. Earlier events belong to the previous clip and are ignored.
- The page enforces a how-to’s stop time itself: every 250 ms during a how-to it checks `getCurrentTime()` against the stop time. `endSeconds` is a backup.
- On ENDED, or when the page reaches a how-to’s stop time, call `cueVideoById` for the same clip at its start time and set clip state ended. The caption says clip ended. ENDED does not complete the phase.
- `onError`, or a thrown load, sets clip state failed and the caption says clip failed. No retry in a loop. A later PLAYING event for the same load clears failed.
- The server passes `soundMethod` from `host.json` to `/player`. Sound is blocked only under `press-on-ready` and only until the first key press on the page. Under `site-setting`, sound is never treated as blocked.
- Ready shows the Press OK button while sound is blocked, and nothing else changes on Ready.
- An 8-second timer starts on each `loadVideoById` and each `playVideo()` call (resume, unlock), never on `cueVideoById`. If no PLAYING arrives before it runs out: while sound is blocked, the caption says press OK for sound; otherwise the clip failed. On PLAYING, read `isMuted()`; playing muted while sound is blocked counts as no PLAYING. Use `onAutoplayBlocked` as an early signal when the browser sends it.
- Caption precedence when more than one state applies: clip failed, then clip ended, then press OK for sound.
- When a key press unlocks sound mid-phase: elapsed = duration − remaining. If the phase is paused, only unlock; resume plays later. If clip state is ended or failed, only unlock. For a how-to, if start + elapsed is at or past the stop time, do not play; clip state ended. Otherwise call `seekTo(start + elapsed)`, `unMute()`, and `playVideo()` on the loaded clip. This does not count as a load. The clock has been running the whole time.
- Remote keys: focus stays on the page body during a session. Keydown calls `preventDefault` for arrows, Enter, and Back, and a `history.pushState` guard catches Back as popstate so the page is never left. After sound is unlocked, keys do nothing.
- On a key press, also request fullscreen (unprefixed, then the webkit form) after starting playback, never before. If the page cannot go fullscreen, the browser’s own full-screen mode recorded in `host.json` is used. Request a screen wake lock only if `navigator.wakeLock` exists. Neither is required; the TV’s own settings keep the screen on (see Hosting).
- The iframe fills the video region. The status bar, rail, and caption sit beside it, never over it.
- `/player` sends `Referrer-Policy: strict-origin-when-cross-origin`. YouTube refuses embeds with no referrer (error 153), and this keeps the token out of the referrer.
- Lengths are whole seconds. Work and rest: 1 to 3599. Start times: 0 to 86399. A how-to’s stop time is after its start time and at most 600 seconds after it. Block count: 1 to 99.

## Editor page

`/editor` is used in a computer browser. There is no phone layout. It uses relative URLs only, so it works under Home Assistant ingress. Five catalogs:

- How-tos: create, edit, delete. Name, URL, start time, stop time. Delete is refused while an exercise points to it, and the editor lists those exercises.
- Songs: create, edit, delete. Name, URL, start time. Delete is refused the same way.
- Exercises: create, edit, delete. A name, a how-to picked from the How-tos catalog, and a song picked from the Songs catalog. Delete shows the preview described in Decisions closed.
- Circuits: name, rest interval, ordered slots (1 to 50). Each slot is an exercise plus a work time. Reorder and repeat exercises. Delete shows the preview described in Decisions closed.
- Workouts: name and an ordered list of blocks (1 to 50). Each block is a circuit and a count. The list stays compact (name, block sequence such as A × 2, B × 1, A × 2, and Start on TV). Selecting a row shows that workout's circuits, rests and slot work times in a detail panel beside the list, per DESIGN.md. Open a workout to change the name or the blocks.

Test play. The How-to and Song forms have a Test play button that loads the clip in a small embedded YouTube player at its start time (and stop time for a how-to), with nothing drawn over it. Save runs the same test. If YouTube reports error 2, 100, 101, or 150, save is refused with the reason: “YouTube can't find this video” (2, 100) or “This video's owner doesn't allow it to play outside YouTube” (101, 150). Any other result saves. Age or region limits that the computer does not hit may still show up on the TV as clip failed.

URLs. Accept hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`, and `youtube-nocookie.com`, in the forms `watch?v=`, `youtu.be/`, and `/embed/`. Ignore `list` and `index`. Refuse `/shorts/` and `/live/`. The video id must match `^[A-Za-z0-9_-]{11}$`. If the URL has `t` or `start` (`90`, `90s`, `1m30s`, `1h2m3s`), prefill the start-time field. Store the video id, not the raw URL. The stored start time is what the player uses.

Save is refused when a name is empty, longer than 40 characters, or already used in that catalog (trimmed, ignoring case); a circuit name is longer than 24 characters or an exercise name longer than 30; a URL does not parse; a test play fails as above; a how-to's stop time is not after its start time or more than 600 seconds after it; an exercise has no how-to or no song; a circuit has no slots or more than 50; a workout has more than 50 blocks; a start time is outside 0 to 86399; a work time or rest is outside 1 to 3599 seconds; a block count is outside 1 to 99, including after merging; or a value is not a whole number. On save, adjacent blocks that name the same circuit collapse into one block and their counts add. A delete whose merge would push a count past 99 caps it at 99, and the preview shows the cap. A workout needs at least one block. Nothing partial is written.

Every save runs in one transaction and checks that each referenced id still exists. Each row has a version; a save from a stale page is refused (409, “This changed in another tab. Reload.”). Ids are `INTEGER PRIMARY KEY AUTOINCREMENT` and are never reused. Foreign keys are on.

TV status pill and controls:

| TV state | Pill | Controls |
| --- | --- | --- |
| Heartbeat stale | TV not connected | Start on TV disabled: “Open /player on the TV.” |
| Ready | TV ready | Start on TV |
| Ready, sound blocked | TV needs a press | Start on TV, with “Press OK on the TV remote for sound.” |
| Running | Running on TV | Pause, Skip, Stop |
| Paused | Paused on TV | Resume, Skip, Stop |
| Finished | Finished on TV | Done; Start on TV disabled: “The TV is on Finished. Press Done.” |

While running or paused, every Start on TV is disabled with “A session is already on the TV.” Editing stays available. Server refusals show their reason word for word. The editor does not show the countdown or the current exercise.

## Failure catalog

Each row is a required behavior and a test. Automated tests use no network and no YouTube; a fake clock and a fake YouTube player stand in. Rows marked TV are manual on the real television.

| # | Condition | Required behavior | Proof |
| --- | --- | --- | --- |
| 1 | A video id errors, is private, or will not embed | The clock finishes the phase. The caption says clip failed. The next phase still starts and plays. | TV. Fixture with one bad id. |
| 2 | A song ends before Work does | The phase continues until the clock ends. The clip is cued; the caption says clip ended. No YouTube end screen or suggestions. Nothing over the iframe. | TV. Song started 10 s before its own end. |
| 3 | Ad or intro plays instead of the movement | Clock still cuts at zero. Skip completes the phase early. The app does not click inside YouTube’s ad UI. | TV. Observe, then press skip. |
| 4 | Sound is blocked | Caption shows press OK for sound. Clock runs. After one OK press, playback seeks into the remaining window, or the clip ends if the window has passed. | TV. Reload the page, no press. |
| 5 | Seek is ignored and the clip plays from 0 | One load. Clock still cuts. | TV. |
| 6 | Phase change | Previous clip is silent within one second. Only one iframe exists. | TV. Listen at a work-to-rest boundary. |
| 7 | Skip aimed at a phase that the clock already completed | Ignored and acknowledged. One transition, one new phase id. The following exercise is not skipped. | Automated. Fake clock: skip carries phase id N, clock enters N+1, then poll. |
| 8 | Resume and the player will not play | Clock runs. Caption says clip failed. | TV. |
| 9 | Command poll fails across a boundary | The clock still changes phase. A skip written during the outage is ignored if its phase id is no longer current, applied once if it is, and dropped if older than 10 s. | TV. Block the poll longer than one interval and press skip during it. |
| 10 | Server process stops mid-session | The open player keeps its clock and its video. After the server restarts, reloading `/player` returns to Ready. | TV. |
| 11 | Workout edited or deleted after start | Running labels, ids, and lengths stay on the snapshot. The next start uses the edited workout. | Automated. |
| 12 | Start with no blocks, an empty circuit, while not Ready, or while the TV is not connected | Refused by the server with the reason. Command row unchanged. Editor shows the reason. | Automated. |
| 13 | Pause, wait, resume | Remaining time continues from the stored value. It does not jump by the paused duration. | Automated. |
| 14 | Skip in intro | Enters work for the first slot of the first pass. Duration 30 seconds in fixture 1. | Automated. |
| 15 | Skip on the last work of the last pass | Finished. No rest phase. | Automated. |
| 16 | Rail at start, middle, and end | Column full, about half, then the next phase at full. Digits do not rest on 0:00. | TV. |
| 17 | Labels for fixtures 1 and 2 | Match both normative tables exactly, including “A 2 of 2” on the rest between passes and “B 1 of 1”, Rest 0:45 on the rest between circuits. | Automated for the labels. TV for the layout. |
| 18 | iframe geometry | Status bar, rail, and caption do not overlap the iframe. Nothing is drawn inside it. | TV. |
| 19 | TV screensaver or sleep | With the settings recorded in Phase 0, the screen stays on through a full workout and 30 minutes idle on Ready. | TV. |
| 20 | Save with any refused value listed in Editor page | Save refused with the reason. Nothing partial is written. | Automated, table-driven, at each boundary. |
| 21 | Player page is closed | The clock stops. The database does not advance the phase. After 5 s the editor shows TV not connected. Reopening `/player` shows Ready and Start is allowed. | Automated. |
| 22 | Workout is A × 2, B × 1, A × 2, and B is deleted | The preview shows A × 2, B × 1, A × 2 → A × 4. The workout becomes A × 4. A running snapshot still contains B. | Automated. |
| 23 | Confirm delete of the only exercise in a circuit | That circuit is deleted. A workout whose blocks all pointed at it is deleted. A workout that also had other blocks keeps them, merging adjacent matches. Cancel changes nothing. A running snapshot is unchanged. | Automated. |
| 24 | Two swing slots, 30 seconds then 30 seconds, and the exercise between them is deleted | Both swing slots remain. They are not merged. | Automated. |
| 25 | Delete a how-to or song that an exercise points to | Refused. The editor lists the exercises. Nothing changes. | Automated. |
| 26 | How-to stop time comes before the rest ends | The clip stops at the stop time, is cued, and the caption says clip ended. It is not replayed. The rest runs to its full length. | TV. 20 s rest, how-to with a 10-second span. |
| 27 | Two commands sent quickly | The second is refused until the first is acknowledged. Both apply in order. A clear never erases a newer command. | Automated. |
| 28 | Stale command | A command older than 10 s, or pending when a player loads, is dropped. The player stays on Ready. | Automated. |
| 29 | Every cell of the command table | Next state, paused flag, command acknowledged, and number of load and play calls match the table. Includes skip while paused (next phase paused, cued) and resume after a clip ended or failed (no play call). | Automated, table-driven. |
| 30 | OK pressed late | Paused: unlock only. Elapsed excludes paused time. Past a how-to’s stop time: no play, clip ended. Otherwise one seekTo to start + elapsed, no extra load. | Automated. |
| 31 | Clock drift and freeze | Eight phases with jittered ticks: entry times equal the sum of durations ± 1 ms. A 200 s freeze: exactly one transition and one load. A pause at end + 5 ms never shows 0:00. | Automated. |
| 32 | Same video id in two phases in a row | An ENDED from the old load is ignored. An ENDED after the new load’s first UNSTARTED is handled. | Automated. |
| 33 | Heartbeat freshness | 4.9 s old is fresh, 5.1 s is stale, by the server clock. A TV clock 120 s off changes nothing. Pause shows Paused on TV and Resume after an editor reload. Under `press-on-ready` with no key press, the editor shows TV needs a press; under `site-setting` it never does. | Automated. |
| 34 | Data safety | A delete preview that changed before confirm is refused (409). A failure mid-delete changes nothing. A stale save is refused (409). A deleted top id is never reused. | Automated. |
| 35 | Security | Add-on shape: on the LAN port, `/editor` and editor APIs answer 403. Container/core shape: without the editor secret, they answer 401. A write with a foreign Origin or Host is rejected. A player API without the token answers 401. A request from a public address answers 403. `/player` sends the referrer policy. | Automated. |
| 36 | Ingress | Served under a fake ingress prefix, every editor asset and API call answers 200. | Automated. |
| 37 | Storage | A database at an older schema version migrates at boot. The catalogs and token survive an add-on update or container rebuild. | Automated; manual for the update. |
| 38 | Sound on the TV | With the method in `host.json`, all 8 phases of fixture 1 have sound. Under `press-on-ready`, a reload shows the Press OK button on Ready, and one press restores sound. | TV. |
| 39 | Ads | Over 3 full runs with the real songs, the number of phases with an ad is recorded. There is no pass threshold; the owner decides what to do with the number. | TV. |
| 40 | Load time | Over 10 passes of fixture 1, the median time from phase start to PLAYING is under 3 s, and later passes are not slower than early ones. | TV. |
| 41 | Remote keys during Work | Arrows, OK, and Back do not pause the video or move focus into the iframe. Back does not leave the page. | TV. |
| 42 | Test play | A song known to refuse embedding is refused at save with the owner reason. A good clip saves. | Manual, in Phase 3. |
| 43 | A second `/player` loads | The first is told it is not active, destroys its player, shows Ready, and stops polling. It does not clear the session. Only the second applies commands. | Automated. |
| 44 | Snapshot guard | A start whose snapshot has no passes, or a pass with no slots, is acknowledged and the player stays on Ready. | Automated. |

## Hosting

Phase 0 records the real install and the real TV in `host.json` at the repo root:

```json
{
  "haInstall": "os | supervised | container | core | unknown",
  "tvDevice": "Fire TV Stick model",
  "tvBrowser": "browser name",
  "userAgent": "",
  "secureContext": false,
  "wakeLock": false,
  "fullscreen": "api | browser-mode | none",
  "soundMethod": "site-setting | press-on-ready",
  "tvSettings": "screensaver and sleep settings applied",
  "soundConfirmed": false
}
```

Then pick one hosting shape. Do not build both.

- `os` or `supervised`: one add-on, one process, one SQLite file in `/data`. The editor and its API answer only through Home Assistant ingress, behind Home Assistant login. The LAN port serves only `/player` and the player APIs, all gated by the token.
- `container` or `core`: the same process runs beside Home Assistant on the LAN, with its data on a required mounted volume. The editor needs its own secret, set once from a URL into a cookie. Link it from Home Assistant as a bookmark, or as an iframe only if Home Assistant itself is served over http.
- `unknown`: stop. Do not guess.

Rules for both shapes:

- The token is 32 random bytes, generated on first run, stored in the data directory, and required on `/player` and every player API. Query strings are never logged. Rotate it by deleting the file.
- Every write needs a JSON body, an allowed Origin, and an allowed Host. The server refuses requests from addresses outside loopback, private ranges, link-local, and the Home Assistant ingress network, and refuses to start if told to bind to a public address.
- The schema version is `PRAGMA user_version`. Migrations run at boot in a transaction. WAL mode, checkpointed on shutdown. The add-on uses Home Assistant’s backup hooks so a backup is never taken mid-write.

## Phases

### Phase 0 — Host record

Write `host.json`.

1. Run a tiny probe page (plain ES5, errors printed on screen) in the Fire TV Stick’s browser. Record the user agent, secure context, wake lock, and fullscreen support. If the page cannot run, try another browser on the stick; if none runs, stop and report.
2. Apply the TV settings that keep the screen on (Fire TV screensaver Never, and any sleep or auto power-off option). Record them.
3. Check whether the browser can allow sound for the site without a key press. If yes, `soundMethod` is `site-setting`; otherwise `press-on-ready`. Confirm a YouTube clip plays with sound by that method, then set `soundConfirmed`.

Exit: `host.json` has an install value other than `unknown`, a named device and browser, a sound method, and `soundConfirmed` true. This phase writes no player.

### Phase 1 — Playback spike on the TV

Build the server skeleton for the hosting shape in `host.json`: the LAN port, the token, the referrer policy, and the real origin and scheme the finished app will use (sound permission is per origin). Build the player layout with fixture 1 baked in and the clock inside the player page. No editor in this phase: a key press on Ready starts the baked fixture (spike only; removed in Phase 2). Include Ready with the Press OK button, the caption video states, remote key handling, the status bar, the visible iframe with nothing over it, and the dropping rail. Lay out the player per the TV section of DESIGN.md.

Exit: TV proofs for catalog rows 1, 2, 4, 5, 6, 16, 18, 19, 26, 38, 39, 40, and 41 pass on the device in `host.json`, and one YouTube player plays all 8 phases of fixture 1 with sound. If one player cannot, stop and report. A desktop browser pass is not enough. Record the proofs in `phase-1-tv.md` with pass or fail per row and the date.

### Phase 2 — Session engine

Implement the state machine and the command table in the player. Add the command row, the heartbeat, and a Start for the baked fixture. Put the session controls on `/editor` against the baked fixture. The editor writes a command. The player applies it. The editor has no timer.

Exit: automated tests cover catalog rows 7, 13, 14, 15, 17, 21, 27, 28, 29, 30, 31, 32, 33, 43, and 44. All of them pass.

### Phase 3 — Editor and save

Persist the five catalogs, slots, and blocks in the same SQLite file. Finish `/editor`, including test play. Start sends the server-built snapshot. Finish hosting from `host.json`: ingress or the editor secret, the security rules, storage, and backups. Do not change phase rules in this phase. Lay out /editor per the Editor section of DESIGN.md.

Exit: catalog rows 11, 12, 20, 22, 23, 24, 25, 34, 35, 36, and 37 pass, and row 42 passes by hand. A manual check shows the catalogs surviving a process restart, a second Start refused, and an edit during a run leaving the TV on the snapshot.

### Phase 4 — Dress rehearsal

Run fixtures 1 and 2 as saved workouts on the TV, started from the editor. Then run the failure rows that need the real page: 1, 3, 6, 8, 9, 10, and 17 (layout).

Exit: `phase-4-tv.md` records pass or fail for those rows on the device in `host.json`. Every row passes. The finished screen shows the workout name and waits for Done.

## Order rule

Phase 1 exists so a bad TV browser is discovered before the editor exists. Do not build persistence, accounts, or extra screens to make the spike look finished. Do not weaken a test to match what the TV happened to do.
