# Lab1 Phase 1 验收规格

## 文档定位

本文件把实验原文中的外部行为整理成验收项目，供后续实现和 Vitest 测试使用。完整语义以 [`phase_cli_1.md`](./phase_cli_1.md) 为准；本文件与原文不一致时，以原文为准。

约定：

- **精确**：输出或错误信息需要逐字匹配；
- **语义**：至少满足状态、父子关系、历史栈等行为要求；
- **草稿**：实现前的测试规格，当前不要求全部通过。

## 语义澄清（2026-10-30）

本节记录针对原文歧义确认的解释和项目补充约定；保留原始实验文档不变，实现和测试统一引用本节。

### 层次顺序

- `front` / `back` 表示视觉置顶 / 置底，只作用于同一个父级。
- `children` 按 SVG 文档和绘制顺序排列：索引 0 在最底层，最后一个索引在最上层。因此 `front` 移到列表末尾，`back` 移到列表开头。
- SVG 写出、读回和 `tree` 均保持此文档顺序；不在输出时反转列表。
- 移动 Group 的层次时把整组作为一个对象，不改变组内顺序、几何属性或父子关系；其他同级对象的相对顺序不变。
- 即使对象已经位于目标位置，成功的 `front` / `back` 仍是一条编辑命令：记录一个 undo 单元，并清空已有 redo。
- 依据：原文第 3 节的 z-order 语义，以及 [SVG 渲染顺序](https://www.w3.org/TR/SVG2/render.html#RenderingOrder)。

### canvas 和历史边界

- 按原文第 4.3 节对“canvas 修改尺寸”的具体限定解释命令总表：无参数 `canvas` 是查询，带参数且成功的尺寸修改才触发文档命令历史规则。
- `canvas` 查询和 `tree` / `show` / `help` 均不改变文档、undo 栈、redo 栈或历史禁用状态；查询不能解除已有禁用状态。
- `init` / `read` / `save` / `canvas` 修改成功后禁止 undo 和 redo，二者均输出 `error: undo not allowed after io command`，直到下一条编辑命令成功。
- **项目补充约定**：上述文档操作成功时清空两栈，形成不能跨越的历史边界。原文只规定禁用，没有明确旧栈是否保留；本项目采用清栈规则，防止切换文档后旧命令再次操作旧对象。
- 下一次成功编辑解除禁用并开启新的历史。撤销全部新编辑后报告空栈错误，不能撤销边界前的编辑。
- 所有失败操作保留文档和历史的原状态；失败编辑不能解禁，失败文档操作不能清栈或新设禁用状态。
- 即使新尺寸等于原尺寸，只要带参数修改成功，也形成历史边界。

### 数值与结构不变量（2026-10-30 补充）

- 移动增量、缩放因子及运算后的全部几何属性必须是有限数。有限输入相加或相乘仍可能溢出；不得把 `Infinity`、`-Infinity` 或 `NaN` 写入模型，也不采用截断或钳制代替报错。
- 缩放因子为零或负数时保留原文规定的 `scale factor must be positive`；非有限输入或运算结果采用项目数值错误 `invalid number for <参数或属性名>`，领域层错误码为 `invalid-number`，CLI 输出时加 `error:` 前缀。
- 叶子和 Group 的移动/缩放都先计算、校验全部受影响节点，再写入状态。任何节点失败时，整棵子树的属性、结构、对象身份和历史均保持原样；失败不能清空已有 redo，也不能解除文档操作造成的禁用状态。
- `parent`、`ownerDocument` 只通过只读属性公开，移除可直接赋值的 `setParent` / `setDocumentOwner`。已挂载对象的结构修改统一经过 `Document`；公开的 Group 添加、插入和删除接口只用于脱离文档的树，传入 Document 引用也不能绕过限制。
- 脱离文档的整棵树也要求 ID 唯一，检查范围包含祖先和其他分支。挂载、摘除、恢复及跨文档转移后，每个节点只出现一次，父级引用和所有后代的文档归属必须一致。
- 使用对象引用操作 Document 时，必须确认对象身份属于该文档；同 ID 的其他对象不视为同一个节点。

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
| DATA-07 | 数值有效性 | 输入及几何运算结果均为有限数，溢出失败不改变任一受影响节点 |
| DATA-08 | 树结构一致性 | 节点不重复出现、ID 唯一、父级和文档归属一致；公共子列表不能用于改写内部列表 |

## 3. 文档命令

`init`、`read`、`save` 和带参数修改尺寸的 `canvas` 成功后清空两栈并禁止 undo/redo，直到下一条编辑命令成功。无参数 `canvas` 查询完全保留历史。具体解释和失败处理见上方“语义澄清”。

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
| DOC-09 | `canvas` | 当前文档存在 | 显示当前尺寸，不改变文档 | 查询；两栈及禁用状态均不变 |
| DOC-10 | `canvas 1024 768` | 当前文档存在 | 画布尺寸改为 1024×768 | 成功摘要；undo/redo 禁止 |
| DOC-11 | `init`/`read`/`save`/`canvas` 修改成功后 `undo`/`redo` | 尚无新的成功编辑 | 不执行历史操作 | `error: undo not allowed after io command` |
| DOC-12 | 文档操作成功后执行一条成功编辑 | 文档存在 | 编辑正常执行并重新解禁历史 | 开启新历史，不能撤销边界前的编辑 |
| DOC-13 | `canvas` 修改失败 | 当前文档存在 | 宽、高均保持原值 | 两栈及禁用状态均不变 |

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
| EDIT-07 | 非有限 dx/dy 的 move | 报参数数值错误，两个坐标及其他属性均不改变 | 两栈及禁用状态不变 |
| EDIT-08 | 有限输入导致 move/scale 溢出 | 报结果属性的数值错误；Group 中后部节点失败也不能留下前部修改 | 两栈及禁用状态不变，后续编辑仍可撤销 |

## 6. 层级和 z-order 命令

| 编号 | 输入 | 预期行为 |
|---|---|---|
| HIER-01 | `group <newGid> <id1> <id2>...` | 创建新容器，摘出目标并按原相对顺序收入 |
| HIER-02 | `ungroup <gid>` | 解散容器，子图形提升到原父级并占据原容器位置 |
| HIER-03 | `addto <gid> <id>` | 把已有图形移动为容器的最后一个子节点 |
| HIER-04 | `front <id>` | 视觉置顶，移到同级列表末尾，最后绘制 |
| HIER-05 | `back <id>` | 视觉置底，移到同级列表开头，最先绘制 |
| HIER-06 | `group` 同时包含容器及其后代 | 拒绝，不能形成循环或把容器收入自己的后代 |
| HIER-07 | `ungroup` 顶层容器 | 拒绝，报告不能解散顶层容器 |
| HIER-08 | 层级命令失败 | 原父级、顺序和对象集合保持不变 |
| HIER-09 | 每条层级编辑命令 | 整体作为一个 undo 单元 |
| HIER-10 | 对已在目标位置的对象执行 `front`/`back` | 顺序不变，仍记录一个 undo 单元并清空 redo |
| HIER-11 | 直接通过已挂载 Group 修改子节点，包括额外传入 Document 引用 | 拒绝，必须通过 Document；不产生重复节点、重复 ID 或悬空归属 |
| HIER-12 | 在脱离文档的树中添加与祖先或其他分支同 ID 的节点 | 拒绝，原树和待加入对象均保持原样 |
| HIER-13 | 删除、恢复或转移完整子树 | 所有后代归属同步更新，子树内部父级和顺序保留 |
| HIER-14 | 通过其他文档的对象引用或同 ID 的另一对象删除/排序 | 拒绝，两个文档均保持原样 |

例：初始列表 `[a,b,c]` 中 `c` 位于最上层；`front b` 得到 `[a,c,b]`，从初始状态执行 `back b` 得到 `[b,a,c]`。根级、嵌套级和 Group 使用相同规则。

## 7. 显示命令

| 编号 | 输入 | 预期行为 | 历史要求 |
|---|---|---|---|
| VIEW-01 | `tree` | 显示完整文档树、画布尺寸和关键几何属性 | 不进入 undo 栈 |
| VIEW-02 | `tree <id>` | 只显示该 ID 为根的子树 | 不改变文档 |
| VIEW-03 | `show <id>` | 显示类型、父级、几何属性和可见属性 | 不进入 undo 栈 |
| VIEW-04 | `help` | 显示全部命令和语法 | 不进入 undo 栈 |
| VIEW-05 | 对不存在 ID 执行 `tree`/`show` | 报 ID 错误，不改变状态 | 不进入 undo 栈 |

`tree` 必须内联关键属性，不能只输出对象名称，并按文档顺序显示；`show` 必须包含父级信息。所有显示查询都保留两栈和历史禁用状态。

## 8. undo/redo

| 编号 | 操作序列 | 预期结果 |
|---|---|---|
| HIST-01 | 一条编辑命令 → `undo` | 恢复该命令前的状态 |
| HIST-02 | `undo` → `redo` | 再次执行被撤销的命令 |
| HIST-03 | `undo` → 新编辑命令成功 → `redo` | redo 栈被清空 |
| HIST-04 | `group`/`delete`/`ungroup` → `undo` | 一次还原整个结构变化 |
| HIST-05 | 编辑 → `canvas` 查询或 `tree`/`show`/`help` → `undo` | 查询不影响上一个编辑命令 |
| HIST-06 | `init`/`read`/`save`/`canvas` 修改成功 → `undo`/`redo` | 旧栈清空，报文档命令历史错误 |
| HIST-07 | 文档操作成功 → 成功编辑 → `undo` | 新编辑可以撤销，文档操作的结果保留 |
| HIST-08 | 编辑 → `undo` → `canvas` 查询 → `redo` | 原编辑正常重做 |
| HIST-09 | 编辑 → 文档操作失败 → `undo` | 原编辑仍可撤销；失败操作未修改文档和历史 |
| HIST-10 | 文档操作成功 → 查询或失败编辑 → `undo`/`redo` | 仍报文档命令历史错误 |
| HIST-11 | 文档操作成功 → 新编辑 → 撤销全部新编辑 → 再次 `undo` | 报空栈错误，不能跨越历史边界 |
| HIST-12 | 编辑 → undo → 非法移动或溢出失败 → redo | 重做原编辑，得到原来的正确结果；失败命令不进入历史 |

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
| `init`/`read`/`save`/`canvas` 修改成功后、尚无新成功编辑时 undo/redo | `error: undo not allowed after io command` |
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
