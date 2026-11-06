<div align="center">

# 🐧 企鹅生成后回顶

**SillyTavern 酒馆助手脚本 · AI 生成结束后自动回到当前楼层顶部 · 持续锚定对抗卡片渲染**

[![Host](https://img.shields.io/badge/Host-SillyTavern-blue?style=flat-square)](https://github.com/SillyTavern/SillyTavern)
![TavernHelper-%E2%89%A53.4.8-blue?style=flat-square](https://img.shields.io/badge/TavernHelper-%E2%89%A53.4.8-blue?style=flat-square)
![Version-3.1.0-blue?style=flat-square](https://img.shields.io/badge/Version-3.1.0-blue?style=flat-square)
![Dependencies-0-success?style=flat-square](https://img.shields.io/badge/Dependencies-0-success?style=flat-square)
![Import-1%20JSON-orange?style=flat-square](https://img.shields.io/badge/Import-1%20JSON-orange?style=flat-square)
![Tests-5%20cases-success?style=flat-square](https://img.shields.io/badge/Tests-5%20cases-success?style=flat-square)

[项目简介](#-项目简介) · [功能特性](#-功能特性) · [安装](#-安装) · [使用指南](#-使用指南) · [限制与已知问题](#-限制与已知问题) · [仓库结构](#-仓库结构) · [常见问题](#-常见问题) · [版本历史](#-版本历史) · [声明与授权](#-声明与授权) · [致谢](#-致谢)

</div>

---

## 📖 项目简介

- **是什么**：一个酒馆助手（Tavern Helper / JS-Slash-Runner）用户脚本。AI 生成结束后，自动把当前楼层顶部拉回聊天视口顶部，省去长楼层里手动滚回顶部的过程。
- **为什么这么设计**：酒馆生成完成后会自动滚动到楼层底部，楼层内美化卡片（前端界面 iframe）渲染时高度还会持续变化。脚本开启一个锚定窗口，每 80 毫秒把楼层顶重新对齐一次，抵消酒馆自动滚底与卡片撑高。
- **绝不抢滚动权**：锚定期间用户任何滚轮、触摸、拖动滚动条、翻页键操作都会让脚本立即让位。
- **可验证的工程**：`src/` 是唯一事实来源，构建出 `dist/` 导入文件；`test/` 内置浏览器测试台（mock 酒馆助手环境，5 个用例）。

## ✨ 功能特性

### 入口一 · 生成结束（自动触发）

| 特性 | 说明 |
| :--- | :--- |
| 🔁 自动回顶 | 监听 `GENERATION_ENDED`，延迟 120 毫秒后开启 6 秒锚定窗口 |
| 🎯 目标钉定 | 监听 `CHARACTER_MESSAGE_RENDERED`，重 roll 旧楼层时锚定该楼层而非最后一楼 |
| 🧱 卡片渲染补偿 | 楼层内前端界面 iframe 渲染完成时锚定窗口追加 1.2 秒（总上限 10 秒） |

### 入口二 · 「企鹅回顶」按钮（手动触发）

| 特性 | 说明 |
| :--- | :--- |
| ⬆️ 单击回顶 | 回到当前楼层顶部并锚定约 2 秒 |
| 🔀 双击切换模式 | 400 毫秒内连点两下切换 自动/手动，`localStorage` 持久保存，默认自动 |

### 入口三 · 让位与取消（自动触发）

| 特性 | 说明 |
| :--- | :--- |
| 🖐️ 用户让位 | 锚定期间滚轮 / 触摸 / 拖动滚动条 / PageUp·PageDown·Home·End·方向键，立即停止锚定 |
| 🛑 信号取消 | 新消息发送 / 新一轮生成 / 切换聊天时立即取消锚定 |

> 三种入口的滚动机制一致：按视口矩形差直接设定滚动位置（每 80 毫秒校正），楼层不足一屏、已完全在视口内时也能精确对齐楼顶。

## 📦 安装

**环境要求**

- SillyTavern（酒馆助手 4.12.0 实测，`getButtonEvent` 需 3.4.8+，更旧版本自动走 `eventOnButton` 兼容路径）
- 已安装并启用「酒馆助手」扩展

**导入步骤**

1. 下载本仓库的 **`dist/酒馆助手脚本-企鹅生成后回顶3.json`**
2. 酒馆扩展面板 → **酒馆助手 → 脚本库 → 导入脚本**，选择该文件
3. 导入后脚本默认处于**停用**状态，手动启用
4. 生效后：聊天界面出现「企鹅回顶」按钮；浏览器控制台打印 `[企鹅生成后回顶3] 自检: …`

> ⚠️ **导入后必须手动启用**：酒馆助手导入脚本时会强制重置为停用并重新生成脚本 id。
> ⚠️ **先删旧版再导入**：与旧版脚本并存会出现两个「企鹅回顶」按钮。
> ⚠️ **不要直接改 `dist/`**：构建产物会被覆盖，改动请进 `src/` 后执行 `npm run build`。

## 🚀 使用指南

| 场景 | 操作 |
| :--- | :--- |
| **自动回顶（默认）** | 无需操作，AI 生成结束后自动回到当前楼层顶部 |
| **手动回顶** | 单击「企鹅回顶」按钮 |
| **切换 自动/手动 模式** | 400 毫秒内连点两下「企鹅回顶」，弹出提示确认当前模式 |
| **锚定期间自己滚动** | 任意滚轮 / 触摸 / 拖滚动条 / 翻页键，脚本立即让位不争抢 |

## 🚧 限制与已知问题

| 限制 | 原因 | 能否绕过 |
| :--- | :--- | :--- |
| 最后一楼不足一屏时，楼顶到不了视口顶 | 浏览器钳制 `scrollTop` 上限（`scrollHeight − clientHeight`），贴底短楼层物理上无法再上滚 | ❌ 平台决定，脚本已停在物理极限位置 |
| `GENERATION_ENDED` 回调不带楼层号 | 酒馆核心实际 emit 的是 `chat.length`，并非楼层号 | ✅ 脚本改用 `CHARACTER_MESSAGE_RENDERED`（回调真正带楼层号）钉定目标 |
| 导入后默认停用、id 重新生成 | 酒馆助手导入逻辑强制重置 | ✅ 导入后手动启用即可，功能不受影响 |

## 📁 仓库结构

```
企鹅生成后回顶/
├── src/
│   ├── penguin-scroll-top.js                 # 脚本源码（唯一事实来源）
│   └── script.meta.json                      # 脚本元数据（名称 / 按钮 / 说明）
├── scripts/
│   ├── build.mjs                             # 构建：src + meta → dist JSON
│   └── serve.mjs                             # 测试台静态服务器（npm run test）
├── test/
│   └── index.html                            # 浏览器测试台：mock 酒馆助手环境 + 5 个用例
├── dist/
│   └── 酒馆助手脚本-企鹅生成后回顶3.json     # 构建产物，导入酒馆助手用
├── PITFALLS.md                               # 开发防踩坑记录
├── package.json                              # npm scripts：build / test
├── .gitignore                                # 忽略 node_modules 与本地临时目录
├── .gitattributes                            # 全仓库强制 LF，防止换行符污染构建产物
└── README.md
```

## ❓ 常见问题

**Q：导入后点了按钮没反应？**
A：确认脚本已启用；打开浏览器控制台看自检日志。若显示「按钮注册失败」，说明酒馆助手版本过低（低于 3.4.8 且无 `eventOnButton`），请升级酒馆助手。

**Q：生成结束后没有回顶？**
A：先确认不在手动模式（400 毫秒内双击按钮可切回自动）。若模式正确仍不回顶，看控制台是否有「生成结束事件监听成功」——没有则说明酒馆助手事件桥接异常。

**Q：为什么最后一楼很短时只回了一半？**
A：那是浏览器允许的最顶位置（见 [限制与已知问题](#-限制与已知问题)），不是故障。

**Q：换了美化主题后还能用吗？**
A：脚本每轮校正都重新定位楼层与滚动容器，`#chat` 不可滚时会自动下探最近的可滚动祖先；主题若给容器配了平滑滚动，锚定期会临时强制即时滚动。

## 🕘 版本历史

<details>
<summary>展开查看历史版本</summary>

| 日期 | 版本 | 更新内容 |
| :--- | :--- | :--- |
| 2026-11-06 | v3.1.0 | 滚动机制改为直接设定 `scrollTop`，修复短楼层回顶失效；目标楼层改由 `CHARACTER_MESSAGE_RENDERED` 钉定；提示改用 `toastr`；工程化（src/build/test） |
| 建仓前 | v3.0.0 | 原始版本（脚本名内置"3"），作者手工迭代 |

</details>

> 版本号出处：`package.json`；v3.0.0 为建仓前版本，随基线提交入库。

## 📜 声明与授权

本项目未附带开源许可证，**保留所有权利**。作者：西维纳尔（GitHub: [Civinar-Riley](https://github.com/Civinar-Riley)）。

## 🙏 致谢

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) —— 宿主程序
- [酒馆助手 JS-Slash-Runner](https://github.com/N0VI028/JS-Slash-Runner) —— 脚本运行环境，事件与 API 依据其源码与文档核实
