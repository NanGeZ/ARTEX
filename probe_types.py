#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import time
sys.path.insert(0, "/workspace/exam_downloader_extract")
import paper_batch_pc as core

core.HDRS["Authorization"] = core.load_token()

GAP = 1.2


def query(types, retries=3):
    body = core.build_filters("", "", "", "", "", types)
    for k in range(retries):
        res, err = core.list_page(body)
        if err != "member_gate":
            return res, err
        time.sleep(3 * (k + 1))
    return None, "member_gate"


if __name__ == "__main__":
    res, err = query("")
    if err:
        print(f"base ERR {err}")
        sys.exit(1)
    print(f"base OK n={len(res)}")
    print("== single id probe 1..60 ==")
    for i in range(1, 61):
        res, err = query(str(i))
        if err:
            print(f"{i:3d} ERR {err}")
            time.sleep(4)
            continue
        if not res:
            print(f"{i:3d} 0")
            time.sleep(GAP)
            continue
        pts = sorted({(it.get("paper_type") or "?") for it in res})
        print(f"{i:3d} n={len(res):2d} types={pts}")
        for it in res[:3]:
            print(f"      {(it.get('name') or '')[:34]}")
        time.sleep(GAP)
