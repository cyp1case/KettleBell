# PLAN.md review

Date: 2026-11-01. Four reviewers read PLAN.md, DESIGN.md and spike/FINDINGS.md from different angles: consistency, state machine and commands, data model and hosting, and YouTube and TV risk. Their 73 findings are merged below into **22 decisions** and **one batch of text fixes**. Reviewer IDs (C-, S-, D-, Y-) are kept so each point can be traced.

Each decision has a recommendation (★) and a self-test that proves the fix.

**Status (2026-11-01): all applied to PLAN.md and DESIGN.md.** The owner chose:
- **1:** A, cue the clip and show states in the caption.
- **4:** sound through the TV browser only. Phase 0 checks for a per-site setting; otherwise, one OK press on Ready. No Home Assistant key presses, kiosk apps, or native apps.
- **8:** skip while paused stays paused.
- **19:** add Test play in the editor.
- **22:** the editor is allowed through HA remote access, behind HA login.

All other decisions use the ★ recommendation. One deviation from 2/13: Start now needs a fresh heartbeat (the TV must be connected), because stale commands are dropped after 10 s anyway. The self-tests are now failure-catalog rows 7 and 12–44 in PLAN.md. A second reviewer then checked the rewrite. It found 14 smaller gaps (for example, a skip lengthening the next phase, three meanings of "sound blocked", and the run record lost after the command row moves on); all are fixed.

## Summary

| # | Decision | Severity | Recommendation |
| --- | --- | --- | --- |
| 1 | Covering the YouTube player breaks YouTube's rules | Blocker | Stop covering it; cue the clip and put messages beside the player |
| 2 | Commands get lost, applied late, or hit the wrong phase | Blocker | Numbered commands aimed at a phase id; drop stale ones |
| 3 | The editor can't know paused, errors, or what will run | Blocker | Player reports paused and phase; server checks Start and stores the snapshot |
| 4 | A TV remote can't "tap" | Blocker | A real focused button, pressed once on Ready |
| 5 | Wake lock doesn't work over plain HTTP | Blocker | Rely on the TV's own settings; wake lock is best effort |
| 6 | Anyone on the LAN can use the editor | Blocker | Editor only via HA ingress (or its own secret); token on every player API |
| 7 | Phase exits need features from later phases | Blocker | Move the server skeleton to Phase 1 and rows 11 and 12 to Phase 3 |
| 8 | Many state and command pairs are undefined | High | A full state × command table |
| 9 | Late-tap catch-up math is undefined | High | Elapsed excludes pauses; past the stop time means no play |
| 10 | Autoplay detection gives false failures and silent passes | High | Wait 8 s; detect muted playback |
| 11 | The clock drifts, and a frozen tab cascades | High | `performance.now`; at most one phase change per tick; clock before command |
| 12 | Old-clip filter fails when the same video repeats | Medium | A load token, not the video id alone |
| 13 | The heartbeat has no number and trusts two clocks | Medium | Server-stamped, stale after 5 s |
| 14 | Finished blocks Start until someone presses Done | Medium | A clear message, with Done next to Start |
| 15 | Ads may eat whole intervals | Medium | Measure on the TV in Phase 1 |
| 16 | Old TV browsers can't run the page | Medium | Run a probe page first |
| 17 | TV load times and long sessions are unmeasured | Medium | A Phase 1 timing target |
| 18 | Deletes and concurrent edits can corrupt data | Medium | One transaction, a checked preview, version column, AUTOINCREMENT ids |
| 19 | Validation has gaps (empty circuits, no limits, URL forms) | Medium | Refuse empty circuits; set limits; a fuller URL parser |
| 20 | Long or duplicate names break the TV labels | Medium | Unique names with a length cap; truncate the name, never "n of m" |
| 21 | Where data lives, plus backups and migrations, are unstated | Medium | `/data`, `user_version` migrations, backup hooks |
| 22 | HA ingress paths and remote access | Medium | Relative URLs; owner decides on remote access |
| T | Text fixes (no decision needed) | Low | Apply as a batch |

---

## 1. Covering the YouTube player breaks YouTube's rules — Blocker (Y-3)

**Problem.** YouTube's Required Minimum Functionality forbids overlays or other elements in front of any part of an embedded player (https://developers.google.com/youtube/terms/required-minimum-functionality). The plan covers the iframe with the clip-ended panel (decided earlier today), the Clip failed overlay, and the Tap prompt. PLAN.md also contradicts itself: "The iframe fills the video region and is not covered by the status bar or the rail."

