# Lab1 Phase 1 验收规格

## 文档定位

本文件把实验原文中的外部行为整理成验收项目，供后续实现和 Vitest 测试使用。完整语义以 [`phase_cli_1.md`](./phase_cli_1.md) 为准；本文件与原文不一致时，以原文为准。

约定：

- **精确**：输出或错误信息需要逐字匹配；
- **语义**：至少满足状态、父子关系、历史栈等行为要求；
- **草稿**：实现前的测试规格，当前不要求全部通过。

## 1. 启动和输入约定

| 编号 | 场景 | 验收要求 |
|---|---|---|
| REPL-01 | 启动 `npm run cli` | 显示 `svg>`，等待下一行输入 |
| REPL-02 | 输入空行 | 不改变文档，不产生业务错误，再次显示提示符 |
| REPL-03 | 输入以 `#` 开头的行 | 视为注释，不改变文档，不进入 undo 栈 |
| REPL-04 | 参数包含空格 | 双引号内的内容作为一个参数，例如 `"My Diagram"` |
| REPL-05 | 一行处理完成 | 成功输出摘要或 `error:` 错误，然后再次显示提示符 |
| REPL-06 | 命令失败 | 文档状态、父子关系和历史栈不产生部分修改 |
| REPL-07 | EOF | 结束 REPL；实验没有要求额外的 `exit` 命令 |

## 2. 全局数据约定

| 编号 | 约定 | 验收要求 |
|---|---|---|
| DATA-01 | ID 唯一 | 每个图形和 `<g>` 都有唯一、大小写敏感的 ID |
| DATA-02 | 坐标 | 原点在左上角，x 向右，y 向下；浮点数合法 |
| DATA-03 | 父级 | 图形可以位于画布根或某个 `<g>` 容器中 |
| DATA-04 | 缺失 ID | `read` 外部 SVG 时自动按“标签名+序号”补 ID 并打印 warning |
| DATA-05 | 失败原子性 | 任意命令失败后，不能留下半完成的图形、层级或属性变化 |
| DATA-06 | 错误前缀 | 错误输出以 `error:` 开头，一行一个错误 |

## 3. 文档命令

文档命令执行后禁止 undo/redo，直到下一条编辑命令重新解禁。这个规则包括 `canvas` 的无参数显示和带参数修改。

| 编号 | 输入 | 初始条件 | 预期状态 | 预期输出/历史 |
|---|---|---|---|---|
| DOC-01 | `init` | 任意状态 | 新建空画布，默认 800×600，作为当前文档 | 精确语义：创建成功；执行后 undo/redo 禁止 |
| DOC-02 | `init 400 200` | 任意状态 | 新建空画布 400×200，旧当前文档被替换 | 执行后 undo/redo 禁止 |
| DOC-03 | `read demo.svg` | 文件存在 | SVG 成为当前文档，保留结构、属性和顺序 | 缺失 ID 时逐个 warning；执行后 undo/redo 禁止 |
| DOC-04 | `read missing.svg` | 文件不存在 | 当前文档不改变 | `error: cannot read file: missing.svg` |
| DOC-05 | `save demo.svg` | 当前文档存在且路径可写 | SVG 文件写出 | 成功摘要；执行后 undo/redo 禁止 |
| DOC-06 | `save` | 当前文档来自 `read` | 写回读入时的路径 | 成功摘要；执行后 undo/redo 禁止 |
| DOC-07 | `save` | 没有当前文档 | 状态不改变 | 无文档错误 |
| DOC-08 | `save locked.svg` | 路径不可写 | 文档内存状态不改变 | `error: cannot write file: locked.svg` |
| DOC-09 | `canvas` | 当前文档存在 | 显示当前尺寸，不改变图形 | 显示类输出；仍按文档命令处理 |
| DOC-10 | `canvas 1024 768` | 当前文档存在 | 画布尺寸改为 1024×768 | 成功摘要；undo/redo 禁止 |
| DOC-11 | 任意文档命令后 `undo`/`redo` | 文档命令刚执行 | 不执行历史操作 | `error: undo not allowed after io command` |
| DOC-12 | 文档命令后执行一条编辑命令 | 文档存在 | 编辑命令正常执行并重新解禁历史 | 编辑命令可作为新的 undo 单元 |

