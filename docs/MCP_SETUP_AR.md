# إعداد MCP لرواق

## 1. Context7

Codex:

```powershell
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

أو الإعداد التفاعلي:

```powershell
npx ctx7 setup
```

## 2. Playwright MCP

Codex:

```powershell
codex mcp add playwright npx "@playwright/mcp@latest"
```

Claude Code:

```powershell
claude mcp add playwright npx @playwright/mcp@latest
```

## 3. Supabase MCP

Claude Code، وضع مشروع وقراءة فقط:

```powershell
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
```

Codex: أضف Streamable HTTP من إعداد MCP أو `config.toml`، ثم نفّذ OAuth إذا طلبه العميل. لا تضع Access Token في Git.

## 4. GitHub MCP الرسمي

الرابط:

```text
https://github.com/github/github-mcp-server
```

ابدأ محليًا مع Docker وبصلاحيات قراءة:

```powershell
$env:GITHUB_PERSONAL_ACCESS_TOKEN = "ضعه في الجلسة فقط"
$env:GITHUB_READ_ONLY = "1"
$env:GITHUB_TOOLSETS = "context,repos,issues,pull_requests,actions,code_security"
```

ثم اربط الحاوية مع MCP Host وفق دليل GitHub الرسمي. لا تكتب PAT داخل ملف المشروع.

## تحقق

Codex:

```powershell
codex mcp list
```

داخل Codex أو Claude استخدم `/mcp` لرؤية الحالة والمصادقة عند الحاجة.
