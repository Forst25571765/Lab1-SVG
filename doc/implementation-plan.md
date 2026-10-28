# Lab1 实现计划

## 1. 目标和范围

实现一个 TypeScript 面向对象的 SVG 命令行编辑器，提示符为 `svg>`。
测试建议遵循课程中的 Test → Code → Refactor
本计划最终必须支持：

- 文档命令：`init`、`read`、`save`、`canvas`；
- 图形命令：`create`、`delete`、`move`、`scale`、`set`；
- 层级命令：`group`、`ungroup`、`addto`、`front`、`back`；
- 显示命令：`tree`、`show`、`help`；
- 历史命令：`undo`、`redo`；
- SVG 读写、缺失 ID 自动补全和规定格式的错误输出；
- Command 模式和叶子图形/容器统一操作的 Composite 语义。

`box` 属于后续插件化步骤。本计划的 `create box` 应报告未知图形类型，不实现 `box` 插件。

## 2. 原文档是行为规范

本计划负责安排实现顺序，实验原文 [phase_cli_1.md](<C:/Users/Lenovo/Desktop/高级软件开发技术/lab1/doc/phase_cli_1.md>) 负责规定最终行为。实现任何命令前，都要先查阅原文档对应章节；如果本计划与原文档出现冲突，以原文档为准，并在过程记录中说明修订原因。

需要持续对照的约定包括：

- `svg>` 提示符、逐行 REPL、`#` 注释和带空格参数的引号规则；
- SVG 坐标系、唯一 ID、缺失 ID 自动补全和 warning；
- 成功输出摘要、`error:` 前缀和命令失败时状态不改变；
- 每个命令的精确语法、参数顺序、默认值和支持的图形类型；
- `set` 属性白名单及各图形的几何属性；
- 文档类、编辑类、显示类命令的 undo/redo 规则；
- 所有规定错误，包括文件错误、ID 错误、非法层级、非法缩放和无文档状态；
- `tree`、`show` 的输出格式和典型会话；
- `box` 的扩展边界：当前步骤只报告未知类型，不实现插件。

## 3. 前置准备

1. 初始化 TypeScript 项目和测试框架。
2. 配置 `build`、`test`、`lint` 和 `cli` 脚本。
3. 创建 `src/`、`tests/`、`doc/` 目录。
4. 初始化 Git 仓库，准备 GitHub 或 Gitee 远程仓库。
5. 把实验命令表、错误约定和典型会话整理成验收清单。

前置准备的验收条件：

- CLI 能启动并显示 `svg>`；
- 测试命令能被执行；
- TypeScript 构建命令能执行；
- 第一笔提交只包含脚手架和文档，不包含未验证的大量实现。

## 4. 目标架构

```text
src/
├── domain/                 # 文档、画布、图形和容器领域模型
├── commands/               # Command 接口和具体命令
├── application/            # 命令执行和历史管理
│   └── ports/              # 文件、SVG 编解码和输出接口
├── infrastructure/         # 文件系统、SVG 解析和序列化实现
├── cli/                    # REPL、解析器、注册表和帮助信息
└── main.ts                 # 依赖装配入口
tests/                      # 单元测试和集成测试
doc/                        # 架构、过程和质量文档
```

依赖方向：

```text
main.ts（Composition Root）
├── cli ───────────────> application ─────> commands ─────> domain
├── application ───────> ports
└── infrastructure ────implements─────────> ports
```

规则：

- `domain` 不依赖 CLI、文件系统或 XML 库；
- `commands` 保存参数和撤销状态，业务规则由领域对象完成；
- `application` 维护 undo/redo 栈和文档命令的历史策略；
- `cli` 只负责输入、解析和输出；
- `infrastructure` 通过接口实现外部技术细节；
- 名字分派只保留在 `CommandRegistry` 和 `ShapeFactory`。

## 5. 分步骤实施

### 步骤记录文档约定

每完成一个步骤，都要在 `doc/` 下建立一个以 `S` 和步骤编号开头的独立记录文件，不把多个步骤合并到同一份进度总表中。

