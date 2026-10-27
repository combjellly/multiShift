# Changelog

All notable changes to the Shift live coding environment will be documented in this file.

## [Unreleased]

### Fixed
- **Loop Phase Continuity on Tempo & Period Changes**:
  - **Phase-Continuous Beat Scheduling**: Resolved stutter, double notes, and audio gaps when changing `tempo` (or variable-dependent periods such as `every (i:x) * tempo`).
  - **Loop Anchor Persistence**: Added `loopPhases` to `EngineRecord` in [src/Main.purs](file:///Users/nico/Documents/shift%20antigrav/src/Main.purs) to track each loop's last scheduled cycle beat.
  - **Dynamic Period Transition**: Instead of recalculating loop beats as disjoint multiples of $t = 0$ ($k \times n$) which caused arbitrary phase jumps and collisions across lookahead windows, beats are now generated continuously stepping forward by the new period from the loop's previous beat.
  - **Stop Lifecycle Reset**: Exported `clearLoopPhases` from PureScript and hooked it in [frontend/src/useEngine.js](file:///Users/nico/Documents/shift%20antigrav/frontend/src/useEngine.js) to clear phase anchors on stop, ensuring a clean start from beat zero on playback restart.
