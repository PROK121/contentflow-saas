"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export async function createDealAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const buyerOrgId = String(formData.get("buyerOrgId") ?? "").trim();
  const ownerUserId = String(formData.get("ownerUserId") ?? "").trim();
  const currency = String(formData.get("currency") ?? "KZT")
    .trim()
    .toUpperCase();

  if (!title || !buyerOrgId || !ownerUserId || currency.length !== 3) {
    throw new Error("Заполните название, UUID покупателя, UUID ответственного и валюту (3 буквы).");
  }

  await apiFetch("/deals", {
    method: "POST",
    body: JSON.stringify({
      title,
      buyerOrgId,
      ownerUserId,
      currency,
    }),
  });

  revalidatePath("/deals");
  revalidatePath("/dashboard");
  redirect("/deals");
}