| 步骤 | 对应记录 |
|---|---|
| 步骤 1 | `doc/S1.md` |
| 步骤 2 | `doc/S2.md` |
| 步骤 3 | `doc/S3.md` |
| 步骤 4 | `doc/S4.md` |
| 步骤 5 | `doc/S5.md` |
| 步骤 6 | `doc/S6.md` |
| 步骤 7 | `doc/S7.md` |
| 步骤 8 | `doc/S8.md` |

每份步骤记录至少包含：

- 本步骤新增或修改的代码、配置和文档；
- 已实现的功能以及明确保留到后续步骤的内容；
- 实际执行过的测试、构建或检查命令；
- 每项检查的结果和必要的失败说明；
- 当前 Git 提交状态，以及已经提交时的 commit hash。

### 步骤 1：项目脚手架和验收规格

工作内容：

- 初始化 TypeScript、测试框架和 Git；
- 建立 CLI 入口；
- 把实验中的典型会话转成测试草稿；
- 记录命令语法、成功输出和错误输出。
- 形成 `doc/acceptance-spec.md` 和 `doc/test-draft.md`，作为后续实现的验收规格和测试设计。
- 形成 `doc/acceptance-results.md`，记录当前步骤真实执行过的检查结果，并区分通过项和未就绪项。

原文档参照：通读第 2 节通用约定、第 3 节命令总表、第 4.2 节错误信息约定和第 6 节典型会话。

验证：

- CLI 可以启动；
- 测试运行器可以执行一个示例测试；
- README 和架构文档已提交。

### 步骤 2：领域模型和图形工厂

工作内容：

- 实现 `Shape` 抽象；
- 实现 `Rect`、`Circle`、`Ellipse`、`Line`、`Text`、`Group`；
- 实现 `Document` 和画布尺寸；
- 实现 `init [w] [h]` 对应的文档创建逻辑：使用指定尺寸或默认的 800×600 创建空当前文档；
- 实现唯一 ID、父子关系和 `ShapeFactory`；
- 实现图形的几何属性和统一操作。

原文档参照：第 0 节 SVG 格式、第 2 节 ID/坐标/状态约定、第 4.1 节图形参数和属性白名单、第 5 节显示属性要求。

验证：

- 每种图形能创建并保存正确属性；
- `init` 能创建指定尺寸的空画布，省略尺寸时使用 800×600；
- `Group` 能递归移动和缩放子图形；
- 重复 ID、未知类型和非法父容器有明确错误；
- 领域层测试不依赖 CLI 或真实文件。

### 步骤 3：Command 和历史管理

工作内容：

- 定义 `Command` 接口；
- 实现 `CreateCommand`、`DeleteCommand`、`MoveCommand`、`ScaleCommand`、`SetCommand`；
- 实现 `CommandExecutor` 和 `CommandHistory`；
- 建立 undo 栈和 redo 栈。

原文档参照：第 3 节编辑命令和撤销重做命令、第 4.2 节命令错误、第 4.3 节 undo/redo 粒度；具体命令的撤销状态按原文档逐条设计。

验证：

- 每条编辑命令执行后状态正确；
- `undo` 精确恢复执行前状态；
- `redo` 精确重做；
- undo 后出现新编辑时，redo 栈清空；
- 删除命令能恢复完整子树及原位置。

### 步骤 4：层级和 z-order 操作

工作内容：

- 实现 `group`、`ungroup`、`addto`；
- 实现 `front`、`back`；
- 检查容器与后代之间的非法收编；
- 保持同级元素的相对顺序。

原文档参照：第 3 节 `group`、`ungroup`、`addto`、`front`、`back`，第 4.2 节非法容器关系错误，以及第 6.1 节流程图示例。

验证：

- `tree` 能正确显示层级；
- group 和 ungroup 是一个 undo 单元；
- 顶层容器不能被非法 ungroup；
- 容器移动时所有子孙保持相对位置。

### 步骤 5：SVG 读写和文档命令

工作内容：

- 实现 `SvgReader` 和 `SvgWriter`；
- 实现 `read`、`save`、`canvas`；
- 明确 `init`、`read`、`save`、`canvas` 都属于文档命令，执行后禁止 undo/redo，直到下一条编辑命令；
- 处理外部 SVG 缺失 ID 的自动分配和 warning；
- 隔离真实文件系统和 XML 解析库；
- 实现文档命令执行后禁止 undo/redo 的规则。

