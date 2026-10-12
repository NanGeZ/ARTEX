import os
import sys
import threading
import time

sys.path.insert(0, "/workspace/exam_downloader_extract")
os.chdir("/workspace/exam_downloader_extract")

from paper_batch_gui import App, GRADE_OPTS

names = [n for n, _ in GRADE_OPTS]
print("GRADE_OPTS:", names, flush=True)
assert names == ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"], "年级选项不符"
assert not any(x in "".join(names) for x in ["七年级", "八年级", "九年级", "高一", "高二", "高三"])

app = App()
app.geometry("1020x820")


def find_grade_combo(widget):
    for w in widget.winfo_children():
        if w.winfo_class() == "TCombobox" and str(w.cget("textvariable")) == str(app.var_grade):
            return w
        r = find_grade_combo(w)
        if r:
            return r
    return None


def scenario():
    time.sleep(1.0)
    combo = find_grade_combo(app)
    combo_vals = list(combo["values"])
    print("COMBO_VALUES:", combo_vals, flush=True)
    assert combo_vals == names, "下拉框内容与 GRADE_OPTS 不符"
    app.var_grade.set("一年级")
    app.var_year.set("2025")
    app.on_search()
    for _ in range(160):
        if not app.busy:
            break
        time.sleep(0.5)
    time.sleep(1.0)
    n = len(app.targets)
    print("RESULTS:", n, flush=True)
    for t in app.targets[:5]:
        print("  -", t.get("name", "")[:60], flush=True)
    if n:
        app.tree.selection_set("0")
    os.makedirs("/workspace/shots", exist_ok=True)
    os.system("scrot -o /workspace/shots/grade_smoke.png")
    print("SHOT_DONE", flush=True)
    app.after(200, app.destroy)


threading.Thread(target=scenario, daemon=True).start()
app.after(60000, app.destroy)
app.mainloop()
print("GRADE_SMOKE_OK")
