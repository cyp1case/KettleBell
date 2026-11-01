# Playback spike — findings

Date: 2026-11-01. Browser: the Claude desktop app's built-in browser (Chromium) on a Windows laptop. **Not the TV.** PLAN.md Phase 1 says a desktop pass is not enough, so treat this as a first look only.

Test clips:

| Role | Video | Start |
| --- | --- | --- |
| Swing how-to | How To Kettlebell Swing (in 3 minutes), Zack Henderson, `bDCeXbMJVNs` | 34 s (Step 1) |
| Squat how-to | How to Goblet Squat (with Kettlebell), Coach Gabe West, `QilYZ20kVfM` | 36 s (stance) |
| Swing song | Survivor, Eye Of The Tiger (Official HD Video), `btPJPFnesV4` | 30 s |
| Squat song | Europe, The Final Countdown (Official Video), `9jK-NcRmVcw` | 30 s (run 1), 285 s (run 2) |

Raw logs: `spike/logs/run-*.json`.

## Run 1: the PLAN.md fixture (Swing 30 s, Squat 60 s, rest 20 s, 2 passes), started with a click

| Check | Result |
| --- | --- |
| All four clips embed and play, including a VEVO official video | Pass |
| `seekTo(start)` on ready lands on the start time | Pass. Every clip read start +1.2 s at a check 1.2 s after PLAYING |
| Phase order and labels match the normative timeline | Pass by eye (Now —, Swing, A 1 of 2 → Now Swing, Squat → … → Finish) |
| Only one iframe at a time; zero after teardown | Pass in every phase |
| Clock cuts the clip at zero | Pass |
| Pause freezes the clock and pauses the video; resume restarts both | Pass |
| Skip completes the phase; two skips in a row move two phases | Pass |
| Finished screen, iframe removed, log saved | Pass |
| Time from phase start to sound | **3.5 s for the first clip**, then 0.5–2.3 s |

## Run 2: no click before start (`?tv=auto`), bad how-to id, song that ends early

| Check | Result |
| --- | --- |
| Autoplay with sound and no user gesture | **Played unmuted at volume 100.** The built-in browser does not enforce normal autoplay rules, so this proves nothing about the TV |
| Bad video id | `onError` code **150**. Clip failed shown, clock kept running, next phase started normally |
| Song reaches its end mid-Work (started 12 s before the end, 60 s work) | `ENDED` logged, phase continued to its full length. **The remaining ~45 s was silent, and YouTube showed its end screen with a replay button and a "More videos" strip** |

## Runs 3–5: new player each phase vs one player that swaps videos

The spike's Player setting picks the mode. Recreate = PLAN.md today (destroy the player, create a new one, seek, play). Reuse = one player for the whole workout; each phase calls `loadVideoById({ videoId, startSeconds })`, and the player is destroyed only on Stop or Finished. Runs 3 and 4 used the same fixture and timing (skip after 6 s), with a warm cache.

| | Recreate (run 4) | Reuse (run 3) |
| --- | --- | --- |
| Players created in 8 phases | 8 | 1 |
| Phase start to PLAYING | 525–761 ms, typically ~600 | 283–2121 ms, typically ~400 (two slow phases were buffering) |
| Seek lands on the start time | 8 of 8 | 8 of 8 |
| Iframes on the page | Never more than 1 | Always exactly 1 |
| Old clip stops | At destroy | ~30 ms after the load call (logged as PAUSED) |

Run 5, reuse mode, failure cases:

| Check | Result |
| --- | --- |
| Bad id inside the reused player | Error 150, clip failed, clock ran on |
| Next phase after that error | Loaded and played normally (squat song at 285 s) |
| Song ends early, then the next phase | ENDED logged, phase continued; the next load replaced the end screen and played normally |
| Late events from an old clip | None seen. The video-id check never had to drop one |

Takeaways:
- On this computer the speed difference is small, ~0.2 s. The 3.5 s in run 1 was a cold first load, not the mode.
- Reuse is simpler code (one call per phase, no separate seek) and recovers from errors and ended clips.
- What matters most is still untested: on a strict TV browser, a single tap may unlock sound for one long-lived player but not for each new one. A TV also creates iframes more slowly than a laptop. **Run both modes on the TV.**

## What this means for PLAN.md

1. **Streaming works in principle.** Embed, seek, cut, destroy/recreate, pause, skip and error handling all behave as the plan assumes.
2. **Every phase starts with ~0.3–2 s of black and silence** (3.5 s on a cold first load). **Decided 2026-11-01: one player per session** (reuse mode), chosen for simplicity. PLAN.md's Clock and video section now says so. The TV run should still confirm it.
3. **Error codes:** a bad id came back as 150, not 100. The plan already treats any `onError` as clip failed, so no change is needed. Tests shouldn't expect a specific code.
4. **A clip that ends early leaves YouTube's end screen up**, and its suggestions can be clicked. The plan says only that `ENDED` doesn't end the phase. **Decided 2026-11-01: a clip-ended panel covers the video region** until the phase ends (PLAN.md Clock and video, DESIGN.md Overlays).
5. **Not tested yet, and these are the real risks:** the TV browser's autoplay policy (the tap prompt), fullscreen and wake lock, ads before a clip, the audio at a phase boundary (can't hear it from here), and screen sleep. These need the run on the TV.

## Running it on the TV

1. Stop the local-only server, then start it on the network: `node spike/server.js --lan`. Windows may ask to allow Node through the firewall on private networks.
2. On the computer, open `http://127.0.0.1:8137`, check the clips, and press **Save for the TV**.
3. On the TV browser, open the printed `TV url` with `/?tv=auto` on the end (starts after 10 s with no press: the real case), or `/?tv` (waits for a press).
4. Each run saves its log to `spike/logs/`, with the TV's user agent.
