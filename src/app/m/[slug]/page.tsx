import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, MessageCircle, Phone, UtensilsCrossed } from "lucide-react";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

type PublicMenuItem = {
  id: string;
  name: string;
  selling_price: number;
  image_url: string | null;
  category_name: string;
  description: string | null;
  is_featured: boolean;
  display_order: number;
};

type PublicRestaurantSite = {
  id: string;
  slug: string;
  display_name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  contact_phone: string | null;
  whatsapp_phone: string | null;
  address: string | null;
  items: PublicMenuItem[];
};

const getPublicSite = cache(async (slug: string): Promise<PublicRestaurantSite | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !hasSupabaseAdminEnv()) return null;
  const admin = createAdminClientWithContext("public-restaurant-site");
  const { data, error } = await (admin as any).rpc("get_public_restaurant_site", { p_slug: slug });
  if (error) {
    console.error("Public restaurant site query failed:", error);
    return null;
  }
  return data as PublicRestaurantSite | null;
});

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return { title: "المنيو غير متاح" };
  return {
    title: `${site.display_name} | المنيو الإلكتروني`,
    description: site.tagline || site.description || `منيو ${site.display_name}`,
    openGraph: {
      title: site.display_name,
      description: site.tagline || site.description || `منيو ${site.display_name}`,
      images: site.cover_url ? [site.cover_url] : [],
    },
  };
}

export default async function PublicRestaurantSitePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();

  const categories = Array.from(new Set(site.items.map((item) => item.category_name)));
  const whatsapp = site.whatsapp_phone?.replace(/[^0-9]/g, "");

  return (
    <main dir="rtl" className="min-h-screen bg-[#f8fafc] text-slate-900" style={{ "--site-color": site.primary_color } as React.CSSProperties}>
      <section className="relative min-h-[360px] overflow-hidden bg-slate-950 text-white">
        {site.cover_url && <img src={site.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="relative mx-auto flex min-h-[360px] max-w-6xl flex-col justify-end px-5 py-10 md:px-8">
          {site.logo_url ? <img src={site.logo_url} alt={`شعار ${site.display_name}`} className="mb-5 h-20 w-20 rounded-2xl border border-white/20 bg-white object-contain p-2 shadow-2xl" /> : <span className="mb-5 grid h-20 w-20 place-items-center rounded-2xl border border-white/15 bg-white/10"><UtensilsCrossed className="h-9 w-9" /></span>}
          <h1 className="text-4xl font-black md:text-6xl">{site.display_name}</h1>
          {site.tagline && <p className="mt-3 max-w-2xl text-lg text-slate-200 md:text-xl">{site.tagline}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            {site.contact_phone && <a href={`tel:${site.contact_phone}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><Phone className="h-4 w-4" />اتصال</a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
            {site.address && <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm"><MapPin className="h-4 w-4" />{site.address}</span>}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {site.description && <p className="mx-auto mb-10 max-w-3xl text-center text-base leading-8 text-slate-600">{site.description}</p>}
        {site.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-16 text-center"><UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h2 className="font-black">المنيو قيد التجهيز</h2><p className="mt-1 text-sm text-slate-500">ستظهر الأصناف هنا بعد تحديث المطعم.</p></div>
        ) : (
          <div className="space-y-12">
            {categories.map((category) => (
              <section key={category}>
                <div className="mb-5 flex items-center gap-3"><span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: site.primary_color }} /><h2 className="text-2xl font-black">{category}</h2></div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {site.items.filter((item) => item.category_name === category).map((item) => (
                    <article key={item.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${item.is_featured ? "ring-2 ring-[var(--site-color)]/30" : ""}`}>
                      {item.image_url ? <img src={item.image_url} alt={item.name} className="aspect-[16/10] w-full object-cover" /> : <div className="grid aspect-[16/10] place-items-center bg-slate-100"><UtensilsCrossed className="h-10 w-10 text-slate-300" /></div>}
                      <div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="text-lg font-black">{item.name}</h3>{item.is_featured && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">مميز</span>}</div>{item.description && <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>}</div><strong className="shrink-0 text-lg" style={{ color: site.primary_color }}>{Number(item.selling_price).toFixed(2)} د.أ</strong></div></div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <footer className="border-t bg-white py-6 text-center text-xs text-slate-400">منيو وموقع مترابطان عبر رواق</footer>
    </main>
  );
}
