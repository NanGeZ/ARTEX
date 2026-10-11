import os
import sys
import threading
import time

sys.path.insert(0, "/workspace/exam_downloader_extract")
os.chdir("/workspace/exam_downloader_extract")

from paper_batch_gui import App

app = App()
app.geometry("1020x820")


def scenario():
    time.sleep(1.0)
    app.var_year.set("2025")
    app.on_search()
    for _ in range(120):
        if not app.busy:
            break
        time.sleep(0.5)
    time.sleep(0.5)
    time.sleep(1.0)
    n = len(app.targets)
    print("RESULTS:", n, flush=True)
    if n:
        app.tree.selection_set("0")
    app.msg_q.put(("progress", 35))
    app.lbl_status.config(text="下载中 1/2  示例试卷")
    os.system("scrot -o /workspace/shots/gui4.png")
    time.sleep(0.8)
    os.system("scrot -o /workspace/shots/gui5.png")
    print("SHOT_DONE", flush=True)
    app.after(200, app.destroy)


threading.Thread(target=scenario, daemon=True).start()
app.after(30000, app.destroy)
app.mainloop()
print("GUI_SMOKE_OK")