**Options**
- **A ★** When a clip ends, call `cueVideoById` for the same clip. The player then shows its thumbnail, with no suggestions. "Clip ended" and "Clip failed" become text in the caption line under the player, and the Tap prompt moves to Ready (see 4). Pro: nothing covers the player. Con: a still thumbnail with a play icon stays on screen.
- **B** Collapse the iframe (size 0) and show the panel in its place. Pro: a clean screen. Con: close to "do not hide the player", and some engines reload a resized iframe.
- **C** Keep the overlays and accept the risk. Pro: matches DESIGN.md. Con: knowingly breaks the rules.

**Self-test.** TV: a how-to reaches its stop time. No end screen or "More videos" strip appears, nothing sits over the iframe, and the caption reads Clip ended. Automated: on ENDED, the fake player gets exactly one `cueVideoById` and no `playVideo`.

## 2. Commands get lost, applied late, or hit the wrong phase — Blocker (C-1, C-3, S-1, S-2, S-3, S-5, D-4, D-7, D-10)

**Problem.** There is one command row, and commands carry no phase id, number, or timestamp. Five things go wrong:
- **Wrong phase.** A Skip pressed at 0:00 lands after the clock has already moved on, so it skips the *next* exercise, even with no outage. Row 7's test only checks the trivial case.
- **Lost commands.** Pause followed by Skip within 0.5 s loses the Pause. The player can also read one command and then clear a different one that arrived in between.
- **Stale commands.** A Start pressed while the TV was off runs the next time the TV opens `/player`.
- **No run id.** "run id" appears once and is never defined.
- **Two players.** A second `/player` tab steals commands from the TV.

**Options**
- **A ★** "Command protocol v2":
  - The server stamps each command with `seq`, `createdAt` (server clock) and, for Start, a `runId`.
  - The heartbeat reports `phaseId`, `paused` and `lastAppliedSeq`.
  - Pause, resume and skip carry the `phaseId` the editor last saw, and the player drops one that doesn't match.
  - The player clears only `WHERE seq = ?`.
  - The server refuses a new command until the last one is acknowledged.
  - Commands older than 10 s are dropped.
  - A freshly loaded player clears anything pending.
  - Only one player client is active; any other shows Ready.
- **B** A timestamp only, dropping commands older than the current phase. Pro: smaller. Con: still loses overwritten commands and depends on two clocks.
- **C** Last-writer-wins, documented. Con: lost Stops and skipped exercises.

**Self-test (automated, fake clock)**
- Skip aimed at phase 2 is applied after the clock enters phase 3: no transition.
- Pause (seq 1) then Skip (seq 2) before a poll: the server refuses seq 2 until seq 1 is acknowledged, then both apply in order.
- A Start 60 s old at player load: the player stays on Ready and the row is cleared.
- Two players: only the active one clears commands.

## 3. The editor can't know paused, errors, or what will run — Blocker (C-2, C-3, S-4, S-9, D-5, D-6, D-21)

**Problem.** The player reports only ready, running or finished.
- **Pause or Resume.** The editor can't choose the right button, which is DESIGN.md Open question 3.
- **Errors.** "Error on the editor" has no channel to travel on.
- **Snapshot.** The player looks the workout up from live tables after it polls, so a delete or edit in that window changes what runs, or makes the workout 404.

**Options**
- **A ★** The heartbeat adds `paused` and `phaseId` (shared with 2). The server validates and flattens the workout when Start is written, and returns any error to the editor at once. It stores the snapshot JSON in the command row, and the player runs only that. A player-side check stays as a guard.
- **B** The player writes back a `lastCommandResult`, and the editor polls it. Con: slower, and the fetch gap remains.

**Self-test (automated)**
- Pause, then reload the editor: it shows Resume.
- Start a workout with an empty circuit: an error comes back with the reason, and the command row is unchanged.
- Start, then delete the workout before the poll: the TV still runs the original.

## 4. A TV remote can't "tap" — Blocker (Y-1, Y-2, Y-13)

**Problem.** Remotes send key presses, not taps. The prompt is a `div` with a click handler, so OK does nothing. Sound permission is also lost on every reload: server restart, TV standby, a discarded tab. In the planned flow the prompt appears partway through the intro, which means a race across the room against a 20 s clock.

