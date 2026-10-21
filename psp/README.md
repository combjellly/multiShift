# Shift PSP (PlayStation Portable)

A native C port of **Shift** for the Sony PlayStation Portable (PSP-1000, 2000, 3000, Street, Go, and the PPSSPP emulator).

Featuring a **real-time 44.1 kHz software synth & sampler engine**, **Controller Mode live coding**, **multi-band visualizer**, and **zero external runtime dependencies**.

---

## Features

- **Native C Engine**: Ultra-low latency, running at locked 60 FPS on the 333 MHz MIPS Allegrex CPU.
- **Polyphonic Subtractive Synth**: `play.synth[gain, note]` with bandlimited saw/pulse/sine oscillators, ADSR envelopes, and resonant low-pass filtering.
- **16 Signature Samples**:
  - `famicom`, `gba`, `genesis`, `kick`, `snare`, `hh`, `breaks`, `deepbass`, `juno`, `casio`, `nes`, `smb`, `m1`, `chrono`, `piano`, `laser`.
  - Also supports loading custom 16-bit PCM WAV files from `ms0:/PSP/GAME/SHIFT/samples/`.
- **PSP Screen Layout (480 × 272)**:
  - Left pane: IDE color-coded code editor with glowing token outline.
  - Right pane: Real-time generative visualizer with separate orbital bands per `every` loop, pitch-scaled height nodes, and expanding volume-glow pulses.
- **Controller Mode Live Coding**: Full code navigation, creation, and value scrubbing using handheld console buttons.

---

## PSP Controls Mapping

| PSP Button | Desktop (SDL2) | Action |
| :--- | :--- | :--- |
| **D-Pad Up / Down** | **Arrow Up / Down** | **Navigate to token on line above / below** (including empty lines!) |
| **D-Pad Left / Right** | **Arrow Left / Right** | Navigate to previous / next token |
| **L-Trigger** | `Q` | Skip up 1 line |
| **R-Trigger** | `R` | Skip down 1 line |
| **Hold Cross ($\times$) + D-Pad Up / Down** | **Hold `S` + Up / Down** | **Scrub Decimals**: `+0.1` / `-0.1` |
| **Hold Cross ($\times$) + D-Pad Left / Right** | **Hold `S` + Left / Right** | **Scrub Integers**: `+1` / `-1` |
| **Circle ($\bigcirc$)** | `D` | **Create Token (D-Menu)**: Statements, Samples, Variables, Values |
| **Square ($\square$)** | `A` | **Delete** token or empty line |
| **Triangle ($\triangle$)** | `W` | **Confirm** selection / **Re-evaluate** code |
| **Start** | `Space` / `Enter` | Toggle **Play / Pause** |
| **Select** | `Tab` / `Esc` | Cycle **Presets** |

### 🏷️ Variables & Empty Lines
- **Scroll to Empty Lines**: Navigating Up/Down moves through all lines, including blank lines (`+ [EMPTY LINE]`). Pressing **Circle ($\bigcirc$)** on an empty line inserts your chosen token or statement directly there.
- **Add Lines Above / Below**: The D-Menu includes `+ Add Line Below` and `+ Add Line Above`.
- **Create Variable Tokens**: In the D-Menu under `VARIABLES`, you can create:
  - `example_variable = 1`
  - `* Random Var = 1`
  - `tempo = 1`, `pitch = 60`, `gain = 80`, `scale = [...]`
  - Any previously declared variables can also be inserted as token references.

---

## Building

### Option A: Desktop Simulator (macOS / Linux / Windows)
You can run and test the exact 480 × 272 PSP build on your desktop using SDL2:

```bash
cd psp
make -f Makefile.pc
./shift_psp_desktop
```

### Option B: Build for Real PSP / PPSSPP (PSPSDK)

If you have `pspdev` installed:
```bash
cd psp
make
```
This produces `EBOOT.PBP`.

#### Using Docker (Recommended if you don't have PSPSDK installed):
```bash
docker run --rm -v $(pwd):/src -w /src/psp pspdev/pspdev:latest make
```

---

## Installation on PSP

1. Connect your PSP via USB or insert your Memory Stick into your PC.
2. Copy the `psp/` folder (containing `EBOOT.PBP` and any custom `samples/`) to:
   ```
   ms0:/PSP/GAME/SHIFT/EBOOT.PBP
   ```
3. On your PSP, go to **Game $\rightarrow$ Memory Stick $\rightarrow$ Shift PSP** and press $\times$ to launch!

Or open `EBOOT.PBP` directly in [PPSSPP](https://www.ppsspp.org/).