## 4. 图形创建和属性

### 4.1 `create` 类型

| 编号 | 语法 | 预期对象 |
|---|---|---|
| SHAPE-01 | `create rect <id> <x> <y> <w> <h> [fill]` | `<rect>`，可选 `fill` |
| SHAPE-02 | `create circle <id> <cx> <cy> <r> [fill]` | `<circle>`，可选 `fill` |
| SHAPE-03 | `create ellipse <id> <cx> <cy> <rx> <ry> [fill]` | `<ellipse>`，可选 `fill` |
| SHAPE-04 | `create line <id> <x1> <y1> <x2> <y2> [stroke]` | `<line>`，可选 `stroke` |
| SHAPE-05 | `create text <id> <x> <y> "content"` | `<text>`，内容是子文本 |
| SHAPE-06 | `create g <id>` | 空 `<g>` 容器 |
| SHAPE-07 | 任意类型加 `in <containerId>` | 新图形直接挂入已存在的 `<g>` |

创建约定：

- `fill`/`stroke` 省略时不写入属性；
- 所有图形和容器 ID 必须唯一；
- `box` 在本阶段必须报告未知图形类型；
- 成功输出至少应包含类型和 ID，例如 `rect#r1 created`。

### 4.2 `set` 属性白名单

| 类型 | 允许的几何属性 |
|---|---|
| `rect` | `x`、`y`、`width`、`height` |
| `circle` | `cx`、`cy`、`r` |
| `ellipse` | `cx`、`cy`、`rx`、`ry` |
| `line` | `x1`、`y1`、`x2`、`y2` |
| `text` | `x`、`y`、`text` |
| 所有适用类型 | `fill`、`stroke`、`stroke-width` |

白名单以外的属性必须报告：

```text
error: unknown attribute: <attr>
```

## 5. 图形编辑命令

| 编号 | 输入 | 预期行为 | 历史要求 |
|---|---|---|---|
| EDIT-01 | `delete <id>` | 删除图形；删除容器时连同全部子孙删除 | 一个 undo 单元，undo 恢复完整子树和位置 |
| EDIT-02 | `move <id> <dx> <dy>` | 增量平移；作用于容器时整体平移 | 一个 undo 单元 |
| EDIT-03 | `scale <id> <factor>` | 等比缩放所有几何属性；容器递归作用于子孙 | `factor` 必须为正数 |
| EDIT-04 | `set <id> <attr> <value>` | 修改白名单属性 | undo 恢复旧值 |
| EDIT-05 | 重复 ID 的 `create` | 创建失败，已有对象保持不变 | 不进入 undo 栈 |
| EDIT-06 | 不存在 ID 的编辑命令 | 创建失败，文档保持不变 | 不进入 undo 栈 |

## 6. 层级和 z-order 命令

| 编号 | 输入 | 预期行为 |
|---|---|---|
| HIER-01 | `group <newGid> <id1> <id2>...` | 创建新容器，摘出目标并按原相对顺序收入 |
| HIER-02 | `ungroup <gid>` | 解散容器，子图形提升到原父级并占据原容器位置 |
| HIER-03 | `addto <gid> <id>` | 把已有图形移动为容器的最后一个子节点 |
| HIER-04 | `front <id>` | 移到同级最前 |
| HIER-05 | `back <id>` | 移到同级最后 |
| HIER-06 | `group` 同时包含容器及其后代 | 拒绝，不能形成循环或把容器收入自己的后代 |
| HIER-07 | `ungroup` 顶层容器 | 拒绝，报告不能解散顶层容器 |
| HIER-08 | 层级命令失败 | 原父级、顺序和对象集合保持不变 |
| HIER-09 | 每条层级编辑命令 | 整体作为一个 undo 单元 |

