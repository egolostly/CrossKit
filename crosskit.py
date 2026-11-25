"""
CrossKit - crosshair editor and screen overlay.

    pip install -r requirements.txt
    python crosskit.py

made by. EgoLost
"""

import base64
import ctypes
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

APP = "CrossKit"
VERSION = "1.6.3"

ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
UI = ROOT / "ui" / "index.html"
ICON = ROOT / "ui" / "icon.ico"

STORE = Path.home() / ".crosskit.json"
PICTURES = Path.home() / "Pictures" / APP

BG = "#000000"

# -- credit ------------------------------------------------------------------
# The "made by" line is part of the license terms (see LICENSE). It is stored
# encoded and injected into the page from here, independently of the UI code.
_SIG = (55, 59, 62, 63, 122, 56, 35, 116, 122, 31, 61, 53, 22, 53, 41, 46)


def credit():
    return "".join(chr(b ^ 0x5A) for b in _SIG)


TITLE = APP

_CREDIT_JS = r"""
(function (text) {
  if (document.querySelector('ck-credit')) return;
  var lock = 'display:block!important;visibility:visible!important;opacity:1!important;' +
    'position:fixed!important;left:22px!important;bottom:12px!important;z-index:2147483647!important;' +
    'pointer-events:none!important;transform:none!important;filter:none!important;clip-path:none!important';
  var host = document.createElement('ck-credit');
  host.setAttribute('style', lock);
  var root = host.attachShadow({ mode: 'closed' });
  var parts = text.split(' ');
  var name = parts.pop();
  root.innerHTML = '<span style="font:500 11px/1.4 Segoe UI,system-ui,sans-serif;color:#52525b;' +
    'letter-spacing:.2px;white-space:nowrap">' + parts.join(' ') + ' <b style="color:#4cc2ff;font-weight:600">' +
    name + '</b></span>';
  document.documentElement.appendChild(host);
})(%s);
"""


# -- storage -----------------------------------------------------------------

# UI calls arrive on several threads at once, so every read-modify-write of
# the store goes through this lock, and files are replaced atomically.
STORE_LOCK = threading.RLock()


def read_store():
    with STORE_LOCK:
        try:
            return json.loads(STORE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}


def write_store(data):
    with STORE_LOCK:
        tmp = STORE.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps(data, indent=1), encoding="utf-8")
            os.replace(tmp, STORE)
        except OSError:
            pass


def update_store(change):
    with STORE_LOCK:
        data = read_store()
        result = change(data)
        write_store(data)
        return result


def copy_to_clipboard(text):
    if os.name == "nt":
        cmd, flags = ["clip"], 0x08000000  # CREATE_NO_WINDOW
    elif sys.platform == "darwin":
        cmd, flags = ["pbcopy"], 0
    else:
        cmd, flags = ["xclip", "-selection", "clipboard"], 0
    try:
        subprocess.run(cmd, input=text.encode(), check=True, creationflags=flags)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


# -- overlay process ---------------------------------------------------------

class OverlayProcess:
    """Owns the overlay child process (see overlay.py).

    Messages go through a queue and a single writer thread, so a slow or
    stuck overlay can never block the UI. Only the newest image is kept.
    """

    def __init__(self):
        self.proc = None
        self.visible = False
        self._lock = threading.Lock()
        self._pending = None
        self._stopped = False
        self._wake = threading.Event()
        threading.Thread(target=self._writer, daemon=True).start()

    def _command(self):
        if getattr(sys, "frozen", False):
            return [sys.executable, "--overlay"]
        return [sys.executable, str(Path(__file__).resolve()), "--overlay"]

    def _ensure(self):
        if self.proc is None or self.proc.poll() is not None:
            self.proc = subprocess.Popen(
                self._command(),
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=0x08000000 if os.name == "nt" else 0,
            )

    def _writer(self):
        while True:
            self._wake.wait()
            with self._lock:
                msg, self._pending = self._pending, None
                self._wake.clear()
            if msg is None or self._stopped:
                continue
            try:
                self._ensure()
                self.proc.stdin.write((json.dumps(msg) + "\n").encode())
                self.proc.stdin.flush()
            except OSError:
                self.proc = None  # restarted on the next message

    def _post(self, msg):
        with self._lock:
            self._pending = msg
            self._wake.set()

    def show(self, png, opacity, dx, dy, hide_ads=False):
        self._post({"cmd": "show", "png": png, "opacity": opacity,
                    "dx": dx, "dy": dy, "hide_ads": bool(hide_ads)})
        self.visible = True

    def hide(self):
        if self.proc and self.proc.poll() is None:
            self._post({"cmd": "hide"})
        self.visible = False

    def toggle(self):
        """Hide/show without forgetting the image, like Ctrl+Shift+H."""
        if self.visible and self.proc and self.proc.poll() is None:
            self._post({"cmd": "toggle"})

    def stop(self):
        self._stopped = True
        proc, self.proc = self.proc, None
        self.visible = False
        if proc and proc.poll() is None:
            try:
                proc.stdin.close()  # overlay quits when its input closes
                proc.wait(timeout=2)
            except (OSError, subprocess.TimeoutExpired):
                proc.kill()


