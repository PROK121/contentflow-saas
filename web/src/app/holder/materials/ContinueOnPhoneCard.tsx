"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import QRCode from "qrcode";
import { v1Fetch } from "@/lib/v1-client";

interface Props {
  /// Путь, на который должен попасть пользователь после магического входа.
  /// Например: `/holder/materials/{id}`.
  path: string;
  onClose: () => void;
}

interface MeResponse {
  user: { email: string };
}

interface MagicResponse {
  ok: boolean;
  /// Полный URL для магического входа. Сервер возвращает его только в DEV.
  /// На проде ссылку отправляют по почте, и QR содержит обычный путь —
  /// пользователь сначала увидит свой почтовый ящик.
  magicUrl?: string | null;
}

/// Карточка «Продолжить с телефона».
///
/// Логика:
///   1) Запрашиваем magic-link для текущего пользователя на тот же путь
///      (через `next` параметр в /v1/auth/holder/magic-link/request — путь
///      используется в письме, отправляемом по email).
///   2) Если сервер вернул `magicUrl` (DEV-режим), кодируем именно его в QR.
///   3) Иначе кодируем абсолютный URL текущей страницы — пользователь после
///      перехода будет вынужден залогиниться, но попадёт ровно сюда.
export function ContinueOnPhoneCard({ path, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await v1Fetch<MeResponse>("/holder/me");
        if (cancelled) return;
        setEmail(me.user.email);

        const fullUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}${path}`
            : path;

        let target = fullUrl;
        try {
          const magic = await v1Fetch<MagicResponse>(
            "/auth/holder/magic-link/request",
            {
              method: "POST",
              body: JSON.stringify({ email: me.user.email, redirect: path }),
            },
          );
          setMagicSent(true);
          if (magic.magicUrl) target = magic.magicUrl;
        } catch (e) {
          // Magic-link сервис может быть выключен (например, нет SMTP) —
          // тогда падаем на обычную ссылку. Не считаем это ошибкой UX.
          console.warn("magic-link failed", e);
        }

        const dataUrl = await QRCode.toDataURL(target, {
          margin: 1,
          width: 320,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <h2 className="text-lg font-semibold">Продолжить с телефона</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Отсканируйте QR-код камерой телефона и продолжите загрузку с него.
          Удобно, если файлы лежат на смартфоне.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : qrDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR для перехода"
                className="size-64 rounded-lg border border-border/40 bg-white p-2"
              />
              {magicSent && email ? (
                <p className="text-center text-xs text-muted-foreground">
                  Вход без пароля. Если попросит подтверждения — проверьте
                  почту {email}, мы отправили туда волшебную ссылку.
                </p>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Откройте на телефоне — попросит войти и сразу переключит
                  на эту страницу.
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Готовим QR-код…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
