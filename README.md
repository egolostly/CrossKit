<div align="center">

# CrossKit

**Crosshair editor, pro library and screen overlay – in one small desktop app.**

![Version](https://img.shields.io/badge/version-1.6.3-4cc2ff?style=flat-square)
![Python](https://img.shields.io/badge/python-3.9+-3776ab?style=flat-square&logo=python&logoColor=white)
![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macOS%20%7C%20linux-1d2028?style=flat-square)
![License](https://img.shields.io/badge/license-MIT%20%2B%20attribution-22c55e?style=flat-square)
[![Made by](https://img.shields.io/badge/made%20by-EgoLost-4cc2ff?style=flat-square&logo=github)](https://github.com/egolostly)

**[Download](../../releases/latest)** &nbsp;·&nbsp;
**[Features](#features)** &nbsp;·&nbsp;
**[Quick start](#quick-start)** &nbsp;·&nbsp;
**[Pro settings](#pro-settings)** &nbsp;·&nbsp;
**[Screen overlay](#screen-overlay)** &nbsp;·&nbsp;
**[FAQ](#faq)**

</div>

<br>

CrossKit is a small desktop app for everything crosshair. Build one in a live editor, stress-test it with simulated spray and movement, borrow a crosshair from 187 pro players, look up the DPI and sensitivity of 245 pros, and copy the share code straight into your game. When the game can't draw what you want, the **screen overlay** puts your crosshair, a custom shape or any image on top of your screen.

No account, no telemetry, no installer – your data stays in one JSON file in your home folder.

## Features

<table>
<tr>
<td width="50%" valign="top">

### Editor
- Preview at **real in-game size** – or zoomed 2× and 4× for detail
- Clean all-black canvas, nothing in the way of the crosshair
- Spray and movement simulation – watch the error lines react
- Every primary setting: color and custom hex, outlines, center dot, inner and outer lines, separate vertical length
- Movement and firing error with **multipliers (0 – 3.000)** exactly like the game – drag or type the value
- Undo, PNG export and a random generator that only builds playable layouts

</td>
<td width="50%" valign="top">

### Library
- **187 pro crosshairs** and **14 starters**, previewed at real size
- Every pro card shows team, DPI and sens
- Categories: Pros, Starters, Dot, Cross, Cross + dot, Dynamic
- Search by name, team or style ("paper rex", "cyan dot")
- Star your favorites to keep them one click away
- One-click load or copy

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Screen overlay <sub>Windows</sub>
- Always on top, click-through, never steals focus
- Your editor crosshair, **17 shapes** or your own image
- Stick figure with an exact **head aim point**
- Optional hide-while-aiming (right mouse button)
- Global <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> toggle; hides to the system tray when you close the window

</td>
<td width="50%" valign="top">

### Codes & saving
- Share codes that match what the game exports
- Unknown settings (ADS, sniper, advanced) survive a round trip untouched
- Paste anywhere to import – or paste a whole list to save many at once
- Saved crosshairs with *Copy all* for easy backups
- Pixel-exact rendering: odd and even thicknesses share one centre

</td>
</tr>
<tr>
<td colspan="2" valign="top">

### Pro settings
- DPI, sens, eDPI and cm/360 for **245 pros**, sortable and filterable, each with a "last checked" month
- Enter your own DPI and sens to see where you sit, and get any pro's sens converted to your DPI in one click

</td>
</tr>
</table>

## Quick start

### Download

Grab `CrossKit.exe` from the **[latest release](../../releases/latest)** and run it. Windows 10 and 11 already include everything it needs.

> Windows SmartScreen may warn about an unsigned app the first time. Click **More info → Run anyway**, or build it yourself from source below.

### Run from source

Requires Python 3.9 or newer.

```bash
git clone https://github.com/egolostly/crosskit.git
cd crosskit
pip install -r requirements.txt
python crosskit.py
```

On Linux, pywebview also needs GTK or Qt – see the [pywebview installation guide](https://pywebview.flowershow.app/guide/installation). The UI runs in a normal browser too: open `ui/index.html` and saving falls back to `localStorage`.

### Build the executable

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name CrossKit --icon ui/icon.ico --add-data "ui;ui" --hidden-import overlay --hidden-import pystray._win32 crosskit.py
```

The executable lands in `dist/`. On macOS and Linux use `:` instead of `;` in `--add-data`.

## Using CrossKit

### Get your crosshair into the game

1. Click **Copy code** (or press <kbd>C</kbd>)
2. In the game, open **Settings → Crosshair**
3. Click the **Import** icon next to the profile name and paste

To go the other way, copy a code in game and press <kbd>Ctrl</kbd>+<kbd>V</kbd> anywhere in CrossKit.

### Library

Shape categories are worked out from each crosshair automatically, so new entries land in the right place without manual tagging. Hover a card and click the star to add it to **Favorites**.

## Pro settings

DPI, sensitivity, eDPI and cm/360 for **245 pro players**, each with the month it was last confirmed.

- **Sort** any column and **filter** by DPI (400 / 800 / 1600 / other) or by players with a crosshair
- **Your setup** – type your DPI and sens to see your eDPI, cm/360 and where you sit on the pro spread
- **At your DPI** – the sens that feels identical to a pro's on *your* mouse. Click it to copy
- Rows within 5% of your eDPI are marked, so you can find pros who play like you
- **Use crosshair** loads that player's code straight into the editor

```
eDPI   = DPI × sens
cm/360 = 360 / (eDPI × 0.07) × 2.54
```

## Screen overlay

Open the **Overlay** page, choose a source and switch on **Show on screen**.

| Source | What it shows |
|---|---|
| **Crosshair** | The crosshair from the editor at its in-game size (or up to 4×). Edits show up live |
| **Shape** | Stick figure, dot, plus, square, ring, ring + dot, scope, chevron, triangle, diamond, brackets, X, T-shape, star, heart, smiley, arrow |
| **Image** | Any PNG, JPG, GIF, BMP or WebP up to 4 MB. Choose a file or drop it on the page |

Shapes come in any color, size and line thickness, with an optional black outline and center dot. Opacity and position can be tuned to the pixel.

- **Aim with the head** (stick figure) moves the figure so its head – not its body – sits exactly on the screen centre, at any size
- **Hide while holding right click** makes the overlay vanish while you aim down sights
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> hides or shows it from anywhere, even in game
- Closing the window while the overlay is on hides CrossKit to the **system tray** (the hidden icons next to the clock). Click the icon to bring it back, right-click for *Hide / show overlay* and *Quit*. **Quit** on the overlay page closes everything too

The overlay is a plain transparent window. It never touches game files or memory and doesn't inject anything. It shows up over games running in **borderless** or **windowed** mode – exclusive fullscreen draws above every other window.

## Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>Space</kbd> / hold click | Fire (spray test) |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Move (movement test) |
| <kbd>C</kbd> | Copy code |
| <kbd>R</kbd> | Random crosshair |
| <kbd>Ctrl</kbd>+<kbd>V</kbd> | Import from the clipboard |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> | Undo |
| <kbd>1</kbd> – <kbd>5</kbd> | Editor, Library, Pro settings, Saved, Overlay |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> | Hide / show the overlay (global) |
| <kbd>?</kbd> | Show all shortcuts |

## FAQ

<details>
<summary><b>Can using the overlay get me banned?</b></summary>
<br>

Copying codes from the editor into the game is completely safe – it's the game's own feature.

The overlay is a different story. It's a normal always-on-top window and doesn't interact with any game, but some competitive games with kernel anti-cheat consider *any* unapproved third-party tool a possible violation, and publishers rarely publish a list of what's allowed. Read the rules of the game you play, and **use the overlay at your own risk**. Never use it to get around a game deliberately hiding the crosshair.
</details>

<details>
<summary><b>The overlay doesn't show up in my game.</b></summary>
<br>

Switch the game to borderless or windowed fullscreen. In exclusive fullscreen the game owns the display and nothing can be drawn over it.
</details>

<details>
<summary><b>Does the overlay work on macOS or Linux?</b></summary>
<br>

Not yet – click-through windows are platform specific and only the Windows version exists right now. The editor, library and saved pages work everywhere.
</details>

<details>
<summary><b>The window froze after turning on "Always on top".</b></summary>
<br>

Fixed in 1.6.1 – pinning now goes straight through Win32 instead of the webview, so it can't lock up the UI. Update to the latest version.
</details>

<details>
<summary><b>My antivirus flags the .exe.</b></summary>
<br>

Single-file PyInstaller builds are a common false positive because of how they unpack themselves. The full source is here – build it yourself if you'd rather not trust a binary.
</details>

<details>
<summary><b>Where is my data stored?</b></summary>
<br>

Saved crosshairs, favorites, your mouse setup and overlay settings live in `~/.crosskit.json`. PNG exports go to `~/Pictures/CrossKit`. Delete the JSON file to reset everything.
</details>

## How share codes work

A code is a list of `key;value` pairs. Only values that differ from the game default are written, so the default crosshair is simply `0`.

```
0;P;c;5;h;0;0l;4;0o;2;0a;1;0f;0;1b;0
│ │ │   │   │    │    │    │    └ outer lines off
│ │ │   │   │    │    │    └ inner firing error off
│ │ │   │   │    │    └ inner opacity 1
│ │ │   │   │    └ inner offset 2
│ │ │   │   └ inner length 4
│ │ │   └ outlines off
│ │ └ color 5 (cyan)
│ └ primary crosshair
└ version
```

Movement and firing error are `0m` / `0f` (on/off) with their multipliers in `0s` / `0e` – the same keys with `1` for the outer lines.

## Project structure

```
crosskit.py        app window and the Python API used by the UI
overlay.py         click-through overlay window (tkinter + win32)
ui/index.html      markup
ui/style.css       styles
ui/crosshair.js    share-code parser/encoder and crosshair renderer
ui/library.js      pro crosshairs, pro settings and starters
ui/pros.js         pro settings page
ui/overlay.js      overlay page and shape drawing
ui/app.js          editor, library and saved pages
ui/icon.ico        app and exe icon
```

The UI is plain HTML, CSS and JavaScript – no build step, no framework. Python hosts it in a native window through [pywebview](https://pywebview.flowershow.app/) and handles files, the clipboard and the overlay process.

## Roadmap

- [ ] Overlay on macOS and Linux
- [x] System tray icon
- [ ] Custom overlay hotkey
- [ ] ADS and sniper crosshair editing
- [ ] Community library submissions

## Contributing

Bug reports and pull requests are welcome.

- **Library updates** – pros change crosshairs and sens often. Edit `ui/library.js` (one line per player: name, team, dpi, sens, seen, code) and link your source in the PR
- **New overlay shapes** – add an entry to `SHAPES` in `ui/overlay.js`; every shape is a short canvas path drawn inside `-r … r`
- Please keep the code dependency-free and the UI consistent with the existing style

## Credits

Pro crosshairs and settings were put together from the players' own stream commands and public pro-settings pages, cross-checked where they disagreed (the newer source wins):
[SensLab](https://senslab.pro/) ·
[ProSettings.net](https://prosettings.net/) ·
[Turbosmurfs](https://turbosmurfs.gg/) ·
[AxeeTech](https://axeetech.com/) ·
[Of Zen and Computing](https://www.ofzenandcomputing.com/) ·
[Dot Esports](https://dotesports.com/).
Pros change setups all the time, so treat every value as a starting point.

CrossKit is an independent project and isn't affiliated with or endorsed by any game publisher.

## License

Released under the MIT license with one extra condition: the **made by. EgoLost** credit must stay visible in the app and in any fork's README. See [LICENSE](LICENSE).

<br>

<div align="center">
<sub>made by. <a href="https://github.com/egolostly"><b>EgoLost</b></a></sub>
</div>
