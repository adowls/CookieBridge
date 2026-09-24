# Sync My Cookies

[English](README.en.md) | **中文**

把指定域名下的 Cookie 备份到 GitHub Gist，需要时再拉回浏览器。

- 版本：1.11（Manifest V3）
- 适用：Chrome / Edge 等 Chromium 内核浏览器

---

## 一、安装

1. 打开 `chrome://extensions/`。
2. 打开右上角的 **开发者模式**。
3. 点 **加载已解压的扩展程序**，选择本目录（含 `manifest.json` 的那一层）。
4. 修改过代码后，回到该页面点扩展卡片上的 **重新加载**，再重新打开弹窗。

## 二、界面预览

### 1. 基础配置与 Cookies to Sync

![主界面](docs/screenshots/01-main.png)

### 2. 拉取后跳转、DOM 触发

![选项](docs/screenshots/02-options.png)

### 3. 操作按钮

![按钮](docs/screenshots/03-actions.png)

> Chrome 应用商店上架素材见 [`store/`](store/)：截图 1280×800、小图 440×280、横幅 1400×560，均为 24 位 PNG 无透明通道；上架文案与隐私申报参考 [`store/README.md`](store/README.md)。

## 三、首次配置

点击工具栏图标打开弹窗，从上到下填写：

| 字段 | 说明 |
| --- | --- |
| GitHub Token | 具有 `gist` 权限的 Personal Access Token，形如 `ghp_...`。 |
| Gist ID | 存放 Cookie 文件的 Gist ID（Gist 地址的最后一段）。 |
| Filename | Gist 内的文件名，例如 `www.google.com.json`。每个域名建议用不同文件名。 |
| Target Domain | 要配置的域名，例如 `www.google.com`。每个域名保存一份独立配置。 |
| Encryption Password | 加密口令。**留空 = 不加密**；Push 与 Pull 必须使用同一个口令。 |

填完点 **Save** 保存。切换 Target Domain 会自动带出该域名已有的配置。

## 四、Cookies to Sync（Cookie 列表）

列表直接显示当前域名下的所有 Cookie，两列：

- **Name**：Cookie 名称
- **Path**：Cookie 路径（无路径显示为 `/`）

交互说明：

- 点击 **Name** 或 **Path** 列头排序，`▲` / `▼` 表示升序 / 降序，再点同一列切换方向。
- 排序不会丢失已勾选的项。
- **勾选 = 只同步这些 Cookie**；一个都不勾 = 同步该域名下的全部 Cookie。
- 列表只显示当前标签页所在域名的 Cookie。若当前页面不是 Target Domain，会提示 `Navigate to <domain> to select cookies.`，切到该域名页面再打开弹窗即可。

## 五、选项

| 选项 | 作用 |
| --- | --- |
| Auto-pull on load | 打开匹配域名的页面时自动 Pull。内部用 sessionStorage 标记，避免"拉取 → 刷新 → 再拉取"死循环。 |
| Clear cookies before pull | Pull 写入之前，先删掉当前域名（含可注册父域）下已有的 Cookie，避免新旧 Cookie 混在一起。 |
| Reload after pull | Pull 成功后自动刷新页面。 |
| Reload Path | 配合上一项。留空 = 刷新当前页；填 `/xxx` 按当前站点解析为相对路径；也可填完整 `http(s)://` 地址。仅接受 HTTP/HTTPS。 |
| Auto-push on DOM trigger | 页面出现指定元素时自动 Push 一次，推送后停止监听。 |
| DOM Selector | 触发元素选择器，**CSS 与 XPath 都支持**，例如 `#topInfo`、`//*[@id='topInfo']`。支持跳转或延迟渲染后才出现的元素（内部用 MutationObserver 监听），并会自动处理复制粘贴带来的外层引号与多余转义符。 |

## 六、按钮

| 按钮 | 作用 |
| --- | --- |
| Save | 保存全局配置（Token / Gist ID / 密码）和当前域名配置。 |
| Test | 测试 GitHub Token 与 Gist ID 是否可用。 |
| Pull | 从 Gist 取回 Cookie 写入浏览器，按上面的选项执行清理与刷新。 |
| Push | 把当前域名的 Cookie 加密后写入 Gist。 |
| Export Config | 导出全部配置为 JSON。 |
| Import Config | 导入 JSON 配置。 |

## 七、安全提示

- GitHub Token 与加密口令以明文保存在 `chrome.storage.local`，不要在共享电脑上使用。
- 建议 Gist 设为 **Secret**，并设置 **Encryption Password**。
- Cookie 等同于登录凭证，导出或分享配置前请确认接收方可信。

## 八、常见问题

**列表里没有 Cookie？**
当前标签页域名与 Target Domain 不一致。切到该域名页面再打开弹窗。

**DOM 触发不生效？**
先在 DevTools Console 里验证选择器能命中：CSS 用 `document.querySelector('你的选择器')`，XPath 用 `$x("你的 XPath")`。XPath 需以 `//` 或 `(` 开头。

**Pull 后没有刷新？**
检查是否勾选 `Reload after pull`；若填了 `Reload Path`，确认它是可访问的 HTTP/HTTPS 地址。

**提示 Decryption failed？**
Push 与 Pull 使用的加密口令不一致，或该 Gist 文件从未用当前口令加密过。

**提示 No settings found for this domain？**
当前域名（或其父域）还没保存过配置，先在弹窗里填好并 Save。
