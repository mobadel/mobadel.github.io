/*
 * داده‌های ساختاریافتهٔ (JSON-LD) همهٔ صفحه‌های ساخته‌شده.
 *
 * قاعدهٔ اصلی: اسکیما ادعای ماشین‌خوان است، پس هر نود فقط وقتی منتشر
 * می‌شود که محتوای متناظرش واقعاً روی همان صفحه باشد. سازنده‌ها توابع
 * خالص‌اند (ورودی ← آبجکت)، هیچ‌کدام @context نمی‌گذارند و سازندهٔ شرطی
 * به‌جای آبجکت خالی null برمی‌گرداند. jsonLdScript یک بار می‌پیچد.
 *
 * عمداً نیست (جزئیات و دلیل در docs/SCHEMA.md):
 * - هیچ Offer، price یا seller: تبدکس چیزی نمی‌فروشد و نرخ لحظه‌ای در
 *   اسکیما روزها در کش گوگل کهنه می‌ماند.
 * - SearchAction: جستجوی /price/ کاملاً سمت مرورگر است و صفحهٔ نتایج ندارد.
 * - FAQPage: پرسش‌های متن جفت‌ها بخشی از مقاله‌اند، نه بخش پرسش متداول.
 */

export const ORIGIN = "https://tabdex.ir";
export const ORGANIZATION_ID = `${ORIGIN}/#organization`;
export const WEBSITE_ID = `${ORIGIN}/#website`;
export const CONVERTER_ID = `${ORIGIN}/convert/#application`;

const ref = (id) => ({ "@id": id });
const pageId = (path) => `${ORIGIN}${path}#webpage`;

// پروفایل‌های رسمی همان‌هایی‌اند که پانویس سایت به آن‌ها پیوند می‌دهد.
export function buildOrganization() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "تبدکس",
    alternateName: "Tabdex",
    url: `${ORIGIN}/`,
    logo: { "@type": "ImageObject", url: `${ORIGIN}/assets/apple-touch-icon.png`, width: 180, height: 180 },
    email: "info@tabdex.ir",
    sameAs: ["https://t.me/tabdexir", "https://www.instagram.com/tabdex.ir"]
  };
}

export function buildWebSite() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "تبدکس",
    alternateName: "Tabdex",
    url: `${ORIGIN}/`,
    publisher: ref(ORGANIZATION_ID),
    inLanguage: "fa-IR"
  };
}

/* یک سازنده برای مبدل، چون هم روی صفحهٔ اصلی است، هم روی /convert/ و
   هم روی همهٔ صفحه‌های جفت؛ جدا نوشتنش یعنی روزی از هم دور می‌افتند.
   offers ندارد: isAccessibleForFree همان «رایگان» را بدون ساختن رابطهٔ
   فروشنده و خریدار می‌گوید. */
export function buildConverter() {
  return {
    "@type": "WebApplication",
    "@id": CONVERTER_ID,
    name: "مبدل قیمت تبدکس",
    url: `${ORIGIN}/convert/`,
    description: "ابزار رایگان تبدیل طلا، سکه، ارز و ارزهای دیجیتال به تومان و به یکدیگر با نرخ مرجع بازار.",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    inLanguage: "fa-IR",
    publisher: ref(ORGANIZATION_ID)
  };
}

// فقط روی صفحه‌ای که بردکرامب واقعاً دیده می‌شود.
export function buildBreadcrumb(path, items) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${ORIGIN}${path}#breadcrumb`,
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: ORIGIN + item.path }))
  };
}

function basePage(type, { path, name, description }) {
  const page = { "@type": type, "@id": pageId(path), url: ORIGIN + path, name };
  if (description) page.description = description;
  page.isPartOf = ref(WEBSITE_ID);
  page.inLanguage = "fa-IR";
  return page;
}

/* ItemList یک Intangible است و با hasPart نمی‌چسبد؛ فقط وقتی mainEntity
   می‌شود که خودِ فهرست موضوع صفحه باشد. فهرست خالی ⇒ null. */
export function buildItemList(path, name, items) {
  if (!items.length) return null;
  return {
    "@type": "ItemList",
    "@id": `${ORIGIN}${path}#list`,
    name,
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, url: ORIGIN + item.path }))
  };
}

// صفحه‌ای که فهرست دارد: CollectionPage؛ صفحه‌ای که فهرستش موضوع نیست: WebPage.
export function buildCollectionPage(meta, list) {
  const page = basePage("CollectionPage", meta);
  if (list) page.mainEntity = ref(list["@id"]);
  page.publisher = ref(ORGANIZATION_ID);
  return page;
}

