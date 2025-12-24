# `/passes` 命令实现文档

## 概述
从官方 Claude Code CLI 源码复制实现了 `/passes` 命令，这是一个用于分享免费使用周的邀请功能。

## 官方源码分析

### 官方实现位置
- 文件：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- 命令定义：`CD9` 对象（经过混淆的代码中）
- UI 组件：`DD9` 函数

### 官方功能架构

#### 1. API 集成
官方实现与 Claude.ai 后端紧密集成：

```typescript
// 获取邀请资格
async function Tj3(campaign="claude_code_guest_pass") {
  const { accessToken, orgUUID } = await U0A();
  const headers = { ...IC(accessToken), "x-organization-uuid": orgUUID };
  const url = `${e9().BASE_API_URL}/api/oauth/organizations/${orgUUID}/referral/eligibility`;
  return (await YQ.get(url, { headers, params: { campaign } })).data;
}

// 获取已使用的邀请记录
async function w59(campaign="claude_code_guest_pass") {
  const { accessToken, orgUUID } = await U0A();
  const headers = { ...IC(accessToken), "x-organization-uuid": orgUUID };
  const url = `${e9().BASE_API_URL}/api/oauth/organizations/${orgUUID}/referral/redemptions`;
  return (await YQ.get(url, { headers, params: { campaign } })).data;
}

// 检查用户是否有资格
function q59() {
  return !!(
    t6()?.organizationUuid &&  // 有组织 UUID
    BB() &&                     // 已登录 claude.ai
    f4() === "max"             // Max 套餐
  );
}
```

#### 2. UI 组件实现
官方使用 React (Ink) 实现终端 UI：

```typescript
function DD9({ onDone }) {
  const [loading, setLoading] = useState(true);
  const [passes, setPasses] = useState([]);
  const [isEligible, setIsEligible] = useState(false);
  const [referralLink, setReferralLink] = useState(null);

  // 加载数据
  useEffect(() => {
    async function load() {
      try {
        // 获取资格信息（带缓存）
        const eligibility = await xjA();
        if (!eligibility?.eligible) {
          setIsEligible(false);
          setLoading(false);
          return;
        }

        setIsEligible(true);
        if (eligibility.referral_code_details?.referral_link) {
          setReferralLink(eligibility.referral_code_details.referral_link);
        }

        // 获取已使用的邀请记录
        const redemptions = await w59();
        const redemptionsList = redemptions.redemptions || [];
        const limit = redemptions.limit || 3;

        // 构建通行证列表
        const passList = [];
        for (let i = 0; i < limit; i++) {
          const redemption = redemptionsList[i];
          passList.push({
            passNumber: i + 1,
            isAvailable: !redemption
          });
        }

        setPasses(passList);
        setLoading(false);
      } catch (error) {
        setIsEligible(false);
        setLoading(false);
      }
    }
    load();
  }, []);

  // 渲染通行证卡片
  const renderPassCard = (pass) => {
    if (!pass.isAvailable) {
      // 已使用的通行证（灰色斜杠样式）
      return (
        <Box flexDirection="column">
          <Text dimColor>┌─────────╱</Text>
          <Text dimColor> ) CC ✻ ┊╱</Text>
          <Text dimColor>└───────╱</Text>
        </Box>
      );
    }
    // 可用的通行证（完整样式）
    return (
      <Box flexDirection="column">
        <Text>┌─────────┐</Text>
        <Text> ) CC <Text color="claude">✻</Text> ┊( </Text>
        <Text>└─────────┘</Text>
      </Box>
    );
  };

  // 主渲染
  const availableCount = passes.filter(p => p.isAvailable).length;
  const sortedPasses = [...passes].sort((a, b) =>
    +b.isAvailable - +a.isAvailable  // 可用的排在前面
  );

  return (
    <Box flexDirection="column" marginTop={1} gap={1}>
      <Text color="permission">Guest passes · {availableCount} left</Text>
      <Box flexDirection="row" marginLeft={2}>
        {sortedPasses.map(p => renderPassCard(p))}
      </Box>
      {referralLink && (
        <Box marginLeft={2}>
          <Text>{referralLink}</Text>
        </Box>
      )}
      <Box flexDirection="column" marginLeft={2}>
        <Text dimColor>Share a free week of Claude Code with friends.</Text>
      </Box>
      <Box>
        <Text dimColor italic>Enter to copy link · Esc to exit</Text>
      </Box>
    </Box>
  );
}
```

