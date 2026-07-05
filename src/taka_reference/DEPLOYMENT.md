# 🚀 دليل النشر والـ Deployment

هذا الدليل يشرح كيفية نشر تطبيق **تكة** على منصات مختلفة.

---

## 📋 المتطلبات الأساسية

- Node.js 16+ مثبت على نظامك
- حساب على منصة نشر (Vercel, Netlify, GitHub Pages, إلخ)
- Git مثبت على نظامك

---

## 🔧 البناء المحلي

### 1. تثبيت المكتبات
```bash
npm install
```

### 2. تشغيل بيئة التطوير
```bash
npm run dev
```

### 3. بناء للإنتاج
```bash
npm run build
```

### 4. اختبار البناء محلياً
```bash
npm run preview
```

---

## ☁️ نشر على Vercel (الأفضل للتطبيقات الـ React)

### الطريقة الأولى: الواجهة الرسمية
1. اذهب إلى [vercel.com](https://vercel.com)
2. قم بتسجيل الدخول أو إنشاء حساب
3. اختر "New Project"
4. اختر مستودع GitHub الخاص بك
5. اتركها على الإعدادات الافتراضية
6. اضغط "Deploy"

### الطريقة الثانية: سطر الأوامر (CLI)
```bash
npm install -g vercel
vercel
# اتبع التعليمات التي تظهر
```

---

## 📦 نشر على Netlify

### الطريقة الأولى: من GitHub مباشرة
1. اذهب إلى [netlify.com](https://netlify.com)
2. اختر "New site from Git"
3. اختر GitHub وحدد المستودع
4. في Build Settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. اضغط "Deploy"

### الطريقة الثانية: بدون Git
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

---

## 🔗 متغيرات البيئة

إذا كنت بحاجة لاستخدام متغيرات بيئية:

### إنشاء ملف `.env` محليًا
```
VITE_API_URL=https://api.example.com
VITE_APP_NAME=تكة
```

### في Vercel:
1. اذهب إلى Project Settings
2. اختر Environment Variables
3. أضف المتغيرات

### في Netlify:
1. اذهب إلى Site Settings
2. اختر Build & Deploy → Environment
3. أضف المتغيرات

---

## ✅ فحوصات ما قبل النشر

قبل النشر، تأكد من:

```bash
# 1. فحص الأخطاء
npm run lint

# 2. بناء ناجح
npm run build

# 3. اختبار محلي
npm run preview
```

---

## 🌍 إعدادات النطاق المخصص

### في Vercel:
1. اذهب إلى Project Settings
2. اختر Domains
3. أضف نطاقك المخصص
4. اتبع تعليمات DNS

### في Netlify:
1. اذهب إلى Site Settings
2. اختر Domain Management
3. أضف نطاقك المخصص

---

## 🔍 استكشاف الأخطاء

### الموقع يظهر فارغاً
- تحقق من أن `dist` مبنية بشكل صحيح
- تأكد من تعيين مجلد النشر على `dist`

### أخطاء JavaScript
- افتح Developer Tools (F12)
- تحقق من console للأخطاء
- تحقق من أن جميع الصور والموارد محملة

### البيانات تختفي بعد الـ Refresh
- تأكد من أن LocalStorage يعمل بشكل صحيح
- تحقق من عدم استخدام الـ Private Browsing

---

## 🔄 التحديثات المستقبلية

عند إجراء تحديثات:

```bash
# 1. أضف التغييرات
git add .

# 2. قم بعمل commit
git commit -m "وصف التغييرات"

# 3. اضغط إلى GitHub
git push

# سيتم النشر تلقائياً!
```

---

## 📞 الدعم

إذا واجهت أي مشاكل:
- تحقق من الأخطاء في Console
- راجع وثائق المنصة (Vercel/Netlify)
- افتح issue على GitHub
