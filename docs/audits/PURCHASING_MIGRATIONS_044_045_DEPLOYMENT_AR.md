# خطة نشر ترحيلي المدفوعات والمشتريات 044 و045

## النطاق

- `044_atomic_supplier_payments.sql`: دفعات الموردين الذرّية، قيد مستقل لكل دفعة، ومنع التكرار.
- `045_atomic_purchasing_cycle.sql`: إنشاء أمر الشراء ببنده، استلام المخزون وقيد GRNI، وفاتورة المورد وقيد AP ضمن معاملات ذرّية.
- لا تُطبّق هذه الملفات تلقائياً على مشروع الإنتاج.

## ترتيب النشر

1. أخذ نسخة احتياطية من قاعدة البيانات أو إنشاء فرع قاعدة بيانات للاختبار.
2. تشغيل استعلامات ما قبل النشر أدناه. أي نتيجة غير فارغة تحتاج مراجعة قبل المتابعة.
3. تطبيق `044` ثم `045` على بيئة غير إنتاجية بعد تطبيق ترحيلات GitHub `040` إلى `043`.
4. تنفيذ سيناريوهات الاستلام الجزئي، إعادة الطلب بنفس المفتاح، الفاتورة المرتبطة، الفاتورة المباشرة، والدفعة الجزئية.
5. تشغيل استعلامات ما بعد النشر ومطابقة دفتر الأستاذ مع السجلات الفرعية.
6. تطبيق الترحيلين على الإنتاج في نافذة صيانة قصيرة ثم مراقبة الأخطاء والقيود الجديدة.

## فحوصات ما قبل النشر

```sql
-- أوامر قديمة بلا بنود: يجب تصحيحها أو إلغاؤها قبل الاستلام.
select po.id, po.organization_id, po.status
from purchase_orders po
left join purchase_order_items poi on poi.purchase_order_id = po.id
group by po.id, po.organization_id, po.status
having count(poi.id) = 0;

-- أرقام فواتير مورد مكررة وغير ملغاة.
select organization_id, supplier_id, invoice_number, count(*)
from invoices
where invoice_number is not null and status <> 'void'
group by organization_id, supplier_id, invoice_number
having count(*) > 1;

-- دفعات لا يساوي مجموعها paid_amount في الفاتورة.
select i.id, i.paid_amount, coalesce(sum(sp.amount), 0) as payments_total
from invoices i
left join supplier_payments sp on sp.invoice_id = i.id and sp.organization_id = i.organization_id
group by i.id, i.paid_amount
having abs(i.paid_amount - coalesce(sum(sp.amount), 0)) > 0.001;
```

## فحوصات ما بعد النشر

```sql
-- لا يوجد أكثر من مستند للمفتاح نفسه.
select organization_id, idempotency_key, count(*)
from goods_receipts
where idempotency_key is not null
group by organization_id, idempotency_key
having count(*) > 1;

select organization_id, idempotency_key, count(*)
from invoices
where idempotency_key is not null
group by organization_id, idempotency_key
having count(*) > 1;

select organization_id, idempotency_key, count(*)
from supplier_payments
where idempotency_key is not null
group by organization_id, idempotency_key
having count(*) > 1;

-- إجمالي سند الاستلام يساوي مجموع بنوده.
select gr.id, gr.total, coalesce(sum(gri.total), 0) as items_total
from goods_receipts gr
left join goods_receipt_items gri on gri.goods_receipt_id = gr.id
where gr.status = 'posted'
group by gr.id, gr.total
having abs(gr.total - coalesce(sum(gri.total), 0)) > 0.001;

-- كل سند استلام مرحّل له قيد منشور مرتبط بالسند نفسه.
select gr.id
from goods_receipts gr
left join journal_entries je
  on je.organization_id = gr.organization_id
 and je.source_doc_type = 'purchase_receipt'
 and je.source_doc_id = gr.id
 and je.status = 'posted'
where gr.status = 'posted' and je.id is null;

-- كل فاتورة مورد مرحلة لها بند وقيد منشور.
select i.id
from invoices i
left join invoice_items ii on ii.invoice_id = i.id
left join journal_entries je
  on je.organization_id = i.organization_id
 and je.source_doc_type = 'supplier_invoice'
 and je.source_doc_id = i.id
 and je.status = 'posted'
where i.status in ('posted', 'partially_paid', 'paid')
group by i.id
having count(ii.id) = 0 or count(je.id) = 0;

-- كل دفعة لها قيدها المستقل.
select sp.id
from supplier_payments sp
left join journal_entries je
  on je.id = sp.journal_entry_id
 and je.organization_id = sp.organization_id
 and je.source_doc_type = 'supplier_payment'
 and je.source_doc_id = sp.id
 and je.status = 'posted'
where je.id is null;

-- القيود الناتجة متوازنة.
select je.id, sum(jl.debit) as debit, sum(jl.credit) as credit
from journal_entries je
join journal_lines jl on jl.journal_entry_id = je.id
where je.source_doc_type in ('purchase_receipt', 'supplier_invoice', 'supplier_payment')
  and je.status = 'posted'
group by je.id
having abs(sum(jl.debit) - sum(jl.credit)) > 0.001;
```

## سيناريوهات القبول

- إنشاء أمر شراء بنفس مفتاح الطلب مرتين يُرجع الأمر نفسه ولا يكرر البند.
- استلام الأمر بنفس المفتاح مرتين لا يكرر الرصيد أو الحركة أو القيد.
- فشل أي سطر في الاستلام يعيد العملية كاملة دون سند أو حركة جزئية.
- الفاتورة المرتبطة لا تزيد المخزون وتخصم GRNI، ولا تتجاوز الكمية المستلمة غير المفوترة.
- الفاتورة المباشرة تزيد المخزون وتحدّث متوسط التكلفة وتسجل AP في العملية نفسها.
- الدفعتان الجزئيتان تنشئان قيدين مستقلين وتحدّثان الرصيد بدقة.
- الفترة المقفلة ترفض الاستلام والفاتورة والدفع دون أي أثر جزئي.
- مستخدم من مؤسسة أخرى لا يستطيع استدعاء أي RPC على المؤسسة المستهدفة.

## التراجع والتصحيح

- لا يُحذف أي سند أو حركة أو قيد تم إنشاؤه بعد النشر.
- عند اكتشاف خلل، يُوقف استدعاء RPC المتأثر في التطبيق ويُنشأ ترحيل تصحيحي أمامي.
- القيود المالية الخاطئة تُعكس بقيود عكسية، والمخزون يُصحح بحركة تسوية مع مرجع وتدقيق.
- يمكن إلغاء صلاحية التنفيذ مؤقتاً عند الحاجة:

```sql
revoke all on function record_supplier_payment_atomic(uuid, uuid, numeric, text, date, text, text, uuid) from public, authenticated, service_role;
revoke all on function create_purchase_order_atomic(uuid, uuid, uuid, uuid, numeric, numeric, date, public.purchase_order_status, text, text, uuid) from public, authenticated, service_role;
revoke all on function record_purchase_receipt_atomic(uuid, uuid, date, text, uuid) from public, authenticated, service_role;
revoke all on function create_supplier_invoice_atomic(uuid, uuid, uuid, text, date, date, uuid, numeric, numeric, uuid, text, date, text, uuid) from public, authenticated, service_role;
```
