import sys
import os

print("GUI instantiation test starting...", flush=True)
sys.path.insert(0, "/workspace/exam_downloader_extract")
os.chdir("/workspace/exam_downloader_extract")

try:
    print("importing paper_batch_gui...", flush=True)
    import paper_batch_gui
    print("module imported, testing App class definition...", flush=True)

    print("checking App class exists:", hasattr(paper_batch_gui, 'App'), flush=True)

    print("creating App instance...", flush=True)
    app = paper_batch_gui.App()
    print("APP_CREATED_OK", flush=True)

    print("destroying app...", flush=True)
    app.after(100, app.destroy)
    app.mainloop()
    print("GUI_INSTANTIATION_TEST_OK", flush=True)

except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}", flush=True)
    import traceback
    traceback.print_exc()
    print("GUI_INSTANTIATION_TEST_FAILED", flush=True)
    sys.exit(1)
