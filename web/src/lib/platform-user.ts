/**
 * ID текущего пользователя платформы для клиентских фильтров («только мои»).
 * Задаётся в `.env.local`: NEXT_PUBLIC_PLATFORM_USER_ID=<uuid из seed / auth>.
 * Пока нет сессии — переменная пустая, чекбокс «Только мои» скрыт.
 */
export function getPlatformOwnerUserId(): string | null {
  const v = process.env.NEXT_PUBLIC_PLATFORM_USER_ID?.trim();
  return v || null;
}
