<div align="center">

# 🤖 Wbrowser

**用终端或 AI 助手，操控你已经登录好的 Chrome。**

无需 API 密钥。无需配置集成。无需重新登录。
你的浏览器，你的会话，你的电脑。

[English](../README.md) · [한국어](README.ko.md) · [中文](README.zh.md) · [Español](README.es.md)

</div>

---

## 为什么要做这个

启发本项目的 AI 浏览器 **Aside** 目前**仅支持 macOS**。
如果你用 Windows 或 Linux，根本用不上。

所以我们把真正重要的部分做了出来，并且**让它在哪都能跑**。

> **需要什么，就自己做。**
>
> 就这么简单。不是等着别人排期的产品，而是一个属于你自己的小工具——
> 跑在你本来就在用的电脑上，操控你本来就登录着的浏览器。
> JavaScript、Python 和 Shell 加起来约 2,600 行——一个下午就能读完。
> 读它、改它、把它变成你的。

Wbrowser 支持 **Windows、macOS、Linux 和 WSL**。
macOS、原生 Linux、WSL2 和 Windows 原生四个环境均已真机验证。
但并非每项检查都在每个环境上运行过（见下表）。

*"你用什么系统？"* 不该成为你无法自动化自己浏览器的理由。

---

## 这是什么？

大多数自动化工具给 AI 的是一个**全新的空白浏览器**。所以它看不到你的邮箱、
后台面板，任何需要登录的东西都进不去——除非你交出密码，或者为每个网站单独配置 API。

Wbrowser 反过来做：**你亲手登录一次**，之后终端（或 AI 助手）就能直接操控那个窗口，
处处都是已登录状态。

```bash
./wb go https://mail.example.com   # 用你已登录的会话打开
./wb read                          # 告诉你屏幕上有什么
./wb click '#compose'              # 点击它
```

**Wbrowser 永远看不到你的密码。** 你输入，Chrome 保存，Wbrowser 只是操控那个已经
打开的窗口。

---

### 一次登录，打开许多站点

这是让整套配置值得的部分。在那个窗口里**登录一次 Google**，然后：

```
Google 自身      google.com · youtube.com · 你的 Workspace 应用
使用 Google SSO   "使用 Google 登录" 能到的一切 ——
                 内部系统、预约系统、后台面板
其他站点         手动登录一次，之后一直保持
```

真实档案实测：**一次 Google 登录**顺带打开了 YouTube 和
**两个从未单独登录过的内部业务系统**（它们使用 Google SSO）。
其余（GitHub、Reddit 等）手动登录一次后一直有效。

也就是说初始成本约为：**一次 Google 登录 + 不使用 Google 的站点各一次**。
之后你的 AI 就能触达全部。

