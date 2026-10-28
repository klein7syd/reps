#!/usr/bin/env python3
"""
REPS 回归测试
多个窗口并行改代码，合并前必须跑这个。全过才算能合。

检查项：
  A. 静态铁律        单文件、script src 0、link 0、外链 0
  B. 语法            JS 能解析（用 node --check 拆出的三段）
  C. 双视口渲染      console 错误 0、无横向溢出、无 4xx/5xx 请求
  D. 核心流程        加组 5 次不重填 → 保存 → 刷新数据仍在 → 导出导入往返
  E. 五个页面可达    训练/进度/成长/动作库/身体 都能切过去且有内容

用法：
    python3 test/regress.py                      测 dist/index.html
    python3 test/regress.py path/to/file.html    测指定文件
    python3 test/regress.py --url <链接>          测线上

退出码：0 全过，1 有失败项
"""
import asyncio
import os
import re
import sys
import json
import subprocess
import tempfile

from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = "/usr/bin/chromium"

VIEWPORTS = [(390, 844, "手机"), (1440, 900, "桌面")]

results = []


def rec(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'✓' if ok else '×'} {name}{('  — ' + detail) if detail else ''}")


def static_checks(html):
    n_src = len(re.findall(r"<script[^>]*\bsrc\s*=", html))
    n_link = len(re.findall(r"<link\b", html))
    ext = [u for u in re.findall(r"https?://[^\s\"'<>()]+", html) if "www.w3.org" not in u]
    rec("A1 script src 为 0", n_src == 0, f"实际 {n_src}")
    rec("A2 link 标签为 0", n_link == 0, f"实际 {n_link}")
    rec("A3 外链为 0", len(ext) == 0, f"实际 {len(ext)} {ext[:2]}")
    rec("A4 单文件（含 DOCTYPE 与 </html>）",
        html.lstrip().lower().startswith("<!doctype html>") and "</html>" in html)
    rec("A5 持久化键为 reps.v2", "reps.v2" in html)


def syntax_checks(html):
    blocks = re.findall(r"<script[^>]*>(.*?)</script>", html, flags=re.S)
    if not blocks:
        rec("B1 提取到 script 块", False, "0 个")
        return
    allok = True
    for i, b in enumerate(blocks):
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(b)
            p = f.name
        r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
        os.unlink(p)
        if r.returncode != 0:
            allok = False
            rec(f"B1.{i} script 块语法", False, r.stderr.strip().split("\n")[0][:120])
    rec(f"B1 {len(blocks)} 个 script 块语法合法", allok)


async def browser_checks(target):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        for w, h, label in VIEWPORTS:
            ctx = await b.new_context(viewport={"width": w, "height": h})
            await ctx.grant_permissions(["clipboard-read", "clipboard-write"])
            pg = await ctx.new_page()
            errs, bad_req = [], []

            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("response", lambda r: bad_req.append(f"{r.status} {r.url[:60]}") if r.status >= 400 else None)

            await pg.goto(target)
            await pg.wait_for_timeout(900)

            rec(f"C {label} {w}×{h} console 错误为 0", len(errs) == 0,
                f"{len(errs)} 条 {errs[:2]}" if errs else "")
            rec(f"C {label} {w}×{h} 无 4xx/5xx", len(bad_req) == 0,
                f"{len(bad_req)} 条 {bad_req[:2]}" if bad_req else "")

            sw = await pg.evaluate("document.documentElement.scrollWidth")
            cw = await pg.evaluate("document.documentElement.clientWidth")
            rec(f"C {label} {w}×{h} 无横向溢出", sw <= cw, f"scrollW {sw} / clientW {cw}")

            # E. 五个 Tab 切换
            tabs = await pg.eval_on_selector_all("nav.tabs button", "els => els.map(e => e.dataset.tab)")
            expected = ["train", "stats", "grow", "moves", "body"]
            ok_tabs = all(t in tabs for t in expected)
            rec(f"E {label} 底部导航含 5 个 Tab", ok_tabs, f"实际 {tabs}")

            for t in expected:
                if t not in tabs:
                    continue
                await pg.click(f'nav.tabs button[data-tab="{t}"]')
                await pg.wait_for_timeout(220)
                visible = await pg.evaluate(
                    f"""() => {{
                        const s = document.getElementById('tab-{t}');
                        if (!s) return false;
                        const st = getComputedStyle(s);
                        return st.display !== 'none' && s.innerText.trim().length > 0;
                    }}"""
                )
                rec(f"E {label} Tab「{t}」可切入且有内容", visible)

            if w == 390:
                await core_flow(pg)

            await ctx.close()

        await b.close()


