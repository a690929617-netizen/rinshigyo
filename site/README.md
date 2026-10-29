# 半額水電魚 · 个人网站

纯静态网页，只有两样东西：`index.html`（整个网站都在这一个文件里），和 `assets/` 里 EP36《六秒》的 6 张测试图版、2 段动态样片。不用安装任何东西。

## 预览

双击 `index.html`，用浏览器打开就能看。字体从 Google Fonts 加载，所以要联网。

## 改文字

每段文字都写了三份，挨在一起：

```html
<span lang="zh-CN">中文</span>
<span lang="ja">日本語</span>
<span lang="en">English</span>
```

在 `index.html` 里搜你想改的那句话，三份一起改就行。

## 换联系方式

在 `index.html` 里搜 `data-todo`，每一行是一个链接（YouTube、Bilibili、X、Email）：

1. 把 `href="#contact"` 换成你的主页链接
2. 删掉 `data-todo`
3. 把后面的「即将开放 / 準備中 / Soon」改成你的账号名，比如 `@xxx`

## 换作品图

图片在 `assets/`，1280×720 的 WebP（比 JPG 小四成左右）。用同名文件替换就行；手上只有 JPG/PNG 的话，把 `index.html` 里对应的文件名后缀改掉也能用。要加新的一帧，就把 `<img class="pl">`、`<div class="cap">` 和下面缩略图条里的 `<button>` 各复制一份。

## 动态样片是怎么来的

`assets/ep36-thumb.mp4` 和 `assets/ep36-deep.mp4` 是用仓库里 `ep36-lab` 的引擎在云端渲染的（无声、30 fps，节拍是占位数据）。换成真实对齐数据后，可以照这几步重渲：

```bash
cd ep36-lab && bash tools/get_fonts.sh && cd app && bun install
bun scripts/render.ts video --from 27.7058 --to 32.1176 --fps 30 --noaudio --only thumb --out ../out/thumb.mp4
bun scripts/render.ts video --from 104.4706 --to 113.2941 --fps 30 --noaudio --only deep --out ../out/deep.mp4
```

起止时间是 `timeline.ts` 里 `thumb`、`deep` 两个场景的窗口，换了数据要跟着改。云端没有显卡时加 `CHROME_PATH=/path/to/chromium`。渲出来是 1920×1080，网站用的是缩到 1280 宽再压缩的版本：

```bash
ffmpeg -i ../out/thumb.mp4 -vf "scale=1280:-2:flags=lanczos" -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -an -movflags +faststart ../../site/assets/ep36-thumb.mp4
```

## 分享时指定语言

链接后面加 `#zh`、`#ja` 或 `#en`，打开就是对应语言。不加的话，按访客浏览器的语言自动选；访客自己切换过一次后会记住。

## 上线（拿到自己的网址）

- **最简单**：打开 Netlify Drop（https://app.netlify.com/drop），把整个 `site` 文件夹拖进去，几秒钟就有一个公开网址。
- **以后常改**：用 GitHub Pages 或 Cloudflare Pages 连上这个仓库，每次推送都会自动更新。

## 页面上有什么

| 部分 | 内容 |
|---|---|
| 首屏 | 实时渲染的雕版指纹（WebGL），鼠标是放大镜；名字逐字砸下来，「半額」章最后盖上。点一下画面会再盖一个章 |
| 六秒の壁 | 一句话，随滚动一个字一个字亮起来 |
| 作品 | EP36《六秒》：往下滚动，6 张图版像视频一样逐帧切换，配歌词和翻译 |
| 动态样片 | 两段引擎实拍的循环视频（4.4 秒 + 8.8 秒），滚到就静音自动播放，点一下暂停；首屏的「看 13 秒动态样片」按钮直接跳到这里 |
| 做法 | 声・描・刻・放 四道工序 |
| 关于 | 标本卡（SPECIMEN No. 0,000,001） |
| 联系 | 联系方式 + 「LOOP」按钮回到开头 |
| 底部进度条 | 整页 = 6 秒，可以拖动 |

学校名、具体住址和邮箱没有放上去；想公开的话直接加在「关于」的标本卡里。