**Options**
- **A ★** Ready shows one focused button, "Press OK to enable sound". Any key except Back counts as the press. The heartbeat reports `soundUnlocked`, and the editor warns "TV needs a press" before Start. A mid-phase prompt remains only as a fallback, beside the player (see 1).
- **B** Keep the mid-phase prompt and rely on pointer remotes. Con: fails on Fire TV, Android TV and most Samsung remotes.

**Self-test.** TV, remote only, pointer mode off: press OK on Ready, start from the editor, and sound plays on all 8 phases. Reload, and the editor shows "TV needs a press".

## 5. Wake lock doesn't work over plain HTTP — Blocker (D-3, Y-5)

**Problem.** The Screen Wake Lock API exists only on HTTPS or localhost (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). The player is served over plain HTTP, so row 19 can't pass the way it's written. TVs also have their own screen savers and auto power-off timers that apply on Ready and Finished.

**Options**
- **A ★** Treat wake lock as best effort. The TV settings recorded in Phase 0 (screen saver off, auto power-off off or long, eco off) become the required control. Row 19 becomes "the screen stays on for 30 min idle on Ready and through a full workout".
- **B** Serve `/player` over HTTPS on the LAN. Con: TV browsers often reject local certificates.

**Self-test.** TV: the log shows `isSecureContext` and the wake lock result. Run a full workout, then leave Ready idle for 30 min with no remote input. The screen stays on.

## 6. Anyone on the LAN can use the editor — Blocker (D-1, D-2, D-9, D-15, Y-9)

**Problem.** Five gaps:
- **Open editor.** The port the TV uses for `/player` also serves `/editor` and its API, with no login. In container mode the editor has no protection at all.
- **No CSRF or rebinding guard.** Any web page you visit can send a POST to the API.
- **Token scope.** The token guards only the player page, not the player's own APIs.
- **"LAN only" isn't enforceable as written.** The app can't tell whether a router forwards its port.
- **Referrer policy.** YouTube now refuses embeds that send no referrer (error 153), and older engines send the full URL, token included.

**Options**
- **A ★**
  - Add-on: editor routes answer only through ingress, and the LAN port serves only token-gated player routes.
  - Container: the editor needs its own secret.
  - Every write requires JSON plus an Origin check plus a Host allowlist.
  - The token is 32 random bytes and is required on every player API.
  - The server rejects requests from non-private addresses.
  - `/player` sends `Referrer-Policy: strict-origin-when-cross-origin`.
- **B** Write down "any LAN device is trusted". Con: a guest's phone can wipe the catalogs.

**Self-test (automated)**
- `/editor` and `/api/*` on the LAN port without ingress: 403.
- A POST with a foreign Origin: rejected.
- A player API without the token: 401.
- A request from 8.8.8.8: 403.
- The `/player` response header shows the referrer policy.

## 7. Phase exits need features from later phases — Blocker (C-10, D-8, C-19)

**Problem.** Three gaps:
- **Phase 2 exit.** It tests rows 11, 12 and 21, which need saved workouts and Start (Phase 3). Phase 2's command row is also persistence, which the Order rule forbids.
- **Phases 1 and 2** need a server reachable from the TV and a token, but hosting comes in Phase 3. Phase 1 also needs to run on the production origin, because sound permission is per origin.
- **No player-mode gate.** Nothing in Phase 1 confirms one-player mode on the TV.

**Options**
- **A ★**
  - Phase 1 builds the server skeleton: LAN bind, token, the real origin and scheme.
  - Phase 2 may add the command row and a Start for the baked fixture.
  - Rows 11 and 12 move to the Phase 3 exit.
  - Phase 1's exit adds: "one player plays all 8 fixture phases with sound after one press; if not, stop and report."
- **B** Test rows 11 and 12 against an in-memory fake in Phase 2. Con: "Editor shows why" stays untested.

**Self-test.** A text check: every row in a phase's exit uses only features built in that phase or earlier.

## 8. Many state and command pairs are undefined — High (C-5, C-6, S-6, S-10)

**Problem.** Several pairs have no defined behavior:
- skip while paused
- pause while paused
- resume after a clip ended or failed (it restarts the audio behind the panel, breaking "not replayed")
- pause while a clip is still loading (the clip starts playing anyway)
- done while running
- any command in Ready

"Does nothing" also doesn't say the command is cleared, and an uncleared command blocks the single row.

