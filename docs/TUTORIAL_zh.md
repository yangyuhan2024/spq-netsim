# spq-netsim 使用教程：VS Code 本地部署 + Claude Code 开发 + 上传云端

适用环境：M1 Mac（macOS 13 以上）。Windows 用户的命令差异在文中单独标出。

---

## 第 0 步：安装需要的工具（只做一次）

### 0.1 命令行开发工具和 Homebrew
打开「终端」（Terminal），依次执行：

```bash
xcode-select --install          # 装 git、编译器等；已装过会提示 already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Homebrew 装完后，按它最后提示的两行 `echo ... >> ~/.zprofile` 和 `eval ...` 执行一次，让 `brew` 命令生效。

### 0.2 Node.js 22（必须 ≥ 22.18）
推荐用 nvm 管理版本：

```bash
brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "$(brew --prefix nvm)/nvm.sh" ] && . "$(brew --prefix nvm)/nvm.sh"' >> ~/.zshrc
source ~/.zshrc
nvm install 22
node --version                  # 应显示 v22.18.0 或更高
```

> 版本低于 22.18 时，运行 `.ts` 文件会报 `Unknown file extension ".ts"`。用 `nvm install 22` 升级即可。

### 0.3 VS Code
1. 从 https://code.visualstudio.com 下载安装（选 Apple Silicon 版）。
2. 打开 VS Code，按 `Cmd+Shift+P`，输入 `Shell Command: Install 'code' command in PATH` 回车。之后终端里可以用 `code .` 打开文件夹。

### 0.4 Claude Code
Claude Code 需要 Claude Pro / Max（或 Team、Enterprise、Console）账号，免费账号不能用。

```bash
curl -fsSL https://claude.ai/install.sh | bash
# 关掉终端再开一个新的
claude --version
claude doctor                   # 检查安装是否正常
```

也可以用 Homebrew：`brew install --cask claude-code`。

VS Code 扩展：在扩展商店搜索 **Claude Code**（发布者 Anthropic）并安装。项目里的 `.vscode/extensions.json` 已经推荐了它，打开项目时 VS Code 也会提示。

### 0.5 Git 身份（第一次用 Git 时）
```bash
git config --global user.name "Yuhan Yang"
git config --global user.email "你在 GitHub 上用的邮箱"
```

---

## 第 1 步：在 VS Code 本地运行项目

### 1.1 解压并打开
```bash
cd ~/Projects                   # 没有就先 mkdir -p ~/Projects
unzip ~/Downloads/spq-netsim.zip
cd spq-netsim
code .
```

### 1.2 安装开发依赖并测试
在 VS Code 里按 `` Ctrl+` `` 打开内置终端：

```bash
nvm use                         # 读取 .nvmrc，切换到 Node 22
npm install                     # 只装 typescript 和 @types/node
npm run check                   # 类型检查 + 全部测试
```

看到 `# pass 35`、`# fail 0` 就说明本地环境没问题（数字可能因你后续添加测试而变化）。

### 1.3 运行仿真
```bash
npm run sim -- list                                   # 列出 Q1–Q6
npm run sim -- run --scenario q1 --load 0.6           # 单次运行，打印每个节点的表格
npm run sim -- run --scenario q2 --load 0.9 --trace results/q2-trace.csv   # 同时输出参考流逐包日志
npm run sim -- sweep --scenario q1 --out results/q1.csv                    # 负载 0.1–0.9 扫描
npm run validate                                      # 仿真结果 vs M/D/1 和优先级排队公式
```

注意 `npm run sim` 后面要先写 `--`，再写参数。CSV 结果在 `results/` 文件夹，装了推荐的 Rainbow CSV 扩展后在 VS Code 里看会更清楚，也可以用 Excel 打开画图。

