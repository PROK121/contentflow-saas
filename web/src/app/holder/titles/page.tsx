"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";

interface Item {
  id: string;
  title: string;
  slug: string;
  assetType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const ASSET_LABEL: Record<string, string> = {
  video: "Фильм",
  series: "Сериал",
  animated_series: "Анимация (сериал)",
  animated_film: "Анимация (фильм)",
  anime_series: "Аниме (сериал)",
  anime_film: "Аниме (фильм)",
  concert_show: "Концерт / шоу",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  active: "В каталоге",
  archived: "В архиве",
};

export default function HolderTitlesPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await v1Fetch<Item[]>("/holder/catalog-items"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Мои тайтлы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Контент, по которому вы являетесь правообладателем в системе.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-10 text-center">
          <Film className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Пока в каталоге нет ваших тайтлов. Менеджер добавит их по мере
            оформления документов.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Название</th>
                <th className="px-4 py-3 text-left">Тип</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-left">Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.id}
                  className="border-t border-border/40 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{it.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ASSET_LABEL[it.assetType] ?? it.assetType}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs ${
                        it.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : it.status === "draft"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(it.updatedAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
