#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""试卷批量下载器 - 电脑交互版
双击运行, 按菜单提示操作。token 保存在程序同目录 token.txt (仅个人使用)。
"""
import base64
import csv
import json
import os
import re
import sys
import time

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = "https://appgw.gongfudou.com/leviathan/api/v2"
PAGE_SIZE = 20
REQUEST_GAP = 0.6
RETRY_MAX = 3
TIMEOUT = 20

HEADERS_BASE = {
    "app_type": "0",
    "AppVersion": "368",
    "LeviathanVersion": "368",
    "Platform": "leviathan_android",
    "GfdUserAgent": "printer:null-null service_sn:null app_version:4.50.1 "
                    "brand:Redmi model:21091116C os:Android os_version:13",
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; 21091116C Build/TP1A.220624.014; wv) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.199 "
                  "Mobile Safari/537.36",
    "Content-Type": "application/json; charset=UTF-8",
}
CDN_HEADERS = {"User-Agent": HEADERS_BASE["User-Agent"]}

OUT_ROOT = "papers"
MANIFEST = os.path.join(OUT_ROOT, "manifest.csv")


def app_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


TOKEN_FILE = os.path.join(app_dir(), "token.txt")
DEFAULT_TOKEN = (
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9."
    "eyJleHAiOjE3OTk0NTc3NzAsInVzZXJfbm8iOjM0MDIxNjkzLCJ1c2VyX3NuIjoiNjQxMDc5NzE0MzIzODkzNyJ9."
    "FUuz4L1dmHIXUbXBzYrOwSUtn9ZWWdSPUNYuQbMrGbY"
)
HDRS = {}


class TokenExpired(Exception):
    pass


def ask_token():
    print("\n" + "=" * 50)
    print("第一次使用 (或 token 失效), 需要粘贴登录凭证")
    print("抓包工具(ProxyPin等)里找 papers/list 请求,")
    print("复制请求头 Authorization 的完整值 (Token token=eyJ...)")
    print("只复制 eyJ 开头那段也可以")
    print("=" * 50)
    tok = input("粘贴后回车> ").strip().strip('"')
    if not tok:
        sys.exit("未输入 token, 退出")
    if "token=" not in tok:
        tok = "Token token=" + tok
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(tok)
    print("[i] 已保存到 token.txt (程序同目录)")
    return tok


def load_token():
    if os.path.isfile(TOKEN_FILE):
        with open(TOKEN_FILE, encoding="utf-8") as f:
            tok = f.read().strip()
        if tok:
            if "token=" not in tok:
                tok = "Token token=" + tok
            return tok
    tok = DEFAULT_TOKEN
    if "token=" not in tok:
        tok = "Token token=" + tok
    try:
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            f.write(tok)
        print("[i] 首次运行: 已使用内置 token 并保存到 token.txt")
    except Exception:
        print("[i] 首次运行: 已使用内置 token (无法写入 token.txt)")
    return tok


def check_tokenExp(tok):
    try:
        p = tok.split(".")[1]
        p += "=" * (-len(p) % 4)
        exp = json.loads(base64.urlsafe_b64decode(p)).get("exp", 0)
        if exp and exp < time.time():
            print("[x] token 已过期, 请重新抓包")
            return ask_token()
        print(f"[i] token 有效期至 {time.strftime('%Y-%m-%d %H:%M', time.localtime(exp))}")
    except Exception:
        pass
    return tok


def api_post(path, body):
    for attempt in range(RETRY_MAX):
        try:
            r = requests.post(f"{BASE}{path}", data=json.dumps(body),
                              headers=HDRS, timeout=TIMEOUT)
            if r.status_code == 401:
                raise TokenExpired()
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                if data.get("code") == 50000:
                    return None, "member_gate"
                return None, data.get("message", "?")
            return data["res"], None
        except TokenExpired:
            raise
        except (requests.RequestException, json.JSONDecodeError, KeyError) as e:
            if attempt == RETRY_MAX - 1:
                return None, f"{type(e).__name__}: {e}"
            time.sleep(1.5 * (attempt + 1))
    return None, "unreachable"


def api_get(path):
    for attempt in range(RETRY_MAX):
        try:
            r = requests.get(f"{BASE}{path}", headers=HDRS, timeout=TIMEOUT)
            if r.status_code == 401:
                raise TokenExpired()
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                return None, data.get("message", "?")
            return data["res"], None
        except TokenExpired:
            raise
        except (requests.RequestException, json.JSONDecodeError, KeyError) as e:
            if attempt == RETRY_MAX - 1:
                return None, f"{type(e).__name__}: {e}"
            time.sleep(1.5 * (attempt + 1))
    return None, "unreachable"


def safe_name(s, maxlen=60):
    s = re.sub(r'[\\/:*?"<>|\r\n\t]', "_", s or "untitled")
    return s[:maxlen].strip("._ ") or "untitled"


def paper_done(outdir):
    meta = os.path.join(outdir, "meta.json")
    if not os.path.isfile(meta):
        return False
    try:
        with open(meta, encoding="utf-8") as f:
            imgs = json.load(f).get("images", [])
        return bool(imgs) and all(
            os.path.isfile(os.path.join(outdir, f"page_{i+1:02d}.jpg"))
            for i in range(len(imgs)))
    except Exception:
        return False


def list_page(body):
    return api_post("/papers/list", body)


def build_filters(grade, subject, area, year, term, types):
    return {
        "page_index": 1, "page_size": PAGE_SIZE,
        "term": term, "xuekewang_area_id": area,
        "xuekewang_grade_id": grade, "xuekewang_level_id": "",
        "xuekewang_subject_id": subject, "xuekewang_type_ids": types,
        "xuekewang_version_id": "",
        "xukewang_school_id": "", "year": year,
    }


def search_by_name(kw, max_pages=30):
    hits, empty_pages = [], 0
    for page in range(1, max_pages + 1):
        body = build_filters("", "", "", "", "", "")
        body["page_index"] = page
        res, err = list_page(body)
        if err == "member_gate":
            print(f"[!] 第{page}页触发会员拦截, 以已搜到的继续")
            break
        if err:
            print(f"[!] 第{page}页失败: {err}")
            break
        if not res:
            break
        for it in res:
            if kw.lower() in (it.get("name") or "").lower():
                hits.append(it)
        print(f"  翻到第{page}页, 累计命中 {len(hits)}", end="\r")
        if len(res) < PAGE_SIZE:
            break
        time.sleep(REQUEST_GAP)
    print()
    return hits


def collect_by_filters(a, max_papers):
    want = [x for x in (a["levels"] or "").split(",") if x]
    ids, seen, page = [], set(), 1
    while True:
        body = build_filters(a["grade"], a["subject"], a["area"],
                             a["year"], a["term"], a["types"])
        body["page_index"] = page
        res, err = list_page(body)
        if err == "member_gate":
            print(f"[!] 第{page}页会员拦截, 以已获取 {len(ids)} 卷继续")
            break
        if err:
            print(f"[!] 列表第{page}页失败: {err}")
            break
        if not res:
            break
        new = 0
        for it in res:
            pid = str(it.get("id") or "")
            if not pid or pid in seen:
                continue
            seen.add(pid)
            lv = it.get("levels") or []
            if want and not any(w in lv for w in want):
                continue
            pc = it.get("print_count") or 0
            if a.get("min_print") and pc < a["min_print"]:
                continue
            ids.append({"id": pid, "name": it.get("name", ""),
                        "print_count": pc, "levels": lv})
            new += 1
        print(f"  列表第{page}页: +{new} (累计 {len(ids)})")
        if max_papers and len(ids) >= max_papers:
            ids = ids[:max_papers]
            break
        if len(res) < PAGE_SIZE:
            break
        page += 1
        time.sleep(REQUEST_GAP)
    return ids


def download_paper(pid, hint="", info=None):
    res, err = api_get(f"/papers/{pid}")
    if err:
        print(f"[!] 详情失败 {pid}: {err}")
        return None
    name = res.get("name") or hint or pid
    outdir = os.path.join(OUT_ROOT, f"{pid}_{safe_name(name)}")
    if paper_done(outdir):
        print(f"  = 已存在, 跳过: {name[:40]}")
        return {"id": pid, "name": name, "dir": outdir, "skipped": True}

    os.makedirs(outdir, exist_ok=True)
    images = res.get("images", [])
    if not images:
        print(f"  [!] 无图片: {name[:40]}")
        return None
    ok = 0
    for i, url in enumerate(images, 1):
        path = os.path.join(outdir, f"page_{i:02d}.jpg")
        if os.path.isfile(path) and os.path.getsize(path) > 0:
            ok += 1
            continue
        got = False
        for attempt in range(RETRY_MAX):
            try:
                with requests.get(url, headers=CDN_HEADERS, stream=True,
                                  timeout=30) as img:
                    img.raise_for_status()
                    if "image" not in img.headers.get("Content-Type", ""):
                        raise ValueError("非图片响应")
                    tmp = path + ".part"
                    with open(tmp, "wb") as f:
                        for chunk in img.iter_content(65536):
                            f.write(chunk)
                    os.replace(tmp, path)
                ok += 1
                got = True
                break
            except (requests.RequestException, ValueError) as e:
                if attempt == RETRY_MAX - 1:
                    print(f"    [x] 第{i}页失败: {e}")
                else:
                    time.sleep(1.5 * (attempt + 1))
        if not got:
            break
        time.sleep(REQUEST_GAP)

    meta = {"id": pid, "name": name, "images": images,
            "page": res.get("page") or len(images),
            "question_count": res.get("question_count"),
            "school": res.get("school_name"),
            "print_count": res.get("print_count") or (info or {}).get("print_count", ""),
            "levels": res.get("levels") or (info or {}).get("levels", []),
            "downloaded_ok": ok, "total": len(images),
            "downloaded_at": time.strftime("%Y-%m-%d %H:%M:%S")}
    with open(os.path.join(outdir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    status = "OK" if ok == len(images) else f"半成 {ok}/{len(images)}"
    print(f"  [{status}] 《{name[:36]}》 {len(images)}页")
    return {"id": pid, "name": name, "dir": outdir, "ok": ok, "total": len(images)}


FIELDS = ["id", "name", "school", "print_count", "levels", "dir",
          "pages_ok", "pages_total", "time"]


def append_manifest(r):
    os.makedirs(OUT_ROOT, exist_ok=True)
    nf = not os.path.isfile(MANIFEST)
    with open(MANIFEST, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        if nf:
            w.writerow(FIELDS)
        m_path = os.path.join(r["dir"], "meta.json")
        lv = ""
        pc = ""
        if os.path.isfile(m_path):
            try:
                with open(m_path, encoding="utf-8") as fm:
                    m = json.load(fm)
                l = m.get("levels", [])
                lv = "|".join(l) if isinstance(l, list) else (l or "")
                pc = m.get("print_count", "")
            except Exception:
                pass
        w.writerow([r["id"], r["name"], "", pc, lv, r["dir"],
                    r.get("ok", ""), r.get("total", ""),
                    time.strftime("%Y-%m-%d %H:%M:%S")])


def make_pdf(outdir):
    try:
        from PIL import Image
    except ImportError:
        print("[!] 未安装 Pillow, 无法生成 PDF (pip install pillow)")
        return
    files = sorted(f for f in os.listdir(outdir)
                   if f.startswith("page_") and f.endswith(".jpg"))
    if not files:
        print("[!] 目录里没有图片")
        return
    imgs = [Image.open(os.path.join(outdir, f)).convert("RGB") for f in files]
    pdf = os.path.join(outdir, os.path.basename(outdir) + ".pdf")
    imgs[0].save(pdf, save_all=True, append_images=imgs[1:], resolution=100)
    print(f"  [PDF] {pdf}  ({len(files)}页, {os.path.getsize(pdf)//1024}KB)")


def run_targets(targets):
    done = fail = skip = 0
    for i, t in enumerate(targets, 1):
        print(f"[{i}/{len(targets)}] {t['id']} {t.get('name','')[:30]}")
        try:
            r = download_paper(t["id"], hint=t.get("name", ""), info=t)
        except TokenExpired:
            HDRS["Authorization"] = check_tokenExp(ask_token())
            print("  已更新 token, 请重跑本次操作")
            return
        time.sleep(REQUEST_GAP)
        if r is None:
            fail += 1
            continue
        if r.get("skipped"):
            skip += 1
            if input("  生成 PDF? (回车=是 / n=否): ").strip().lower() != "n":
                make_pdf(r["dir"])
        else:
            done += 1
            if input("  生成 PDF? (回车=是 / n=否): ").strip().lower() != "n":
                make_pdf(r["dir"])
            append_manifest(r)
    print(f"\n完成: 新下载 {done} | 跳过 {skip} | 失败 {fail}")
    print(f"输出目录: {os.path.abspath(OUT_ROOT)}")


def ask_int(prompt, default=0):
    s = input(prompt).strip()
    return int(s) if s.isdigit() else default


def menu_batch():
    print("\n--- 按条件批量下载 (直接回车用默认值) ---")
    a = {
        "grade":   input("年级 id (默认6=六年级): ").strip() or "6",
        "subject": input("科目 (默认2=数学, 1语文 3英语): ").strip() or "2",
        "area":    input("地区 (默认320000=江苏, 回车同): ").strip() or "320000",
        "year":    input("年份 (如2026, 回车=不限): ").strip(),
        "term":    input("学期 (LAST上/NEXT下, 回车=不限): ").strip(),
        "types":   input("卷型 ids (回车=不限): ").strip(),
        "levels":  "名校,市重点" if input("只要名校/市重点? (回车=是 / n=否): ").strip().lower() != "n" else "",
        "min_print": ask_int("只下打印量≥ (回车=不限): ", 0),
    }
    mx = ask_int("最多下几份 (回车=20): ", 20)
    print("\n开始搜索...")
    targets = collect_by_filters(a, mx)
    print(f"共 {len(targets)} 卷")
    if targets and input("确认下载? (回车=是 / n=否): ").strip().lower() != "n":
        run_targets(targets)


def menu_search():
    print("\n--- 按名字搜索下载 ---")
    kw = input("输入试卷名关键词 (如: 学易金卷 江苏): ").strip()
    if not kw:
        return
    hits = search_by_name(kw)
    if not hits:
        print("[!] 没搜到, 换个关键词试试")
        return
    for i, h in enumerate(hits[:30], 1):
        lv = "|".join(h.get("levels") or [])
        print(f"  {i:2d}. {h['name'][:60]}  (打印{h.get('print_count',0)} {lv})")
    if len(hits) > 30:
        print(f"  ... 共 {len(hits)} 条, 只显示前 30")
    pick = input("输入序号(多个用逗号), 回车=只下第1个, q=取消> ").strip()
    if pick == "q":
        return
    idx = [int(x) - 1 for x in pick.split(",") if x.strip().isdigit()] if pick else [0]
    targets = [{"id": str(hits[i]["id"]), "name": hits[i]["name"]}
               for i in idx if 0 <= i < len(hits)]
    if targets:
        run_targets(targets)


def menu_id():
    print("\n--- 按试卷 ID 下载 ---")
    ids = input("输入试卷 id (多个用逗号)> ").strip()
    if not ids:
        return
    run_targets([{"id": x.strip(), "name": ""} for x in ids.split(",") if x.strip()])


def menu_pdf():
    print("\n--- 把已下载的试卷合成 PDF ---")
    dirs = [d for d in sorted(os.listdir(OUT_ROOT))
            if os.path.isdir(os.path.join(OUT_ROOT, d))]
    if not dirs:
        print("[!] papers/ 下还没有试卷")
        return
    for i, d in enumerate(dirs, 1):
        print(f"  {i:2d}. {d[:60]}")
    pick = input("输入序号(多个逗号), 回车=全部> ").strip()
    idx = ([int(x) - 1 for x in pick.split(",") if x.strip().isdigit()]
           if pick else range(len(dirs)))
    for i in idx:
        if 0 <= i < len(dirs):
            print(f"  · {dirs[i][:50]}")
            make_pdf(os.path.join(OUT_ROOT, dirs[i]))


def main():
    global HDRS
    tok = check_tokenExp(load_token())
    HDRS = dict(HEADERS_BASE)
    HDRS["Authorization"] = tok
    os.makedirs(OUT_ROOT, exist_ok=True)
    while True:
        print("\n" + "=" * 50)
        print("  试卷批量下载器 (个人使用)")
        print("=" * 50)
        print("  1. 按条件批量下载 (年级/科目/年份/名校市重点...)")
        print("  2. 按名字搜索并下载")
        print("  3. 按试卷 ID 下载")
        print("  4. 已下载的试卷合成 PDF")
        print("  q. 退出")
        c = input("选择> ").strip().lower()
        try:
            if c == "1":
                menu_batch()
            elif c == "2":
                menu_search()
            elif c == "3":
                menu_id()
            elif c == "4":
                menu_pdf()
            elif c in ("q", "quit", "exit"):
                break
        except TokenExpired:
            HDRS["Authorization"] = check_tokenExp(ask_token())
        except KeyboardInterrupt:
            print("\n(已中断当前操作)")
    print("再见")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n再见")
