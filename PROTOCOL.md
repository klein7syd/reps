# 并行开发协议

> 这份文件解决一个问题：**多个对话窗口同时改同一个软件，怎么不互相覆盖。**
> 不遵守的后果不是"代码乱"，是「A 的改动被 B 整文件覆盖，且没人发现」。

---

## 一、先把话说死：为什么必须拆分

单文件 78 KB HTML，两个人同时改，物理上只有两种结果：

1. 后提交的覆盖前一个 —— 前一个人的工作直接消失
2. 手工合并 —— 在一个没有 diff 工具的大文件里对行，出错率远高于重写

这个项目已经发生过一次同类事故：同一个 sharecode 下的内容被整个替换，先前发出去的链接内容全变了。

所以：**源码必须拆成多个文件，每个文件同一时间只有一个负责人。**

---

## 二、目录结构与所有权

```
src/
├── shell/head.html          【共享】改前报备
├── shell/body.html          【共享】改前报备（含 [[MODULE:x]] 占位）
├── css/
│   ├── 00-base.css          A
│   ├── 10-controls.css      A
│   ├── 20-tabbar.css        A
│   ├── 30-card.css          A
│   ├── 40-state.css         A
│   ├── 50-train.css         B
│   ├── 60-progress.css      C
│   ├── 70-grow.css          C
│   ├── 80-moves.css         D
│   ├── 85-body.css          E
│   ├── 90-audio.css         F
│   └── 95-responsive.css    A
├── js/
│   ├── moves.js             D  动作库数据（109 条）
│   ├── grow.js              C  成长算法（修为/境界/灵宠）
│   └── app/
│       ├── 00-state.js      【共享】状态与工具函数，改前报备
│       ├── 20-train.js      B  训练页逻辑
│       ├── 30-progress.js   C  进度页
│       ├── 40-grow-page.js  C  成长页
│       ├── 50-moves-page.js D  动作库页
│       ├── 60-body-page.js  E  身体数据
│       ├── 70-audio.js      F  音乐播放
│       ├── 80-backup.js     A  导出/导入
│       ├── 85-tabs.js       【共享】Tab 切换
│       └── 90-init.js       【共享】初始化
└── manifest.json            【共享】拼接顺序，改动等于改结构
```

字母只是占位，实际按人分。**一个字母 = 一个对话窗口。**

### 三个死规矩

1. **只改属于你的文件。** 需要改别人的，去任务板开一条，写清"我要改哪个文件、改成什么"。
2. **`00-state.js` 是公共状态区。** 加全局变量必须在这里，且要报备——两个窗口同时往里加同名变量，后加的静默覆盖前一个。
3. **`manifest.json` 的数组顺序就是执行顺序。** 不要随手排序，CSS 层叠和 JS 变量声明都依赖它。

---

## 三、每个窗口的标准动作

### 开工前

```bash
git pull                      # 拿最新（有远程时）
python3 build.py --verify     # 确认当前 src/ 能还原出对的包
```

`--verify` 必须显示「与 dist/handmade.html 逐字节一致」。不一致说明有人改坏了，先别动。

### 干活时

只改自己的文件，改完立刻：

```bash
python3 build.py              # 看字节数和 md5
python3 test/regress.py       # 28 项必须全过
```

**不许跳过 regress。** 它是唯一能抓住「你改 A 页面，顺手弄坏了 B 页面」的东西。

### 收工前

```bash
git add -A && git commit -m "[训练页] 加组后保留重量：wInput 不清空"
git push
```

commit message 格式：`[工作线] 一句话说清改了什么`。
工作线只用：`[训练]` `[进度]` `[成长]` `[动作库]` `[身体]` `[音乐]` `[外壳]` `[数据]`。

---

## 四、冲突怎么处理

### 情况一：改的不是同一个文件

Git 自动合并，无事发生。**这是常态，也是拆分的目的。**

### 情况二：改的是同一个文件

```bash
git pull
# 出现 CONFLICT
```

**不要硬合。** 两份都留着，去任务板开一条，把两个人的 diff 都贴上去，由一个人定方案。硬合的代价是两边都可能错，而且事后查不出来。

### 情况三：`00-state.js` / `manifest.json` 冲突

同上，且**必须**走任务板确认。这两个文件冲突意味着结构变了，不是一个人的事。

---

## 五、构建器为什么能保证不出错

`build.py` 做三件事，任何一件不满足就退出，不产出半成品：

| 检查 | 失败后果 |
|---|---|
| `manifest` 列的文件必须存在 | 直接报错，不会用旧内容顶 |
| `[[MODULE:x]]` 占位必须全部替换 | 直接报错，不会留下占位符 |
| 产物必须 script src 0 / link 0 / 外链 0 | 直接报错，单文件铁律在构建阶段就卡住 |

另外 `--verify` 模式要求产物与 `dist/handmade.html` 逐字节一致。
**注意：`handmade.html` 是基线，不是目标。** 正常开发时产物当然会变，`--verify` 只在「确认拆分/合并本身没引入意外」时用。

---

## 六、已经踩过的坑（别再踩）

1. **改了片段但构建读到的是旧文件。** 这个是真实发生过的：`build.py` 一开始读静态 `app.js`，改 `src/js/app/*.js` 片段完全不影响产物，md5 一点没变。已修，现在片段由 `assemble_app()` 现场拼装。
2. **`rstrip()` 吃掉了缩进。** 拼接时对片段做 strip，会让 78,617 B 变成 78,569 B，少 48 B 全是空白和缩进。现在片段一律原样拼接。
3. **`<script>` 标签谁加。** app 片段只存 IIFE 内容，外层标签由 `build.py` 统一加。片段里带标签会导致占位替换时标签丢失。
4. **CSS 片段之间的空行是内容，不是格式。** 删掉空行字节数会变，`--verify` 会报差异。

---

## 七、如果要接远程 Git

现在还没有远程。接上之后上面的 `git pull/push` 才真正生效。

前提：需要一次 GitHub 授权（`gh auth login` 或 OAuth）。**这一步要人来点**，其余的我都能代做。

接上之后：

```bash
git remote add origin <仓库地址>
git branch -M main
git push -u origin main
```

---

## 八、给新窗口的开场白

每个新对话的**第一句**发这个：

```
读 /workspace/reps-repo/PROTOCOL.md 和 /workspace/AGENTS.md，读完再干活。

你的工作线是：【填一个：训练 / 进度 / 成长 / 动作库 / 身体 / 音乐 / 外壳 / 数据】

开始前必须先做三件，不许跳：
1. cd /workspace/reps-repo && python3 build.py --verify   # 必须显示逐字节一致
2. git log --oneline -5                                   # 看别人最近改了啥
3. 只改 PROTOCOL.md 里属于你的文件，改完跑 python3 test/regress.py

不要动别的文件。需要动就停下来问我。
```
