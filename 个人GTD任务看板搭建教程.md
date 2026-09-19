# 个人 GTD 工作任务看板搭建教程

> 目标：搭建一个可在电脑和手机浏览器使用、支持多设备同步的个人工作任务系统。最终包含月历行程、自定义任务栏目、项目看板、拖拽排序、编辑删除和云端登录等功能。

## 一、最终效果

系统由三类页面组成：

1. **行程安排**：显示当月日历，可创建、编辑、删除行程，也可拖动行程调整日期。行程分为“工作、个人、重要”三类，默认选择“工作”，并用不同颜色区分。
2. **任务安排**：默认包含“进行中任务、等待中任务、分配中任务、待分配任务”四个栏目。任务可新增、编辑、删除、勾选完成、跨栏目拖动，也可在同一栏目内拖动调整优先顺序。
3. **自定义项目**：左侧导航支持新增和重命名项目，每个项目都会创建一套独立任务看板，例如“园区任务”。每个页面都可以单独新增、改名、改说明、改颜色、排序或删除栏目。

系统还包含：

- Supabase 邮箱账号登录与多设备实时同步；
- 自动记住登录状态；
- JSON 数据导入与导出；
- GitHub Pages 免费发布，苹果手机和电脑均可直接访问。

## 二、技术方案

这是一个不需要单独购买服务器的静态网页应用。

| 部分 | 使用技术 | 作用 |
| --- | --- | --- |
| 页面结构 | HTML | 日历、看板、弹窗和登录界面 |
| 界面样式 | CSS | 桌面端、手机端和横屏适配 |
| 交互功能 | 原生 JavaScript | 新增、编辑、删除、拖拽、任务与栏目排序 |
| 图标 | Lucide Icons | 页面按钮图标 |
| 云端数据库 | Supabase PostgreSQL | 保存每个用户的看板数据 |
| 用户登录 | Supabase Auth | 邮箱注册、登录和会话保持 |
| 实时同步 | Supabase Realtime | 多设备接收最新数据 |
| 网站托管 | GitHub Pages | 提供公开的 HTTPS 访问地址 |

数据流如下：

```text
手机或电脑浏览器
      ↓ 登录
Supabase Auth 识别当前用户
      ↓
网页把行程和任务写入 user_boards 表
      ↓
其他已登录设备通过 Realtime 收到更新
```

## 三、项目文件说明

复制现有项目时，需要保留以下文件：

```text
focus-gtd-board/
├─ index.html                         页面结构
├─ style.css                         主界面样式和响应式布局
├─ script.js                         日历、任务和项目逻辑
├─ board-model.js                    自定义栏目的数据规则
├─ cloud.css                         登录与同步状态样式
├─ cloud.js                          Supabase 登录和数据同步逻辑
├─ config.js                         Supabase 项目地址和公开密钥
└─ supabase/
   └─ migrations/
      └─ 20260811000000_create_user_boards.sql
```

各文件之间的加载顺序在 `index.html` 底部：

```html
<script src="config.js"></script>
<script src="board-model.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="cloud.js"></script>
<script src="script.js"></script>
```

这个顺序不能随意改变：先读取配置和 Supabase SDK，再初始化云端同步，最后启动看板。

## 四、最快复刻方法

### 第 1 步：复制 GitHub 项目

打开原项目：

`https://github.com/caiyixian2026/focus-gtd-board`

推荐点击右上角 **Fork**，复制到新使用者自己的 GitHub 账号。也可以下载全部文件，然后新建一个 GitHub 仓库上传。

建议仓库名称继续使用：

```text
focus-gtd-board
```

此时只复制了网页代码，不能直接共用原来的 Supabase 配置，否则双方数据会进入同一个后端项目。下一步必须新建独立的 Supabase 项目。

### 第 2 步：创建 Supabase 项目

1. 访问 `https://supabase.com` 并登录。
2. 点击 **New project**。
3. 填写项目名称，例如 `focus-gtd-board`。
4. 设置并妥善保存数据库密码。
5. 选择距离自己较近的区域。
6. 等待项目创建完成。

### 第 3 步：创建看板数据库

进入 Supabase 项目后，打开左侧 **SQL Editor**，点击 **New query**。

先复制并执行项目中的：

```text
supabase/migrations/20260811000000_create_user_boards.sql
```

这份脚本会完成：