# -- tray icon ---------------------------------------------------------------

class Tray:
    """Icon in the notification area ("hidden icons") on Windows.

    Closing the window while the overlay is on hides the app here instead of
    quitting. Needs pystray + Pillow; without them CrossKit falls back to
    minimizing to the taskbar.
    """

    def __init__(self, on_open, on_toggle, on_quit):
        self.icon = None
        self._told = False
        if os.name != "nt":
            return
        try:
            import pystray
            from PIL import Image
        except ImportError:
            return

        try:
            image = Image.open(ICON)
        except OSError:
            image = Image.new("RGBA", (64, 64), (76, 194, 255, 255))

        menu = pystray.Menu(
            pystray.MenuItem("Open CrossKit", lambda: on_open(), default=True),
            pystray.MenuItem("Hide / show overlay  (Ctrl+Shift+H)", lambda: on_toggle()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", lambda: on_quit()),
        )
        self.icon = pystray.Icon(APP, image, APP, menu)
        threading.Thread(target=self.icon.run, daemon=True).start()

    @property
    def available(self):
        return self.icon is not None

    def tell_once(self):
        # first time only, so people know where the app went
        if self.icon is None or self._told:
            return
        self._told = True
        try:
            self.icon.notify("Still running here so the overlay stays on screen. "
                             "Right-click the icon to quit.", APP)
        except Exception:  # notifications are a nice-to-have
            pass

    def stop(self):
        if self.icon is not None:
            try:
                self.icon.stop()
            except Exception:
                pass
            self.icon = None


def bring_to_front():
    hwnd = main_hwnd()
    if hwnd:
        user32 = ctypes.windll.user32
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.SetForegroundWindow(hwnd)


# -- api exposed to the page -------------------------------------------------

class Api:
    def __init__(self, overlay):
        self._window = None
        self._overlay = overlay
        self._quitting = False

    def load(self):
        data = read_store()
        data.setdefault("saved", [])
        data["version"] = VERSION
        data["platform"] = sys.platform
        return data

    def remember(self, code):
        update_store(lambda d: d.update(last=code))

    def set_pref(self, key, value):
        if key in ("overlay", "overlayImage", "favorites", "pinned", "mouse"):
            update_store(lambda d: d.update({key: value}))

    def save_crosshair(self, name, code):
        name = (name or "").strip()[:40] or "Untitled"

        def change(data):
            saved = [s for s in data.get("saved", []) if s["name"] != name]
            saved.insert(0, {"name": name, "code": code, "time": int(time.time())})
            data["saved"] = saved[:200]
            return data["saved"]

        return update_store(change)

    def delete_crosshair(self, name):
        def change(data):
            data["saved"] = [s for s in data.get("saved", []) if s["name"] != name]
            return data["saved"]

        return update_store(change)

    def copy(self, text):
        return copy_to_clipboard(text)

    def export_png(self, data_url):
        PICTURES.mkdir(parents=True, exist_ok=True)
        path = PICTURES / time.strftime("crosshair-%Y%m%d-%H%M%S.png")
        path.write_bytes(base64.b64decode(data_url.split(",", 1)[-1]))
        return str(path)

    def open_folder(self):
        PICTURES.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(PICTURES)
        else:
            subprocess.Popen(["open" if sys.platform == "darwin" else "xdg-open", str(PICTURES)])

    def pick_image(self):
        kind = getattr(getattr(webview, "FileDialog", None), "OPEN", None) or webview.OPEN_DIALOG
        picked = self._window.create_file_dialog(
            kind, file_types=("Images (*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp)",))
        if not picked:
            return None
        path = Path(picked[0] if isinstance(picked, (list, tuple)) else picked)
        if path.stat().st_size > 4_000_000:
            return {"error": "That image is over 4 MB."}
        mime = {".jpg": "jpeg", ".jpeg": "jpeg", ".gif": "gif", ".bmp": "bmp", ".webp": "webp"}
        kind = mime.get(path.suffix.lower(), "png")
        return {"name": path.name,
                "url": f"data:image/{kind};base64," + base64.b64encode(path.read_bytes()).decode()}

    def overlay_show(self, png, opacity, dx, dy, hide_ads=False):
        if os.name != "nt":
            return {"ok": False, "error": "The screen overlay is Windows only for now."}
        self._overlay.show(png, opacity, dx, dy, hide_ads)
        return {"ok": True}

    def overlay_hide(self):
        self._overlay.hide()
        return {"ok": True}

    def pin(self, on):
        on = bool(on)
        self.set_pref("pinned", on)
        # Setting window.on_top from a JS call can deadlock pywebview on
        # Windows (the setter waits on the UI thread, which is waiting on
        # us). Talk to Win32 directly there and never block the caller.
        if set_topmost(on):
            return
        if self._window:
            window = self._window
            threading.Thread(target=lambda: setattr(window, "on_top", on), daemon=True).start()

    def quit(self):
        self._quitting = True
        self._overlay.stop()
        if self._window:
            self._window.destroy()


# -- window ------------------------------------------------------------------

_hwnd = None


def main_hwnd():
    """Handle of our own top-level window. Matching on the process id avoids
    grabbing some other window that happens to be called "CrossKit" (an
    Explorer folder, a browser tab...)."""
    global _hwnd
    if os.name != "nt":
        return None
    user32 = ctypes.windll.user32
    if _hwnd and user32.IsWindow(_hwnd):
        return _hwnd

    from ctypes import wintypes
    pid = os.getpid()
    found = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def check(hwnd, _):
        owner = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value == pid and user32.IsWindowVisible(hwnd):
            buf = ctypes.create_unicode_buffer(64)
            user32.GetWindowTextW(hwnd, buf, 64)
            if buf.value == TITLE:
                found.append(hwnd)
                return False
        return True

    user32.EnumWindows(check, 0)
    _hwnd = found[0] if found else None
    return _hwnd


def set_topmost(on):
    """Pin/unpin without touching the UI thread. Returns False if it couldn't."""
    if os.name != "nt":
        return False
    try:
        hwnd = main_hwnd()
        if not hwnd:
            return False
        insert_after = -1 if on else -2  # HWND_TOPMOST / HWND_NOTOPMOST
        # NOSIZE | NOMOVE | NOACTIVATE | ASYNCWINDOWPOS (don't wait for the UI thread)
        flags = 0x0001 | 0x0002 | 0x0010 | 0x4000
        user32 = ctypes.windll.user32
        user32.SetWindowPos.argtypes = [ctypes.c_void_p, ctypes.c_void_p] + [ctypes.c_int] * 4 + [ctypes.c_uint]
        return bool(user32.SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, flags))
    except (AttributeError, OSError):
        return False


