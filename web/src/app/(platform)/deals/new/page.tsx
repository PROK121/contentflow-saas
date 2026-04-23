import { redirect } from "next/navigation";

/** Мастер создания — на странице воронки (кнопка New Deal или ?create=1). */
export default function LegacyNewDealPage() {
  redirect("/deals?create=1");
}