**Options**
- **A ★** A full table of 6 commands × (ready, running, paused, finished). Every cell is a transition or "ignored, cleared, reported as rejected".
  - Skip while paused: the next phase starts **paused**, at full length.
  - Resume: play only if the clip hasn't ended or failed.
  - A PLAYING event while paused: pause again.
- **B** The same table, but skip while paused enters the next phase running. Pro: matches "completes the phase the same way the clock would". Con: the TV starts moving while you think it's paused.

**Self-test.** Automated, table-driven: every cell asserts the next state, the paused flag, an empty command row, and the number of load or play calls. ENDED, then pause, then resume: zero play calls.

## 9. Late-tap catch-up math is undefined — High (C-7, S-12, Y-7)

**Problem.** Three gaps:
- **"Elapsed" includes paused time,** so the catch-up can seek minutes ahead.
- **Seeking past a how-to's stop time** plays the rest of the video.
- **The "one load per phase" rule** doesn't say whether the catch-up counts as a load.

Separately, YouTube doesn't document whether `endSeconds` fires ENDED.

**Options**
- **A ★**
  - Elapsed = duration − remaining.
  - If start + elapsed ≥ stop, don't play; mark the clip ended (see 1).
  - A press while paused only unlocks sound.
  - The catch-up is `seekTo` plus `playVideo` on the loaded clip, which doesn't count as a load.
  - The page checks `getCurrentTime() ≥ stop` every 250 ms; `endSeconds` is a backup.
- **B** On a press, start playing from the next phase. Con: the current phase stays silent.

**Self-test (automated, fake player)**
- Pause at 15 s left, wait 120 s, press: no play.
- Resume, then press at 12 s left: `seekTo(start + 8)`.
- Press past the stop time: clip ended, no seek.

TV: row 26 with a late press.

## 10. Autoplay detection gives false failures and silent passes — High (S-7, Y-11)

**Problem.** "Blocked" is guessed from no PLAYING event within 3 s, but the very first desktop load took 3.5 s, and TVs are slower. Some browsers autoplay **muted** instead of refusing, which reports PLAYING with no sound. An ad also reports PLAYING.

**Options**
- **A ★**
  - No PLAYING within 8 s **and** no user activation: show the press prompt, not "failed".
  - "Failed" comes only from onError, or from no PLAYING within 8 s after a press.
  - A later PLAYING clears "failed".
  - Log `isMuted()` and `getVolume()` on PLAYING; muted counts as "needs press", and the press unmutes.
  - Use the `onAutoplayBlocked` event when the browser sends it.
- **B** Keep 3 s. Con: flaky rows 1 and 4.

**Self-test.** Automated: no gesture and no PLAYING for 8 s gives the prompt with failed false. PLAYING at 3.5 s shows nothing. Muted PLAYING gives the prompt. TV: a no-press run logs the muted state.

## 11. The clock drifts, and a frozen tab cascades — High (S-8, S-11)

**Problem.** Three gaps:
- **Drift.** The plan doesn't say which clock to use or how to arm the next phase. Re-arming from "now" adds a little lateness every phase.
- **Frozen tab.** A tab frozen by an input switch or dimming either loses minutes silently, or fires several phases at once.
- **Pause at 0:00.** A pause applied after the time is up but before the tick freezes the screen on 0:00.

**Options**
- **A ★**
  - Use `performance.now()`.
  - The next end time = the previous end time, unless the tick is 1 s or more late; then start from now and log it.
  - Never more than one phase change per tick.
  - Before applying any command, run the clock check first.
- **B** Always arm from now. Con: drift, and freezes go unseen.

**Self-test (automated, fake clock)**
- Eight phases with jittered ticks: entry times equal the sum of durations ±1 ms.
- A 200 s freeze: exactly one transition and one load.
- A pause at end + 5 ms: digits never show 0:00.

## 12. Old-clip filter fails when the same video repeats — Medium (S-13)

**Problem.** The spike drops events whose video id isn't the current clip. The same video can legally be both a how-to and a song, so a late ENDED from the old clip puts the panel over the new one. An error can also arrive before the video id updates, and get dropped.

**Options**
- **A ★** Each load gets a token (the phase id). Accept events only after the first UNSTARTED, BUFFERING or CUED following that load, and only when the video id matches.
- **B** Video id only. Con: fails on repeats.

**Self-test.** Automated: the same id V for work and rest. ENDED before UNSTARTED is ignored. ENDED after UNSTARTED is handled. An error with the old id is still marked failed.