- 创建 `user_boards` 数据表；
- 每个账号只保存一份完整看板数据；
- 开启 RLS 数据隔离；
- 限制用户只能读取和修改自己的数据；
- 自动记录更新时间；
- 将表加入 Supabase Realtime。

### 第 4 步：配置邮箱登录

在 Supabase 中进入 **Authentication → Providers → Email**：

1. 确认 Email 登录已启用。
2. 如果希望注册后立即使用，可关闭邮箱确认；如果重视账号安全，则保留邮箱确认。
3. 在 **Authentication → URL Configuration** 中设置站点地址。

GitHub Pages 的站点地址一般是：

```text
https://你的GitHub用户名.github.io/focus-gtd-board/
```

把它填写到 **Site URL**，并加入允许的 **Redirect URLs**。

### 第 5 步：填写 Supabase 配置

进入 Supabase 的 **Project Settings → API**，找到：

- Project URL；
- Publishable key，旧版界面可能显示为 `anon public` key。

修改项目根目录中的 `config.js`：

```js
window.SUPABASE_CONFIG = {
  url: 'https://你的项目编号.supabase.co',
  publishableKey: '你的Supabase公开密钥'
};
```

这里必须使用前端公开密钥，绝对不要把 `service_role` 密钥写进网页。公开密钥之所以可以出现在前端，是因为数据库同时使用了 RLS 权限策略保护用户数据。

### 第 6 步：开启 GitHub Pages

在新 GitHub 仓库中：

1. 打开 **Settings → Pages**。
2. 在 **Build and deployment** 中选择 **Deploy from a branch**。
3. Branch 选择 `main`，文件夹选择 `/ (root)`。
4. 点击 **Save**。
5. 等待一到几分钟，GitHub 会显示网站地址。

网站地址通常为：

```text
https://你的GitHub用户名.github.io/focus-gtd-board/
```

### 第 7 步：首次注册和同步

1. 打开 GitHub Pages 网站。
2. 输入邮箱和至少 6 位密码。
3. 点击“创建新账户”。
4. 如果启用了邮箱确认，前往邮箱点击确认链接。
5. 返回网页并登录。
6. 新增一条行程或任务，观察右上角状态是否变成“云端已同步”。
7. 在另一台设备上用同一账号登录，检查数据是否一致。

## 五、核心功能是怎样实现的

### 1. 数据模型

前端把整个工作台保存成一个 JSON 对象：

```js
{
  events: [],
  tasks: [],
  parkTasks: [],
  projectBoards: [],
  projectTasks: {}
}
```

- `events`：所有日历行程；
- `tasks`：默认“任务安排”中的任务；
- `parkTasks`：“园区任务”中的任务；
- `projectBoards`：左侧自定义项目名称和编号；
- `projectTasks`：各个自定义项目对应的任务数组。

本地模式写入浏览器 `localStorage`；登录后，`cloud.js` 把相同数据写入 Supabase 的 `user_boards.board_data`。

### 2. 行程日历

`script.js` 根据当前年月动态计算：

- 当月第一天是星期几；
- 当月天数；
- 上月和下月需要补齐的日期；
- 每个日期对应的行程。

行程卡片使用 HTML5 Drag and Drop。拖到另一天时，只修改行程的 `date` 字段并重新保存。当天日期使用单独的高亮样式，方便在手机和电脑上快速定位。

### 3. 自定义栏目任务看板

任务的 `quadrant` 字段保存所属栏目的稳定编号。新页面默认创建以下四个栏目：

```text
in-progress  → 进行中任务
waiting      → 等待中任务
assigned     → 分配中任务
unassigned   → 待分配任务
```

跨栏目拖动会修改 `quadrant`；同一栏目拖动会修改 `sortOrder`，因此可手动调整重要等级。新增、编辑、删除、完成状态和截止日期都由同一个任务弹窗及任务处理逻辑管理。

每个项目的 `columns` 数组独立保存栏目名称、说明、颜色和顺序，最多 12 个。删除空栏目可直接确认；删除有任务的栏目时，必须先选择另一个栏目迁移任务，因此不会丢失任务。

### 4. 自定义项目看板

`projectBoards` 保存左侧导航名称和各页面独立的 `columns`；`projectTasks` 按项目编号保存各自的任务。新增项目时创建一个唯一编号并复制默认四栏目；重命名只改变显示名称，不会影响原任务数据。

这种结构让所有新项目都能从统一默认模板开始，之后又能分别调整，不需要为每个项目复制一套 HTML 页面。

