#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os
import queue
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk

import paper_batch_pc as core

GRADE_OPTS = [
    ("六年级", "6"), ("七年级", "7"), ("八年级", "8"),
    ("九年级", "9"), ("高一", "10"), ("高二", "11"), ("高三", "12"),
]
SUBJECT_OPTS = [("数学", "2"), ("语文", "1"), ("英语", "3")]
TERM_OPTS = [("不限", ""), ("上学期", "LAST"), ("下学期", "NEXT")]
YEAR_OPTS = ["不限"] + [str(y) for y in range(2026, 2017, -1)]
TYPE_OPTS = ["不限", "区统考", "校际卷", "期中", "期末",
             "一模", "二模", "月考", "中考真题"]
AREA_OPTS = [("320000 江苏", "320000"), ("310000 上海", "310000"),
             ("110000 北京", "110000"), ("440000 广东", "440000"),
             ("330000 浙江", "330000"), ("510000 四川", "510000")]

FONT = "Microsoft YaHei UI"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("试卷下载器")
        self.geometry("1020x700")
        self.minsize(900, 600)
        self.configure(bg="#F6F7FB")

        self.msg_q = queue.Queue()
        self.busy = False
        self.targets = []
        self.make_pdf = tk.BooleanVar(value=True)

        self._setup_token()
        self._style()
        self._build()
        self._load_local()
        self.after(100, self._poll)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _setup_token(self):
        try:
            self.token = core.load_token()
        except Exception:
            self.token = core.DEFAULT_TOKEN
        self.token_exp = ""
        try:
            p = self.token.split(".")[1]
            p += "=" * (-len(p) % 4)
            exp = json.loads(core.base64.urlsafe_b64decode(p)).get("exp", 0)
            if exp:
                self.token_exp = time.strftime("%Y-%m-%d", time.localtime(exp))
        except Exception:
            pass
        core.HDRS = dict(core.HEADERS_BASE)
        core.HDRS["Authorization"] = self.token
        os.makedirs(core.OUT_ROOT, exist_ok=True)

    def _style(self):
        s = ttk.Style(self)
        try:
            s.theme_use("clam")
        except Exception:
            pass
        s.configure(".", background="#F6F7FB", foreground="#1F2430",
                    fieldbackground="#FFFFFF", bordercolor="#E3E7F0",
                    lightcolor="#F6F7FB", darkcolor="#F6F7FB",
                    font=(FONT, 10))
        s.configure("TFrame", background="#F6F7FB")
        s.configure("TLabel", background="#F6F7FB", foreground="#1F2430")
        s.configure("TButton", padding=(14, 7), background="#FFFFFF",
                    foreground="#1F2430", borderwidth=1)
        s.map("TButton", background=[("active", "#EEF1F8")])
        s.configure("Accent.TButton", background="#3B6FF6", foreground="#FFFFFF",
                    font=(FONT, 10, "bold"), borderwidth=0, padding=(18, 8))
        s.map("Accent.TButton",
              background=[("active", "#2E5FE0"), ("disabled", "#A9C0F8")],
              foreground=[("disabled", "#EAF0FF")])
        s.configure("Ghost.TButton", background="#EFF3FF",
                    foreground="#2E5FE0", borderwidth=0, padding=(18, 8),
                    font=(FONT, 10, "bold"))
        s.map("Ghost.TButton", background=[("active", "#DFE7FF")])
        s.configure("TCombobox", arrowsize=16, padding=6)
        s.configure("TEntry", padding=6)
        s.configure("TCheckbutton", background="#FFFFFF")
        s.configure("Treeview", background="#FFFFFF", fieldbackground="#FFFFFF",
                    foreground="#1F2430", rowheight=32, borderwidth=0)
        s.map("Treeview", background=[("selected", "#E4ECFF")],
              foreground=[("selected", "#1B2440")])
        s.configure("Treeview.Heading", background="#FAFBFF",
                    foreground="#5A6478", relief="flat",
                    font=(FONT, 9, "bold"))
        s.map("Treeview.Heading", background=[("active", "#F0F3FA")])
        s.configure("Horizontal.TProgressbar", troughcolor="#E7ECF7",
                    background="#3B6FF6", borderwidth=0, thickness=8)

    def _card(self, parent):
        return tk.Frame(parent, bg="#FFFFFF", highlightthickness=1,
                        highlightbackground="#E7EAF3")

    def _build(self):
        hdr = tk.Frame(self, bg="#FFFFFF", height=62,
                       highlightthickness=1, highlightbackground="#E7EAF3")
        hdr.pack(fill="x", padx=14, pady=(12, 8))
        hdr.pack_propagate(False)
        left = tk.Frame(hdr, bg="#FFFFFF")
        left.pack(side="left", padx=18)
        tk.Label(left, text="试卷下载器",
                 font=(FONT, 16, "bold"),
                 bg="#FFFFFF", fg="#1B2440").pack(anchor="w")
        tk.Label(left, text="检索 · 下载 · 合成 PDF",
                 font=(FONT, 9),
                 bg="#FFFFFF", fg="#7A8299").pack(anchor="w")
        right = tk.Frame(hdr, bg="#FFFFFF")
        right.pack(side="right", padx=18)
        exp = f"token 有效至 {self.token_exp}" if self.token_exp else "token 状态未知"
        tk.Label(right, text=exp, font=(FONT, 9),
                 bg="#FFFFFF", fg="#3B8F64").pack(anchor="e")

        card = self._card(self)
        card.pack(fill="x", padx=14, pady=(2, 8))
        row1 = tk.Frame(card, bg="#FFFFFF")
        row1.pack(fill="x", padx=16, pady=(14, 6))
        self.var_grade = tk.StringVar(value="六年级")
        self.var_subject = tk.StringVar(value="数学")
        self.var_year = tk.StringVar(value="不限")
        self.var_type = tk.StringVar(value="不限")
        self.var_term = tk.StringVar(value="不限")
        self.var_area = tk.StringVar(value="320000 江苏")
        self.var_kw = tk.StringVar()
        fields = [
            ("年级", self.var_grade, [n for n, _ in GRADE_OPTS]),
            ("科目", self.var_subject, [n for n, _ in SUBJECT_OPTS]),
            ("年份", self.var_year, YEAR_OPTS),
            ("卷型", self.var_type, TYPE_OPTS),
            ("学期", self.var_term, [n for n, _ in TERM_OPTS]),
            ("地区", self.var_area, [n for n, _ in AREA_OPTS]),
        ]
        for i, (label, var, opts) in enumerate(fields):
            col = tk.Frame(row1, bg="#FFFFFF")
            col.grid(row=0, column=i, padx=(0, 12), sticky="w")
            tk.Label(col, text=label, font=(FONT, 9),
                     bg="#FFFFFF", fg="#5A6478").pack(anchor="w", pady=(0, 3))
            ttk.Combobox(col, textvariable=var, values=opts,
                         state="readonly", width=11).pack(anchor="w")
        row2 = tk.Frame(card, bg="#FFFFFF")
        row2.pack(fill="x", padx=16, pady=(2, 14))
        tk.Label(row2, text="名称关键词 (可留空)", font=(FONT, 9),
                 bg="#FFFFFF", fg="#5A6478").pack(anchor="w", pady=(0, 3))
        kwrow = tk.Frame(row2, bg="#FFFFFF")
        kwrow.pack(fill="x")
        ent = ttk.Entry(kwrow, textvariable=self.var_kw)
        ent.pack(side="left", fill="x", expand=True, ipady=4)
        ent.bind("<Return>", lambda e: self.on_search())
        self.btn_search = ttk.Button(kwrow, text="搜索", style="Ghost.TButton",
                                     command=self.on_search)
        self.btn_search.pack(side="left", padx=(10, 0))
        self.btn_dl = ttk.Button(kwrow, text="下载选中 (不选=全部)",
                                 style="Accent.TButton",
                                 command=self.on_download)
        self.btn_dl.pack(side="left", padx=(10, 0))

        lcard = self._card(self)
        lcard.pack(fill="both", expand=True, padx=14, pady=(0, 8))
        head = tk.Frame(lcard, bg="#FFFFFF")
        head.pack(fill="x", padx=16, pady=(12, 6))
        tk.Label(head, text="试卷列表", font=(FONT, 11, "bold"),
                 bg="#FFFFFF", fg="#1B2440").pack(side="left")
        self.lbl_count = tk.Label(head, text="", font=(FONT, 9),
                                  bg="#FFFFFF", fg="#7A8299")
        self.lbl_count.pack(side="right")
        tk.Checkbutton(head, text="下载后生成 PDF", variable=self.make_pdf,
                       bg="#FFFFFF", font=(FONT, 9),
                       activebackground="#FFFFFF").pack(side="right", padx=12)
        wrap = tk.Frame(lcard, bg="#FFFFFF")
        wrap.pack(fill="both", expand=True, padx=16, pady=(0, 14))
        cols = ("idx", "name", "print", "level")
        self.tree = ttk.Treeview(wrap, columns=cols, show="headings",
                                 selectmode="extended")
        self.tree.heading("idx", text="#")
        self.tree.heading("name", text="试卷名称")
        self.tree.heading("print", text="打印量")
        self.tree.heading("level", text="级别")
        self.tree.column("idx", width=50, anchor="center", stretch=False)
        self.tree.column("name", width=640, anchor="w")
        self.tree.column("print", width=90, anchor="center", stretch=False)
        self.tree.column("level", width=160, anchor="w")
        sb = ttk.Scrollbar(wrap, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=sb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        self.tree.tag_configure("odd", background="#FFFFFF")
        self.tree.tag_configure("even", background="#FAFBFF")

        bcard = self._card(self)
        bcard.pack(fill="x", padx=14, pady=(0, 12))
        top = tk.Frame(bcard, bg="#FFFFFF")
        top.pack(fill="x", padx=16, pady=(12, 6))
        ttk.Button(top, text="全部合成 PDF",
                   command=self.on_make_pdf).pack(side="left")
        ttk.Button(top, text="打开文件夹",
                   command=self.on_open_folder).pack(side="left", padx=(10, 0))
        self.lbl_status = tk.Label(top, text="就绪", font=(FONT, 9),
                                   bg="#FFFFFF", fg="#7A8299")
        self.lbl_status.pack(side="right")
        self.progress = ttk.Progressbar(bcard, mode="determinate", maximum=100)
        self.progress.pack(fill="x", padx=16)
        logf = tk.Frame(bcard, bg="#FFFFFF")
        logf.pack(fill="x", padx=16, pady=(8, 14))
        self.log = tk.Text(logf, height=7, bg="#FAFBFF", fg="#414B63",
                           font=("Consolas", 9), relief="flat",
                           highlightthickness=1, highlightbackground="#E7EAF3",
                           wrap="word", state="disabled")
        self.log.pack(fill="x")

    def logln(self, text):
        self.msg_q.put(("log", text))

    def _poll(self):
        try:
            while True:
                kind, payload = self.msg_q.get_nowait()
                if kind == "log":
                    self.log.configure(state="normal")
                    self.log.insert("end", payload + "\n")
                    self.log.see("end")
                    self.log.configure(state="disabled")
                elif kind == "progress":
                    self.progress["value"] = payload
                elif kind == "status":
                    self.lbl_status.config(text=payload)
                elif kind == "results":
                    self._fill_results(payload)
                elif kind == "done":
                    self._set_busy(False)
        except queue.Empty:
            pass
        self.after(120, self._poll)

    def _set_busy(self, v):
        self.busy = v
        st = "disabled" if v else "normal"
        self.btn_search.configure(state=st)
        self.btn_dl.configure(state=st)

    def _fill_results(self, items):
        self.tree.delete(*self.tree.get_children())
        self.targets = items
        for i, it in enumerate(items, 1):
            lv = it.get("levels") or []
            lv = "|".join(lv) if isinstance(lv, list) else (lv or "")
            self.tree.insert("", "end", iid=str(i - 1),
                             tags=("even" if i % 2 == 0 else "odd",),
                             values=(i, it.get("name", ""),
                                     it.get("print_count", ""), lv))
        self.lbl_count.config(text=f"共 {len(items)} 卷")

    def _load_local(self):
        d = core.OUT_ROOT
        if os.path.isdir(d):
            n = len([x for x in os.listdir(d)
                     if os.path.isdir(os.path.join(d, x))])
            self.logln(f"输出目录: {os.path.abspath(d)} (已下载 {n} 卷)")
        else:
            self.logln(f"输出目录: {os.path.abspath(d)}")

    def on_search(self):
        if self.busy:
            return
        kw = self.var_kw.get().strip()
        grade = dict(GRADE_OPTS)[self.var_grade.get()]
        subject = dict(SUBJECT_OPTS)[self.var_subject.get()]
        area = dict(AREA_OPTS)[self.var_area.get()]
        year = "" if self.var_year.get() == "不限" else self.var_year.get()
        term = dict(TERM_OPTS)[self.var_term.get()]
        types = "" if self.var_type.get() == "不限" else self.var_type.get()

        self._set_busy(True)
        self.lbl_count.config(text="搜索中…")

        def worker():
            try:
                if kw:
                    items = core.search_by_name(kw, max_pages=8)
                    self.msg_q.put(("log", f"关键词「{kw}」命中 {len(items)} 卷"))
                else:
                    a = {"grade": grade, "subject": subject, "area": area,
                         "year": year, "term": term, "types": types,
                         "levels": "", "min_print": 0}
                    items = core.collect_by_filters(a, 40)
                    self.msg_q.put(("log", f"条件筛选得到 {len(items)} 卷"))
                self.msg_q.put(("results", items))
            except core.TokenExpired:
                self.msg_q.put(("log", "[x] token 已过期, 请更换 token.txt 后重启"))
            except Exception as e:
                self.msg_q.put(("log", f"[x] 搜索失败: {e}"))
            finally:
                self.msg_q.put(("status", "就绪"))
                self.msg_q.put(("done", None))

        threading.Thread(target=worker, daemon=True).start()

    def on_download(self):
        if self.busy:
            return
        sel = self.tree.selection()
        if not sel:
            if not self.targets:
                self.logln("[!] 请先搜索出试卷列表")
                return
            sel = [str(i) for i in range(len(self.targets))]
        targets = [self.targets[int(i)] for i in sel]
        do_pdf = self.make_pdf.get()

        self._set_busy(True)
        self.progress["value"] = 0
        total = len(targets)

        def worker():
            done = fail = skip = 0
            try:
                for i, t in enumerate(targets, 1):
                    name = (t.get("name") or str(t.get("id", "")))[:30]
                    self.msg_q.put(("status", f"下载中 {i}/{total}  {name}"))
                    self.msg_q.put(("log", f"[{i}/{total}] {name}"))
                    try:
                        r = core.download_paper(str(t.get("id", "")),
                                                hint=t.get("name", ""), info=t)
                    except core.TokenExpired:
                        self.msg_q.put(("log", "[x] token 已过期, 请更换 token.txt 后重启"))
                        return
                    if r is None:
                        fail += 1
                    elif r.get("skipped"):
                        skip += 1
                        self.msg_q.put(("log", "  = 已存在, 跳过"))
                    else:
                        done += 1
                        core.append_manifest(r)
                        self.msg_q.put(("log", f"  [OK] {r.get('total')}页"))
                    if r is not None and do_pdf:
                        core.make_pdf(r["dir"])
                    self.msg_q.put(("progress", int(i * 100 / total)))
                    time.sleep(core.REQUEST_GAP)
                self.msg_q.put(("log",
                                f"完成: 新下载 {done} | 跳过 {skip} | 失败 {fail}"))
                self.msg_q.put(("log",
                                f"输出目录: {os.path.abspath(core.OUT_ROOT)}"))
            except Exception as e:
                self.msg_q.put(("log", f"[x] 下载出错: {e}"))
            finally:
                self.msg_q.put(("status", "就绪"))
                self.msg_q.put(("done", None))

        threading.Thread(target=worker, daemon=True).start()

    def on_make_pdf(self):
        if self.busy:
            return
        d = core.OUT_ROOT
        if not os.path.isdir(d):
            self.logln("[!] 还没有下载过试卷")
            return
        dirs = [x for x in sorted(os.listdir(d))
                if os.path.isdir(os.path.join(d, x))]
        if not dirs:
            self.logln("[!] papers 下还没有试卷")
            return

        def worker():
            self.msg_q.put(("status", f"合成 PDF ({len(dirs)} 份)…"))
            for x in dirs:
                self.msg_q.put(("log", f"  · {x[:50]}"))
                core.make_pdf(os.path.join(d, x))
            self.msg_q.put(("status", "就绪"))
            self.msg_q.put(("done", None))

        self._set_busy(True)
        threading.Thread(target=worker, daemon=True).start()

    def on_open_folder(self):
        path = os.path.abspath(core.OUT_ROOT)
        os.makedirs(path, exist_ok=True)
        try:
            if sys.platform.startswith("win"):
                os.startfile(path)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", path])
            else:
                subprocess.Popen(["xdg-open", path])
        except Exception as e:
            self.logln(f"[!] 打开文件夹失败: {e}")

    def _on_close(self):
        if self.busy:
            self.msg_q.put(("status", "正在处理中, 请稍候再退出"))
            return
        self.destroy()


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
