/**
 * HUD words (DRIFT-S7-HUD-PLAN step 4): every word on the flight screen in 8 languages + Simple, ready for S8.
 *
 * S8 picks the language (Hub setting, `lang` and `dir` on <html>) and the components read from here. Until then the
 * components keep their own English text, and a test checks that it matches `HUD.en` word for word.
 *
 * **Every table except English is a machine draft** (`MACHINE_DRAFT`). Dari (fa-AF), Kinyarwanda (rw) and Tigrinya (ti)
 * most need a native reader. Digits stay Western (1, 2, 3) in every language: Arabic-Indic digits are still an open
 * question for Diego (DRIFT-2-DESIGN unknown #16).
 *
 * Placeholders: `{n}`, `{total}` and `{name}` in `speedOf`. Labels with a state are written "Sound: On" (label, colon, state),
 * so no language needs plural or gender forms.
 */

export const HUD_LANGS = ["en", "simple", "es", "uk", "ru", "ar", "fa-AF", "rw", "ti"] as const
export type HudLang = (typeof HUD_LANGS)[number]
export const RTL_LANGS: ReadonlySet<HudLang> = new Set(["ar", "fa-AF"])
/** Tables written by machine, waiting for a native reader. */
export const MACHINE_DRAFT: ReadonlySet<HudLang> = new Set(["simple", "es", "uk", "ru", "ar", "fa-AF", "rw", "ti"])

export type HudWords = {
  speed: string
  faster: string
  slower: string
  /** The 5 speed notches, slowest first. */
  speedNames: readonly [string, string, string, string, string]
  /** Screen-reader value of the Speed slider: "Speed {n} of {total}, {name}". */
  speedOf: string
  pause: string
  paused: string
  resume: string
  home: string
  soundOn: string
  soundOff: string
  tapSound: string
  steerOption: string
  on: string
  off: string
  steerPad: string
  left: string
  right: string
  up: string
  down: string
  /** The hint line at the bottom left. */
  hint: string
  /** The hint line when "Steer with buttons" is on. */
  hintPad: string
  /** What a screen reader says for the picture. */
  glider: string
}

