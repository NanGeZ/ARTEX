import sys
import os
import traceback

print("starting runtime test...", flush=True)
try:
    sys.path.insert(0, "/workspace/exam_downloader_extract")
    os.chdir("/workspace/exam_downloader_extract")
    print("importing App...", flush=True)
    from paper_batch_gui import App
    print("App imported, creating instance...", flush=True)
    app = App()
    print("App created OK, starting mainloop...", flush=True)
    app.after(2000, app.destroy)
    app.mainloop()
    print("RUNTIME_TEST_OK", flush=True)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}", flush=True)
    traceback.print_exc()
    print("RUNTIME_TEST_FAILED", flush=True)
    sys.exit(1)
