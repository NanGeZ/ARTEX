import sys
import os

print("frozen test starting...", flush=True)
print(f"sys.frozen = {getattr(sys, 'frozen', False)}", flush=True)
print(f"sys.executable = {sys.executable}", flush=True)
print(f"__file__ = {__file__ if '__file__' in dir() else 'NOT DEFINED'}", flush=True)
print(f"cwd = {os.getcwd()}", flush=True)

try:
    from paper_batch_pc import app_dir
    print(f"app_dir() = {app_dir()}", flush=True)
except Exception as e:
    print(f"app_dir error: {e}", flush=True)

try:
    import paper_batch_gui
    print("importing paper_batch_gui module...", flush=True)
    print("FROZEN_TEST_IMPORT_OK", flush=True)
except Exception as e:
    print(f"import error: {type(e).__name__}: {e}", flush=True)
    import traceback
    traceback.print_exc()
