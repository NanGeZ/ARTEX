# -*- coding: utf-8 -*-
"""单变量实验: 找出 v2 列表过滤参数的正确格式"""
import sys, time, json
sys.path.insert(0, '/workspace/v3_upload')
import paper_batch_pc as core
_tok = open('/workspace/exam_downloader_extract/token.txt', encoding='utf-8').read().strip()
if 'token=' not in _tok:
    _tok = 'Token token=' + _tok
core.HDRS.update(core.HEADERS_BASE)
core.HDRS['Authorization'] = _tok

tests = [
    ("仅term LAST",            {"page_index": 1, "page_size": 3, "term": "LAST"}),
    ("仅年级6(xuekewang)",      {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6"}),
    ("仅年级6(resource_id)",    {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "600f7df21ce95800126c077f"}),
    ("仅学科2",                 {"page_index": 1, "page_size": 3, "xuekewang_subject_id": "2"}),
    ("仅年份2025",              {"page_index": 1, "page_size": 3, "year": "2025"}),
    ("仅卷型14",                {"page_index": 1, "page_size": 3, "xuekewang_type_ids": "14"}),
    ("仅地区320000",            {"page_index": 1, "page_size": 3, "xuekewang_area_id": "320000"}),
    ("年级6+学科2",             {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "xuekewang_subject_id": "2"}),
    ("年级6+卷型14",            {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "xuekewang_type_ids": "14"}),
    ("年级6+2025",              {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "year": "2025"}),
    ("年级6+term LAST",         {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "term": "LAST"}),
    ("type数组[14]",            {"page_index": 1, "page_size": 3, "xuekewang_type_ids": ["14"]}),
]
for name, body in tests:
    res, err = core.list_page(body)
    if res is None:
        print("%-26s -> ERR %s" % (name, err))
        time.sleep(1.5)
        continue
    items = res if isinstance(res, list) else (res.get("items") or [])
    total = res.get("total", len(items)) if isinstance(res, dict) else len(items)
    if items:
        print("%-26s -> %d 卷: %s | %s" % (name, total, items[0].get("name", "")[:28], items[0].get("paper_type")))
    else:
        print("%-26s -> 0  (err=%s)" % (name, err))
    time.sleep(1.5)
