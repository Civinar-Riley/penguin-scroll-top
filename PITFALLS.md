# PITFALLS 防踩坑

开发过程中实际踩到的坑，按时间顺序记录。

## 1. 本机 git 没配身份，首次提交直接失败

- **现象**：`git commit` 报 `Author identity unknown`，退出码 128。
- **原因**：这台机器从未设置过全局 `user.name` / `user.email`。
- **正确做法**：只给仓库配局部身份，邮箱用 GitHub 提供的 noreply 地址，不暴露真实邮箱：
  ```bash
  gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"'
  git config user.name "Civinar-Riley"
  git config user.email "<上一步得到的地址>"
  ```
  顺手配 `git config core.quotepath false`，否则 `git status` 里中文文件名全显示成八进制转义。

## 2. CRLF 会污染脚本产物（dist JSON）

- **现象**：`git add` 时警告 `LF will be replaced by CRLF`。
- **原因**：脚本 JSON 的 `content` 字段是整段脚本字符串。源码在 Windows 上被 git 换成 CRLF 后重新构建，dist 里的脚本就会混入 `\r`，产生无意义 diff，甚至影响导入酒馆后的展示。
- **正确做法**：`.gitattributes` 写 `* text=auto eol=lf` 强制全仓库 LF；构建脚本里再兜一道 `.replace(/\r\n?/g, '\n')`，保证产物与换行策略解耦。

## 3. scrollIntoView 对「已完全可见」的目标是静默 no-op

- **现象**：测试台里锚定会话正常跑了 2 秒，`scrollTop` 却纹丝不动；当时目标楼层 500px 高、完全在视口内。
- **原因**：Chrome 按 CSSOM 规范实现，目标 bounding box 已完全在滚动口内时，`scrollIntoView` 不产生任何滚动。楼层不足一屏、停在视口中下部时，永远无法靠它对齐楼顶。旧版的兜底判定（楼层顶 > 视口中线 50% 连续 4 轮）也探测不到这种失败——差值不到中线，兜底根本不触发。
- **正确做法**：主路径直接用视口矩形差算目标 `scrollTop` 赋值（旧版「手动兜底」分支同款机制），每 80ms 幂等校正；`scrollIntoView` 整条路径、stuckTicks 判定和 auto/manual 双分支一并删除。

## 4. GENERATION_ENDED 的回调参数不是楼层号

- **现象**：酒馆助手 `event.d.ts` 把 `tavern_events.GENERATION_ENDED` 标成 `(message_id: number)`，旧版注释据此认为回调带楼层号。
- **原因**：酒馆核心全仓库唯一的 emit 点在 `hideStopButton()` 里，实际传的是 `chat.length`（楼层数）。当楼层号用会差 1，重 roll / continue 时不新增楼层的场景语义完全错位；旧版碰巧有「按楼层号找不到就取最后一楼」的兜底才没出明显错。
- **正确做法**：生成结束只当「窗口开启信号」，忽略参数；目标楼层改由 `CHARACTER_MESSAGE_RENDERED`（渲染完成后触发、回调真正带 message_id）钉定，1.5 秒内有效。注意 `MESSAGE_RECEIVED` 在 DOM 渲染**前**触发，对楼层做 DOM 操作不能用。

## 5. 短楼层贴底时楼顶物理上到不了容器顶

- **现象**：测试断言「楼层顶距容器顶 ≤ 2px」在最后一楼不足一屏时永远失败（差 114.8px），一度误判为脚本 bug。
- **原因**：`scrollTop` 上限 = `scrollHeight − clientHeight`。最后一楼贴着聊天底部时，楼顶最高只能到这个钳制位置——浏览器不允许滚出内容末尾以下的空白。这不是故障，是物理极限。
- **正确做法**：验收断言写成「已对齐楼顶 **或** 已滚到可滚范围最底」；README 行为说明里写明，避免被当 bug 报。

## 6. 浏览器自动化进不去 file:// 页面

- **现象**：测试台是本地 HTML，`goto("file:///...")` 直接被拒。
- **正确做法**：配一个 15 行静态服务器（`scripts/serve.mjs`，`npm run test`），测试台从 `http://127.0.0.1` 打开；顺带和真实环境的 http 场景对齐。

## 7. 测试结果只存布尔不存细节，定位全靠猜

- **现象**：第一版测试页 `results` 只存 `{name, ok}`，用例失败后只能加日志重跑一遍才拿到数值。
- **正确做法**：结果对象一开始就带上 detail（数值、现场快照），控制台再挂一个环形缓冲捕获脚本自身日志——失败时一次取全，不用二轮重跑。