def style_window():
    """Dark title bar + icon on Windows. Silently does nothing elsewhere."""
    if os.name != "nt":
        return
    try:
        user32 = ctypes.windll.user32
        hwnd = main_hwnd()
        if not hwnd:
            return

        dwm = ctypes.windll.dwmapi
        dark = ctypes.c_int(1)
        dwm.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(dark), 4)  # immersive dark mode
        rgb = int(BG[1:], 16)
        bgr = ctypes.c_int(((rgb & 0xFF) << 16) | (rgb & 0xFF00) | (rgb >> 16))
        dwm.DwmSetWindowAttribute(hwnd, 35, ctypes.byref(bgr), 4)  # caption color (win 11)
        dwm.DwmSetWindowAttribute(hwnd, 34, ctypes.byref(bgr), 4)  # border color (win 11)

        if ICON.exists():
            icon = user32.LoadImageW(None, str(ICON), 1, 0, 0, 0x10 | 0x40)
            if icon:
                user32.SendMessageW(hwnd, 0x80, 0, icon)  # WM_SETICON small
                user32.SendMessageW(hwnd, 0x80, 1, icon)  # WM_SETICON big

        # force the frame to repaint so the dark title bar shows up right away
        user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0004 | 0x0020 | 0x4000)
    except (AttributeError, OSError):
        pass

    if read_store().get("pinned"):
        set_topmost(True)


def keep_credit(window):
    # one-off: the page keeps it in place itself (ui/crosshair.js)
    try:
        window.evaluate_js(_CREDIT_JS % json.dumps(credit()))
    except Exception:  # window already closing
        pass


def main():
    global webview
    try:
        import webview
    except ImportError:
        sys.exit("pywebview is missing. Run:  pip install -r requirements.txt")

    overlay = OverlayProcess()
    api = Api(overlay)
    window = webview.create_window(
        TITLE,
        url=str(UI),
        js_api=api,
        width=1200,
        height=780,
        min_size=(940, 600),
        background_color=BG,
    )
    api._window = window

    def open_window():
        window.show()
        if os.name == "nt":
            bring_to_front()

    def quit_app():
        api.quit()

    tray = Tray(open_window, overlay.toggle, quit_app)

    def on_closing():
        # with the overlay on, closing tucks the app away instead of quitting
        if overlay.visible and not api._quitting:
            if tray.available:
                threading.Timer(0.05, window.hide).start()
                tray.tell_once()
            else:
                threading.Timer(0.05, window.minimize).start()
            return False
        return True

    window.events.shown += style_window
    window.events.loaded += lambda: keep_credit(window)
    window.events.closing += on_closing

    try:
        webview.start()
    finally:
        overlay.stop()
        tray.stop()


if __name__ == "__main__":
    if "--overlay" in sys.argv:
        from overlay import run
        run()
    else:
        main()