### 1.4 断点调试
1. 打开 `src/simulator.ts`，在 `function depart` 里某一行左侧点一下，出现红点。
2. 左侧栏点「运行和调试」（或按 `Cmd+Shift+D`），选择 **Debug: run Q1 at load 0.6**，按 `F5`。
3. 程序停在断点处，可以查看 `node.queues`、`p.arrivedAtNode` 等变量。

调试单个测试：打开任意 `test/*.test.ts`，选择 **Debug: current test file**，按 `F5`。

---

## 第 2 步：用 Claude Code 继续开发（面试重点）

JD 要求你能展示「怎么指挥 Claude Code」，所以建议你**亲自**用下面的流程完成 `specs/BACKLOG.md` 里的一两个功能，并把过程记在 `docs/BUILD_LOG.md`。面试时讲的是你自己做的这部分。

### 2.1 启动并检查配置
在项目根目录的终端里：

```bash
claude
```

第一次会让你登录，并询问是否信任这个文件夹，选信任。进入后可以输入：

- `/hooks`：确认看到 PreToolUse（block-secrets）和 PostToolUse（test-after-edit）两个 hook
- `/permissions`：确认 `npm test` 等命令已允许，`.env`、`git push` 被禁止
- `/agents`：确认有 `sim-reviewer` 子代理
- 输入 `/` 可以看到项目自定义命令：`/spec`、`/implement`、`/review`、`/sweep`

也可以在 VS Code 里点右上角的 Claude 图标，在侧边栏里用，效果相同。

### 2.2 每个功能单独开分支（或 worktree）
```bash
git checkout -b feature/ci-across-seeds
# 或者用 worktree，同时开发两个功能互不干扰：
git worktree add ../spq-ci -b feature/ci-across-seeds
```

### 2.3 推荐的工作流程（以 BACKLOG 第 1 项「多种子置信区间」为例）
1. **写 spec**
   ```
   /spec sweep 支持 --seeds N，每个负载用 N 个种子运行，输出参考流时延和阻塞率的均值与 95% 置信区间（t 分布）
   ```
   Claude 会先提问（比如 N=1 时怎么办、CI 写进 CSV 的哪几列），回答后生成 `specs/003-xxx.md`。你自己读一遍，改掉不合理的地方，再让它继续。
2. **实现**
   ```
   /implement specs/003-ci-across-seeds.md
   ```
   它会先列步骤，每一步先写测试、再改代码、再跑 `npm run check`，然后停下来等你说 `next`。每改一个 `.ts` 文件，PostToolUse hook 会自动跑对应测试，失败时它会自己看到错误并修复。
3. **逐行看 diff**：在 VS Code 左侧「源代码管理」里点每个文件，看红绿差异。重点看单位（bit/byte、秒/毫秒）、warm-up 是否处理、除零。
4. **独立审查**
   ```
   /review
   ```
   或者：`用 sim-reviewer 子代理审查当前分支的改动`。
5. **自己再验证一次**：`npm run check`、`npm run validate`，必要时手动跑一次 `sweep` 看趋势是否合理。
6. **记录**：在 `docs/BUILD_LOG.md` 填一行：你的指令、Claude 做了什么、你检查了什么、你发现并纠正了什么。
7. **提交**
   ```bash
   git add -A
   git commit -m "Add confidence intervals across seeds to sweep"
   ```

### 2.4 试一下 secret 拦截（面试可以演示）
```bash
echo "API_KEY=test123" > .env
```
然后在 Claude Code 里说「读一下 .env 文件」，它会被 hook 拦下并提示 Blocked。演示完删除：`rm .env`。

---

## 第 3 步：上传到 GitHub（云端）

### 3.1 创建 GitHub 账号和登录
1. 在 https://github.com 注册账号。
2. 安装 GitHub CLI 并登录（最省事，不用手动配 SSH key）：
   ```bash
   brew install gh
   gh auth login        # 依次选 GitHub.com → HTTPS → Login with a web browser
   ```

### 3.2 初始化仓库并推送
在项目根目录：