## 13. The heartbeat has no number and trusts two clocks — Medium (C-11, S-5, D-22)

**Problem.** "A few seconds" is undefined (DESIGN.md Open question 5). If freshness is compared using the TV's clock or the computer's clock, a skew between them can make the TV look gone or alive forever.

**Options**
- **A ★** The server stamps the heartbeat on receipt. The player sends one every 1 s. Stale means more than 5 s old. The API returns `{status, fresh}`.
- **B** 2 s and 10 s. Pro: very tolerant. Con: slower recovery.

**Self-test.** Automated with a fake server clock: 4.9 s is fresh and 5.1 s is stale. A TV clock 120 s off has no effect.

## 14. Finished blocks Start until someone presses Done — Medium (S-15)

**Problem.** If nobody presses Done, the TV sits on Finished and Start is refused with "a session is already on the TV", which is misleading.

**Options**
- **A ★** The editor says "The TV is on Finished. Press Done." and shows Done next to the disabled Start.
- **B** Start while Finished means Done, then Start. Pro: one press. Con: changes a state machine row.
- **C** Return to Ready automatically after N minutes. Con: a new timer.

**Self-test.** Automated: in Finished, Start is refused with that reason. Done, then Start, enters the intro.

## 15. Ads may eat whole intervals — Medium (Y-6)

**Problem.** Official music videos usually carry pre-roll ads, and a 15–30 s ad can fill a 20 s rest. With one player, every load is a fresh chance for an ad. The desktop runs saw none, and only the TV will show the real rate.

**Options**
- **A ★** Measure it in Phase 1: three full runs with the real songs, pressing Mark at each ad and counting the affected phases. The owner decides afterwards: accept them, sign in to Premium, or choose other clips.
- **B** Sign the TV in to Premium now. Con: costs money, and it may not apply inside embeds.

**Self-test.** The TV script step for ads. Count the ad-affected phases per run.

## 16. Old TV browsers can't run the page — Medium (Y-4)

**Problem.** The spike uses modern JavaScript and CSS (`?.`, `??`, `aspect-ratio`). Many TVs ship Chromium older than version 80, where the script won't even parse. "Start does nothing" would then look like a YouTube problem.

**Options**
- **A ★** First, a tiny ES5 probe page. It shows the user agent and errors on screen, and reports secure context, wake lock and fullscreen support, the viewport, and whether user activation is tracked. Transpile the spike only if the TV is older than Chromium 88.
- **B** Run the spike as is. Con: a failure won't say why.

**Self-test.** The probe shows its readout, and the user agent appears in `spike/logs/`.

## 17. TV load times and long sessions are unmeasured — Medium (Y-12)

**Problem.** On the laptop, each phase started with 0.3–2 s of black. On a TV, 3–6 s is plausible, and a 30+ min session in one player may slow down over time.

**Options**
- **A ★** Phase 1 records the median and maximum time from phase start to sound over a 10-pass session. Pass: median under 3 s, and no upward trend.
- **B** Only the short fixture. Con: misses slowdown.

**Self-test.** The `msToPlaying` summary in the spike logs.

## 18. Deletes and concurrent edits can corrupt data — Medium (D-11, D-17, D-18)

**Problem.** Four gaps:
- **No transaction.** The delete cascade (slots, then circuits, then blocks, merge, workouts) isn't required to run in one transaction.
- **Missing merges.** The exercise-delete dialog doesn't list the block merges it causes.
- **Stale previews.** Another tab can change the data between the preview and the confirm.
- **Concurrent edits.** Two tabs can save over each other, or point a slot at an exercise that was just deleted.

SQLite foreign keys are also off by default, and deleted ids can be reused.

**Options**
- **A ★**
  - One preview endpoint lists everything the delete will do, including merges, and returns a hash.
  - Confirm recomputes inside `BEGIN IMMEDIATE`, and returns 409 if the hash changed.
  - `PRAGMA foreign_keys=ON`.
  - A `version` column on each row, with 409 on a stale save.
  - `AUTOINCREMENT` ids.
- **B** One transaction only, last writer wins. Con: silent lost edits.

**Self-test (automated)**
- The preview lists "W: A×2, B×1, A×2 → A×4".
- Data changed between preview and confirm: 409.
- A failure injected mid-cascade: nothing changes.
- A stale-version save: 409.
- Delete the highest id and create again: a new, larger id.

