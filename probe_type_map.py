#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import time
sys.path.insert(0, "/workspace/exam_downloader_extract")
import paper_batch_pc as core

core.HDRS["Authorization"] = core.load_token()

GAP = 1.0


def list_ok(body, retries=4):
    for k in range(retries):
        res, err = core.list_page(body)
        if err != "member_gate":
            return res, err
        time.sleep(5 * (k + 1))
    return None, "member_gate"


def fetch_pages(pages):
    out = []
    for p in range(1, pages + 1):
        body = core.build_filters("", "", "", "", "", "")
        body["page_index"] = p
        res, err = list_ok(body)
        if err:
            print(f"  page {p} ERR {err}")
            break
        if not res:
            break
        out.extend(res)
        print(f"  page {p}: +{len(res)} (累计 {len(out)})")
        if len(res) < core.PAGE_SIZE:
            break
        time.sleep(GAP)
    return out


def main():
    print("== 1. 抓无筛选列表, 收集 paper_type -> resource_id ==")
    items = fetch_pages(5)
    mapping = {}
    for it in items:
        pt = (it.get("paper_type") or "").strip()
        rid = str(it.get("paper_type_resource_id") or "").strip()
        if pt and rid:
            mapping.setdefault(pt, set()).add(rid)
    for pt in sorted(mapping):
        rids = sorted(mapping[pt])
        decoded = []
        for r in rids:
            try:
                decoded.append(int(r, 16))
            except ValueError:
                decoded.append(f"hex:{r}")
        print(f"  {pt:10s} rids={rids} -> ids={decoded}")

    ids = sorted({d for rids in mapping.values() for r in rids
                  for d in [int(r, 16) if all(c in '0123456789abcdefABCDEF' for c in r) else None]
                  if d is not None})
    if not ids:
        print("no decodable ids")
        return
    print("== 2. 用解码出的 id 反查验证 ==")
    for i in ids:
        body = core.build_filters("", "", "", "", "", str(i))
        res, err = list_ok(body)
        if err:
            print(f"  id={i} ERR {err}")
            time.sleep(3)
            continue
        pts = sorted({(x.get("paper_type") or "?") for x in res}) if res else []
        print(f"  id={i} n={len(res) if res else 0} types={pts}")
        time.sleep(GAP)


if __name__ == "__main__":
    main()
