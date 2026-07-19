-- P0 accounting integrity: all journal postings and reversals become atomic.
-- Posted journals/lines are immutable. Corrections are reversal entries only.

alter table public.journal_entries
  add column if not exists posting_fingerprint text;

create or replace function public.protect_journal_entry_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف قيد يومية. استخدم قيداً عكسياً.';
  end if;
  if old.status = 'posted' then
    raise exception 'القيد المرحل غير قابل للتعديل. استخدم قيداً عكسياً.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_journal_line_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_entry_status text;
  v_entry_id uuid := case when tg_op = 'DELETE' then old.journal_entry_id else new.journal_entry_id end;
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف سطر قيد يومية. استخدم قيداً عكسياً.';
  end if;
  select je.status into v_entry_status
  from public.journal_entries je
  where je.id = v_entry_id;
  if v_entry_status = 'posted' then
    raise exception 'سطور القيد المرحل غير قابلة للإضافة أو التعديل.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_journal_entry_history_trigger on public.journal_entries;
create trigger protect_journal_entry_history_trigger
before update or delete on public.journal_entries
for each row execute function public.protect_journal_entry_history();

drop trigger if exists protect_journal_line_history_trigger on public.journal_lines;
create trigger protect_journal_line_history_trigger
before insert or update or delete on public.journal_lines
for each row execute function public.protect_journal_line_history();

create or replace function public.post_balanced_journal_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_source_doc_type text,
  p_source_doc_id uuid,
  p_memo text,
  p_entry_date date,
  p_lines jsonb,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.journal_entries%rowtype;
  v_entry_id uuid;
  v_entry_number text;
  v_line jsonb;
  v_account_id uuid;
  v_cost_center_id uuid;
  v_debit numeric(14,4);
  v_credit numeric(14,4);
  v_debit_total numeric(18,4) := 0;
  v_credit_total numeric(18,4) := 0;
  v_fingerprint text;
  v_line_count integer;
  v_daily_sequence integer;