## 19. Validation has gaps (empty circuits, no limits, URL forms) — Medium (C-12, D-12, D-13, D-19, D-23, Y-8, Y-15)

**Problem.** Five gaps:
- **Empty circuits** can be saved, although Start refuses them and deletes remove them.
- **No upper limits.** A count of 1e9 crashes the TV, and work of 3600 s or more breaks `M:SS`.
- **URL forms.** `shorts`, `m.`, `music.`, `nocookie`, `t=1m30s`, `&list=`, and other hosts with `v=` aren't handled.
- **Typo'd stop times** (900 instead of 90) are accepted.
- **Embed-blocked songs** are only discovered mid-workout.

**Options**
- **A ★**
  - Refuse saving a circuit with no slots.
  - Limits: count 1–99, work and rest 1–3599 s, at most 50 slots and 50 blocks, names 1–40 characters, whole seconds only, a how-to span of 600 s or less.
  - Parser: a host allowlist (youtube.com, www, m, music, youtu.be, youtube-nocookie) with the forms watch, embed and youtu.be. Shorts and live are refused. The id must match `^[A-Za-z0-9_-]{11}$`. `t` is parsed as h/m/s. Store the canonical id.
  - Embed check: run-time handling only, unless you approve an editor "test play" (a new feature).
- **B** Keep the plan's three URL forms, with strict id checks. Con: rejects common pasted links.

**Self-test.** Automated, table-driven: each URL form, including `t=1m30s` giving 90 and `evil.com/watch?v=…` being rejected. Each limit at its boundary. Saving a circuit with zero slots is refused.

## 20. Long or duplicate names break the TV labels — Medium (D-20)

**Problem.** A status-bar slot fits about 14–16 characters at 64 px. Long circuit or exercise names wrap or overflow, and duplicate names are impossible to tell apart.

**Options**
- **A ★** Names are unique per catalog (trimmed, case-insensitive). Circuit names are at most 24 characters, exercise names at most 30. The TV truncates the name with an ellipsis and never cuts off "2 of 2".
- **B** Shrink the font to fit. Con: the layout varies.

**Self-test.** Automated: a duplicate or a 25-character circuit name is refused. TV: a 24-character name fits on one line with "2 of 2" intact.

## 21. Where data lives, plus backups and migrations, are unstated — Medium (D-16)

**Problem.** If the database and token sit in the container's own layer, an add-on update wipes every catalog. An HA backup taken in the middle of a write can be inconsistent. There's no schema version to migrate from.

**Options**
- **A ★** The database and token live in `/data` (add-on) or a required volume (container). `PRAGMA user_version` drives migrations, run at boot inside a transaction. WAL with a checkpoint on shutdown, plus add-on backup hooks.
- **B** Rely on HA backups as they are. Con: a restore may be corrupt.

**Self-test.** Automated: boot on an old-version database and the migration applies. Manual: after an add-on update the catalogs and token survive; a restored backup passes `integrity_check`.

## 22. HA ingress paths and remote access — Medium (D-14)

**Problem.** Ingress serves the add-on under `/api/hassio_ingress/<token>/`, so absolute paths like `/editor` or `/api/...` hit Home Assistant instead and break. In container mode, an `http` editor inside an `https` HA iframe is blocked. With Nabu Casa, the ingress editor can be reached from the internet, which contradicts "The app stays on the LAN".

**Options**
- **A ★** Relative URLs only. In container mode, use a bookmark (or an iframe only when HA itself is on http). **You decide:** is the editor via Nabu Casa allowed, behind HA login? If so, "LAN only" applies to the player port only.
- **B** Refuse ingress requests from non-LAN addresses. Con: fragile behind proxies.

**Self-test.** Automated: serve the editor under a fake ingress prefix; every asset and API call returns 200. Manual: open it through HA on the real install.

---

## T. Text fixes (no decision needed)

1. **Product** describes an intro at every block. It should be one intro per session (C-4).
2. **Normative timeline, Circuit column:** "1 of 2" becomes "A 1 of 2", which also closes DESIGN Open question 4 (C-8, S-14). Add a second fixture, A×2 then B×1 with B's rest at 45 s, to pin the A→B rest label and length.
3. **Finished row** of the timeline says the status bar is hidden (C-9).
4. **Add "Pass" to Words.** Replace "circuit N", "circuit count" and "Workout count" with pass and block wording (C-13).
5. **Slot numbering:** "first slot" in prose, 0-based only in the state machine (C-14).
6. **Words:** split Intro from Rest. Rest length is the length of the circuit being previewed (C-15).
7. **Stale lists:**
   - Commands: list all six (start, pause, resume, skip, stop, done).
   - Database contents: the five catalogs, slots, blocks, the command row, heartbeat and status.
   - "seeks" becomes "loads" (C-16).
