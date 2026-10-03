# pdoom-video 拆解（给 EP36 用）

仓库：<https://github.com/mexicat/pdoom-video>（MIT，© 2026 Giacomo Magnanini）。成片：YouTube `5EoO5413dBY`（4K）。
2026-10-03 在云端克隆、读完 README / ENGINE.md / TREATMENT.md / 主要场景源码，并实际渲染了原片画面（见 `img/pdoom_reference.jpg`）。

## 一句话

整支 MV 是**一个网页程序**：给它一个歌曲时间 t，它算出那一帧画面（同一个 t 永远出同一张图）。预览在浏览器里实时播，导出时用无头 Chrome 一帧一帧算、交给 ffmpeg 编码。**没有用任何生图/生视频模型。** README 原话：概念、风格圣经、歌词对齐、音频分析、渲染器、每一场、渲染，全部是在 Claude Code 里和 Claude（Opus 5.5）对话做出来的。

## 结构

| 部分 | 内容 |
|---|---|
| `analysis/`（Python） | Demucs 分轨 ＋ 主唱再用 mel-band-roformer 单独抽一遍 → CTC 强制对齐、用 Whisper 交叉核对 → **逐词（部分逐音节）时间** `data/lyrics.json`；节拍/强拍/段落/鼓与人声起音/响度包络 → `data/audio.json`。歌是**恒速 132.007 BPM**，整曲拟合一条直线网格（每 15 秒相位偏差 ≤ 2 ms） |
| `app/src/engine/` | 时间线播放、后期（bloom、halation、颗粒、色散、暗角）、字体系统（Archivo 宽度轴 62–125、IBM Plex Mono、Cormorant Garamond、单笔画绘图仪字体）、GPU 线段批渲染 `LineBatch`（10 万级发丝线）、HUD（裁切标记） |
| `app/src/scenes/` | 17 个场景模块（`open loss prompt hook room shoggoth spacetime ascent bureau leftturn paperclips fuse stack dense loom ilya outro`），约 2.1 万行 |
| `app/src/timeline.ts` | 剪辑：每场的窗口**按歌词内容锚定**（`cut('ChatGPT, please')`）再**吸到拍**——切在该句第一个词之前的最后一拍 |
| `app/scripts/render.ts` | 离线渲染：无头 Chrome → WebSocket 传原始帧 → ffmpeg；模式有 stills / sheet（联系表，`--cuts` 看所有切点）/ video / perf |

## 画面的"配方"（为什么看起来像 pdoom）

1. **极少的颜色**：ink 黑、bone 骨白、一个 signal 橙（火花、P(doom)、正在唱的词），外加只属于一个瞬间的稀有强调色。只有信号色能发光，骨白字永远不晕。
2. **每场一种画法**：雕版、示波器、公文纸、钞票花纹、蓝图、光线步进 3D、织物、界面……但共用一套配色、字体、颗粒和冷面幽默。部分场景反转成"白纸黑线"，制造明暗节奏。
3. **雕版着色** `hatch()` / `engrave()`：亮的地方线粗、暗的地方线细，深阴影加交叉线；3D 场景是**光线步进**（每像素 4 点旋转网格超采样），表面用平行发丝线"刻"出来，背光一圈橙色轮廓。
4. **字是画面的一部分**：被火花写出来、骑在曲线上、当作 token 打出来（带下一个 token 的概率分布）、盖在公文上、织进布里……不是贴在上面的字幕。逐词同步，高亮永远不超前于人声。
5. **冷面注释层**：等宽小字、编号、单位、脚注、概率条、公章。
6. **贯穿母题**：一颗橙色火花拖着一根线（导火索），贯穿全片，最后引爆；P(doom) 每段副歌上涨，钩子时放大到整屏；结尾倒带、首尾帧相同，可以无缝循环。
7. **自适应动态模糊**：每帧是 12–324 个子帧的平均，静止的少、甩镜和砸字的多，所以快速运动是连续拖影而不是一格格的残影。全曲 4K 在 M5 Pro 上约 2.5 小时。
8. **硬规则**：画面必须是 t 的纯函数（不许 `Math.random()`）；不许紫/青霓虹、发光大脑、代码雨、镜头光晕、粒子星云；不许描边/光晕字；不画真实产品界面和 logo；不画写实人脸。

## 怎么做出来的（对我们最有用的一点）

TREATMENT 的场景表里每场有一个"负责人"（A2、A3、B1…），ENGINE.md 写给"场景作者"的规矩是"只改自己的场景文件，引擎要改先问 lead"。也就是说，**pdoom 是一个主 Claude 定风格和引擎、几个子 Claude 并行各写各的场景**做出来的。EP36 要做到"≥10,000 行、≥5 场 3D"，也可以这样分：本地主会话定 TREATMENT、引擎和母题（`_engrave.ts`、`_ep36.ts` 就是为这个准备的公共件），每个子任务只负责一两场，各自渲静帧自审。

## 和我们的关系

- **EP35 的引擎就是 pdoom 的分支**（技能 code-lyric-mv 里写着"原型是 mexicat/pdoom-video（MIT）"），在它上面加了 `_fx.ts`（砸字、冲击环、镜头）、`_textfx.ts`（燃烧字、火星拼字、灰字……）、中文字幕。
- EP35 和 pdoom 的差距（EP36 TREATMENT 里实测过）：pdoom 有 7 场以上光线步进 3D、2.1 万行场景代码；EP35 是 0 场 3D、4,517 行。这次云端做的 `_engrave.ts` 就是补这一块。
- 卡点精度：pdoom 到"逐词"（英文），EP35 到"逐音拍"（日文 mora，加了辅音提前量），EP35 这块其实比 pdoom 更细。

## 你发的 B 站视频（BV1NfYA6KENC）：怎么判断是不是"同一个代码"

云端的网络策略把 B 站挡了，我**没看到这个视频**。本地 Claude 可以照这张表核对（贴给它就行）：

| 看什么 | 是 pdoom 代码的特征 |
|---|---|
| 简介/置顶评论 | 出现 `mexicat/pdoom-video`、"Claude Code"、"Opus 5.5"、"代码渲染" |
| 歌 | 如果就是《I'm Upping My P(doom)》→ 多半是原片搬运或解说；如果是别的歌、但画面语言一样 → 有人 fork 了这个仓库改的 |
| 画面四角 | 片头片尾有裁切标记（crop marks），中间全出血 |
| 字 | 粗体无衬线大字（Archivo）撑满画面、等宽小字注释（IBM Plex Mono）、偶尔衬线斜体（Cormorant）；有"像绘图仪一笔写出来"的手写字 |
| 颜色 | 黑＋骨白＋一个发光的信号色，几乎没有别的颜色 |
| 3D | 平行发丝线刻出来的 3D（雕版感），背光一圈信号色轮廓 |
| 动作 | 每个词在唱的那一刻出现/变色；一颗拖着线的火花贯穿全片；结尾倒带回第一帧 |

给本地 Claude 的话（可直接粘贴）：

```
看一下 B站 BV1NfYA6KENC（静音，只读简介/置顶评论/字幕，再抽帧看画面），
对照 rinshigyo 仓库 ep36-lab/docs/PDOOM_BREAKDOWN.md 里的核对表，
判断它是不是 mexicat/pdoom-video 那套代码做的（原片搬运 / fork 改的 / 只是风格像），
有能吸收进 EP36 的东西就记进 code-lyric-mv 技能。
```
