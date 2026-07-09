/**
 * دوال المطابقة الذكية للبحث الشامل.
 * نقية بلا اعتماديات خادم حتى يمكن اختبارها واستخدامها من أي مكان.
 */

/** توحيد النص العربي: همزات، تاء مربوطة، ألف مقصورة، تشكيل، تطويل. */
export function normalize(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ً-ْـ]/g, "")
    .trim();
}

/** يزيل "ال" التعريف من أول الكلمة حتى تتطابق «المخزن» مع «مخزن» والعكس. */
export function stripArticle(token: string): string {
  return token.length > 3 && token.startsWith("ال") ? token.slice(2) : token;
}

export function tokenize(query: string): string[] {
  return normalize(query)
    .split(/[\s،,]+/)
    .map(stripArticle)
    .filter((t) => t.length > 0);
}

/** تجذيع خفيف: يزيل لواحق الجمع والتأنيث الشائعة حتى تتطابق «وردية» مع «ورديات». */
export function stem(word: string): string {
  const suffixes = ["ات", "ون", "ين", "يه", "ه", "ي"];
  let w = word;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
        w = w.slice(0, w.length - suffix.length);
        changed = true;
        break;
      }
    }
  }
  return w;
}

/** هل يحتوي الحقل على الرمز (مع تجاهل ال التعريف واللواحق داخل كلمات الحقل)؟ */
export function fieldHasToken(field: string, token: string): boolean {
  if (field.includes(token)) return true;
  const stemmedToken = stem(token);
  return field.split(/[\s،,]+/).some((raw) => {
    const word = stripArticle(raw);
    return word.includes(token) || stem(word).includes(stemmedToken);
  });
}

/**
 * مطابقة متعددة الكلمات: كل كلمة من البحث يجب أن توجد في أي حقل من الحقول.
 * يعيد درجة (أعلى = أفضل) أو null إذا لم تتطابق كل الكلمات.
 */
export function scoreMatch(
  tokens: string[],
  weightedFields: Array<[text: string | null | undefined, weight: number]>,
): number | null {
  const fields = weightedFields
    .filter((entry): entry is [string, number] => Boolean(entry[0]))
    .map(([text, weight]) => [normalize(text), weight] as const);

  let total = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    for (const [field, weight] of fields) {
      if (!fieldHasToken(field, token)) continue;
      // تطابق أقوى إذا كانت الكلمة كلمة كاملة في الحقل أو في بدايته
      const words = field.split(/[\s،,]+/).map(stripArticle);
      const exact = words.includes(token) ? 2 : field.startsWith(token) ? 1.5 : 1;
      tokenScore += weight * exact;
    }
    if (tokenScore === 0) return null; // كلمة لم تتطابق مع أي حقل → استبعاد
    total += tokenScore;
  }
  return total;
}
