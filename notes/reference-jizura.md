# JIZURA 吸收笔记（给本地 Claude 收进记忆和 code-lyric-mv 技能）

> 用法：把这个文件交给本地 Claude，说一句「把这份笔记收进记忆和 code-lyric-mv 技能」。
> - 第一部分存成记忆 `reference-jizura.md`，并在 `MEMORY.md` 的 `reference-mg-styles-15` 那行后面加一条索引
> - 第二部分追加到 `code-lyric-mv/references/effects-catalog.md`，作为第七节
>
> 来源：2026-10-02 本地会话打开 JIZURA 时撞到周额度中断，改在云端会话里看完。已克隆仓库、读完 README / CHANGELOG / LICENSE，并在无头浏览器里打开简体中文版确认能用。

---

## 第一部分：记忆条目

```markdown
---
name: reference-jizura
description: JIZURA（852wa/JIZURA，MIT）浏览器里自动拼文字PV的工具。卡点只到句/拍，不能替代 code-lyric-mv 的逐字对齐；适合当分镜草图机、字效词汇表，代码是 MIT 可以借
metadata:
  type: reference
---

JIZURA 字面 lyric motion engine：https://852wa.github.io/JIZURA/zh-hans/ ，仓库 https://github.com/852wa/JIZURA
（v0.10.1，2026-10-01，1.4k star，还在频繁更新）。
贴歌词＋放歌 → 按 R「一键生成」，从 860 个部件＋27 种风格里按种子随机拼出文字PV，导出 MP4 / 连番PNG / 透明PNG / 绿幕 / LRC / AE 用 JSON，另有 After Effects 面板。
全部在浏览器里跑，不上传；导出 MP4 要 Chrome/Edge（WebCodecs）。

**许可**：代码 MIT（Copyright (c) 2026 hakoniwa），可以改、可以搬进成品，要保留版权声明；
做出来的视频归制作者，商用可；字体是 Google Fonts（OFL）。
和 mg-styles-15（没有 LICENSE，只能学方法）不同，JIZURA 的代码可以直接借。

**跟我们 code-lyric-mv 的差距（决定它用在哪）**：
- 卡点：只到「整句起点」（LRC 时间戳或 Space 手动打拍）＋切点吸到拍；キネティック部件让词跟拍切换。
  没有人声分离和逐音拍对齐，做不到 EP35 那种「字在开口那一帧砸下来」。
- 画面：Canvas2D 平面排版为主，没有 three.js 3D、着色器火焰、雕版排线这类质感。
- 风格：谁都能免费用，日本那边看多了会认出「JIZURA 味」，差异化靠不住。
→ **完整版 MV 主线仍然走 code-lyric-mv**，JIZURA 只当辅助。

**Why:** 用户 2026-10-02 让看「对我有没有用，有用就吸收」。最值钱的是 860 个部件的分类，正好是一张日式文字PV的字效菜单，而且代码是 MIT。
**How to apply:**
1. 写 TREATMENT 前当**分镜草图机**：导入该曲 LRC＋wav，主题选「文字PV」或「キネティック」，按 R 刷几十次，把喜欢的构图截图贴进 TREATMENT 的逐场设计，十几分钟就能拿到一批排版点子。
2. 定每句字效时，查它的部件分类找词汇（见技能 effects-catalog 第七节）。
3. 想借某个排版/转场的具体算法时，可以读 `src/11p_layouts*.js` 等文件改写进我们的引擎，要在 CREDITS 里写上 JIZURA 的 MIT 声明。
4. 没做代码 MV 的歌，可以用它快速出一版日式「歌詞動画」放 YouTube。这类视频的文案**不要写**「Claude 用代码逐帧渲染」。
仓库克隆位置建议放在 `D:\code\_refs\JIZURA`，和 pdoom-video、mg-styles-15 放一起。相关：[[reference-mg-styles-15]] [[reference-pdoom-video]] [[project-ep36-roku-byou]]
```

---

## 第二部分：追加到 effects-catalog.md

```markdown
## 七、可借鉴：JIZURA 的部件分类（852wa/JIZURA，MIT，2026-10-02 吸收）

浏览器里自动拼文字PV的工具，860 个部件，按种子组合。卡点只到句和拍，所以**不能替代我们的流程**；
它的价值在于提供一套完整的「日式文字PV词汇表」，代码是 MIT，可以借（要保留声明）。

| 分类 | 数量 | 对我们有用的地方 |
|---|---|---|
| 版面（排版构图） | 184 | 补「一句一个新点子」（pdoom 节奏）：竖排、斜排、分格、满版等构图都可以从这里挑 |
| 登场 | 125 | 补精细化第 3 条「缓动别千篇一律」：同样是出场，有很多种节奏和路径 |
| 保持 | 52 | 字停留期间的微动：拍で脈動、鼓動、灯火のゆらぎ、音圧で伸びる、ピント送り……正好对应「结尾停住但保留微动」 |
| 退场 | 109 | 字怎么离场也是一种字效，可以和下一句的登场接力（精细化第 4 条） |
| 装饰 | 130 | 补精细化第 11 条「信息密度」（编号、刻度、HUD 小字）；装饰数字/时刻可以关掉 |
| 文字加工 | 62 | 和我们的 BurnText / glitch / boil 同一类，可以对照找新字效 |
| 背景 | 66 / 镜头 36 / 画面效果 69 | 镜头有拍でズーム、クラッシュズーム、周回、めまい、渦ズーム、スナップパン |
| 转场 | 27 | 补精细化第 9 条「场景之间别硬切」 |
| 主题 | 6 | 文字PV / キネティック / 和风 / 恐怖 / 流行 / 抒情 |

用法：
- 先在 https://852wa.github.io/JIZURA/zh-hans/ 导入本曲 LRC＋wav，按 R 刷构图，截图当 TREATMENT 的参考。
- 时间轴下面会显示每个镜头用的部件名（例如 布局「大字夹排」、入场「光标扫过」），可以直接拿来当字效的名字和描述。
- 要借算法就读 `src/11p_layouts*.js`、`11p_enter*.js`、`11p_treattrans.js` 等文件，改写进我们的 Canvas 字层。
  它是纯 JS、全局注册式写法，不能直接 import，需要改写。CREDITS 里写上
  「JIZURA © 2026 hakoniwa, MIT License」。
- 文字处理 `src/03_text.js`：日文/英文断行（不把单词从中间切开、带连字符的词在连字符后面断）、中英混排，可以参考。
- 30 秒版可以试试用透明 PNG 序列代替 ASS 字幕叠在即梦对口型视频上。卡点精度和现在的 ASS 一样，都是整句级，但要注意别挡住脸和嘴。
```

---

## 附：EP36《六秒》待办（从本地记忆里看到的）

- 🔴 腾讯音乐人：表单停在 step1，等你回一句「按原词，提交」或「两处改成の/を，提交」。
  这两处是 0:50「瞬きした**ろ**/**の**」和 2:55「ラストのサビ**よ**/**を**」。Chrome 那个标签页不要关。
- 代码 MV：TREATMENT 已经加了「借来的技法」表（mg-styles-15）。歌已经出来了，下一步是用实测节拍替换「节拍合约」，然后开始逐场写。
  开工前可以先用 JIZURA 刷一轮构图当草图。
