"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";

type ModifierOption = {
  id?: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
};

type ModifierGroup = {
  id: string;
  name: string;
  selectionType: "single" | "multiple";
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
  catalogItemIds: string[];
};

type CatalogItem = { id: string; name: string; category: string | null };

type ModifierGroupEditor = {
  id?: string;
  name: string;
  selectionType: "single" | "multiple";
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
  catalogItemIds: string[];
};

const emptyEditor = (): ModifierGroupEditor => ({
  id: undefined,
  name: "",
  selectionType: "single",
  minSelect: 0,
  maxSelect: 1,
  isRequired: false,
  options: [{ id: undefined, name: "", priceDelta: 0, isDefault: false, isAvailable: true }],
  catalogItemIds: [],
});

export default function ModifiersPage() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<ModifierGroupEditor | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/modifiers");
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر التحميل");
      setGroups(p.groups);
      setCatalogItems(p.catalogItems);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const optionName = (id: string) => catalogItems.find((c) => c.id === id)?.name ?? id;

  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim()) { setError("اسم المجموعة مطلوب"); return; }
    if (editor.options.some((o) => !o.name.trim())) { setError("كل الخيارات تحتاج اسم"); return; }
    setSaving(true); setError("");
    try {
      const body = {
        id: editor.id,
        name: editor.name,
        selectionType: editor.selectionType,
        minSelect: editor.minSelect,
        maxSelect: editor.maxSelect,
        isRequired: editor.isRequired,
        options: editor.options.map((o) => ({
          id: o.id, name: o.name, priceDelta: Number(o.priceDelta) || 0,
          isDefault: o.isDefault, isAvailable: o.isAvailable,
        })),
        catalogItemIds: editor.catalogItemIds,
      };
      const r = editor.id
        ? await fetch("/api/modifiers", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/modifiers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر الحفظ");
      setEditor(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف مجموعة الإضافات نهائيًا؟")) return;
    try {
      const r = await fetch(`/api/modifiers?id=${id}`, { method: "DELETE" });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر الحذف");
      await load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <PageHeader
        title="مجموعات الإضافات (Modifiers)"
        description="أنشئ مجموعات إضافات لكل صنف مثل الحجم والإضافات بأسعار مختلفة، واربطها بأصناف الكتالوج."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>المجموعات ({groups.length})</CardTitle>
            <Button onClick={() => setEditor(emptyEditor())} className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> مجموعة جديدة
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}
            {!loading && groups.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد مجموعات بعد. أضف مجموعة لربطها بالأصناف.</p>
            )}
            {groups.map((g) => (
              <div key={g.id} className="border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.selectionType === "single" ? "اختيار واحد" : "متعدد"} · {g.isRequired ? "إلزامي" : "اختياري"} · {g.catalogItemIds.length} صنف
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setEditor({ ...emptyEditor(), ...g, options: g.options.map((o) => ({ ...o })) })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-500" onClick={() => remove(g.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o, i) => (
                    <span key={i} className="text-[11px] bg-slate-100 rounded-full px-2 py-0.5">
                      {o.name}{o.priceDelta > 0 ? ` +${o.priceDelta}` : ""}{o.isDefault ? " ★" : ""}
                    </span>
                  ))}
                </div>
                {g.catalogItemIds.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2 truncate">
                    الأصناف: {g.catalogItemIds.map(optionName).join("، ")}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {editor && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editor.id ? "تعديل المجموعة" : "مجموعة جديدة"}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setEditor(null)}><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>اسم المجموعة</Label>
                <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="الحجم، الإضافات..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>نوع الاختيار</Label>
                  <select value={editor.selectionType} onChange={(e) => setEditor({ ...editor, selectionType: e.target.value as any })}
                    className="w-full h-10 border rounded-md px-2 bg-background">
                    <option value="single">اختيار واحد</option>
                    <option value="multiple">متعدد</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editor.isRequired} onChange={(e) => setEditor({ ...editor, isRequired: e.target.checked })} />
                    إلزامي
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>الخيارات</Label>
                  <Button variant="outline" size="sm" onClick={() => setEditor({ ...editor, options: [...editor.options, { name: "", priceDelta: 0, isDefault: false, isAvailable: true }] })}>
                    <Plus className="h-3.5 w-3.5" /> خيار
                  </Button>
                </div>
                <div className="space-y-2">
                  {editor.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="flex-1" value={o.name} placeholder="اسم الخيار" onChange={(e) => {
                        const opts = [...editor.options]; opts[i] = { ...o, name: e.target.value }; setEditor({ ...editor, options: opts });
                      }} />
                      <Input type="number" className="w-24" value={o.priceDelta} onChange={(e) => {
                        const opts = [...editor.options]; opts[i] = { ...o, priceDelta: Number(e.target.value) || 0 }; setEditor({ ...editor, options: opts });
                      }} />
                      <label className="flex items-center text-xs" title="افتراضي">
                        <input type="checkbox" checked={o.isDefault} onChange={(e) => {
                          const opts = [...editor.options]; opts[i] = { ...o, isDefault: e.target.checked }; setEditor({ ...editor, options: opts });
                        }} /> افتراضي
                      </label>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setEditor({ ...editor, options: editor.options.filter((_, j) => j !== i) })}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>أصناف الكتالوج المرتبطة</Label>
                <select multiple value={editor.catalogItemIds} onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setEditor({ ...editor, catalogItemIds: vals });
                }} className="w-full h-32 border rounded-md p-2 bg-background text-sm">
                  {catalogItems.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">اضغط Ctrl/⌘ لاختيار عدة أصناف.</p>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>}
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving ? <ChevronDown className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> حفظ</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