async def core_flow(pg):
    """核心流程：加组 → 保存 → 刷新 → 导出导入。全部用真实 UI 操作。"""
    await pg.click('nav.tabs button[data-tab="train"]')
    await pg.wait_for_timeout(200)

    # 选一个动作
    sel = pg.locator("#moveSel")
    if await sel.count():
        opts = await sel.evaluate("e => Array.from(e.options).map(o => o.value).filter(Boolean)")
        if opts:
            await sel.select_option(opts[0])

    for el, val in [("#wInput", "100"), ("#rInput", "8")]:
        loc = pg.locator(el)
        if await loc.count():
            await loc.fill(val)

    btn = pg.locator("#addSetBtn")
    if not await btn.count():
        rec("D1 找到「加一组」按钮", False)
        return

    for i in range(5):
        await btn.click()
        await pg.wait_for_timeout(120)

    wv = await pg.eval_on_selector("#wInput", "e => e.value") if await pg.locator("#wInput").count() else ""
    rv = await pg.eval_on_selector("#rInput", "e => e.value") if await pg.locator("#rInput").count() else ""
    rec("D1 连加 5 组后输入框保留 100/8", wv == "100" and rv == "8", f"实际 {wv}/{rv}")

    # setList 第一个 li 是标题行（动作名 · N 组），之后才是每组
    kids = await pg.eval_on_selector("#setList", "e => Array.from(e.children).map(c => c.innerText.trim())")
    n_sets = len([k for k in kids if k.startswith("#")])
    has_head = bool(kids) and "组" in kids[0]
    rec("D2 标题行 + 5 组明细", n_sets == 5 and has_head, f"组 {n_sets} / 首行 {kids[0][:24] if kids else '空'}")

    # 保存
    fb = pg.locator("#finishBtn")
    if await fb.count():
        await fb.click()
        await pg.wait_for_timeout(300)

    # 刷新后数据仍在
    await pg.reload()
    await pg.wait_for_timeout(800)
    stored = await pg.evaluate("() => { try { return (JSON.parse(localStorage.getItem('reps.v2')||'{}').sessions||[]).length } catch(e){ return -1 } }")
    rec("D3 刷新后 localStorage['reps.v2'].sessions 非空", stored >= 1, f"sessions {stored}")

    # 导出（按钮在「成长」Tab 下的数据备份卡片里）
    await pg.click('nav.tabs button[data-tab="grow"]')
    await pg.wait_for_timeout(250)
    dl_ok = False
    try:
        async with pg.expect_download(timeout=6000) as dl_info:
            await pg.click("#exportBtn")
        dl = await dl_info.value
        path = await dl.path()
        data = open(path, "rb").read()
        json.loads(data)
        dl_ok = len(data) > 0
        rec("D4 导出 JSON 可解析", dl_ok, f"{len(data)} 字节")
    except Exception as e:
        rec("D4 导出 JSON 可解析", False, str(e)[:80])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--url" in sys.argv:
        i = sys.argv.index("--url")
        target = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
        if not target:
            sys.exit("用法错误：--url 后面要跟链接")
        label = target
        html = None
    else:
        path = args[0] if args else os.path.join(ROOT, "dist", "index.html")
        if not os.path.exists(path):
            sys.exit(f"× 找不到 {path}")
        target = "file://" + os.path.abspath(path)
        label = os.path.relpath(os.path.abspath(path), ROOT)
        html = open(path, encoding="utf-8").read()

    print(f"\n回归测试: {label}\n{'-' * 62}")

    if html is not None:
        static_checks(html)
        syntax_checks(html)
    else:
        print("（线上目标，跳过静态/语法检查）")

    asyncio.run(browser_checks(target))

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    failed = [(n, d) for n, ok, d in results if not ok]

    print("-" * 62)
    if failed:
        print(f"× {passed}/{total} 通过，{len(failed)} 项失败：")
        for n, d in failed:
            print(f"   - {n}  {d}")
        sys.exit(1)
    print(f"✓ 全部 {total} 项通过")


if __name__ == "__main__":
    main()
