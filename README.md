# REPS · 多窗口并行开发仓库

## 这是什么

一个单文件 HTML 健身记录应用（REPS），拆成多份片段源码，让**多个对话窗口可以同时改不同部分**。

产出的仍然是**一个 78 KB 的单文件 HTML**：0 个 `<script src>`、0 个 `<link>`、0 个外链。

## 远程仓库

`https://github.com/klein7syd/reps` · 分支 `main` · **公开仓库**

```bash
./push.sh        # 首次推送（需先授权 GitHub 连接器）
git pull         # 之后每次开工前
```

## 三条命令

```bash
cd /workspace/reps-repo

python3 build.py              # 构建 → dist/index.html
python3 build.py --verify     # 构建 + 校验拆分无损（与基线逐字节比对）
python3 test/regress.py       # 28 项回归（构建产物必须全过才算能合）
```

## 当前基线

| 项 | 值 |
|---|---|
| 产物 | 78,617 字节 |
| md5 | `f9701638039d8b558eb2c865018d5d7c` |
| 与线上一致 | 是（`a582baf0294c5e5e6.app.workbuddy.host`） |
| 回归 | 28/28 通过 |
| 代码片段 | CSS 12 段 + JS 3 模块（app 内含 10 段） |

## 自动化

`.github/workflows/ci.yml`：每次 push / PR 自动构建 + 跑 28 项回归，产物作为 artifact 保留 30 天。
**改坏了会直接红**，不用等别人发现。

## 我要改代码，怎么开始

**先读 [`PROTOCOL.md`](./PROTOCOL.md)。** 里面写了谁负责哪些文件、冲突怎么处理。

一句话版：只改属于你的片段文件 → `python3 build.py` → `python3 test/regress.py` 全过 → 提交。

## 目录

```
build.py              构建器（只用标准库）
test/regress.py       回归测试（Playwright + /usr/bin/chromium）
src/shell/            HTML 骨架
src/css/              12 个 CSS 片段，按 manifest 顺序拼
src/js/               moves.js（动作库数据）/ grow.js（成长算法）/ app/（主逻辑 10 段）
src/manifest.json     拼接顺序 —— 顺序即执行顺序，别乱排
dist/handmade.html    基线参考版，--verify 拿它比对
dist/index.html       构建产物（已 gitignore）
```

## 为什么拆成这样

单文件 78 KB，两个人同时改只能整文件覆盖，且事后查不出谁覆盖了谁。
拆成片段后，不同人改不同文件，Git 能自动合并——**这是并行的前提，不是代码洁癖。**

拆分过程本身是可验证的：`python3 build.py --verify` 显示与原始单文件逐字节一致，
说明拆开再拼回来没动一行代码。