🔴 反过来也是同一件事：**能操控这个浏览器的人，就能在上述所有站点上以你的身份行动。**
请阅读[安全](#安全)一节。

## 快速开始

```bash
git clone https://github.com/<你的账号>/Wbrowser.git
cd Wbrowser
# Wbrowser 使用*系统已安装的* Chrome，无需 Playwright 自带浏览器。
# 跳过下载可节省约 400MB：
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install

node launch.js       # 1. 打开一个专用 Chrome 窗口
                     # 2. 在那个窗口里手动登录你的网站
node engine.js       # 3. 启动控制引擎
./wb go https://example.com
```

就这样。**只有第 2 步需要人工操作**。

> **如果 `./wb` 提示 "Permission denied"** —— 克隆时执行权限丢失了。执行一次即可：
> ```bash
> chmod +x wb install.sh autostart.sh sync-session.sh
> ```

> **无显示器的服务器：** 检测到没有 `$DISPLAY` 时会自动以 headless 模式启动 Chrome。
> 可用 `WBROWSER_HEADLESS=1` / `=0` 强制指定。
> 🔵 没有屏幕就无法手动登录——请在桌面机器上 `./sync-session.sh export`，
> 再到服务器 `import`。

---

## 为什么要用单独的 Chrome 窗口？

从 **Chrome 136（2025 年 3 月）** 开始，`--remote-debugging-port` 对 Chrome 默认
配置目录**无效**。因为攻击者曾利用远程调试窃取 Cookie，谷歌做了这项安全变更。

所以现在**必须**使用非默认的 `--user-data-dir`。Wbrowser 会在 `~/.wbrowser`
创建一个并从那里启动 Chrome。

**这意味着你现有的登录状态不会带过来。** 在新窗口里登录一次，之后就会一直保持。

> ⚠️ **复制 Chrome 配置文件夹行不通。** 我们试过：685 个 Cookie 只剩 **3 个**，
> 所有会话 Cookie 全部失效。Chrome 会让它不认识的配置文件失效。
> 直接重新登录吧——一分钟的事，而且确实管用。

---

## 命令

```bash
./wb go <网址>             打开页面并返回结构
./wb read                  概览当前页面
./wb click <选择器>         点击元素
./wb type <选择器> <文本>    填写输入框
./wb press Enter           按键
./wb eval '<js>'           在页面中运行 JavaScript
./wb console [正则]         控制台日志 + 未捕获异常
./wb network               失败的请求（4xx/5xx、CORS、超时）
./wb shot [文件.png]        截图
./wb tabs                  按代理分组显示已打开标签页
./wb close                 只关闭你自己打开的标签页
./wb status                运行状态、当前配置文件
./wb show                  把浏览器窗口调到最前
```

### 不要猜选择器

`./wb read` 会返回页面上**真实存在**的可点击元素：

```
inputs(1):
  - #searchbox_input  (搜索，不被追踪)
buttons(3): 搜索, 登录, 设置
```

直接从这里复制。

> 真实案例：我们曾猜搜索框是 `input[name=q]`，结果失败了——它其实是 `textarea`。
> 而 `read` 从一开始就给出了正确答案。

---

## 从 AI 助手使用（MCP）

Wbrowser 支持 [Model Context Protocol](https://modelcontextprotocol.io)，
任何支持 MCP 的助手都能操控你的浏览器。

**本地（stdio）：**
```json
{
  "mcpServers": {
    "wbrowser": {
      "command": "node",
      "args": ["/安装路径/Wbrowser/mcp-server.js"]
    }
  }
}
```

**远程（HTTP）：**
```bash
export WBROWSER_MCP_TOKEN=$(openssl rand -hex 32)
node mcp-server.js --http --port 7982 --host 127.0.0.1
```

然后直接对助手说：

> *"打开我的后台，总结一下今天的数据。"*
> *"看看那个购物网站的购物车里有什么。"*

> 🔴 **远程服务器没有令牌就拒绝启动。** 这不是可选项——它操控的浏览器装着你所有的
> 登录状态。能访问那个端口的人，就等于是你本人。

---

## 定时任务（cron）

创建 `jobs/morning-check.json`：

```json
{
  "schedule": "0 9 * * 1-5",
  "tab": "morning",
  "steps": [
    { "goto": "https://dashboard.example.com", "wait": 2000 },
    { "eval": "document.querySelector('.total').innerText" },
    { "shot": true }
  ]
}
```

```bash
node cron.js list      查看已注册任务
node cron.js next      每个任务下次运行时间
node cron.js run <名称>  立即运行一次
node cron.js daemon    按计划自动运行
```

`0 9 * * 1-5` 表示**工作日上午 9 点整**。标准五段式 cron：`分 时 日 月 周`。

### 不可逆操作默认被拦截

无人值守的自动化意味着**出问题时没人在看**。所以看起来像提交 / 支付 / 删除的步骤会被**拒绝**：

```
⛔ 第 2 步被拦截 — 看起来不可逆 (click: #submit-payment)
   如果确实需要，请在任务文件中添加 "allowIrreversible": true。
```

这是**逐个任务**授权，不是全局开关。

---

## 谁在操控？（可视提示）

当代理正在操控浏览器时，你能看见：

- **半透明边框**，带标签：`🤖 my-agent 控制中`
- **标签页标题**加前缀：`[my-agent] 仪表盘`

停止操作 6 秒后边框淡出，所以"控制中"确实表示**此刻**。颜色由代理名生成，
多个代理同时接入也能一眼分辨。

标签页前缀**在页面跳转后依然保留**——`MutationObserver` 会在页面重写标题时
立即补回（单页应用会频繁重写标题）。

---

## 多账号

在同一个窗口里打开多个 Chrome 配置文件，Wbrowser 可以分别指定：

```bash
./wb -a work@example.com go https://mail.example.com
./wb windows                    # 列出已打开的配置文件
```

或在 `accounts.json` 中按网站映射：

```json
{
  "sites": {
    "mail.example.com": { "account": "work@example.com" }
  }
}
```

> 🔴 **如果指定的账号没有打开，Wbrowser 会直接失败**，而不是猜一个相近的。
> 用错账号发邮件，比一条错误提示糟糕得多。

---

## 平台支持

| 系统 | Chrome 自动检测 |
|---|---|
| **Windows** | `Program Files`、`AppData`、Edge |
| **macOS** | `/Applications/Google Chrome.app`、Chromium、Edge |
| **Linux** | `google-chrome`、`chromium`、snap、Edge |
| **WSL** | 优先使用 Windows Chrome（你实际在用的浏览器） |

检测失败时用 `WBROWSER_CHROME=/chrome/路径` 指定。

> **已在真实设备上验证**（2026-08-24）：
>
> | 环境 | Chrome | 验证者 | 该环境实际测量的项目 |
> |---|---|---|---|
> | macOS 15 | 151 | 独立验证者 | 启动·引擎·CLI·状态路径 |
> | Linux（原生·无显示器） | 148 | 独立验证者 | 以上 + **安全审查** |
> | WSL2 + Windows Chrome | 151 | 维护者 | 以上 |
> | Windows 10（原生） | 151 | 独立验证者 | 以上 + **端到端实测** |
>
> 🔵 **并非每项检查都在每个平台上运行过。** 安全审查（用 `ss` 确认无令牌时拒绝启动、
> 引擎在回环之外不可达）在 Linux 上完成；端到端（`/health` → `/act` → 真实页面提取）在
> Windows 上完成。UNC 路径（`\\wsl.localhost\...`）同样可用——实测推翻了我们的预期。
>
> 安全性在 Linux 上独立复核：没有令牌时 MCP HTTP 服务器直接退出，
> **根本不打开套接字**（用 `ss` 确认）；引擎仅绑定 `127.0.0.1`，同网段也无法访问。

---

## 安全

这个工具操控的浏览器装着**你所有的登录状态**，请谨慎对待。

- 🔴 **`127.0.0.1` 不是围墙——它意味着"以你的身份运行的进程都能进来"。**
  Chrome 调试端口（9222）**没有任何认证**。该机器上任何本地进程——其他应用、
  npm 安装钩子、随手运行的脚本——都能连上并操作你已登录的全部会话。
  实测：一个无关进程无需凭据即可通过 `GET http://127.0.0.1:9222/json/list` 列出所有标签页。
  **只有当你信任这台机器上以你身份运行的一切时**才使用本工具。
- 引擎**只绑定 `127.0.0.1`**。切勿直接暴露到公网。
- 🔴 `mcp-server.js --host 0.0.0.0` 选项存在，且**会绑定到所有网络接口**。
  代码会打印警告，但那时端口已经打开。除非在受信任的专用网络（VPN/tailnet），
  否则请使用 `127.0.0.1`，且无论如何都必须带令牌。
- MCP HTTP 服务器**必须有令牌**，否则拒绝启动。
- `./wb type` **不记录**输入内容——那可能是密码。
- Cookie 的值**永远不会**被打印、记录或返回。
- 🔴 **不要用它输入密码、卡号或身份证号。**
  请手动登录，Wbrowser 会复用该会话。

### 会话备份

```bash
./sync-session.sh export   Cookie → 加密存储
./sync-session.sh import   在另一台机器上恢复
./sync-session.sh status   查看备份内容
```

> 🔴 **Cookie 和密码同等敏感**——它本身**就是**登录凭证。
> 目标位置若未真正加密，脚本会**拒绝写入**。

---

## 环境变量

| 变量 | 默认值 | 用途 |
|---|---|---|
| `WBROWSER_CHROME` | 自动检测 | Chrome 可执行文件路径 |
| `WBROWSER_PROFILE_DIR` | `~/.wbrowser` | 配置文件目录 |
| `WBROWSER_PROFILE` | `Default` | 目录内的配置文件名 |
| `WBROWSER_CDP_PORT` | `9222` | Chrome 调试端口 |
| `WBROWSER_PORT` | `7981` | 控制引擎端口 |
| `WBROWSER_AGENT` | 自动 | 边框和标签页显示的名称 |
| `WBROWSER_MCP_TOKEN` | — | 远程 MCP **必需** |
| `WBROWSER_NOTES` | — | 工作日志目录（可选） |

---

## 开机自启

```bash
# Linux / WSL（systemd 用户服务）
./install.sh
systemctl --user status wbrowser
```

引擎会自动启动。**浏览器仍需手动打开**——它是桌面进程，何时开窗应由你决定。

---

## 已知限制

- **不内置自然语言循环。** 选择器由代理决定；`read` 会提供真实的选择器，无需猜测。
- **仅支持 Chrome/Chromium。** Firefox 不支持 CDP。
- **一个 CDP 端口对应一个 Chrome 进程。** 从该窗口内打开的配置文件可见；
  另行启动的 Chrome 不可见。

---

## 参与贡献 · 安全

- [CONTRIBUTING.md](../CONTRIBUTING.md) — 塑造这份代码的规则，以及如何测试
- [SECURITY.md](../SECURITY.md) — 🔴 威胁模型。在共享机器上运行前请务必阅读：
  Chrome 调试端口**没有认证**，任何以你身份运行的本地进程都能操作你的会话。

发现安全问题请通过
[私密 advisory](https://github.com/w-partners/Wbrowser/security/advisories/new) 报告，不要开公开 issue。

## 许可证

MIT — 参见 [LICENSE](../LICENSE)。