8. **Failure catalog:**
   - Move row 21 after row 20 (C-17).
   - Add row 17's TV part to the Phase 4 exit.
   - Row 2's proof becomes "a song ending during Work" (C-18).
9. **Editor UI text:**
   - Pill states: TV ready, Running on TV, Paused on TV, Finished on TV, TV not connected.
   - The button label is "Start on TV".
   - Write the disabled reasons word for word (C-20).
10. **Remote focus:**
    - Player vars `disablekb: 1`.
    - Iframe `tabindex="-1"`.
    - Fullscreen tries unprefixed, then webkit, and plays before awaiting it (Y-10, Y-14).
11. **spike/FINDINGS.md:** "Recreate = PLAN.md today" is out of date (C-19).

---

## TV test script

Run with the spike once it has these changes (none are made yet):
- an ES5 probe and an environment log (16)
- a focusable press button, with Enter or OK counting as the press (4)
- how-to stop times with page-side enforcement and the cue-on-end behavior (1, 9)
- `isMuted` logging (10)
- a referrer meta tag (6)

1. On the PC: `node spike/server.js --lan`. Allow Node on Private networks. Enter the real clips, set Player to "One player, swap video", and press **Save for the TV**.
2. **Probe.** Open the TV URL. Record the user agent, secure context (expected false), wake lock, fullscreen support and the viewport. If the page is blank or dead, the engine is too old (16).
3. **Press-first run (`/?tv`).** Remote only: press OK on Start. Run the full fixture. Pass when:
   - every phase has sound
   - the old clip is silent within 1 s at each boundary (row 6)
   - there is one iframe throughout
   - time-to-sound is logged
4. **No-press run.** Reboot the TV or clear site data, then open `/?tv=auto`. Record whether the intro is silent with the prompt, playing muted, or playing with sound. Silent with no prompt is a fail (10).
5. **Press OK on the prompt.** The log shows the press, fullscreen, wake lock, the catch-up and PLAYING. During Work, press arrows, OK and Back; record any pause the page didn't cause, and whether Back leaves fullscreen.
6. **Reload.** Reload `/?tv=auto` and start: does sound need a press again? Leave Ready idle for 30 min, then start again (4).
7. **Bad clips.** Tick the bad-id box, then try one embed-blocked video and one age-restricted video. Each shows failed, the clock runs, and the next phase plays (row 1).
8. **Stop time and early end.** Set a 10 s how-to span with a 20 s rest, and start a song 10 s before its end. Pass when:
   - the clip stops on time
   - no end screen appears and nothing replays
   - the rest runs its full length (rows 2 and 26)

   Repeat once with a late press.
9. **Ads.** Three full runs with the real songs. Press Mark for each ad and count the affected phases. Press Skip during one ad (row 3, decision 15).
10. **Performance.** Run 10 passes in reuse mode, then 2 passes in new-player mode. Compare median and maximum time-to-sound (17).
11. **Sleep.** With the Phase 0 TV settings applied, run 10 passes, then leave Finished or Ready idle for 20+ min (row 19, decision 5).
12. **Production origin.** Repeat steps 3–6 from the host and port the real `/player` will use. Sound permission is per origin.
13. Copy `spike/logs/run-*.json` and record pass or fail per row, with the date, in `phase-1-tv.md`.

**If something fails**
- **The page won't run:** transpile and retry. Then try another browser on the HDMI path (for example a streaming stick). If none works, stop and report.
- **No sound even after a press:** try the TV's per-site autoplay setting, then another browser. If none works, stop and report. Cast, hidden audio and downloads stay forbidden.
- **Sound needs a press after every reload:** the press-on-Ready flow (decision 4) covers it.
- **Muted autoplay:** unmute on the press (decision 10).
- **Wake lock unsupported:** expected. Rely on the TV settings, then try HTTPS. If the screen still sleeps, row 19 fails.
- **`endSeconds` unreliable:** the page-side stop check becomes required (decision 9).
- **Ads in most phases:** you decide between Premium, other clips, or accepting them.