原文档参照：第 0 节 SVG 文件格式和预览，第 3 节文档命令，第 4.2 节文件错误，第 4.3 节文档命令的历史边界，以及第 6 节 `read`/`save` 会话。

验证：

- 保存出的 SVG 能在浏览器中打开；
- 读入后树结构、属性和顺序保持一致；
- 缺失 ID 会自动生成且不重复；
- 文件不存在和不可写时输出规定错误；
- `save` 后执行 `undo` 会得到规定错误。

### 步骤 6：CLI 解析、帮助和错误处理

工作内容：

- 实现 `CommandParser`；
- 支持 `init [w] [h]`、注释行、引号参数和 `in <containerId>`；
- 实现 `CommandRegistry`；
- 实现 `tree`、`show`、`help`；
- 统一输出成功摘要和 `error:` 错误。

原文档参照：第 2 节输入约定，第 3 节完整命令语法，第 4.1 节参数规则，第 4.2 节完整错误表，第 5 节输出格式；实现后逐条回放第 6 节典型会话。

验证：

- 能逐行回放实验中的典型会话；
- 文本内容中的空格不会被错误拆分；
- 命令失败时文档状态不改变；
- `tree` 和 `show` 输出包含规定的几何属性。

### 步骤 7：综合测试和重构

工作内容：

- 补齐领域层、命令层、应用层和 CLI 集成测试；
- 使用内存文件系统替代真实磁盘进行大部分测试；
- 检查依赖方向和名字分派位置；
- 根据测试结果重构重复代码和过大的类。

原文档参照：完整实验文档。测试矩阵必须覆盖命令总表、错误表、undo/redo 规则、树形输出和典型会话，不能只测试正常路径。

验证：

- 所有测试通过；
- TypeScript 构建和代码检查通过；
- 领域层没有 CLI 或基础设施依赖；
- 代码中没有到处的 `switch(tag)` 或具体类型分支。

### 步骤 8：文档、发布和最终验收

工作内容：

- 完成 `doc/README.md` 的过程记录、一致性自查和质量保证；
- 检查实际目录是否与架构方案一致；
- 审查最终 `git diff` 和提交历史；
- 在最终提交上创建 `final` tag；
- 推送代码和 tag 到远程仓库。

最终验收条件：

- 功能命令和错误约定完整；
- undo/redo 行为正确；
- SVG 文件可以读回并在浏览器预览；
- 测试、构建和代码检查全部通过；
- `doc/README.md` 与实际代码一致；
- 远程仓库包含分步骤提交和 `final` tag。

## 6. 测试清单

### 领域层

- 六种内置图形的创建和属性；
- 图形移动、缩放和属性设置；
- Group 的递归操作；
- 唯一 ID 和父子关系。

### 命令层

- 每条编辑命令的 `execute`；
- 每条编辑命令的 `undo`；
- `redo` 和 redo 栈清空；
- 删除、分组和层级调整的状态恢复。

### CLI 和 IO

- 引号文本和注释；
- `in` 子句；
- 缺失 ID 自动补全；
- 文件不存在、ID 不存在、未知类型和非法缩放；
- SVG 保存和读回。

### 集成场景

至少完整回放：

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
move node2 0 100
undo
redo
save flowchart.svg
```

## 7. Git 提交节奏

建议按以下粒度提交：

```text
chore: scaffold TypeScript CLI and tests
docs: define acceptance matrix and architecture
feat: add SVG shape model and factory
feat: implement create show tree
feat: add command executor and undo redo
feat: implement hierarchy and z-order operations
feat: implement SVG read save
feat: complete parser and error handling
test: add integration and regression coverage
docs: complete README and final self-check
```

每次提交前运行测试和构建。发现实现方向错误时，先修正架构或测试，再继续添加功能。

## 8. Go / Pivot / No-go 条件

- **Go**：当前步骤测试和构建通过，模块依赖符合规则，可以进入下一步骤；
- **Pivot**：XML 库、文件接口或命令参数设计不适合当前需求时，保留接口边界并替换内部实现；
- **No-go**：基础流程图、SVG round-trip 或 undo/redo 仍然失败时，暂停新功能，先修复核心行为。