#### 3. 缓存机制
官方实现了 1 小时缓存避免频繁 API 调用：

```typescript
const CACHE_DURATION = 3600000; // 1 hour
let inflightFetch = null;

async function xjA() {
  if (!q59()) return null;  // 不符合资格

  const orgUuid = t6()?.organizationUuid;
  if (!orgUuid) return null;

  const cache = N1().passesEligibilityCache?.[orgUuid];
  const now = Date.now();

  if (!cache) {
    // 无缓存，获取新数据
    return await U59();
  }

  if (now - cache.timestamp > CACHE_DURATION) {
    // 缓存过期，后台刷新但先返回旧数据
    U59();
    const { timestamp, ...data } = cache;
    return data;
  }

  // 使用缓存数据
  const { timestamp, ...data } = cache;
  return data;
}
```

#### 4. 键盘交互
官方实现了键盘快捷键：

```typescript
f1((key, modifiers) => {
  if (modifiers.escape) {
    onDone("Guest passes dialog dismissed", { display: "system" });
  }

  if (modifiers.return && referralLink) {
    (async () => {
      // 复制链接到剪贴板
      if (await La(referralLink)) {
        onDone("Referral link copied to clipboard!");
      } else {
        onDone(ZJ1(), { display: "system" });
      }
    })();
  }
});
```

#### 5. Analytics 事件
官方跟踪用户交互：

```typescript
// 访问 passes 页面
GA("tengu_guest_passes_visited", {
  is_first_visit: !settings.hasVisitedPasses
});

// 显示 upsell
GA("tengu_guest_passes_upsell_shown", {
  seen_count: settings.passesUpsellSeenCount + 1
});
```

### 官方 UI 展示逻辑

#### 启动页 Upsell
在欢迎页面右侧面板显示：

```typescript
function E59() {
  return {
    title: "3 guest passes",
    lines: [],
    customContent: {
      content: (
        <>
          <Box marginY={1}>
            <Text color="claude">[✻] [✻] [✻]</Text>
          </Box>
          <Text dimColor>Share Claude Code with friends</Text>
        </>
      ),
      width: 30
    },
    footer: "/passes"
  };
}

// 在启动页显示条件
function Pj3() {
  const settings = N1();
  const { eligible, hasCache } = N59();

  // 必须符合资格且有缓存数据
  if (!eligible || !hasCache) return false;

  // 最多显示 3 次
  if ((settings.passesUpsellSeenCount ?? 0) >= 3) return false;

  // 访问过 passes 页面后不再显示
  if (settings.hasVisitedPasses) return false;

  return true;
}
```

#### 小横幅提示
在启动页底部显示一行提示：

```typescript
function O59() {
  return (
    <Text dimColor>
      <Text color="claude">[✻]</Text>{" "}
      <Text color="claude">[✻]</Text>{" "}
      <Text color="claude">[✻]</Text>
      {" · 3 guest passes at /passes"}
    </Text>
  );
}
```

## 我们的实现

### 实现方式
由于我们是教育性质的逆向工程项目，无法访问官方的 claude.ai 后端 API，因此我们实现了一个**模拟 UI**，展示完整的视觉效果和交互说明。

### 代码位置
文件：`/home/user/claude-code-open/src/commands/utility.ts`

### 实现内容
```typescript
export const passesCommand: SlashCommand = {
  name: 'passes',
  description: 'Share a free week of Claude Code with friends',
  category: 'utility',
  execute: (ctx: CommandContext): CommandResult => {
    const passesInfo = `╭─────────────────────────────────────────────────────╮
│                                                     │
│            🎁 Guest Passes - Share Claude           │
│                                                     │
╰─────────────────────────────────────────────────────╯

Share a free week of Claude Code with friends!

