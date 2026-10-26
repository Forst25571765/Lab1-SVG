# SVG 编辑器（Lab1 Phase 1）

这是《高级软件开发技术》Lab1 Phase 1 的 TypeScript 命令行 SVG 编辑器工程。

## 目录

```text
src/
├── domain/                 # SVG 文档、图形和容器领域模型
├── commands/               # Command 接口和具体命令
├── application/            # 命令执行、历史记录和应用协调
│   └── ports/              # 文件、SVG 编解码和输出接口
├── infrastructure/         # 文件系统、SVG 读写等外部技术实现
├── cli/                    # REPL、命令解析和帮助信息
└── main.ts                 # 依赖装配入口（待实现）
tests/                      # 单元测试和集成测试
doc/README.md               # 实验要求对应的架构与过程文档
doc/phase_cli_1.md          # Lab1 原始实验文档
```

## 实现范围

- 支持 `init`、`read`、`save`、`canvas`；
- 支持图形创建、删除、移动、缩放、属性设置和层级操作；
- 支持 `tree`、`show`、`help`；
- 使用 Command 模式实现 undo/redo；
- 使用面向对象模型统一处理叶子图形和 `g` 容器；
- `box` 属于后续插件化阶段，本阶段暂不实现。

## 开发方式

按 `Test → Code → Refactor` 迭代，每个阶段单独提交 Git commit。完成全部功能和验证后，在最终提交上创建 `final` tag。


详细的分阶段实现、验收条件、测试清单和 Git 提交节奏见 [doc/implementation-plan.md](<C:/Users/Lenovo/Desktop/高级软件开发技术/lab1/doc/implementation-plan.md>)。

