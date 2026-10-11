#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import time

# Windows 下隐藏控制台窗口
if sys.platform == "win32":
    try:
        import ctypes
        whnd = ctypes.windll.kernel32.GetConsoleWindow()
        if whnd != 0:
            ctypes.windll.user32.ShowWindow(whnd, 0)  # SW_HIDE
    except Exception:
        pass

def log_debug(msg):
    try:
        if getattr(sys, 'frozen', False):
            path = os.path.join(os.path.dirname(sys.executable), "TEST_LOG.txt")
        else:
            path = os.path.join(os.getcwd(), "TEST_LOG.txt")
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
    except Exception as e:
        print(f"LOG_ERROR: {e}", flush=True)

log_debug("script started")
log_debug(f"sys.executable = {sys.executable}")
log_debug(f"frozen = {getattr(sys, 'frozen', False)}")

try:
    import tkinter as tk
    log_debug("tkinter imported")

    from tkinter import ttk
    log_debug("ttk imported")

    log_debug("creating window...")
    root = tk.Tk()
    root.title("测试窗口")
    root.geometry("400x300")
    log_debug("window created")

    tk.Label(root, text="Hello GUI!").pack(pady=20)
    log_debug("widget added")

    root.after(3000, root.destroy)
    log_debug("starting mainloop")
    root.mainloop()
    log_debug("mainloop ended")

    log_debug("SUCCESS")
    print("GUI_OK", flush=True)

except Exception as e:
    log_debug(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    log_debug(traceback.format_exc())
    print(f"GUI_FAILED: {e}", flush=True)
    sys.exit(1)
