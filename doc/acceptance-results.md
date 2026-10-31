# Lab1 Phase 1 阶段一验收结果

> 本文件保留 S1 当时的历史状态，其中“尚未实现”不代表当前工程。当前完整验收、证据和发布状态见 [S8.md](./S8.md)。

## 记录范围

- 验收日期：2026-10-28（Asia/Shanghai）
- 验收对象：TypeScript/Vitest 脚手架和最小 CLI REPL
- 原始规范：[`phase_cli_1.md`](./phase_cli_1.md)
- 验收规格：[`acceptance-spec.md`](./acceptance-spec.md)
- 测试草稿：[`test-draft.md`](./test-draft.md)

本记录只报告当前已经实际检查的结果。领域模型、Command、SVG IO 和具体业务命令尚未实现，因此对应验收项不标记为通过。

## 1. 阶段一结果

| 项目 | 结果 | 证据 |
|---|---|---|
| TypeScript 配置可用 | PASS | `npm run typecheck` 退出码 0 |
| TypeScript 构建可用 | PASS | `npm run build` 退出码 0 |
| Vitest 可运行 | PASS | `npm test`：1 个测试文件、1 个测试通过 |
| CLI 入口存在 | PASS | `npm run cli` 可以启动 `src/main.ts` |
| REPL 显示 `svg>` | PASS | REPL 启动时输出 `svg> ` |
| REPL 等待下一行输入 | PASS | 子进程在首个提示符后保持运行，写入下一行后继续处理 |
| 空行处理 | PASS | 输入空行后再次显示 `svg>`，无业务错误 |
| `#` 注释处理 | PASS | 输入 `# comment` 后再次显示 `svg>`，无业务错误 |
| 未实现命令的临时错误 | PASS | 输出 `error: command not implemented: <输入>` 并继续循环 |
| EOF 结束 | PASS | 输入结束后进程以退出码 0 结束 |
| 典型会话完整回放 | NOT READY | 需要领域命令、Command 和 SVG IO 实现 |
| 具体命令验收 | NOT READY | `init`、`create`、`move` 等尚未实现 |

## 2. 实际检查摘要

### 类型检查、构建和测试

```text
npm run typecheck  PASS
npm run build      PASS
npm test           PASS: 1 test file, 1 test
```

### REPL 行为

已检查以下输入：

```text
空行
# comment
help
init 800 600
EOF
```

当前预期结果：

- 空行和注释只重新显示提示符；
- `help` 和 `init 800 600` 尚未有业务实现，因此输出 `error: command not implemented: ...`；
- REPL 在收到下一行前保持运行；
- EOF 后正常结束。

## 3. 尚未验收的内容

以下项目属于后续阶段，当前不能宣称通过：

- `init` 的真实文档创建和默认 800×600；
- 六种图形创建和属性白名单；
- `move`、`scale`、`set`、`delete`；
- `group`、`ungroup`、`addto`、`front`、`back`；
- `undo`、`redo` 和文档命令历史边界；
- `read`、`save`、`canvas` 和缺失 ID warning；
- `tree`、`show`、`help` 的规定输出；
- 原文档错误表的完整实现；
- SVG round-trip 和浏览器预览；
- 两节点流程图端到端会话。

## 4. Git 状态

本次验收没有自动提交或推送 Git。当前工作区包含未提交的：

- `src/main.ts` 的最小 REPL 实现；
- `README.md`、`doc/README.md`、`doc/implementation-plan.md` 的文档更新；
- `doc/acceptance-spec.md`、`doc/test-draft.md`、`doc/acceptance-results.md`。

只有在用户明确要求提交时，才创建 Git commit。

## 5. 阶段结论

阶段一的脚手架、测试环境和最小 REPL 验收通过；阶段一的验收规格和测试草稿已经形成。具体业务命令仍处于后续实现阶段，下一步应进入阶段二的领域模型设计和测试，而不是把当前的临时错误视为业务功能完成。
