/**
 * Генерация логинов из ФИО: Бондаренко Артём Игоревич → bondarenko_ai
 * Кириллица украинская и русская.
 */

const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ы: "y", э: "e",
  ё: "e", ъ: "",
};

export function translit(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => (ch in MAP ? MAP[ch] : /[a-z0-9]/.test(ch) ? ch : ""))
    .join("");
}

export type PersonName = {
  lastName: string;
  firstName: string;
  middleName?: string | null;
};

/** bondarenko_ai — фамилия плюс инициалы. */
export function baseLogin({ lastName, firstName, middleName }: PersonName): string {
  const surname = translit(lastName);
  const initials = [firstName, middleName]
    .filter(Boolean)
    .map((n) => translit(String(n)).charAt(0))
    .join("");
  return initials ? `${surname}_${initials}` : surname;
}

/**
 * Делает логин уникальным: если bondarenko_ai занят — bondarenko_ai2 и так далее.
 * `taken` — множество уже существующих логинов (из базы плюс созданные в этой же пачке).
 */
export function uniqueLogin(name: PersonName, taken: Set<string>): string {
  const base = baseLogin(name);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  const login = `${base}${n}`;
  taken.add(login);
  return login;
}

/**
 * Разбор строки списка: «Бондаренко Артём Игоревич» либо «Бондаренко Артём».
 * Возвращает null для мусорных строк, чтобы импорт мог их показать отдельно.
 */
export function parseNameLine(line: string): PersonName | null {
  const parts = line.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length < 2) return null;
  const [lastName, firstName, ...rest] = parts;
  return {
    lastName,
    firstName,
    middleName: rest.length ? rest.join(" ") : null,
  };
}