export const HUD: Record<HudLang, HudWords> = {
  en: {
    speed: "Speed",
    faster: "Faster",
    slower: "Slower",
    speedNames: ["Slowest", "Slow", "Medium", "Fast", "Fastest"],
    speedOf: "Speed {n} of {total}, {name}",
    pause: "Pause",
    paused: "Paused",
    resume: "Resume",
    home: "Home",
    soundOn: "Sound: On",
    soundOff: "Sound: Off",
    tapSound: "Tap to start sound",
    steerOption: "Steer with buttons",
    on: "On",
    off: "Off",
    steerPad: "Steer buttons",
    left: "Steer left",
    right: "Steer right",
    up: "Nose up",
    down: "Nose down",
    hint: "Drag to steer, or use the arrow keys",
    hintPad: "Drag, use the arrow keys, or hold the buttons to steer",
    glider: "A glider flying among clouds. Drag, or use the arrow keys, to steer.",
  },
  simple: {
    speed: "Speed",
    faster: "Faster",
    slower: "Slower",
    speedNames: ["Slowest", "Slow", "Middle", "Fast", "Fastest"],
    speedOf: "Speed {n} of {total}, {name}",
    pause: "Pause",
    paused: "Paused",
    resume: "Go on",
    home: "Home",
    soundOn: "Sound: On",
    soundOff: "Sound: Off",
    tapSound: "Tap to hear sound",
    steerOption: "Use buttons",
    on: "On",
    off: "Off",
    steerPad: "Buttons",
    left: "Go left",
    right: "Go right",
    up: "Go up",
    down: "Go down",
    hint: "Drag or use arrow keys to steer",
    hintPad: "Drag, arrow keys, or hold a button",
    glider: "A glider in the clouds. Drag or use arrow keys to steer.",
  },
  es: {
    speed: "Velocidad",
    faster: "Más rápido",
    slower: "Más lento",
    speedNames: ["Muy lento", "Lento", "Medio", "Rápido", "Muy rápido"],
    speedOf: "Velocidad {n} de {total}, {name}",
    pause: "Pausa",
    paused: "En pausa",
    resume: "Seguir",
    home: "Inicio",
    soundOn: "Sonido: Activado",
    soundOff: "Sonido: Desactivado",
    tapSound: "Toca para activar el sonido",
    steerOption: "Dirigir con botones",
    on: "Activado",
    off: "Desactivado",
    steerPad: "Botones de dirección",
    left: "Girar a la izquierda",
    right: "Girar a la derecha",
    up: "Morro arriba",
    down: "Morro abajo",
    hint: "Arrastra para dirigir o usa las flechas",
    hintPad: "Arrastra, usa las flechas o mantén pulsados los botones",
    glider: "Un planeador vuela entre las nubes. Arrastra o usa las flechas para dirigir.",
  },
  uk: {
    speed: "Швидкість",
    faster: "Швидше",
    slower: "Повільніше",
    speedNames: ["Найповільніше", "Повільно", "Середньо", "Швидко", "Найшвидше"],
    speedOf: "Швидкість {n} з {total}, {name}",
    pause: "Пауза",
    paused: "На паузі",
    resume: "Продовжити",
    home: "Головна",
    soundOn: "Звук: Увімкнено",
    soundOff: "Звук: Вимкнено",
    tapSound: "Торкніться, щоб увімкнути звук",
    steerOption: "Керувати кнопками",
    on: "Увімкнено",
    off: "Вимкнено",
    steerPad: "Кнопки керування",
    left: "Ліворуч",
    right: "Праворуч",
    up: "Ніс угору",
    down: "Ніс униз",
    hint: "Тягніть, щоб керувати, або натискайте стрілки",
    hintPad: "Тягніть, натискайте стрілки або тримайте кнопки",
    glider: "Планер летить серед хмар. Тягніть або натискайте стрілки, щоб керувати.",
  },
  ru: {
    speed: "Скорость",
    faster: "Быстрее",
    slower: "Медленнее",
    speedNames: ["Очень медленно", "Медленно", "Средне", "Быстро", "Очень быстро"],
    speedOf: "Скорость {n} из {total}, {name}",
    pause: "Пауза",
    paused: "На паузе",
    resume: "Продолжить",
    home: "Главная",
    soundOn: "Звук: Включён",
    soundOff: "Звук: Выключен",
    tapSound: "Нажмите, чтобы включить звук",
    steerOption: "Управлять кнопками",
    on: "Включено",
    off: "Выключено",
    steerPad: "Кнопки управления",
    left: "Влево",
    right: "Вправо",
    up: "Нос вверх",
    down: "Нос вниз",
    hint: "Тяните, чтобы управлять, или нажимайте стрелки",
    hintPad: "Тяните, нажимайте стрелки или удерживайте кнопки",
    glider: "Планер летит среди облаков. Тяните или нажимайте стрелки, чтобы управлять.",
  },
  ar: {
    speed: "السرعة",
    faster: "أسرع",
    slower: "أبطأ",
    speedNames: ["الأبطأ", "بطيء", "متوسط", "سريع", "الأسرع"],
    speedOf: "السرعة {n} من {total}، {name}",
    pause: "إيقاف مؤقت",
    paused: "متوقف مؤقتًا",
    resume: "متابعة",
    home: "الرئيسية",
    soundOn: "الصوت: مُشغَّل",
    soundOff: "الصوت: مُطفأ",
    tapSound: "انقر لتشغيل الصوت",
    steerOption: "التوجيه بالأزرار",
    on: "مُشغَّل",
    off: "مُطفأ",
    steerPad: "أزرار التوجيه",
    left: "انعطف يسارًا",
    right: "انعطف يمينًا",
    up: "المقدمة للأعلى",
    down: "المقدمة للأسفل",
    hint: "اسحب للتوجيه، أو استخدم مفاتيح الأسهم",
    hintPad: "اسحب، أو استخدم مفاتيح الأسهم، أو اضغط مطولًا على الأزرار",
    glider: "طائرة شراعية تحلّق بين الغيوم. اسحب أو استخدم مفاتيح الأسهم للتوجيه.",
  },
  "fa-AF": {
    speed: "سرعت",
    faster: "تیزتر",
    slower: "آهسته‌تر",
    speedNames: ["خیلی آهسته", "آهسته", "متوسط", "تیز", "خیلی تیز"],
    speedOf: "سرعت {n} از {total}، {name}",
    pause: "توقف",
    paused: "متوقف",
    resume: "ادامه",
    home: "خانه",
    soundOn: "صدا: روشن",
    soundOff: "صدا: خاموش",
    tapSound: "برای روشن کردن صدا ضربه بزنید",
    steerOption: "رهنمایی با دکمه‌ها",
    on: "روشن",
    off: "خاموش",
    steerPad: "دکمه‌های رهنمایی",
    left: "به چپ",
    right: "به راست",
    up: "دماغه بالا",
    down: "دماغه پایین",
    hint: "برای رهنمایی بکشید، یا از کلیدهای تیر استفاده کنید",
    hintPad: "بکشید، از کلیدهای تیر استفاده کنید، یا دکمه‌ها را نگه دارید",
    glider: "یک گلایدر میان ابرها پرواز می‌کند. برای رهنمایی بکشید یا از کلیدهای تیر استفاده کنید.",
  },
  rw: {
    speed: "Umuvuduko",
    faster: "Byihuse kurushaho",
    slower: "Buhoro kurushaho",
    speedNames: ["Buhoro cyane", "Buhoro", "Hagati", "Byihuse", "Byihuse cyane"],
    speedOf: "Umuvuduko {n} kuri {total}, {name}",
    pause: "Hagarika",
    paused: "Byahagaritswe",
    resume: "Komeza",
    home: "Ahabanza",
    soundOn: "Ijwi: Rirafunguye",
    soundOff: "Ijwi: Rirafunze",
    tapSound: "Kanda kugira ngo ijwi ritangire",
    steerOption: "Kuyobora ukoresheje utubuto",
    on: "Birafunguye",
    off: "Birafunze",
    steerPad: "Utubuto two kuyobora",
    left: "Ibumoso",
    right: "Iburyo",
    up: "Zamuka",
    down: "Manuka",
    hint: "Kurura kugira ngo uyobore, cyangwa ukoreshe utubuto tw'imyambi",
    hintPad: "Kurura, koresha imyambi, cyangwa ufate utubuto",
    glider: "Indege itagira moteri iguruka mu bicu. Kurura cyangwa ukoreshe imyambi kugira ngo uyobore.",
  },
  ti: {
    speed: "ፍጥነት",
    faster: "ቅልጡፍ",
    slower: "ዝሑል",
    speedNames: ["ብጣዕሚ ዝሑል", "ዝሑል", "ማእከላይ", "ቅልጡፍ", "ብጣዕሚ ቅልጡፍ"],
    speedOf: "ፍጥነት {n} ካብ {total}፣ {name}",
    pause: "ደው ኣብል",
    paused: "ደው ኢሉ",
    resume: "ቀጽል",
    home: "መበገሲ",
    soundOn: "ድምጺ፡ ክፉት",
    soundOff: "ድምጺ፡ ዕጹው",
    tapSound: "ድምጺ ንምጅማር ጠውቕ",
    steerOption: "ብመልጎማት ምምራሕ",
    on: "ክፉት",
    off: "ዕጹው",
    steerPad: "መምርሒ መልጎማት",
    left: "ናብ ጸጋም",
    right: "ናብ የማን",
    up: "ናብ ላዕሊ",
    down: "ናብ ታሕቲ",
    hint: "ንምምራሕ ጎትት፣ ወይ ናይ ምልክት መፍትሕታት ተጠቐም",
    hintPad: "ጎትት፣ ናይ ምልክት መፍትሕታት ተጠቐም፣ ወይ መልጎማት ሓዝ",
    glider: "ኣብ መንጎ ደበና ዝነፍር ግላይደር። ንምምራሕ ጎትት ወይ ናይ ምልክት መፍትሕታት ተጠቐም።",
  },
}

/** The table for a language tag; anything unknown (or a region like "es-MX") falls back sensibly, then to English. */
export function hudFor(tag: string | null | undefined): HudWords {
  if (!tag) return HUD.en
  if ((HUD_LANGS as readonly string[]).includes(tag)) return HUD[tag as HudLang]
  if (tag.toLowerCase().startsWith("fa") || tag.toLowerCase().startsWith("prs")) return HUD["fa-AF"]
  const base = tag.split("-")[0].toLowerCase()
  return (HUD_LANGS as readonly string[]).includes(base) ? HUD[base as HudLang] : HUD.en
}

/** Fills `{name}` placeholders. A missing value leaves the placeholder visible, so a test catches it. */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
