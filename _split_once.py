#!/usr/bin/env python3
"""
一次性拆分器：把单文件 HTML 拆成 src/ 下的片段。
只在初始化时跑一次，之后手改 src/，不再用它。

切分依据是文件自己的注释分区，不靠猜。
"""
import os
import re
import json

SRC_FILE = "/workspace/reps-archive/线上当前版-a582baf-78617B-20261028.html"
ROOT = "/workspace/reps-repo"
SRC = os.path.join(ROOT, "src")

s = open(SRC_FILE, encoding="utf-8").read()


def w(rel, text):
    p = os.path.join(SRC, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(text)


# ---------- shell ----------
i_style = s.index("<style")
head = s[:i_style]
w("shell/head.html", head)

style_raw = s[i_style: s.index("</style>") + 8]
after_style = s[s.index("</style>") + 8:]

# body 骨架：从 </style> 之后到 </html>，但把三个 script 换成占位
body = after_style
scripts = re.findall(r"<script[^>]*>.*?</script>", s, flags=re.S)
mod_names = ["moves", "grow", "app"]
for sc, nm in zip(scripts, mod_names):
    # 占位独占一行：连 script 后面那个换行一起吃掉。
    # 构建时按「replace 后补一个 \n」还原，因为模块文本本身不以换行结尾。
    idx = body.index(sc)
    nxt_nl = body.find("\n", idx + len(sc))
    if nxt_nl != -1 and body[idx + len(sc):nxt_nl].strip() == "":
        body = body[:idx] + "[[MODULE:%s]]" % nm + body[nxt_nl + 1:]
    else:
        body = body.replace(sc, "[[MODULE:%s]]" % nm, 1)
w("shell/body.html", body)

# ---------- CSS 切分 ----------
css = style_raw[len("<style>"): -len("</style>")]
css = css.strip("\n")

# 分区标题形如  /* =====  标题  ===== */
mark = re.compile(r"/\*\s*=+\s*(.+?)\s*=+\s*\*/")
cuts = [(m.start(), m.group(1).strip()) for m in mark.finditer(css)]

def slug(name, idx):
    """把中文标题转成稳定文件名。用索引保证顺序和唯一性。"""
    mapping = {
        "REPS 单文件版 · 像素风样式": "00-base",
        "通用控件（键盘可达、像素风）": "10-controls",
        "底栏 Tab": "20-tabbar",
        "卡片 / 区块": "30-card",
        "三态": "40-state",
        "训练页": "50-train",
        "进度页": "60-progress",
        "成长页": "70-grow",
        "动作库": "80-moves",
        "身体数据": "85-body",
        "音乐卡": "90-audio",
        "响应式：小屏微调": "95-responsive",
    }
    return mapping.get(name, f"x{idx:02d}-{name[:8]}")

css_files = []
for i, (pos, name) in enumerate(cuts):
    end = cuts[i + 1][0] if i + 1 < len(cuts) else len(css)
    chunk = css[pos:end]
    fn = slug(name, i) + ".css"
    w("css/" + fn, chunk)
    css_files.append(fn)

# ---------- JS: moves（数据） ----------
m0 = scripts[0]
w("js/moves.js", m0 + "\n")

# ---------- JS: grow（成长系统） ----------
w("js/grow.js", scripts[1] + "\n")

# ---------- JS: app 主逻辑，按注释分区切 ----------
app = scripts[2]
open_tag = re.match(r"<script[^>]*>", app).group(0)
close_tag = "</script>"
inner = app[len(open_tag): -len(close_tag)]

# IIFE 头尾
iife_head_end = inner.index("const KEY = 'reps.v2';")
iife_prefix = inner[:iife_head_end]          # (function () { 'use strict'; ... 注释
iife_suffix = inner[inner.rindex("})();"):]  # 收尾
core = inner[iife_head_end: inner.rindex("})();")]

# 主逻辑内部分区：/* ===== 训练 ===== */ 这一种（单行短横线不同）
app_mark = re.compile(r"/\*\s*=+\s*\n\s*(.+?)\n\s*=+\s*\*/")
app_cuts = [(m.start(), m.group(1).strip()) for m in app_mark.finditer(core)]
print("app 分区:", [(p, n) for p, n in app_cuts])

app_map = {
    "训练": "20-train",
    "进度": "30-progress",
    "成长 + 灵兽": "40-grow-page",
    "动作库": "50-moves-page",
    "身体数据（真实 BMI / BMR / 每日消耗）": "60-body-page",
    "音乐（导入本地音频，真实播放 + 真实陪伴值累计）": "70-audio",
    "数据备份（导出 / 导入 JSON）": "80-backup",
    "Tab 切换": "85-tabs",
    "初始化": "90-init",
}

# 第一段是「状态与工具函数」，在第一个分区标记之前
first_mark = app_cuts[0][0] if app_cuts else len(core)
# ---------- app 片段：恢复原始缩进 ----------
# app.js 生成时，片段按 2 空格缩进重新拼回过。为了让片段单独可读又不丢原始缩进，
# 这里把每个片段开头的 2 空格「还回去」——片段首行在原始文件里是缩进 2 的，
# 但在片段文件里被顶格了，所以每行要补 2 个空格。
w("js/app/00-state.js", core[:first_mark])


app_files = ["00-state.js"]
for i, (pos, name) in enumerate(app_cuts):
    end = app_cuts[i + 1][0] if i + 1 < len(app_cuts) else len(core)
    chunk = core[pos:end]
    fn = app_map.get(name, f"x{i:02d}") + ".js"
    w("js/app/" + fn, chunk)
    app_files.append(fn)

# IIFE 包装单独存
w("js/app/_iife-open.txt", iife_prefix)   # 原样保存，含尾部空行
w("js/app/_iife-close.txt", iife_suffix)  # 原样保存

# ---------- 组装 app 模块成品 ----------
# 注意：app 内部片段是裸代码，必须重新包回同一个 IIFE 闭包，
# 否则顶层 function 声明会泄漏到全局，且 const KEY 等状态彼此不可见。
app_assembled = iife_prefix + core[:first_mark]
for i, (pos, name) in enumerate(app_cuts):
    end = app_cuts[i + 1][0] if i + 1 < len(app_cuts) else len(core)
    app_assembled += core[pos:end]
app_assembled = app_assembled + iife_suffix
w("js/app.js", open_tag + app_assembled + close_tag)   # 仅作参考，build 不读它
print("app.js 长度:", len(app_assembled), "（原始 script2:", len(scripts[2]), "）")

# ---------- manifest ----------
manifest = {
    "css": css_files,
    "js": ["moves.js", "grow.js", "app.js"],
    "appFragments": app_files,
}
w("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

print(f"\nCSS 片段 {len(css_files)} 个")
print(f"JS 模块 3 个（moves / grow / app），app 内部 {len(app_files)} 段")
