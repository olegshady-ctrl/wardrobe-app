// lib/t.ts
export const t = {
  appName: "Гардероб",
  tabs: {
    wardrobe: "Гардероб",
    outfits: "Образи",
    looks: "Стрічка",
    partners: "Магазини",
    profile: "Профіль",
  },
  common: {
    save: "Зберегти",
    saved: "Збережено ✅",
    delete: "Видалити",
    loading: "Завантаження…",
    add: "+ Додати",
  },
  wardrobe: {
    title: "Мій гардероб",
    namePlaceholder: "Назва (необов’язково)",
    chooseFile: "Оберіть файл",
    addItem: "+ Додати річ",
    needPhoto: "Оберіть фото",
    empty: "Додайте першу річ — вона з’явиться тут.",
  },
  profile: {
    title: "Профіль",
    username: "Нікнейм (латиниця)",
    firstName: "Ім’я",
    lastName: "Прізвище",
    phone: "Телефон",
    gender: "Стать",
    city: "Місто",
    detectCity: "Визначити автоматично",
    detectingCity: "Визначаємо місто…",
    budgetFrom: "Бюджет від (₴)",
    budgetTo: "Бюджет до (₴)",
    sizes: { top: "Розмір (верх)", bottom: "Розмір (низ)", shoes: "Розмір (взуття, EU)" },
    wrongBudget: "Мінімальний бюджет не може бути більшим за максимальний",
    save: "Зберегти",
    saved: "Збережено ✅",
    errorSave: "Не вдалося зберегти",
  },
  recommendations: {
    title: "Рекомендації",
    balance: "Баланс гардероба:",
    none: "Поки немає пропозицій — додайте товари партнерів.",
  },
  auth: {
    signIn: "Вхід",
    signUp: "Реєстрація",
    email: "Email",
    password: "Пароль",
    username: "Нікнейм (латиниця)",
    submitIn: "Увійти",
    submitUp: "Створити акаунт",
    confirm: "Ми надіслали листа для підтвердження. Після підтвердження увійдіть.",
    badUsername: "Нік: латиниця/цифри/._, 3–20 символів",
  },
};

export const CATEGORY_UA: Record<string, string> = {
  TOP: "Верх",
  BOTTOM: "Низ",
  SHOES: "Взуття",
  OUTERWEAR: "Верхній одяг",
  ACCESSORY: "Аксесуари",
  DRESS: "Сукні",
};

export const fmt = {
  money: (n?: number | null, currency = "UAH") =>
    typeof n === "number"
      ? new Intl.NumberFormat("uk-UA", { style: "currency", currency }).format(n)
      : "",
};
