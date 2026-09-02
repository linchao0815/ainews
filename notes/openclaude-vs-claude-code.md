# OpenClaude (Gitlawb/openclaude) 与 Claude Code 对比分析

分析对象：https://github.com/Gitlawb/openclaude
分析日期：2026-09-02

## 一、核心发现：源码来源

**`Gitlawb/openclaude` 不是一个独立实现，而是基于 Anthropic 私有闭源 Claude Code CLI 源码的未授权衍生项目。**

依据：该仓库自己的 `LICENSE` 文件（NOTICE 部分）明确声明：

> This repository contains code derived from Anthropic's Claude Code CLI.
> The original Claude Code source is proprietary software:
>   Copyright (c) Anthropic PBC. All rights reserved.
>   Subject to Anthropic's Commercial Terms of Service.
>
> ...This project does not have Anthropic's authorization to distribute
> their proprietary source. Users and contributors should evaluate their
> own legal position.

### 交叉验证的证据

| 证据 | 说明 |
|---|---|
| `src/tools/` 类名 | `BashTool`、`FileEditTool`、`FileReadTool`、`GlobTool`、`GrepTool`、`AgentTool`、`TaskCreateTool`、`SkillTool`、`AskUserQuestionTool`、`EnterPlanModeTool` 等，与 Claude Code 内部工具集合一一对应 |
| 目录结构 | `src/commands`、`src/services`、`src/hooks`、`src/entrypoints`、`src/tasks` 等命名和分层与 Claude Code 一致 |
| 内部命名风格 | `good-claude`、`brief`、`buddy`、`advisor`、`btw` 等命令名带有明显的内部代号色彩，不是常规开源项目会独立想出的命名 |
| 技术栈 | React + Ink 终端 UI、TypeScript 严格模式、ESM，与 Claude Code 公开可观察到的技术栈吻合 |

### 结论

差异不是"两套独立设计的系统在实现细节上不同"，而是"**同一套源码（Claude Code 本体）+ 后加的多 provider 适配层**"。逐行做实现细节对比意义不大。

### 法律风险提示

如果考虑使用/依赖/贡献这个项目，需要意识到其核心运行时代码的分发本身缺乏授权，这是需要独立评估的合规风险，不只是技术选型问题。

---

## 二、新增部分：Provider 适配层设计

这是该项目在 Claude Code 本体之上真正自研叠加的部分，核心文档在 `docs/architecture/integrations.md` 和 `docs/integrations/overview.md`。设计思路可概括为 **"descriptor-first"（描述符优先）** 三层架构。

### 1. 三层职责分离

```
metadata（描述符层）  →  routing（路由层）  →  transport（传输层）
描述"是什么"           决定"当前用哪个"      决定"怎么发请求"
```

- **Metadata**（`src/integrations/descriptors.ts` + 各 vendor/gateway 描述符文件）：声明某个 provider/route 叫什么、默认模型是什么、认证方式、模型目录、能力标记（是否支持 reasoning 等）
- **Routing**（`routeMetadata.ts`）：把当前的用户配置 / 环境变量 / preset 选择映射到某个具体 route
- **Transport**（`openaiShim.ts`、Gemini/Bedrock/Vertex 等专用 client）：真正按该 route 的协议去发 HTTP 请求

规则：如果改的是 route 是什么 → 改 descriptor；如果改的是请求怎么发 → 改 transport 代码。不允许用一堆散落各处的 provider if/else 分支做路由决策。

### 2. `transportConfig.kind` 才是真正的路由开关

Gateway 有个 `category` 字段（`local` / `hosted` / `aggregating`），但那**只是展示分组用的**，不能用来做运行时路由判断；真正决定走哪条传输路径的是 `transportConfig.kind`（如 `openai-compatible`、`anthropic-proxy`、`bedrock`、`vertex`、`local`）。文档专门列出这条"陷阱"，说明这是开发过程中踩过坑后沉淀出的约定。

### 3. Descriptor 是数据，注册是加载器的事

新增一个 provider 遵循 `define*` 辅助函数模式（`defineVendor`/`defineGateway`/`defineCatalog`/`defineModel`），贡献者只写**纯数据描述符**，不直接调用 `registerXxx`：

```ts
export default defineGateway({
  id: 'acme',
  label: 'Acme AI',
  category: 'hosted',
  defaultBaseUrl: 'https://api.acme.example/v1',
  defaultModel: 'acme/fast',
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['ACME_API_KEY'],
  },
  transportConfig: {
    kind: 'openai-compatible',
    openaiShim: {
      supportsApiFormatSelection: false,
      supportsAuthHeaders: true,
    },
  },
  catalog,
})
```

然后跑 `bun run integrations:generate` 生成 `generated/integrationArtifacts.generated.ts`，由 `src/integrations/index.ts` 统一加载注册。这样把"新增一个 provider"这件事，从"改好几个文件里的分支逻辑"降级为"新增一个纯数据文件 + 跑一次生成脚本"。

### 4. 显式承认"不完美，但诚实"

文档里专门列了一节"已知例外"（known exceptions），没有假装所有 provider 都能被统一到 descriptor 模型里：

- **GitHub**：双模式路由 —— Claude 模型走 Anthropic 原生格式，Copilot/Models 流量走 OpenAI/Codex 格式
- **Mistral**：不是标准 OpenAI 兼容，仍需专用 env 选择和请求整形
- **Azure OpenAI / Bankr**：认证方式不同（`api-key` + deployment URL vs `X-API-Key`）
- **Bedrock / Vertex / Foundry**：走专用 Anthropic SDK/认证流程，而非通用 OpenAI shim
- **DeepSeek / Moonshot(Kimi)**：需要专用的 `reasoning_content`、`max_tokens`、`store` 字段整形
- **原生 web search**：只在原生 Anthropic 系路径（firstParty/vertex/foundry）和独立的 Codex 路径上有效
- **MiniMax**：保留专用 `/usage` 执行逻辑，因为其用量端点和通用 vendor 路径不同

他们明确区分了两类情况：

- **真实的协议差异**（该长期保留，不应硬塞进统一抽象）
- **临时的兼容桥接**（`compatibility.ts`、`providerFlag.ts` 等，因为老的 env 配置协议还没重构完）

### 小结

如果只看这层 provider 适配设计（descriptor → route → transport 三层分离 + 生成式注册 + 显式记录例外），思路是合理且工程上站得住脚的：

- 值得借鉴：用生成脚本代替手写注册表；公开记录已知例外而不是假装抽象完美
- 但需注意：这套适配层是**寄生在未授权的 Claude Code 衍生代码之上**的，评估该项目时这一点无法绕开

---

## 附：仓库速览

- **npm 包名**：`@gitlawb/openclaude`，版本 `0.30.0`
- **License**：声明为 MIT，但仅覆盖"OpenClaude contributors 的修改部分"，底层衍生代码仍受 Anthropic 版权约束且未获授权分发
- **支持后端**：OpenAI 兼容 API、Gemini、GitHub Models、Codex OAuth/Codex、Ollama、Atomic Chat 等
- **额外功能**（Claude Code 未公开的部分）：`src/grpc/`、`src/self-hosted-runner/`、`src/remote/`（gRPC 服务与自托管 runner）、`src/buddy/`（像素小伙伴彩蛋）、`src/voice/`、`src/vim/`
