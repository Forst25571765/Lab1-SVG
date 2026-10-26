# Lab1 Phase 1 实现计划

## 1. 目标和范围

实现一个 TypeScript 面向对象的 SVG 命令行编辑器，提示符为 `svg>`。

本阶段必须支持：

- 文档命令：`init`、`read`、`save`、`canvas`；
- 图形命令：`create`、`delete`、`move`、`scale`、`set`；
- 层级命令：`group`、`ungroup`、`addto`、`front`、`back`；
- 显示命令：`tree`、`show`、`help`；
- 历史命令：`undo`、`redo`；
- SVG 读写、缺失 ID 自动补全和规定格式的错误输出；
- Command 模式和叶子图形/容器统一操作的 Composite 语义。

`box` 属于后续插件化阶段。本阶段的 `create box` 应报告未知图形类型，不实现 `box` 插件。

## 2. 前置准备

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

## 3. 目标架构

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
cli → application → commands → domain
                         ↓
                       ports
                         ↑
                  infrastructure
```

规则：

- `domain` 不依赖 CLI、文件系统或 XML 库；
- `commands` 保存参数和撤销状态，业务规则由领域对象完成；
- `application` 维护 undo/redo 栈和文档命令的历史策略；
- `cli` 只负责输入、解析和输出；
- `infrastructure` 通过接口实现外部技术细节；
- 名字分派只保留在 `CommandRegistry` 和 `ShapeFactory`。

## 4. 分阶段实施

### 阶段 1：项目脚手架和验收规格

工作内容：

- 初始化 TypeScript、测试框架和 Git；
- 建立 CLI 入口；
- 把实验中的典型会话转成测试草稿；
- 记录命令语法、成功输出和错误输出。

验证：

- CLI 可以启动；
- 测试运行器可以执行一个示例测试；
- README 和架构文档已提交。

### 阶段 2：领域模型和图形工厂

工作内容：

- 实现 `Shape` 抽象；
- 实现 `Rect`、`Circle`、`Ellipse`、`Line`、`Text`、`Group`；
- 实现 `Document` 和画布尺寸；
- 实现唯一 ID、父子关系和 `ShapeFactory`；
- 实现图形的几何属性和统一操作。

验证：

- 每种图形能创建并保存正确属性；
- `Group` 能递归移动和缩放子图形；
- 重复 ID、未知类型和非法父容器有明确错误；
- 领域层测试不依赖 CLI 或真实文件。

### 阶段 3：Command 和历史管理

工作内容：

- 定义 `Command` 接口；
- 实现 `CreateCommand`、`DeleteCommand`、`MoveCommand`、`ScaleCommand`、`SetCommand`；
- 实现 `CommandExecutor` 和 `CommandHistory`；
- 建立 undo 栈和 redo 栈。

验证：

- 每条编辑命令执行后状态正确；
- `undo` 精确恢复执行前状态；
- `redo` 精确重做；
- undo 后出现新编辑时，redo 栈清空；
- 删除命令能恢复完整子树及原位置。

### 阶段 4：层级和 z-order 操作

工作内容：

- 实现 `group`、`ungroup`、`addto`；
- 实现 `front`、`back`；
- 检查容器与后代之间的非法收编；
- 保持同级元素的相对顺序。

验证：

- `tree` 能正确显示层级；
- group 和 ungroup 是一个 undo 单元；
- 顶层容器不能被非法 ungroup；
- 容器移动时所有子孙保持相对位置。

### 阶段 5：SVG 读写和文档命令

工作内容：

- 实现 `SvgReader` 和 `SvgWriter`；
- 实现 `read`、`save`、`canvas`；
- 处理外部 SVG 缺失 ID 的自动分配和 warning；
- 隔离真实文件系统和 XML 解析库；
- 实现文档命令执行后禁止 undo/redo 的规则。

验证：

- 保存出的 SVG 能在浏览器中打开；
- 读入后树结构、属性和顺序保持一致；
- 缺失 ID 会自动生成且不重复；
- 文件不存在和不可写时输出规定错误；
- `save` 后执行 `undo` 会得到规定错误。

### 阶段 6：CLI 解析、帮助和错误处理

工作内容：

- 实现 `CommandParser`；
- 支持注释行、引号参数和 `in <containerId>`；
- 实现 `CommandRegistry`；
- 实现 `tree`、`show`、`help`；
- 统一输出成功摘要和 `error:` 错误。

验证：

- 能逐行回放实验中的典型会话；
- 文本内容中的空格不会被错误拆分；
- 命令失败时文档状态不改变；
- `tree` 和 `show` 输出包含规定的几何属性。

### 阶段 7：综合测试和重构

工作内容：

- 补齐领域层、命令层、应用层和 CLI 集成测试；
- 使用内存文件系统替代真实磁盘进行大部分测试；
- 检查依赖方向和名字分派位置；
- 根据测试结果重构重复代码和过大的类。

验证：

- 所有测试通过；
- TypeScript 构建和代码检查通过；
- 领域层没有 CLI 或基础设施依赖；
- 代码中没有到处的 `switch(tag)` 或具体类型分支。

### 阶段 8：文档、发布和最终验收

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
- 远程仓库包含分阶段提交和 `final` tag。

## 5. 测试清单

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

## 6. Git 提交节奏

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

## 7. Go / Pivot / No-go 条件

- **Go**：当前阶段测试和构建通过，模块依赖符合规则，可以进入下一阶段；
- **Pivot**：XML 库、文件接口或命令参数设计不适合当前需求时，保留接口边界并替换内部实现；
- **No-go**：基础流程图、SVG round-trip 或 undo/redo 仍然失败时，暂停新功能，先修复核心行为。

