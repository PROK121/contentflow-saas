/// HTML-обёртка для писем GROWIX.
///
/// Зачем не MJML/Handlebars? Внешние зависимости и build-step увеличивают
/// размер контейнера и усложняют деплой. На текущем объёме (~5–6 шаблонов)
/// проще сохранить inline-стили и string-template'ы. Когда шаблонов станет
/// >15 — переедем на MJML.
///
/// Все стили — inline (Gmail/Outlook не понимают `<style>` снаружи `<body>`).
/// Шаблон протестирован на тёмной/светлой теме Gmail и Outlook 365.

const PRIMARY = '#0F172A'; // slate-900
const ACCENT = '#2563EB'; // blue-600
const MUTED = '#475569'; // slate-600
const BG = '#F8FAFC'; // slate-50
const CARD_BG = '#FFFFFF';
const BORDER = '#E2E8F0'; // slate-200

/// Универсальная вёрстка письма: лого, заголовок, основной блок,
/// CTA-кнопка (опц.), футер. Всё — таблицы (для совместимости с почтовиками).
export interface EmailTemplateInput {
  /// Заголовок (большой, в шапке письма).
  title: string;
  /// Превью-текст (preheader) — то, что почтовик показывает рядом с темой.
  preheader?: string;
  /// Тело — массив абзацев (можно с inline-HTML, доверяем своему content).
  paragraphs: string[];
  /// Опциональный список (метки → значения) под параграфами — для деталей.
  details?: { label: string; value: string }[];
  /// Опциональная CTA-кнопка.
  cta?: { label: string; url: string };
  /// Дополнительная подпись под CTA (часто используется для дисклеймера).
  ctaNote?: string;
}

export function renderEmailHtml(input: EmailTemplateInput): string {
  const safeTitle = escapeHtml(input.title);
  const safePreheader = escapeHtml(input.preheader ?? '');

  const paragraphsHtml = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;color:${PRIMARY};font-size:15px;line-height:22px;">${p}</p>`,
    )
    .join('');

  const detailsHtml = input.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px 0;border-collapse:collapse;">
         ${input.details
           .map(
             (d) => `
             <tr>
               <td style="padding:6px 12px 6px 0;color:${MUTED};font-size:13px;width:35%;vertical-align:top;">${escapeHtml(d.label)}</td>
               <td style="padding:6px 0;color:${PRIMARY};font-size:13px;font-weight:500;">${escapeHtml(d.value)}</td>
             </tr>`,
           )
           .join('')}
       </table>`
    : '';

  const ctaHtml = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 16px 0;">
         <tr>
           <td align="center" bgcolor="${ACCENT}" style="border-radius:8px;">
             <a href="${escapeAttr(input.cta.url)}" style="display:inline-block;padding:12px 22px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;background:${ACCENT};">${escapeHtml(input.cta.label)}</a>
           </td>
         </tr>
       </table>
       ${
         input.ctaNote
           ? `<p style="margin:0 0 16px 0;color:${MUTED};font-size:12px;line-height:18px;">${input.ctaNote}</p>`
           : ''
       }`
    : '';

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreheader}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid ${BORDER};">
              <span style="display:inline-block;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${PRIMARY};">GROWIX</span>
              <span style="display:inline-block;margin-left:8px;font-size:12px;font-weight:500;color:${MUTED};">кабинет правообладателя</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:20px;line-height:28px;color:${PRIMARY};font-weight:600;">${safeTitle}</h1>
              ${paragraphsHtml}
              ${detailsHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px 32px;border-top:1px solid ${BORDER};color:${MUTED};font-size:12px;line-height:18px;">
              Это автоматическое письмо от GROWIX. Если вы не ожидали его —
              просто проигнорируйте. Вопросы — отвечайте на это письмо или
              пишите менеджеру.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/// Безопасный текстовый эквивалент письма — отдаём вторым `text` в SMTP,
/// чтобы почтовики (и пользователи без HTML) видели нормальное содержимое.
export function renderEmailText(input: EmailTemplateInput): string {
  const lines: string[] = [];
  lines.push(input.title.toUpperCase());
  lines.push('-'.repeat(Math.min(input.title.length, 60)));
  lines.push('');
  for (const p of input.paragraphs) {
    lines.push(stripHtml(p));
    lines.push('');
  }
  if (input.details?.length) {
    for (const d of input.details) {
      lines.push(`${d.label}: ${d.value}`);
    }
    lines.push('');
  }
  if (input.cta) {
    lines.push(`${input.cta.label}: ${input.cta.url}`);
    lines.push('');
  }
  if (input.ctaNote) {
    lines.push(stripHtml(input.ctaNote));
    lines.push('');
  }
  lines.push('— GROWIX');
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