```bash
git init -b main
git add -A
git status                      # 确认没有 node_modules/、results/、.env
git commit -m "Initial commit: SPQ network simulator with Claude Code setup"
gh repo create spq-netsim --public --source=. --remote=origin --push
```

完成后浏览器打开 `https://github.com/<你的用户名>/spq-netsim` 就能看到代码。

> 不用 gh 的话：先在 GitHub 网页点 **New repository** 建一个空仓库（不要勾选 README），然后
> `git remote add origin https://github.com/<用户名>/spq-netsim.git` 和 `git push -u origin main`。

### 3.3 GitHub Actions 自动测试（CI）
`.github/workflows/ci.yml` 已经写好。每次 push 后：
1. 打开仓库页面 → **Actions** 标签，能看到 CI 在跑：安装 → 类型检查 → 测试 → 理论验证 → 小规模扫描。
2. 绿色对勾表示通过。点进某次运行，底部 **Artifacts** 里可以下载 `sweep-results`（CI 生成的 CSV）。

### 3.4 保护 main 分支（对应 JD 里的 protected branches）
仓库 **Settings → Branches → Add branch ruleset**（或 Add rule）：
- Branch name pattern 填 `main`
- 勾选 **Require a pull request before merging**
- 勾选 **Require status checks to pass**，选择 `test`（CI 的 job 名）

之后的流程就是：功能分支 push → 网页上开 Pull Request → CI 通过 → 合并。

```bash
git push -u origin feature/ci-across-seeds
gh pr create --fill              # 用提交信息创建 PR
gh pr checks                     # 查看 CI 状态
gh pr merge --squash             # CI 通过后合并
```

### 3.5 在云端直接运行（GitHub Codespaces，可选）
不想在本机装环境时，可以在浏览器里跑：
1. 仓库页面点绿色 **Code** → **Codespaces** → **Create codespace on main**。
2. 打开的是网页版 VS Code，在终端执行：
   ```bash
   npm install
   npm run check
   npm run sim -- run --scenario q1 --load 0.6
   ```
个人账号每月有一定免费额度，用完记得在 https://github.com/codespaces 里停止或删除 codespace。

---

## 第 4 步：常见问题

| 现象 | 原因和解决 |
|------|-----------|
| `Unknown file extension ".ts"` | Node 版本太低，执行 `nvm install 22 && nvm use` |
| `npm run sim run ...` 参数没生效 | 少了 `--`，应为 `npm run sim -- run ...` |
| `claude: command not found` | 安装后要开新终端；仍不行运行 `claude doctor` |
| hook 没触发 | 在 Claude Code 里输入 `/hooks` 查看；确认是在项目根目录启动的 `claude` |
| CI 失败但本地通过 | 点进 Actions 日志看哪一步；常见是本地有未提交文件，`git status` 检查 |
| `git push` 要求密码 | 用 `gh auth login` 登录，或改用 SSH |
| Windows 用户 | 用 PowerShell 安装：`irm https://claude.ai/install.ps1 \| iex`；Node 用 nvm-windows 安装 |

---

## 第 5 步：面试时怎么讲（2 分钟版本）

1. **项目是什么**：严格优先级排队的离散事件仿真，三类流量，参考流跨 M 个节点，输出时延、阻塞率、积压。
2. **我怎么让 Claude Code 适应这个项目**：CLAUDE.md 写了单位、模型规则、"看起来对但其实错"的清单；hook 拦截 secret、改完自动跑测试；`/spec → /implement → /review` 三个命令固定流程；独立的 reviewer 子代理。
3. **我怎么验证 AI 写的代码**：确定性种子、包守恒、优先级顺序、边界情况（K=0、ON 时长短于发包间隔），以及和 M/D/1、Cobham 公式对比误差在几个百分点内。
4. **测试抓不到、我自己发现的问题**：从 `docs/BUILD_LOG.md` 里挑一个你亲自做的例子讲。比如 ON/OFF 平均速率如果用「峰值 × 占空比」会偏小，现在有专门的测试防止回退。
