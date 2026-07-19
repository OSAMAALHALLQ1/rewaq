# قائمة تحقق إعداد رواق

## قبل البدء

- [ ] إنشاء Branch أو Worktree.
- [ ] التأكد أن Working Tree نظيف.
- [ ] نسخ احتياطي لملفات الإعداد الحالية.
- [ ] تحديد مدير الحزم من Lockfile.
- [ ] عدم وجود أسرار في الملفات المتتبعة.

## تعليمات الوكلاء

- [ ] دمج `AGENTS.md`.
- [ ] دمج `CLAUDE.md`.
- [ ] اكتشاف Skills عبر `/skills` في Codex.
- [ ] اكتشاف Subagents في Claude.
- [ ] عدم وجود أسماء Skills أو Agents مكررة.

## MCP

- [ ] Supabase مقيد بـ`project_ref`.
- [ ] Supabase يبدأ بـ`read_only=true`.
- [ ] GitHub يبدأ Read-only.
- [ ] GitHub Toolsets محدودة.
- [ ] Context7 يعمل.
- [ ] Playwright MCP يعمل بعد تثبيت Playwright.
- [ ] لا توجد Tokens داخل Git.

## الاختبارات

- [ ] typecheck.
- [ ] lint.
- [ ] unit tests.
- [ ] integration tests.
- [ ] build.
- [ ] Playwright smoke.
- [ ] اختبار tenant isolation.
- [ ] اختبار branch isolation.
- [ ] اختبار idempotency.
- [ ] اختبار closed period.
- [ ] اختبار debit = credit.

## قبل Pull Request

- [ ] عرض migrations وخطة rollback.
- [ ] مراجعة RLS.
- [ ] مراجعة Security.
- [ ] مراجعة أثر المخزون.
- [ ] مراجعة أثر المحاسبة.
- [ ] لا توجد أزرار وهمية أو بيانات ثابتة.
- [ ] لا توجد أسرار أو Logs حساسة.
