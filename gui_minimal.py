#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import time
import tkinter as tk

def log_debug(msg):
    try:
        path = os.path.join(os.path.dirname(sys.executable), "MINIMAL_LOG.txt")
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
    except Exception as e:
        print(f"LOG_ERROR: {e}", flush=True)

log_debug("module start")

try:
    log_debug("importing tkinter...")
    from tkinter import ttk
    log_debug("ttk imported")

    log_debug("importing paper_batch_pc...")
    import paper_batch_pc as core
    log_debug("core imported")

    log_debug("creating window...")
    root = tk.Tk()
    root.title("测试")
    root.geometry("400x300")
    log_debug("window created")

    log_debug("adding widget...")
    tk.Label(root, text="Hello GUI!").pack(pady=20)
    log_debug("widget added")

    root.after(3000, root.destroy)
    log_debug("starting mainloop")
    root.mainloop()
    log_debug("mainloop ended")

    log_debug("SUCCESS")
    print("MINIMAL_GUI_OK", flush=True)

except Exception as e:
    log_debug(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    err = traceback.format_exc()
    log_debug(f"Traceback:\n{err}")
    print(f"MINIMAL_GUI_FAILED: {e}", flush=True)
    sys.exit(1)
