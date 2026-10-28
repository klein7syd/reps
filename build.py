#!/usr/bin/env python3
"""
REPS 单文件构建器
把 src/ 下的片段拼成单文件 HTML。

设计原则：
1. 能证明「拆分没有改变任何一行代码」——构建产物与参考版逐字节比对。
2. 不依赖第三方库，只用标准库。
3. 缺片段、占位未替换、违反铁律，一律报错退出，不产出半成品。

目录约定：
    src/shell/head.html     <!DOCTYPE> 到 <style> 之前
    src/shell/body.html     </style> 之后到 </html>，三个 script 用 [[MODULE:x]] 占位
    src/css/*.css           CSS 片段，按 manifest 顺序拼
    src/js/moves.js         动作库数据（window.MOVES）
    src/js/grow.js          成长算法（window.GROW）
    src/js/app.js           主应用逻辑（完整 IIFE）
    src/manifest.json       拼接顺序，顺序即执行顺序

用法：
    python3 build.py             构建到 dist/index.html
    python3 build.py --verify    构建后要求与 dist/handmade.html 逐字节一致
"""
import os
import re
import sys
import json
import hashlib

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def manifest():
    p = os.path.join(SRC, "manifest.json")
    if not os.path.exists(p):
        sys.exit("× 缺少 src/manifest.json")
    return json.loads(read(p))


def collect(folder_key):
    m = manifest()
    out = []
    for name in m[folder_key]:
        p = os.path.join(SRC, folder_key, name)
        if not os.path.exists(p):
            sys.exit(f"× manifest 里写了 {folder_key}/{name}，但文件不存在")
        out.append((name, read(p)))
    return out


def assemble_app():
    """把 src/js/app/*.js 片段按 manifest 顺序装回完整 IIFE。

    约束（改了会静默出错）：
      - 片段内容必须原样拼接，不做 strip，否则空白差异会累积
      - 片段之间不能加分隔符，产物必须逐字节可还原
    """
    m = manifest()
    frags = m.get("appFragments")
    if not frags:
        sys.exit("× manifest.json 缺少 appFragments")

    # script 外层标签由这里统一加，片段只存 IIFE 内容
    open_tag = "<script>" + read(os.path.join(SRC, "js", "app", "_iife-open.txt"))
    close_tag = read(os.path.join(SRC, "js", "app", "_iife-close.txt")) + "</script>"

    body = ""
    for fn in frags:
        p = os.path.join(SRC, "js", "app", fn)
        if not os.path.exists(p):
            sys.exit(f"× appFragments 里写了 {fn}，但 src/js/app/{fn} 不存在")
        body += read(p)

    return open_tag + body + close_tag


def build():
    m = manifest()

    head = read(os.path.join(SRC, "shell", "head.html"))

    # CSS：片段之间用注释分隔。注意分隔符本身不写进产物——
    # 产物必须与参考版一致，所以这里直接首尾相接，各片段自带尾部换行。
    css_parts = [t for _, t in collect("css")]
    # 最后一个片段尾换行去掉，让 </style> 紧贴上一行
    style = "<style>" + "".join(css_parts).rstrip("\n") + "\n</style>"

    body = read(os.path.join(SRC, "shell", "body.html"))

    modules = {}
    for name, text in collect("js"):
        key = name.replace(".js", "")
        if key == "app":
            # app 由片段现场拼装，绝不读静态 app.js——
            # 否则改了片段却不生效，是最危险的静默失败。
            text = assemble_app()
        modules[key] = text

    for slot in re.findall(r"\[\[MODULE:(\w+)\]\]", body):
        if slot not in modules:
            sys.exit(f"× body.html 引用了模块 {slot}，但 src/js/{slot}.js 不存在")
        # 模块文本不以换行结尾，占位吃掉了原 script 后的换行，这里补回
        body = body.replace(f"[[MODULE:{slot}]]", modules[slot].rstrip("\n") + "\n")

    left = re.findall(r"\[\[MODULE:(\w+)\]\]", body)
    if left:
        sys.exit(f"× 还有未替换的占位: {left}")

    html = head + style + body
    write(os.path.join(DIST, "index.html"), html)
    return html


def check_rules(html):
    """硬性验收：单文件、0 外链。项目铁律，构建阶段就卡住。"""
    errs = []
    n_script_src = len(re.findall(r"<script[^>]*\bsrc\s*=", html))
    n_link = len(re.findall(r"<link\b", html))
    ext = [u for u in re.findall(r"https?://[^\s\"'<>()]+", html) if "www.w3.org" not in u]
    if n_script_src:
        errs.append(f"存在 {n_script_src} 个 <script src>")
    if n_link:
        errs.append(f"存在 {n_link} 个 <link> 标签")
    if ext:
        errs.append(f"存在 {len(ext)} 个外链: {ext[:3]}")
    return errs


def main():
    verify = "--verify" in sys.argv
    html = build()

    b = len(html.encode("utf-8"))
    md5 = hashlib.md5(html.encode("utf-8")).hexdigest()
    print(f"构建完成: dist/index.html  {b:,} 字节  md5 {md5}")

    errs = check_rules(html)
    if errs:
        print("× 违反项目铁律：")
        for e in errs:
            print("   -", e)
        sys.exit(1)
    print("✓ 铁律检查：script src 0 / link 0 / 外链 0")

    ref = os.path.join(DIST, "handmade.html")
    if not os.path.exists(ref):
        print("· 无参考版，跳过一致性比对")
        return

    ref_html = read(ref)
    if ref_html == html:
        print("✓ 与 dist/handmade.html 逐字节一致（拆分无损）")
        return

    rb = len(ref_html.encode("utf-8"))
    print(f"△ 与参考版有差异：参考 {rb:,} B / 构建 {b:,} B，差 {b - rb:+d} B")

    # 找出所有差异段落，用行号定位
    def lines(t):
        return t.split("\n")

    a, c = lines(ref_html), lines(html)
    import difflib
    diff = list(difflib.unified_diff(a, c, "handmade", "build", n=1, lineterm=""))
    print(f"  差异行数: {len(diff)}")
    for ln in diff[:40]:
        print("  " + ln[:200])
    if len(diff) > 40:
        print(f"  …还有 {len(diff) - 40} 行")
    if verify:
        print("  × --verify 模式：存在差异即失败")
        sys.exit(1)


if __name__ == "__main__":
    main()
