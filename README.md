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
└── main.ts                 # 依赖装配和逐行 REPL 入口
tests/                      # 单元测试和集成测试
doc/README.md               # 实验要求对应的架构与过程文档
doc/phase_cli_1.md          # Lab1 原始实验文档
doc/acceptance-spec.md      # 命令、错误和端到端验收规格
doc/test-draft.md           # 分层测试草稿
doc/acceptance-results.md   # S1 历史验收记录；当前结果见各阶段 S*.md
```

## 当前进度

S1–S6 已实现：领域模型、编辑与历史管理、SVG 读写，以及全部 19 条 CLI 命令、tree/show/help、统一摘要和错误输出。全量 328 个测试、类型检查、构建通过，实际 CLI 输出的 Edge 浏览器验收已有通过记录。详细实现与补充语义见 [doc/S6.md](./doc/S6.md)，SVG 支持边界见 [doc/S5.md](./doc/S5.md)。S7 综合评审和 S8 最终发布仍在后续范围；本次按用户授权将 S6 统一提交到本地，不推送或创建 tag。

## 启动 CLI

```text
npm run cli
```

在 `svg>` 提示符后逐行输入：

```text
init 400 200
create g scene
create rect r1 20 30 120 60 #4a90d9 in scene
create text t1 35 65 "开始" in scene
tree
move scene 20 0
undo
save "示例 drawing.svg"
```

`init` 只允许不传尺寸（默认 800×600）或同时提供宽高，单参数会报用法错误。`help` 可在初始化前查看全部语法；空行和以 `#` 开头的整行会跳过；命令后可用独立的 `#` 添加行末注释，例如 `move r1 10 0 # 向右移动`，颜色和引号内的 # 保留。保存成功会清空旧历史，下一条成功编辑开启新历史。Windows 终端按 Ctrl+Z 后回车结束输入，其他终端可发送 EOF。

## 目标范围

- 支持 `init`、`read`、`save`、`canvas`；
- 支持图形创建、删除、移动、缩放、属性设置和层级操作；
- 支持 `tree`、`show`、`help`；
- 使用 Command 模式实现 undo/redo；
- 使用面向对象模型统一处理叶子图形和 `g` 容器；
- `box` 属于后续插件化阶段，本阶段暂不实现。

## S5 HTTP 预览

```text
npm run preview:s5
```

启动后打开 [S5 HTTP 浏览器验收页](http://127.0.0.1:8765/)。服务仅监听本机回环地址，提供六组重新生成的测试样例；不开放项目目录。终端运行期间保持服务，按 Ctrl+C 停止。需要更换端口时可设置 `S5_PREVIEW_PORT`。

六组样例的 Edge 自动检查已通过，真实截图与报告保存在 `tmp/s5-http-preview/`，详见 [S5.md](./doc/S5.md)。预览命令负责生成样例和启动服务，浏览器检查独立执行。

## S6 实际 CLI 输出预览

```text
npm run preview:s6
```

打开 [S6 HTTP 浏览器验收页](http://127.0.0.1:8766/)，查看由真实 CLI 子进程创建、修改、保存和读回的五组 SVG。服务仅监听本机，按 Ctrl+C 停止；可设置 `S6_PREVIEW_PORT` 更换端口。命令会生成文件并启动预览，浏览器检查独立执行。实际 Edge 的 DOM、中文、顺序和截图像素检查已通过，证据在 `tmp/s6-cli-preview/`，详见 [S6.md](./doc/S6.md)。

## 开发方式

按 `Test → Code → Refactor` 迭代，每个阶段在用户明确授权后单独提交 Git commit。完成全部功能和验证并获得发布授权后，在最终提交上创建 `final` tag。


详细的分阶段实现、验收条件、测试清单和 Git 提交节奏见 [doc/implementation-plan.md](<C:/Users/Lenovo/Desktop/高级软件开发技术/lab1/doc/implementation-plan.md>)。

