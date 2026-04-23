/** Слоты документов сделки (совпадают с API `GET/POST/DELETE /deals/:id/documents/:slot`). */

export const DEAL_DOCUMENT_GROUPS: {
  title: string;
  items: { slot: string; label: string }[];
}[] = [
  {
    title: "Уставные документы",
    items: [
      { slot: "charter", label: "Устав" },
      { slot: "bank_details", label: "Реквизиты" },
      {
        slot: "registration_cert",
        label: "Свидетельство о постановке на учёт организации",
      },
      { slot: "director_order", label: "Приказ о директоре" },
    ],
  },
  {
    title: "Цепочка прав (5 договоров)",
    items: [
      { slot: "chain_director", label: "Режиссёр" },
      { slot: "chain_operator", label: "Оператор-постановщик" },
      { slot: "chain_screenwriter", label: "Автор сценария" },
      { slot: "chain_composer", label: "Композитор" },
      { slot: "chain_art_director", label: "Художник-постановщик" },
    ],
  },
];