### 5. 多设备同步与记住登录

`cloud.js` 使用 Supabase JS SDK：

- 登录后先从云端读取数据；
- 每次修改后延迟约 350 毫秒合并写入，避免频繁请求；
- 订阅 `user_boards` 的实时更新；
- 使用浏览器 `localStorage` 保存登录会话；
- 自动刷新访问令牌，因此日常打开网页通常不需要重新登录。

同步失败时，本地数据仍保留，并可通过“导出数据”生成 JSON 备份。

## 六、手机和电脑快捷使用

### 苹果手机

1. 用 Safari 打开 GitHub Pages 地址。
2. 点击底部“分享”按钮。
3. 选择“添加到主屏幕”。
4. 修改名称后点击“添加”。

以后可像打开 App 一样从手机桌面进入。横屏时顶部导航可以横向滚动，日历区域也可以横向滑动。

### Windows 电脑

使用 Chrome 或 Edge 打开网站后，可通过浏览器菜单选择“将页面安装为应用”或“创建快捷方式”，并勾选在窗口中打开。也可以直接把网页地址拖到桌面创建快捷方式。

## 七、验收清单

搭建完成后，逐项检查：

- [ ] GitHub Pages 地址能正常打开；
- [ ] 新账号可以注册和登录；
- [ ] 关闭并重新打开浏览器后仍保持登录；
- [ ] 可以新增、编辑、删除行程；
- [ ] 行程可以拖到其他日期；
- [ ] 行程类别默认是“工作”，并可改为“个人”或“重要”；
- [ ] 可以新增、编辑、删除和完成任务；
- [ ] 任务可以跨栏目拖动；
- [ ] 同一栏目可以拖动排序；
- [ ] 每个项目页面可以独立新增、编辑、改色和排序栏目；
- [ ] 删除有任务的栏目时，系统要求选择迁移目标，任务不会丢失；
- [ ] 可以新增和重命名项目看板；
- [ ] 两台设备登录同一账号后数据一致；
- [ ] 数据可以导出为 JSON，也能重新导入。

## 八、常见问题

### 网页每次打开都要求登录

确认浏览器没有开启无痕模式，也没有设置成退出时自动清除网站数据。`cloud.js` 已开启 `persistSession` 和 `autoRefreshToken`，正常浏览器会保存会话。

### 手机和电脑内容不一致

确认两台设备使用的是同一个邮箱账号，并查看右上角同步状态。若显示“同步失败”，检查 Supabase 项目是否暂停、网络是否正常，以及 `config.js` 是否填写了正确的项目地址和公开密钥。

### 注册后无法登录

如果 Supabase 开启了邮箱确认，必须先点击验证邮件中的链接。还要确认 Authentication 的 Site URL 和 Redirect URLs 已填写 GitHub Pages 地址。

### 修改代码后网站没有立刻更新

GitHub Pages 通常需要一到几分钟发布。等待后强制刷新页面：Windows 使用 `Ctrl + F5`，苹果设备可关闭标签页后重新打开。

## 九、介绍给别人时的演示顺序

建议用 5 分钟按以下顺序演示：

1. 先介绍它是一个遵循 GTD 的个人工作台，行程管时间，任务管下一步行动。
2. 在日历中新增一条不同类别的行程，并拖到另一天。
3. 进入任务看板，新增任务并填写备注。
4. 把任务在栏目之间拖动，再在同一栏目调整顺序。
5. 打开“管理栏目”，演示改名、改色和新增栏目。
6. 新建一个项目看板，说明各项目的任务与栏目配置彼此独立。
7. 展示另一台设备上的同步结果。
8. 最后说明系统使用 GitHub Pages 和 Supabase，成本低、无需维护传统服务器。

一句话介绍可以这样说：

> 这是一个把日历、GTD 任务栏目和自定义项目整合在一起的个人工作台，数据通过 Supabase 在手机和电脑之间同步，每个项目都能按自己的流程配置栏目。

## 十、后续可扩展方向

- 增加任务附件、负责人和完成百分比；
- 增加 PWA 配置，实现更接近原生 App 的离线体验和图标；
- 为项目看板增加归档和删除功能；
- 增加每日提醒或截止日期通知。

---

现有示例站点：`https://caiyixian2026.github.io/focus-gtd-board/`

现有源码仓库：`https://github.com/caiyixian2026/focus-gtd-board`
