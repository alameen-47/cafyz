const KEY = 'cafyz_language_code';

type LangCode = 'en' | 'ar' | 'fr' | 'es' | 'de' | 'hi' | 'ur';

const PHRASES: Record<string, Partial<Record<LangCode, string>>> = {
  'Operations': { ar: 'العمليات', fr: 'Opérations', es: 'Operaciones', de: 'Betrieb', hi: 'ऑपरेशन्स', ur: 'آپریشنز' },
  'Overview': { ar: 'نظرة عامة', fr: 'Aperçu', es: 'Resumen', de: 'Übersicht', hi: 'अवलोकन', ur: 'جائزہ' },
  'Inventory': { ar: 'المخزون', fr: 'Inventaire', es: 'Inventario', de: 'Inventar', hi: 'इन्वेंटरी', ur: 'انوینٹری' },
  'Staff': { ar: 'الموظفون', fr: 'Équipe', es: 'Personal', de: 'Mitarbeiter', hi: 'स्टाफ', ur: 'اسٹاف' },
  'Reports': { ar: 'التقارير', fr: 'Rapports', es: 'Reportes', de: 'Berichte', hi: 'रिपोर्ट्स', ur: 'رپورٹس' },
  'Role Management': { ar: 'إدارة الأدوار', fr: 'Gestion des rôles', es: 'Gestión de roles', de: 'Rollenverwaltung', hi: 'रोल प्रबंधन', ur: 'رول مینجمنٹ' },
  'Point of Sale': { ar: 'نقطة البيع', fr: 'Point de vente', es: 'Punto de venta', de: 'Kasse', hi: 'पॉइंट ऑफ सेल', ur: 'پوائنٹ آف سیل' },
  'Menu': { ar: 'القائمة', fr: 'Menu', es: 'Menú', de: 'Menü', hi: 'मेन्यू', ur: 'مینیو' },
  'Kitchen': { ar: 'المطبخ', fr: 'Cuisine', es: 'Cocina', de: 'Küche', hi: 'किचन', ur: 'کچن' },
  'Expedite': { ar: 'التجهيز', fr: 'Expédition', es: 'Despacho', de: 'Ausgabe', hi: 'डिस्पैच', ur: 'ایکسپیڈائٹ' },
  'Floor Plan': { ar: 'مخطط الصالة', fr: 'Plan de salle', es: 'Plano del salón', de: 'Saalplan', hi: 'फ्लोर प्लान', ur: 'فلور پلان' },
  'Table Setup': { ar: 'إعداد الطاولات', fr: 'Configuration des tables', es: 'Configuración de mesas', de: 'Tischkonfiguration', hi: 'टेबल सेटअप', ur: 'ٹیبل سیٹ اپ' },
  'Notifications': { ar: 'الإشعارات', fr: 'Notifications', es: 'Notificaciones', de: 'Benachrichtigungen', hi: 'नोटिफिकेशन्स', ur: 'اطلاعات' },
  'Mark all read': { ar: 'تحديد الكل كمقروء', fr: 'Tout marquer comme lu', es: 'Marcar todo como leído', de: 'Alle als gelesen markieren', hi: 'सभी पढ़ा हुआ', ur: 'سب کو پڑھا ہوا کریں' },
  'No new notifications for this panel.': { ar: 'لا توجد إشعارات جديدة لهذه الشاشة.', fr: 'Aucune nouvelle notification pour cet écran.', es: 'No hay nuevas notificaciones para esta sección.', de: 'Keine neuen Benachrichtigungen für dieses Panel.', hi: 'इस पैनल के लिए कोई नई नोटिफिकेशन नहीं।', ur: 'اس پینل کے لیے کوئی نئی اطلاع نہیں۔' },
  'Send to Kitchen': { ar: 'إرسال إلى المطبخ', fr: 'Envoyer à la cuisine', es: 'Enviar a cocina', de: 'An Küche senden', hi: 'किचन में भेजें', ur: 'کچن کو بھیجیں' },
  'Selected Items': { ar: 'العناصر المحددة', fr: 'Articles sélectionnés', es: 'Artículos seleccionados', de: 'Ausgewählte Artikel', hi: 'चयनित आइटम', ur: 'منتخب آئٹمز' },
  'Total': { ar: 'الإجمالي', fr: 'Total', es: 'Total', de: 'Gesamt', hi: 'कुल', ur: 'کل' },
  'Select table…': { ar: 'اختر طاولة…', fr: 'Sélectionner une table…', es: 'Seleccionar mesa…', de: 'Tisch wählen…', hi: 'टेबल चुनें…', ur: 'ٹیبل منتخب کریں…' },
  'Pending Table Bills': { ar: 'فواتير الطاولات المعلقة', fr: 'Factures de table en attente', es: 'Cuentas de mesa pendientes', de: 'Offene Tischrechnungen', hi: 'पेंडिंग टेबल बिल', ur: 'زیر التواء ٹیبل بلز' },
  'Select Pending Table': { ar: 'اختر الطاولة المعلقة', fr: 'Sélectionner une table en attente', es: 'Seleccionar mesa pendiente', de: 'Offenen Tisch wählen', hi: 'पेंडिंग टेबल चुनें', ur: 'زیر التواء ٹیبل منتخب کریں' },
  'Billing-only mode: orders are created and sent from Menu/Waiter panels.': {
    ar: 'وضع الفوترة فقط: يتم إنشاء الطلبات وإرسالها من القائمة/النادل.',
    fr: 'Mode facturation uniquement : les commandes sont créées et envoyées depuis Menu/Serveur.',
    es: 'Modo solo facturación: los pedidos se crean y envían desde Menú/Mesero.',
    de: 'Nur-Abrechnung-Modus: Bestellungen werden in Menü/Kellner erstellt und gesendet.',
    hi: 'केवल बिलिंग मोड: ऑर्डर मेन्यू/वेटर पैनल से बनते और भेजे जाते हैं।',
    ur: 'صرف بلنگ موڈ: آرڈرز مینیو/ویٹر پینل سے بن کر بھیجے جاتے ہیں۔',
  },
  'Profile': { ar: 'الملف الشخصي', fr: 'Profil', es: 'Perfil', de: 'Profil', hi: 'प्रोफ़ाइल', ur: 'پروفائل' },
  'My Profile': { ar: 'ملفي الشخصي', fr: 'Mon profil', es: 'Mi perfil', de: 'Mein Profil', hi: 'मेरा प्रोफ़ाइल', ur: 'میرا پروفائل' },
  'Manage your profile details, password and 4-digit PIN.': {
    ar: 'قم بإدارة تفاصيل ملفك الشخصي وكلمة المرور ورقم PIN المكون من 4 أرقام.',
    fr: 'Gérez vos informations de profil, mot de passe et PIN à 4 chiffres.',
    es: 'Administra tu perfil, contraseña y PIN de 4 dígitos.',
    de: 'Verwalten Sie Profildaten, Passwort und 4-stellige PIN.',
    hi: 'अपनी प्रोफ़ाइल जानकारी, पासवर्ड और 4-अंकों का PIN मैनेज करें।',
    ur: 'اپنی پروفائل معلومات، پاس ورڈ اور 4 ہندسوں کا PIN مینج کریں۔',
  },
  'Name': { ar: 'الاسم', fr: 'Nom', es: 'Nombre', de: 'Name', hi: 'नाम', ur: 'نام' },
  'Email': { ar: 'البريد الإلكتروني', fr: 'E-mail', es: 'Correo electrónico', de: 'E-Mail', hi: 'ईमेल', ur: 'ای میل' },
  'Phone': { ar: 'الهاتف', fr: 'Téléphone', es: 'Teléfono', de: 'Telefon', hi: 'फोन', ur: 'فون' },
  'Save Profile': { ar: 'حفظ الملف', fr: 'Enregistrer le profil', es: 'Guardar perfil', de: 'Profil speichern', hi: 'प्रोफ़ाइल सेव करें', ur: 'پروفائل محفوظ کریں' },
  'Current Password': { ar: 'كلمة المرور الحالية', fr: 'Mot de passe actuel', es: 'Contraseña actual', de: 'Aktuelles Passwort', hi: 'वर्तमान पासवर्ड', ur: 'موجودہ پاس ورڈ' },
  'New Password': { ar: 'كلمة المرور الجديدة', fr: 'Nouveau mot de passe', es: 'Nueva contraseña', de: 'Neues Passwort', hi: 'नया पासवर्ड', ur: 'نیا پاس ورڈ' },
  'Change Password': { ar: 'تغيير كلمة المرور', fr: 'Changer le mot de passe', es: 'Cambiar contraseña', de: 'Passwort ändern', hi: 'पासवर्ड बदलें', ur: 'پاس ورڈ تبدیل کریں' },
  'Current PIN': { ar: 'رقم PIN الحالي', fr: 'PIN actuel', es: 'PIN actual', de: 'Aktuelle PIN', hi: 'वर्तमान PIN', ur: 'موجودہ PIN' },
  'New PIN': { ar: 'رقم PIN الجديد', fr: 'Nouveau PIN', es: 'Nuevo PIN', de: 'Neue PIN', hi: 'नया PIN', ur: 'نیا PIN' },
  'Change PIN': { ar: 'تغيير PIN', fr: 'Changer le PIN', es: 'Cambiar PIN', de: 'PIN ändern', hi: 'PIN बदलें', ur: 'PIN تبدیل کریں' },
  'Save': { ar: 'حفظ', fr: 'Enregistrer', es: 'Guardar', de: 'Speichern', hi: 'सेव करें', ur: 'محفوظ کریں' },
  'Cancel': { ar: 'إلغاء', fr: 'Annuler', es: 'Cancelar', de: 'Abbrechen', hi: 'रद्द करें', ur: 'منسوخ کریں' },
};