begin
  if nullif(btrim(p_source_doc_type), '') is null or p_source_doc_id is null then
    raise exception 'نوع ومعرف المستند المصدر مطلوبان.';
  end if;
  if p_entry_date is null then raise exception 'تاريخ القيد مطلوب.'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'سطور القيد يجب أن تكون مصفوفة JSON.'; end if;
  v_line_count := jsonb_array_length(p_lines);
  if v_line_count < 2 or v_line_count > 500 then
    raise exception 'القيد يحتاج سطرين إلى 500 سطر.';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'المؤسسة غير موجودة.';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b where b.id = p_branch_id and b.organization_id = p_organization_id
  ) then
    raise exception 'الفرع لا يتبع المؤسسة.';
  end if;
  if public.is_accounting_period_closed(p_organization_id, p_entry_date) then
    raise exception 'هذه الفترة المحاسبية مقفلة.';
  end if;

  v_fingerprint := encode(digest(
    concat_ws('|', p_organization_id::text, coalesce(p_branch_id::text, ''),
      btrim(p_source_doc_type), p_source_doc_id::text, coalesce(p_memo, ''),
      p_entry_date::text, p_lines::text),
    'sha256'
  ), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':' || btrim(p_source_doc_type) || ':' || p_source_doc_id::text, 0
  ));

  select * into v_existing
  from public.journal_entries je
  where je.organization_id = p_organization_id
    and je.source_doc_type = btrim(p_source_doc_type)
    and je.source_doc_id = p_source_doc_id
  for update;
  if found then
    if v_existing.status = 'draft' then
      raise exception using
        message = 'يوجد قيد draft قديم غير مكتمل لهذا المستند.',
        hint = 'راجعه وابطله بإجراء تصحيح موثق؛ لا تحذف سطوره.';
    end if;
    if v_existing.status <> 'posted' then
      raise exception 'قيد المستند موجود بحالة % ولا يمكن إعادة ترحيله.', v_existing.status;
    end if;
    if v_existing.posting_fingerprint is not null
       and v_existing.posting_fingerprint <> v_fingerprint then
      raise exception 'أعيد استخدام مستند المصدر بحمولة محاسبية مختلفة.';
    end if;
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'entry_id', v_existing.id,
      'entry_number', v_existing.entry_number, 'status', v_existing.status
    );
  end if;

  perform public.ensure_default_chart_accounts(p_organization_id);

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    begin
      v_debit := round(coalesce(nullif(v_line->>'debit', '')::numeric, 0), 4);
      v_credit := round(coalesce(nullif(v_line->>'credit', '')::numeric, 0), 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'قيمة مدين أو دائن غير صالحة.';
    end;
    if not ((v_debit > 0 and v_credit = 0) or (v_credit > 0 and v_debit = 0)) then
      raise exception 'كل سطر يجب أن يحتوي قيمة موجبة في المدين أو الدائن فقط.';
    end if;
    if nullif(btrim(v_line->>'memo'), '') is null then
      raise exception 'وصف سطر القيد مطلوب.';
    end if;
    v_debit_total := round(v_debit_total + v_debit, 4);
    v_credit_total := round(v_credit_total + v_credit, 4);
  end loop;
  if v_debit_total <= 0 or v_debit_total <> v_credit_total then
    raise exception 'القيد غير متوازن: مدين % ودائن %.', v_debit_total, v_credit_total;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':journal:' || p_entry_date::text, 0
  ));
  select count(*)::integer + 1 into v_daily_sequence
  from public.journal_entries je
  where je.organization_id = p_organization_id and je.entry_date = p_entry_date;
  v_entry_number := 'JE-' || to_char(p_entry_date, 'YYYYMMDD') || '-' || lpad(v_daily_sequence::text, 4, '0');
  v_entry_id := gen_random_uuid();

  insert into public.journal_entries (
    id, organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status, created_by, posting_fingerprint
  ) values (
    v_entry_id, p_organization_id, p_branch_id, v_entry_number, p_entry_date,
    btrim(p_source_doc_type), p_source_doc_id, nullif(btrim(p_memo), ''),
    'draft', p_created_by, v_fingerprint
  );

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_account_id := null;
    if nullif(v_line->>'account_id', '') is not null then
      begin v_account_id := (v_line->>'account_id')::uuid;
      exception when invalid_text_representation then raise exception 'معرف حساب غير صالح.';
      end;
      if not exists (
        select 1 from public.chart_of_accounts coa
        where coa.id = v_account_id and coa.organization_id = p_organization_id and coa.is_active = true
      ) then
        raise exception 'الحساب المحدد غير نشط أو لا يتبع المؤسسة.';
      end if;
    elsif nullif(btrim(v_line->>'system_key'), '') is not null then
      select coa.id into v_account_id
      from public.chart_of_accounts coa
      where coa.organization_id = p_organization_id
        and coa.system_key = btrim(v_line->>'system_key') and coa.is_active = true;
      if not found then raise exception 'الحساب المحاسبي غير موجود: %.', v_line->>'system_key'; end if;
    else
      raise exception 'سطر قيد بدون حساب محاسبي.';
    end if;

    v_cost_center_id := null;
    if nullif(v_line->>'cost_center_id', '') is not null then
      begin v_cost_center_id := (v_line->>'cost_center_id')::uuid;
      exception when invalid_text_representation then raise exception 'معرف مركز تكلفة غير صالح.';
      end;
      if not exists (
        select 1 from public.cost_centers cc
        where cc.id = v_cost_center_id and cc.organization_id = p_organization_id
      ) then
        raise exception 'مركز التكلفة لا يتبع المؤسسة.';
      end if;
    end if;

    v_debit := round(coalesce(nullif(v_line->>'debit', '')::numeric, 0), 4);
    v_credit := round(coalesce(nullif(v_line->>'credit', '')::numeric, 0), 4);
    insert into public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id,
      debit, credit, memo, cost_center_id
    ) values (
      p_organization_id, v_entry_id, v_account_id, p_branch_id,
      v_debit, v_credit, btrim(v_line->>'memo'), v_cost_center_id
    );
  end loop;

  update public.journal_entries
  set status = 'posted'
  where id = v_entry_id and organization_id = p_organization_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_created_by, 'journal_entry_posted_atomic',
    'journal_entry', v_entry_id,
    jsonb_build_object(
      'entry_number', v_entry_number, 'entry_date', p_entry_date,
      'source_doc_type', btrim(p_source_doc_type), 'source_doc_id', p_source_doc_id,
      'debit_total', v_debit_total, 'credit_total', v_credit_total,
      'line_count', v_line_count, 'posting_fingerprint', v_fingerprint
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false, 'entry_id', v_entry_id,
    'entry_number', v_entry_number, 'status', 'posted'
  );
end;
$$;