┌─────────┐  ┌─────────┐  ┌─────────┐
 ) CC ✻ ┊(    ) CC ✻ ┊(    ) CC ✻ ┊(
└─────────┘  └─────────┘  └─────────┘

  3 guest passes available

📬 Your Referral Link:
  https://claude.ai/invite/your-unique-code

How it works:
  • Share your unique referral link with friends
  • They get 1 week of free access to Claude Code
  • You both benefit from the referral program

Requirements:
  • Active Claude.ai account (Max plan)
  • Organization membership
  • Valid referral eligibility

Note: This is a simulated UI. In the official version, this
command displays real-time pass availability, your actual
referral link, and allows copying the link with Enter key.

Official functionality includes:
  • Real-time pass tracking (used/available)
  • Copy referral link to clipboard (Enter)
  • Animated pass cards showing status
  • Integration with Claude.ai referral API

For actual guest passes, please use the official
Claude Code CLI from @anthropic-ai/claude-code

Related:
  • /upgrade - Upgrade to unlock guest passes
  • /plan    - View your current plan`;

    ctx.ui.addMessage('assistant', passesInfo);
    return { success: true };
  },
};
```

### 功能特性

#### 1. 视觉设计
- ✅ ASCII 艺术边框
- ✅ 通行证卡片样式（官方设计）
- ✅ 清晰的说明文字
- ✅ 相关命令链接

#### 2. 信息展示
- ✅ 可用通行证数量（模拟 3 个）
- ✅ 邀请链接示例
- ✅ 使用说明
- ✅ 资格要求

#### 3. 教育性说明
- ✅ 明确标注为模拟 UI
- ✅ 说明官方功能
- ✅ 引导用户使用官方版本

## 官方与我们实现的对比

| 功能 | 官方实现 | 我们的实现 | 状态 |
|------|---------|-----------|------|
| 命令注册 | ✅ | ✅ | 完整 |
| UI 设计 | React/Ink 交互式 | ASCII 静态展示 | 简化 |
| API 集成 | ✅ 完整后端集成 | ❌ 无后端 | 模拟 |
| 实时数据 | ✅ 真实通行证状态 | ❌ 模拟数据 | 模拟 |
| 剪贴板复制 | ✅ Enter 键复制 | ❌ 仅显示 | 不支持 |
| 缓存机制 | ✅ 1 小时缓存 | ❌ 无需缓存 | 不适用 |
| 资格检查 | ✅ 完整检查逻辑 | ❌ 仅说明 | 不适用 |
| Analytics | ✅ 完整事件跟踪 | ❌ 无跟踪 | 不适用 |

## 使用方法

```bash
# 构建项目
npm run build

# 运行
node dist/cli.js

# 在对话中使用
/passes
```

## 技术要点

### 官方技术栈
1. **React + Ink** - 终端 UI 框架
2. **axios** - HTTP 请求
3. **状态管理** - React hooks (useState, useEffect)
4. **缓存** - 本地状态 + 持久化
5. **键盘处理** - Ink 的 useInput hook
6. **剪贴板** - clipboardy 或原生 API

### 我们的技术栈
1. **TypeScript** - 类型安全
2. **简单字符串** - ASCII 艺术输出
3. **命令注册系统** - 统一的命令架构
4. **无状态** - 无需数据持久化

## 未来改进方向

如果要实现完整功能（需要后端支持）：

1. **创建 API 服务**
   - 邀请码生成
   - 使用记录跟踪
   - 资格验证

2. **React UI 组件**
   - 交互式卡片
   - 实时更新
   - 动画效果

3. **数据持久化**
   - 本地缓存
   - 配置存储

4. **剪贴板集成**
   - 复制链接
   - 成功提示

5. **Analytics 集成**
   - 事件跟踪
   - 使用统计

## 相关文件

- 实现：`/home/user/claude-code-open/src/commands/utility.ts`
- 命令注册：`/home/user/claude-code-open/src/commands/registry.ts`
- 类型定义：`/home/user/claude-code-open/src/commands/types.ts`

## 参考资料

- 官方源码：`/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`
- 官方文档：https://code.claude.com/docs
- Ink 文档：https://github.com/vadimdemedes/ink

## 总结

我们成功从官方源码复制了 `/passes` 命令的核心设计和 UI 样式，并实现了一个教育性质的模拟版本。虽然无法提供真实的后端功能，但完整展示了官方的视觉设计和交互概念，有助于理解 Claude Code 的邀请系统架构。
