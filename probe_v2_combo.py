# -*- coding: utf-8 -*-
"""组合参数二分: 定位导致 0 结果的参数组合"""
import sys, time
sys.path.insert(0, '/workspace/v3_upload')
import paper_batch_pc as core
_tok = open('/workspace/exam_downloader_extract/token.txt', encoding='utf-8').read().strip()
if 'token=' not in _tok:
    _tok = 'Token token=' + _tok
core.HDRS.update(core.HEADERS_BASE)
core.HDRS['Authorization'] = _tok

tests = [
    ("年级6+卷型14+2025",    {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "xuekewang_type_ids": "14", "year": "2025"}),
    ("年级6+卷型14+term",    {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "xuekewang_type_ids": "14", "term": "LAST"}),
    ("年级6+2025+term",      {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "year": "2025", "term": "LAST"}),
    ("年级6+卷型14+2025+term", {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "6", "xuekewang_type_ids": "14", "year": "2025", "term": "LAST"}),
    ("卷型14+2025+term",     {"page_index": 1, "page_size": 3, "xuekewang_type_ids": "14", "year": "2025", "term": "LAST"}),
    ("年级7+卷型13+110000+2025", {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "7", "xuekewang_type_ids": "13", "xuekewang_area_id": "110000", "year": "2025"}),
    ("年级7+卷型13+2025",    {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "7", "xuekewang_type_ids": "13", "year": "2025"}),
    ("年级7+110000",         {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "7", "xuekewang_area_id": "110000"}),
    ("年级7+卷型13+2026",    {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "7", "xuekewang_type_ids": "13", "year": "2026"}),
    ("多卷型14,11",          {"page_index": 1, "page_size": 3, "xuekewang_type_ids": "14,11"}),
    ("年级10+卷型12+2025",   {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "10", "xuekewang_type_ids": "12", "year": "2025"}),
    ("年级1+学科1+320000",   {"page_index": 1, "page_size": 3, "xuekewang_grade_id": "1", "xuekewang_subject_id": "1", "xuekewang_area_id": "320000"}),
]
for name, body in tests:
    res, err = core.list_page(body)
    if res is None:
        print("%-32s -> ERR %s" % (name, err))
    else:
        items = res if isinstance(res, list) else (res.get("items") or [])
        if items:
            print("%-32s -> %d: %s | %s" % (name, len(items), items[0].get("name", "")[:30], items[0].get("paper_type")))
        else:
            print("%-32s -> 0" % name)
    time.sleep(1.5)
