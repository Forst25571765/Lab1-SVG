# Lab1 Phase 1 测试草稿

## 使用方式

本文件是实现前的测试设计，不代表当前所有测试都已经写成 Vitest 代码。每个用例先作为红色规格，等对应模块出现后再实现为测试；通过后再重构。

2026-10-30 起，层次顺序、无参数 `canvas` 查询和文档操作历史边界统一遵循 [验收规格的语义澄清](./acceptance-spec.md#语义澄清2026-10-30)。

S6 当时的结果为全量 14 个文件、328 个测试通过；实际 CLI 输出的 Edge 浏览器专项见 [S6.md](./S6.md)。S7 初次新增 139 个用例，2026-10-31 又补充 64 个非负值回归用例；当前 19 个文件、531 个测试、类型检查、构建及 lint 全部通过，S8 已再次复核。测试设计与实际用例、阶段不适用项的对应见 [S7.md](./S7.md)，最终证据和发布记录见 [S8.md](./S8.md)。本文件保留早期测试设计，不代替实际验收记录。

测试分层：

1. **领域层**：测试 `Document`、`Shape`、`Group` 的状态和行为；
2. **Command 层**：测试具体命令的执行、撤销和重做；
3. **应用/解析层**：测试命令注册、参数解析和历史策略；
4. **IO 层**：使用内存文件系统测试 SVG 读写；
5. **CLI 集成层**：回放完整会话，检查最终输出和文档状态。

2026-10-31 增补的 `nonnegative-values.test.ts` 对应验收 DATA-09：覆盖画布/矩形宽高、圆/椭圆半径、六类图形的描边宽度；构造与直接属性设置、CLI `init/canvas/create/set`、SVG 数字/px/科学计数法导入均拒绝负值。断言包括当前文档及对象身份、来源路径、文件、两栈数量和栈顶、已有 redo 的可执行性、文档历史禁用状态，以及失败导入不泄漏临时元素或 warning。合法对照覆盖零值、负坐标、移动/缩放及保存读回。修复前 57 失败、7 通过，修复后 64 个全部通过。

## 1. 阶段一测试

| ID | 层级 | 场景 | 预期 |
|---|---|---|---|
| REPL-T01 | CLI | 启动 REPL | 输出 `svg>` 并等待输入 |
| REPL-T02 | CLI | 空行 | 不产生错误，再次输出提示符 |
| REPL-T03 | CLI | `# comment` | 不执行命令、不改变状态 |
| REPL-T04 | CLI | 输入未知命令 | 输出 `error: unknown command: ...`，程序继续等待 |
| REPL-T05 | CLI | EOF | REPL 正常结束 |
| REPL-T06 | 测试环境 | 运行 `npm test` | Vitest 能发现并运行测试 |

`framework.smoke.test.ts` 覆盖 REPL-T06；S6 的 `cli-repl.test.ts` 已覆盖启动提示符、空行、注释、错误继续、等待下一次交互输入、EOF 和导入 main 不启动 REPL。

## 2. 领域模型测试

### 2.1 文档和画布

| ID | 场景 | 断言 |
|---|---|---|
| DOMAIN-T01 | `init` 无参数 | 空文档，尺寸为 800×600 |
| DOMAIN-T02 | `init 400 200` | 空文档，尺寸为 400×200 |
| DOMAIN-T03 | 初始化后添加图形 | 图形出现在根级子节点 |
| DOMAIN-T04 | 查找不存在 ID | 返回明确的不存在结果或领域错误 |
| DOMAIN-T05 | 重复 ID | 不允许添加第二个同 ID 对象 |
| DOMAIN-T06 | ID 大小写 | `r1` 和 `R1` 按实验的大小写敏感约定处理 |
| DOMAIN-T07 | 修改画布时任一尺寸为 NaN/Infinity | 报数值错误，宽、高均保持原值 |

### 2.2 六种图形

| ID | 对象 | 断言 |
|---|---|---|
| DOMAIN-T10 | `Rect` | 保存 x、y、width、height 和可选 fill |
| DOMAIN-T11 | `Circle` | 保存 cx、cy、r 和可选 fill |
| DOMAIN-T12 | `Ellipse` | 保存 cx、cy、rx、ry 和可选 fill |
| DOMAIN-T13 | `Line` | 保存 x1、y1、x2、y2 和可选 stroke |
| DOMAIN-T14 | `Text` | 保存 x、y 和子文本内容 |
| DOMAIN-T15 | `Group` | 可拥有有序子节点 |
| DOMAIN-T16 | 可选属性省略 | 不把省略的 fill/stroke 强行写入模型或 SVG |

### 2.3 统一图形操作

| ID | 操作 | 断言 |
|---|---|---|
| DOMAIN-T20 | 叶子 `move` | 位置按增量改变 |
| DOMAIN-T21 | 叶子 `scale` | 位置和尺寸按比例改变 |
| DOMAIN-T22 | Group `move` | 所有子孙整体平移，内部相对位置不变 |
| DOMAIN-T23 | Group `scale` | 所有子孙几何属性递归缩放 |
| DOMAIN-T24 | `set` 合法属性 | 属性更新 |
| DOMAIN-T25 | `set` 非法属性 | 拒绝修改并返回未知属性错误 |
| DOMAIN-T26 | 五种叶子、空 Group、嵌套 Group 的 dx/dy 为 NaN/±Infinity | 报数值错误，完整文档状态不变 |
| DOMAIN-T27 | 移动导致任一位置属性溢出 | 拒绝正向/负向溢出，不留下较早属性的部分修改 |
| DOMAIN-T28 | 缩放导致任一几何属性溢出 | 拒绝，不改变位置、尺寸、样式或文本 |
| DOMAIN-T29 | Group 后部或嵌套后代发生溢出 | 前部已计算的图形也不修改，整个操作失败 |
| DOMAIN-T30 | 大数的运算结果仍有限 | 正常接受，不能一律拒绝大数；普通小数和负坐标仍可用 |
| DOMAIN-T31 | 脱离文档的树中跨分支/祖先 ID 冲突 | 加入前拒绝，原树可继续正常挂载 |
| DOMAIN-T32 | 父级和文档归属的公开访问 | 只读；旧的直接 setter 不再公开 |

DOMAIN-T26 至 T30 的数值和整树原子性由 `tests/geometry-safety.test.ts` 验证；结构不变量和公开接口由 `tests/hierarchy-integrity.test.ts` 验证。`tests/helpers/documentState.ts` 同时检查节点唯一性、父级、文档归属、属性快照和对象身份。

## 3. Command 层测试

### 3.1 基础编辑命令

| ID | 命令 | 测试顺序 | 断言 |
|---|---|---|---|
| CMD-T01 | Create | execute | 新对象出现 |
| CMD-T02 | Create | execute → undo | 新对象被移除 |
| CMD-T03 | Create | execute → undo → redo | 新对象再次出现 |
| CMD-T04 | Delete | execute | 对象和子树消失 |
| CMD-T05 | Delete | execute → undo | 原对象、父级和顺序完整恢复 |
| CMD-T06 | Move | execute | 位置改变 |
| CMD-T07 | Move | execute → undo | 原位置恢复 |
| CMD-T08 | Scale | execute → undo | 所有几何属性恢复 |
| CMD-T09 | Set | execute → undo | 旧属性值恢复 |

### 3.2 历史栈

| ID | 操作顺序 | 断言 |
|---|---|---|
| HIST-T01 | 编辑 A → 编辑 B → undo | 只撤销 B |
| HIST-T02 | 编辑 A → undo → redo | A 被重新执行 |
| HIST-T03 | 编辑 A → undo → 新编辑 B 成功 → redo | redo 栈清空 |
| HIST-T04 | 显示查询 → undo | 查询保留两栈及禁用状态，仍可撤销最近编辑 |
| HIST-T05 | init/read/save/canvas 修改成功 → undo/redo | 清空两栈，二者均返回 `undo not allowed after io command` |
| HIST-T06 | 文档操作成功 → 成功编辑 → undo | 可以撤销新编辑，保留文档操作结果 |
| HIST-T07 | 一条 `group` 命令 → undo | 整个分组一次恢复 |
| HIST-T08 | move → canvas 查询 → undo | 撤销移动，查询未写入历史 |
| HIST-T09 | move → undo → canvas 查询 → redo | 原移动正常重做，查询未清空 redo |
| HIST-T10 | 文档操作成功 → canvas 查询 → undo/redo | 查询不能解除禁用 |
| HIST-T11 | 文档操作成功 → 编辑失败 → undo/redo | 失败编辑不能解除禁用 |
| HIST-T12 | canvas 修改失败，已有 undo 和 redo | 尺寸、两栈内容及禁用状态均保持原样 |
| HIST-T13 | 文档操作成功 → 新编辑 → 撤销全部新编辑 → 再次 undo | 报空栈错误，不能跨边界撤销 |
| HIST-T14 | canvas 设置为原尺寸 | 仍是成功修改操作，清栈并禁用历史 |
| HIST-T15 | 替换当前文档 → 新文档编辑 → undo/redo | 只操作新文档，不恢复旧文档历史 |
| HIST-T16 | 历史已禁用 → 文档操作失败或查询失败 | 文档和禁用状态均保持原样 |
| HIST-T17 | 非法移动/溢出前已有 undo 和 redo | 两栈数量、栈顶命令身份和完整文档均不变，原 redo 仍产生正确结果 |
| HIST-T18 | 溢出失败 → 后续正常编辑 → undo | 后续快照不含非有限数，撤销正常 |
| HIST-T19 | 同一缩放命令首次溢出失败，修正原始数据后重试 | 可以重新执行及撤销，失败未将命令标记为已执行 |
| HIST-T20 | 小数移动/缩放反复 undo/redo | 精确恢复保存的快照，不使用反向运算累积误差 |

## 4. 层级和顺序测试

| ID | 场景 | 断言 |
|---|---|---|
| HIER-T01 | group 两个根级图形 | 新 Group 出现，两个图形成为子节点 |
| HIER-T02 | group 位于不同父容器的图形 | 摘出后收入新容器，原相对顺序保持 |
| HIER-T03 | group 容器及其后代 | 拒绝循环层级 |
| HIER-T04 | ungroup 普通子容器 | 子节点提升到原父级，位置正确 |
| HIER-T05 | ungroup 顶层容器 | 返回顶层容器错误 |
| HIER-T06 | addto | 目标成为容器最后一个子节点 |
| HIER-T07 | front | 目标成为视觉最上层，位于同级列表末尾 |
| HIER-T08 | back | 目标成为视觉最底层，位于同级列表开头 |
| HIER-T09 | 任意层级操作失败 | 原树完全保持不变 |
| HIER-T10 | 根级或嵌套级叶子/Group 排序 | 其他同级对象相对顺序、组内顺序、属性、父级及归属不变 |
| HIER-T11 | front/back → undo → redo → undo | 每次准确恢复对应文档顺序 |
| HIER-T12 | 单节点或已在目标位置时 front/back | 顺序不变，仍产生一个 undo 单元；新成功命令清空 redo |
| HIER-T13 | 两个重叠矩形写出 SVG 后排序 | front 的矩形在重叠区域覆盖另一矩形，back 后位于下方（SVG IO 完成后执行） |
| HIER-T14 | 已挂载 Group 的公开 add/insert/remove，包括旧 Document 参数 | 拒绝；原树、待加入节点及归属保持不变 |
| HIER-T15 | 跨文档引用或同 ID 的其他对象 | Document 入口按对象身份拒绝错误操作，两棵树均不变 |
| HIER-T16 | 子列表的返回值被调用方改写 | 不改变文档或 Group 的内部子列表 |
| HIER-T17 | 整棵子树摘除、转移和恢复 | 所有后代归属同步改变；已转入其他文档时不能被旧文档直接恢复 |
| HIER-T18 | create/group/move/scale/set/addto/front/back/ungroup/delete 混合序列 | 每步检查不变量，完整 undo/redo 精确恢复结构、属性和对象身份 |

## 5. CLI 解析测试

| ID | 输入 | 断言 |
|---|---|---|
| PARSER-T01 | `create rect r1 10 20 100 50 red` | 类型、ID、数值和颜色解析正确 |
| PARSER-T02 | `create text t1 20 40 "My Diagram"` | 文本作为一个带空格参数 |
| PARSER-T03 | `create rect r1 ... in node1` | `in` 子句被识别为父容器 |
| PARSER-T04 | `# comment` | 返回注释/跳过结果 |
| PARSER-T05 | 多余参数 | 返回错误，不执行命令 |
| PARSER-T06 | 缺少参数 | 返回错误，不执行命令 |
| PARSER-T07 | 未知命令 | 以 `error:` 开头，不改变状态 |
| PARSER-T08 | 非法数字 | 以 `error:` 开头，不改变状态 |
| PARSER-T09 | `box` | 返回规定的 unknown shape type 错误 |
| PARSER-T10 | `init`、`init 400 200`、`init 400` | 前两者成功；单参数报 `error: usage: init [w h]`，不改变文档、来源路径或历史 |
| PARSER-T11 | `create rect r1 0 0 10 10 #4a90d9 # 蓝色` | 执行标记前的创建，保留颜色；同样保留文字/路径内的 #；纯注释/查询不影响历史，标记前错误仍保持原子性 |

S6 已用 `cli-parser.test.ts` 的 16 个用例和 `cli-commands.test.ts` 的 67 个用例覆盖上述解析及接线，另含空文字、中文/空格路径、反斜杠、转义、未闭合/中段引号、颜色、文字中的 in/#、合法 ID in、严格数值、所有命令参数数量和失败历史不变。init 按用户要求仅接受零或两个参数，新增三个回归覆盖尚无文档、已读入文件且两栈非空、历史已禁用的失败状态。注释功能另新增 5 个分词和 3 个命令回归，实际进程的带注释保存会话见 CLI 端到端用例。

## 6. 文档和 SVG IO 测试

### 6.1 序列化

| ID | 场景 | 断言 |
|---|---|---|
| IO-T01 | 空 800×600 文档保存 | 根 SVG 尺寸正确 |
| IO-T02 | 保存六种图形 | 标签、ID、属性和文本内容正确 |
| IO-T03 | 保存嵌套 Group | `<g>` 嵌套关系和子顺序正确 |
| IO-T04 | 可选 fill/stroke 省略 | 不产生额外属性 |
| IO-T05 | 保存后浏览器打开 | 输出是可渲染 SVG |

### 6.2 读回和 round-trip

| ID | 场景 | 断言 |
|---|---|---|
| IO-T10 | 保存后读回 | 画布、结构、属性和顺序保持一致 |
| IO-T11 | 外部 SVG 缺失 ID | 自动分配 ID 并打印 warning |
| IO-T12 | 外部 SVG 含嵌套 Group | 子树正确恢复 |
| IO-T13 | 文件不存在 | 返回 cannot read file 错误 |
| IO-T14 | 目标不可写 | 返回 cannot write file 错误 |
| IO-T15 | read/save 成功后 undo/redo | 清空两栈并返回文档命令历史错误；失败时文档和历史均保留 |

建议注入 `FileSystem` 和 `SvgCodec` 接口，在单元测试中使用内存实现，避免测试依赖真实路径。

S5 已以同步 FileSystem、SvgReaderPort、SvgWriterPort 落地上述边界。新增 svg-io（16）、document-session（16）、node-filesystem（3）共 35 个定向用例，加上已有 history-policy 的 11 个，共 46 个通过。覆盖 IO-T01 至 T04、T10 至 T15 对应的应用/IO 行为，以及保存路径、非法 SVG、ID 防冲突和序列化失败；CLI 的实际输出仍待 S6。IO-T05 通过独立 HTTP 预览入口完成六组样例的 Edge 自动验证，包含加载、DOM、文字、继承样式及截图像素检查。记录见 [S5.md](./S5.md)。

S5 当时按用户要求运行了完整 `npm test`：10 个文件、235 个测试全部通过；类型检查与构建通过。S5 浏览器专项独立通过，不计入 235 个单元/集成用例。S6 随后补齐 CLI 输出和真实完整会话，并以实际 CLI 保存结果完成五组 Edge 专项；含 init 和注释修订后的当前总数为 328 个。

## 7. 显示命令测试

| ID | 命令 | 断言 |
|---|---|---|
| VIEW-T01 | `tree` | 显示画布尺寸、根节点、几何属性和层级符号 |
| VIEW-T02 | `tree node1` | 只显示 node1 子树 |
| VIEW-T03 | `show r1` | 显示类型、父级和关键属性 |
| VIEW-T04 | `help` | 包含所有命令和语法 |
| VIEW-T05 | 显示命令后 undo | 不改变 undo 栈 |

S6 的 `shape-presentation.test.ts` 验证六类图形的完整树形输出、几何/父级/显式样式、空树/子树、文档顺序及展示不修改对象；`cli-commands.test.ts` 验证 help 的完整语法、查询后 undo/redo 栈顶与禁用状态保持。

## 8. 错误原子性测试

每个错误场景都要额外断言：

- 图形数量不变；
- 父子关系不变；
- 属性不变；
- 当前路径和画布尺寸不变；
- undo/redo 栈没有增加错误命令。

重点场景：

```text
重复 ID
不存在的图形
不存在或非容器的 in 目标
未知图形类型
非法 scale 因子
非法 set 属性
容器收入自己的后代
顶层容器 ungroup
文件不存在或不可写
未 init/read 就执行编辑或显示命令
```

## 9. 端到端测试草稿

### E2E-T01：两节点流程图

回放原实验文档第 6.1 节的流程图会话，断言：

1. `init` 创建 800×600 空文档；
2. `flowchart`、`node1`、`node2` 的父子关系正确；
3. 两个矩形和两个文字节点的属性正确；
4. `arrow1` 位于 `flowchart` 下；
5. `move node2 0 100` 会整体移动 node2；
6. `undo` 恢复 node2 和其子图形的位置；
7. `set process-label text ...` 只更新文本；
8. `save flowchart.svg` 生成可打开文件。

### E2E-T02：读写和历史边界

```text
init 400 200
create rect r1 10 20 100 50 red
save demo.svg
undo
```

断言最后一条命令返回文档命令历史错误，且 `r1` 仍然存在。

### S6 已执行的端到端覆盖

`cli-repl.test.ts` 的 7 个用例中，真实子进程分别回放原文第 6 节 transcript、第 6.1 节流程图，以及剩余层级/显示/文档命令路线；同时检查 stdout、stderr、退出码、实际保存文件和读回模型。流程图追加 undo/redo/undo 后检查坐标，再修改中文并使用带空格/中文文件名保存。另有带行末注释的真实保存会话，验证颜色、文字/文件名中的 #、in 与 undo/redo，并用交互子进程验证首个提示符后保持运行、错误后继续和 EOF 退出。

`npm run preview:s6` 使用真实 CLI 子进程生成流程图、读回、front、back、外部导入五组输出，通过独立 HTTP 服务供 Edge 检查。已验证图片加载、SVG DOM、中文、父子顺序、保存前后内容一致及真实截图像素；控制台无 warning/error。该专项单独执行，不计入 Vitest 数量。

## 10. Test → Code → Refactor 顺序

每个功能按以下步骤推进：

1. 从本文件选择一个失败的测试规格；
2. 先写测试并确认它确实失败；
3. 实现最小领域或命令逻辑；
4. 运行相关测试并达到绿色；
5. 在测试保护下重构；
6. 再运行完整测试集。

当前已实现框架 smoke test、领域、Command、层级、内存历史、移动/溢出原子性、接口保护与混合命令回放；S5 完成 SVG IO、文档会话及真实文件失败检查，S6 完成 CLI 解析、全命令接线、展示和实际进程会话。S7 补齐属性和命令状态矩阵、CLI 完整恢复、架构检查，并先复现后修复文本回车的读写问题；2026-10-31 又完成非负尺寸、半径和描边宽度回归修复。S8 重跑 531 个测试、类型检查、构建和 lint，通过构建产物会话与浏览器核验；文档和证据随最终版本交付，以 final 标签标识。S5/S6 的 Edge 专项分别保留历史记录。
