export const VARNA_CENTER = { lat: 43.2141, lng: 27.9147 };

const ZONE_KEYWORDS: { keyword: string; lat: number; lng: number }[] = [
  { keyword: "център", lat: 43.2141, lng: 27.9147 },
  { keyword: "чайка", lat: 43.2075, lng: 27.935 },
  { keyword: "морска градина", lat: 43.2075, lng: 27.935 },
  { keyword: "владислав варненчик", lat: 43.236, lng: 27.87 },
  { keyword: "младост", lat: 43.198, lng: 27.88 },
  { keyword: "възраждане", lat: 43.205, lng: 27.895 },
  { keyword: "аспарухово", lat: 43.18, lng: 27.91 },
  { keyword: "виница", lat: 43.22, lng: 27.96 },
  { keyword: "галата", lat: 43.17, lng: 27.935 },
  { keyword: "левски", lat: 43.216, lng: 27.918 },
  { keyword: "западна промишлена", lat: 43.23, lng: 27.85 },
  { keyword: "тракия", lat: 43.222, lng: 27.925 },
  { keyword: "изгрев", lat: 43.228, lng: 27.928 },
  { keyword: "бриз", lat: 43.212, lng: 27.94 },
  { keyword: "владиславово", lat: 43.183, lng: 27.905 },
  { keyword: "победа", lat: 43.183, lng: 27.895 },
  { keyword: "христо ботев", lat: 43.2, lng: 27.905 },
  { keyword: "свети никола", lat: 43.24, lng: 27.93 },
  { keyword: "кайсиева градина", lat: 43.232, lng: 27.865 },
  { keyword: "максуда", lat: 43.213, lng: 27.9 },
  { keyword: "гръцка махала", lat: 43.209, lng: 27.917 },
  { keyword: "пчелина", lat: 43.2, lng: 27.885 },
  { keyword: "автогара", lat: 43.2, lng: 27.9 },
  { keyword: "трошево", lat: 43.28, lng: 27.83 },
  { keyword: "свети иван рилски", lat: 43.195, lng: 27.87 },
  { keyword: "цветен квартал", lat: 43.225, lng: 27.933 },
  { keyword: "евксиноград", lat: 43.25, lng: 27.94 },
];

export const VARNA_NEW_NEIGHBORHOODS = [
  "Тракия",
  "Изгрев",
  "Бриз",
  "Владиславово",
  "Победа",
  "Христо Ботев",
  "Свети Никола",
  "Кайсиева градина",
  "Максуда",
  "Гръцка махала",
  "Пчелина",
  "Автогара",
  "Трошево",
  "Свети Иван Рилски",
  "Цветен квартал",
  "Евксиноград",
];

export function zoneCenterOrNull(
  zoneName: string | null | undefined
): { lat: number; lng: number } | undefined {
  if (!zoneName) return undefined;
  const normalized = zoneName.toLowerCase();
  for (const z of ZONE_KEYWORDS) {
    if (normalized.includes(z.keyword)) return { lat: z.lat, lng: z.lng };
  }
  return undefined;
}

export function approximateZoneCenter(zoneName: string | null | undefined): {
  lat: number;
  lng: number;
} {
  return zoneCenterOrNull(zoneName) ?? VARNA_CENTER;
}