export function setActiveLanguageCode(code?: string | null): void {
  const safe = String(code ?? '').trim().toLowerCase();
  if (!safe) return;
  localStorage.setItem(KEY, safe);
}

export function getActiveLanguageCode(fallback: LangCode = 'en'): string {
  const raw = localStorage.getItem(KEY);
  if (!raw) return fallback;
  return String(raw).trim().toLowerCase() || fallback;
}

function translateText(text: string, language: string): string {
  const lang = (language || 'en') as LangCode;
  if (lang === 'en') return text;
  let out = text;
  const keys = Object.keys(PHRASES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const translated = PHRASES[key][lang];
    if (!translated) continue;
    if (out.includes(key)) out = out.split(key).join(translated);
  }
  return out;
}

export function applyLanguageToDocument(language: string, root?: HTMLElement | null): void {
  const target = root ?? document.body;
  if (!target) return;
  document.documentElement.lang = language || 'en';
  document.documentElement.dir = language === 'ar' || language === 'ur' ? 'rtl' : 'ltr';

  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const n = walker.nextNode();
    if (!n) break;
    textNodes.push(n as Text);
  }
  for (const node of textNodes) {
    const original = node.textContent ?? '';
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = translateText(trimmed, language);
    if (translated !== trimmed) {
      node.textContent = original.replace(trimmed, translated);
    }
  }

  const attrs: Array<'placeholder' | 'title' | 'aria-label'> = ['placeholder', 'title', 'aria-label'];
  const all = target.querySelectorAll<HTMLElement>('*');
  all.forEach((el) => {
    attrs.forEach((attr) => {
      const val = el.getAttribute(attr);
      if (!val) return;
      const translated = translateText(val, language);
      if (translated !== val) el.setAttribute(attr, translated);
    });
  });
}