/* «درباره ما» و «تماس» دربارهٔ خودِ ناشرند، پس about می‌گیرند؛ بقیهٔ
   صفحه‌ها فقط publisher. about: #organization روی صفحهٔ مبدل یعنی
   «این صفحه دربارهٔ تبدکس است» که درست نیست. */
export function buildWebPage(meta, { type = "WebPage", about, mainEntity, hasPart, breadcrumb } = {}) {
  const page = basePage(type, meta);
  if (about) page.about = about;
  if (mainEntity) page.mainEntity = mainEntity;
  if (hasPart && hasPart.length) page.hasPart = hasPart;
  if (breadcrumb) page.breadcrumb = ref(breadcrumb["@id"]);
  page.publisher = ref(ORGANIZATION_ID);
  return page;
}

/* دارایی (دلار، طلا، بیت کوین…) چیزی نیست که اینجا فروخته شود و
   schema.org تایپ دقیق بی‌ادعایی برایش ندارد؛ پس Thing. برای دقیق‌تر
   شدن تایپ عوض نمی‌شود، هویت اضافه می‌شود: alternateName و (وقتی دستی
   و درست وارد شد) sameAs ویکی‌دیتا. */
export function buildThing(id, { name, alternateName, sameAs }) {
  const thing = { "@type": "Thing", "@id": id, name };
  if (alternateName && alternateName !== name) thing.alternateName = alternateName;
  if (sameAs) thing.sameAs = sameAs;
  return thing;
}

/* نمودار تایپ ندارد؛ چیزی که نمودار واقعاً هست یک سری زمانی منتشرشده
   است. فقط وقتی ساخته می‌شود که نمودار روی صفحه هست و تاریخ واقعی شروع
   داده را داریم؛ بدون آن null. عدد قیمت عمداً داخلش نیست. واحد نمودار
   تومان است و کد ISO ندارد، پس unitText متن است و هیچ عددی کنارش نیست
   که ده برابر غلط خوانده شود. license عمداً نیست: داده با مجوز باز
   منتشر نشده و صفحهٔ شرایط استفاده هم نداریم. */
export function buildDataset(path, { name, since }) {
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) return null;
  const year = Number(since.slice(0, 4));
  if (year < 1900 || year > new Date().getUTCFullYear() + 1) return null;
  return {
    "@type": "Dataset",
    "@id": `${ORIGIN}${path}#series`,
    name: `نمودار قیمت ${name}`,
    description: `سری زمانی قیمت ${name} به تومان که در نمودار همین صفحه نمایش داده می‌شود.`,
    url: ORIGIN + path,
    temporalCoverage: `${since}/..`,
    isAccessibleForFree: true,
    inLanguage: "fa-IR",
    creator: ref(ORGANIZATION_ID),
    variableMeasured: { "@type": "PropertyValue", name: `قیمت ${name}`, unitText: "تومان" }
  };
}

/* هر صفحه این دو نود را دارد تا گراف به برند اصلی وصل بماند. */
export function withIdentity(nodes) {
  return [buildOrganization(), buildWebSite(), ...nodes.filter(Boolean)];
}

/* < در متن JSON-LD با < نوشته می‌شود تا متنی مثل «</script>» داخل
   نام یا توضیح، تگ را زودتر نبندد. تک‌نود مستقیم، چندتا زیر @graph. */
export function jsonLdScript(nodes, attributes = "") {
  const list = nodes.filter(Boolean);
  if (!list.length) return "";
  const body = list.length === 1 ? { "@context": "https://schema.org", ...list[0] } : { "@context": "https://schema.org", "@graph": list };
  const json = JSON.stringify(body).replace(/</g, "\\u003c");
  return `<script${attributes} type="application/ld+json">${json}</script>`;
}

const LD_BLOCK = /<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/g;

/* هر صفحه دقیقاً یک بلاک JSON-LD دارد. بلاک قالب جایگزین می‌شود؛ اگر
   قالب بلاکی نداشت، پیش از </head> می‌نشیند. */
export function replaceJsonLd(html, nodes, attributes = "") {
  const script = jsonLdScript(nodes, attributes);
  const stripped = html.replace(LD_BLOCK, "");
  if (!script) return stripped;
  if (!stripped.includes("</head>")) throw new Error("</head> پیدا نشد؛ جای JSON-LD معلوم نیست.");
  return stripped.replace("</head>", `${script}\n</head>`);
}
