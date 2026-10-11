import sys
sys.path.insert(0, "/workspace/exam_downloader_extract")
import os
os.chdir("/workspace/exam_downloader_extract")
import paper_batch_pc as core

core.HDRS = dict(core.HEADERS_BASE)
core.HDRS["Authorization"] = core.load_token()

body = core.build_filters("", "", "", "", "", "")
body["page_index"] = 1
res, err = core.list_page(body)
print("err:", err)
if res:
    print("count:", len(res))
    print("first:", {k: res[0].get(k) for k in ("id", "name", "print_count", "levels")})
    for it in res[:10]:
        print("-", it.get("name"))