## 7. 显示命令

| 编号 | 输入 | 预期行为 | 历史要求 |
|---|---|---|---|
| VIEW-01 | `tree` | 显示完整文档树、画布尺寸和关键几何属性 | 不进入 undo 栈 |
| VIEW-02 | `tree <id>` | 只显示该 ID 为根的子树 | 不改变文档 |
| VIEW-03 | `show <id>` | 显示类型、父级、几何属性和可见属性 | 不进入 undo 栈 |
| VIEW-04 | `help` | 显示全部命令和语法 | 不进入 undo 栈 |
| VIEW-05 | 对不存在 ID 执行 `tree`/`show` | 报 ID 错误，不改变状态 | 不进入 undo 栈 |

`tree` 必须内联关键属性，不能只输出对象名称；`show` 必须包含父级信息。

## 8. undo/redo

| 编号 | 操作序列 | 预期结果 |
|---|---|---|
| HIST-01 | 一条编辑命令 → `undo` | 恢复该命令前的状态 |
| HIST-02 | `undo` → `redo` | 再次执行被撤销的命令 |
| HIST-03 | `undo` → 新编辑命令 → `redo` | redo 栈被清空 |
| HIST-04 | `group`/`delete`/`ungroup` → `undo` | 一次还原整个结构变化 |
| HIST-05 | `tree`/`show`/`help` → `undo` | 显示命令不影响上一个编辑命令 |
| HIST-06 | 文档命令 → `undo`/`redo` | 报文档命令历史错误，不执行旧命令 |
| HIST-07 | 文档命令后编辑 → `undo` | 新编辑可以撤销 |

## 9. 必须覆盖的错误

以下错误信息在原文中有明确格式，应逐字测试：

| 场景 | 预期错误 |
|---|---|
| ID 已存在 | `error: id already exists: r1` |
| ID 不存在 | `error: no such shape: r9` |
| `in` 容器不存在 | `error: no such container: node9` |
| `in` 目标不是容器 | `error: not a container: start` |
| 未注册图形类型 | `error: unknown shape type: hexagon (is the plugin loaded?)` |
| 复合图形不能 ungroup | `error: cannot ungroup composite shape: n1` |
| 容器收入自己的后代 | `error: cannot group a container into its own descendant: g1` |
| 顶层容器不能 ungroup | `error: cannot ungroup top-level container: scene` |
| 缩放因子非正数 | `error: scale factor must be positive` |
| 文件无法读取 | `error: cannot read file: a.svg` |
| 文件无法写入 | `error: cannot write file: a.svg` |
| 没有当前文档 | `error: no document. use 'init' or 'read' first` |
| 文档命令后 undo/redo | `error: undo not allowed after io command` |
| 属性不在白名单 | `error: unknown attribute: <attr>` |

实验没有固定未知命令或语法错误的完整文本；实现时必须保持 `error:` 前缀、状态不变，并把最终格式记录到本文档或过程记录中。

## 10. 端到端验收会话

以下会话必须在后续实现完成后完整回放，并检查输出、树结构和保存文件：

```text
init 800 600
create g flowchart
create g node1 in flowchart
create rect start 120 100 160 60 #4a90d9 in node1
create text start-label 155 135 "开始" in node1
create g node2 in flowchart
create rect process 520 100 160 60 #f5a623 in node2
create text process-label 545 135 "处理数据" in node2
create line arrow1 280 130 520 130 black in flowchart
tree
move node2 0 100
undo
redo
set process-label text "处理数据 v2"
save flowchart.svg
```

验收结果应包括：

- `tree` 展示正确的 8 个元素和层级；
- `move` 后 node2 及其子图形整体移动；
- `undo`/`redo` 只影响那条移动命令；
- `set` 只修改文字内容；
- 保存出的 `flowchart.svg` 可以在浏览器打开。
