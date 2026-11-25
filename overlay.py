"""
Screen overlay: a transparent, click-through, always-on-top window that sits
in the middle of the screen and shows a single image.

crosskit.py starts this as a child process (`crosskit.py --overlay`) and talks
to it over stdin, one JSON message per line:

    {"cmd": "show", "png": "<base64>", "opacity": 0.9, "dx": 0, "dy": 0, "hide_ads": false}
    {"cmd": "hide"}
    {"cmd": "quit"}

When stdin closes (the main app is gone) the overlay quits as well.
Ctrl+Shift+H hides / shows it from anywhere, also while a game has focus.
With "hide_ads" it also disappears while the right mouse button is held,
so it doesn't sit on top of a scope.

Windows only - it relies on layered windows for transparency and click-through.
"""

import ctypes
import json
import os
import queue
import sys
import threading
import tkinter as tk

KEY = "#010203"  # this exact colour becomes see-through

GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_NOACTIVATE = 0x08000000
HWND_TOPMOST = -1
SWP_FLAGS = 0x0001 | 0x0002 | 0x0010 | 0x4000  # no size, no move, no activate, async

VK_RBUTTON, VK_CONTROL, VK_SHIFT, VK_H = 0x02, 0x11, 0x10, 0x48


def _dpi_aware():
    # without this Windows scales the window and the crosshair gets blurry
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except (AttributeError, OSError):
            pass


class Overlay:
    def __init__(self):
        self.user32 = ctypes.windll.user32
        self.root = tk.Tk()
        self.root.withdraw()
        self.root.overrideredirect(True)
        self.root.configure(bg=KEY)
        self.root.attributes("-topmost", True)
        self.root.attributes("-transparentcolor", KEY)

        self.label = tk.Label(self.root, bg=KEY, bd=0, highlightthickness=0)
        self.label.pack()

        self.image = None
        self.dx = self.dy = 0
        self.wanted = False      # the app asked us to be visible
        self.hotkey_hidden = False
        self.hotkey_down = False
        self.hide_ads = False
        self.ads = False
        self.opacity = 1.0
        self.ticks = 0

        self.inbox = queue.Queue()
        threading.Thread(target=self._read_stdin, daemon=True).start()

    def _read_stdin(self):
        # windowed builds have sys.stdin = None, so read the raw pipe instead
        try:
            stream = os.fdopen(0, "rb", closefd=False)
            for line in stream:
                try:
                    msg = json.loads(line)
                except ValueError:
                    continue
                self.inbox.put(msg)
        except (OSError, ValueError):
            pass
        self.inbox.put({"cmd": "quit"})

    def _hwnd(self):
        return self.user32.GetParent(self.root.winfo_id()) or self.root.winfo_id()

    def _make_click_through(self):
        hwnd = self._hwnd()
        style = self.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        style |= WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE
        self.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)

    def _place(self):
        w, h = self.image.width(), self.image.height()
        sw = self.user32.GetSystemMetrics(0)
        sh = self.user32.GetSystemMetrics(1)
        x = sw // 2 - w // 2 + self.dx
        y = sh // 2 - h // 2 + self.dy
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _refresh_visibility(self):
        if self.wanted and not self.hotkey_hidden and self.image is not None:
            self.root.deiconify()
            self._make_click_through()
            self.user32.SetWindowPos(self._hwnd(), HWND_TOPMOST, 0, 0, 0, 0, SWP_FLAGS)
        else:
            self.root.withdraw()

    def handle(self, msg):
        cmd = msg.get("cmd")
        if cmd == "quit":
            self.root.destroy()
            return False
        if cmd == "toggle":  # same as the Ctrl+Shift+H hotkey, sent from the tray menu
            self.hotkey_hidden = not self.hotkey_hidden
        elif cmd == "hide":
            self.wanted = False
        elif cmd == "show":
            self.image = tk.PhotoImage(data=msg["png"])
            self.label.configure(image=self.image)
            self.dx = int(msg.get("dx", 0))
            self.dy = int(msg.get("dy", 0))
            self.opacity = min(1.0, max(0.05, float(msg.get("opacity", 1))))
            self.hide_ads = bool(msg.get("hide_ads"))
            self.root.attributes("-alpha", 0.0 if self.ads else self.opacity)
            self._place()
            self.wanted = True
        self._refresh_visibility()
        return True

    def _poll_hotkey(self):
        key = self.user32.GetAsyncKeyState
        down = bool(key(VK_CONTROL) & 0x8000 and key(VK_SHIFT) & 0x8000 and key(VK_H) & 0x8000)
        if down and not self.hotkey_down:
            self.hotkey_hidden = not self.hotkey_hidden
            self._refresh_visibility()
        self.hotkey_down = down

        # fading to 0 instead of hiding the window avoids flicker on fast clicks
        ads = self.hide_ads and bool(key(VK_RBUTTON) & 0x8000)
        if ads != self.ads:
            self.ads = ads
            self.root.attributes("-alpha", 0.0 if ads else self.opacity)

    def tick(self):
        try:
            # only the newest image matters when several arrive at once
            latest_show = None
            while not self.inbox.empty():
                msg = self.inbox.get()
                if msg.get("cmd") == "show":
                    latest_show = msg
                    continue
                latest_show = None if msg.get("cmd") == "hide" else latest_show
                if self.handle(msg) is False:
                    return
            if latest_show is not None:
                self.handle(latest_show)
            self._poll_hotkey()
        except (tk.TclError, ValueError, KeyError, OSError):
            pass  # a bad message must not kill the overlay

        # games love to grab the top spot, so take it back every couple of seconds
        self.ticks += 1
        if self.ticks % 60 == 0 and self.wanted and not self.hotkey_hidden:
            self.user32.SetWindowPos(self._hwnd(), HWND_TOPMOST, 0, 0, 0, 0, SWP_FLAGS)

        self.root.after(16, self.tick)

    def run(self):
        self.root.after(33, self.tick)
        self.root.mainloop()


def run():
    if sys.platform != "win32":
        sys.exit("The overlay is Windows only for now.")
    _dpi_aware()
    Overlay().run()


if __name__ == "__main__":
    run()