create or replace function public.reverse_journal_entry_atomic(
  p_organization_id uuid,
  p_entry_id uuid,
  p_reason text,
  p_reversal_date date,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_original public.journal_entries%rowtype;
  v_existing public.journal_entries%rowtype;
  v_reversal_id uuid;
  v_entry_number text;
  v_daily_sequence integer;
  v_line_count integer;
  v_fingerprint text;
begin
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) < 3 then
    raise exception 'سبب العكس مطلوب (3 أحرف على الأقل).';
  end if;
  if p_reversal_date is null then raise exception 'تاريخ القيد العكسي مطلوب.'; end if;
  if public.is_accounting_period_closed(p_organization_id, p_reversal_date) then
    raise exception 'فترة القيد العكسي مقفلة.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':journal-reversal:' || p_entry_id::text, 0
  ));
  select * into v_original
  from public.journal_entries je
  where je.id = p_entry_id and je.organization_id = p_organization_id
  for update;
  if not found then raise exception 'القيد المطلوب عكسه غير موجود.'; end if;
  if v_original.status <> 'posted' then raise exception 'لا يعكس إلا قيد مرحل.'; end if;
  if v_original.reversal_of_entry_id is not null or v_original.source_doc_type = 'journal_reversal' then
    raise exception 'لا يمكن عكس قيد عكسي.';
  end if;

  select * into v_existing
  from public.journal_entries je
  where je.organization_id = p_organization_id
    and je.source_doc_type = 'journal_reversal' and je.source_doc_id = p_entry_id
  for update;
  if found then
    if v_existing.status = 'draft' then
      raise exception using
        message = 'يوجد قيد عكسي draft قديم غير مكتمل.',
        hint = 'راجعه وابطله بإجراء تصحيح موثق؛ لا تحذف سطوره.';
    end if;
    return jsonb_build_object(
      'success', true, 'duplicate', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number
    );
  end if;

  select count(*) into v_line_count
  from public.journal_lines jl
  where jl.organization_id = p_organization_id and jl.journal_entry_id = p_entry_id;
  if v_line_count < 2 then raise exception 'القيد الأصلي لا يحتوي سطوراً مكتملة.'; end if;

  v_fingerprint := encode(digest(
    concat_ws('|', p_organization_id::text, p_entry_id::text, btrim(p_reason), p_reversal_date::text),
    'sha256'
  ), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':journal:' || p_reversal_date::text, 0
  ));
  select count(*)::integer + 1 into v_daily_sequence
  from public.journal_entries je
  where je.organization_id = p_organization_id and je.entry_date = p_reversal_date;
  v_entry_number := 'JE-' || to_char(p_reversal_date, 'YYYYMMDD') || '-' || lpad(v_daily_sequence::text, 4, '0');
  v_reversal_id := gen_random_uuid();

  insert into public.journal_entries (
    id, organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status, reversal_of_entry_id,
    created_by, posting_fingerprint
  ) values (
    v_reversal_id, p_organization_id, v_original.branch_id, v_entry_number, p_reversal_date,
    'journal_reversal', p_entry_id,
    'عكس قيد ' || v_original.entry_number || ': ' || btrim(p_reason),
    'draft', p_entry_id, p_created_by, v_fingerprint
  );

  insert into public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id,
    debit, credit, memo, cost_center_id
  )
  select jl.organization_id, v_reversal_id, jl.account_id, jl.branch_id,
         jl.credit, jl.debit,
         case when jl.memo is null then 'عكس قيد ' || v_original.entry_number else 'عكس: ' || jl.memo end,
         jl.cost_center_id
  from public.journal_lines jl
  where jl.organization_id = p_organization_id and jl.journal_entry_id = p_entry_id
  order by jl.created_at, jl.id;

  update public.journal_entries set status = 'posted'
  where id = v_reversal_id and organization_id = p_organization_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, v_original.branch_id, p_created_by,
    'journal_entry_reversed_atomic', 'journal_entry', p_entry_id,
    jsonb_build_object(
      'reversal_entry_id', v_reversal_id, 'reversal_entry_number', v_entry_number,
      'reversal_date', p_reversal_date, 'reason', btrim(p_reason), 'line_count', v_line_count
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false,
    'entry_id', v_reversal_id, 'entry_number', v_entry_number
  );
end;
$$;

drop policy if exists "journal entries accountant write" on public.journal_entries;
drop policy if exists "journal lines accountant write" on public.journal_lines;

revoke all on function public.post_balanced_journal_atomic(
  uuid, uuid, text, uuid, text, date, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.post_balanced_journal_atomic(
  uuid, uuid, text, uuid, text, date, jsonb, uuid
) to service_role;
revoke all on function public.reverse_journal_entry_atomic(
  uuid, uuid, text, date, uuid
) from public, anon, authenticated;
grant execute on function public.reverse_journal_entry_atomic(
  uuid, uuid, text, date, uuid
) to service_role;

-- Pre-deployment validation (review every returned row; do not delete it):
-- select je.id, je.organization_id, je.entry_number, je.source_doc_type, je.source_doc_id,
--        je.created_at, count(jl.id) as line_count,
--        coalesce(sum(jl.debit),0) as debits, coalesce(sum(jl.credit),0) as credits
-- from public.journal_entries je
-- left join public.journal_lines jl on jl.organization_id = je.organization_id and jl.journal_entry_id = je.id
-- where je.status = 'draft'
-- group by je.id;

-- Forward correction: replace either RPC in a later migration. Posted rows remain
-- immutable; any accounting correction must be a new reversal/adjustment entry.
