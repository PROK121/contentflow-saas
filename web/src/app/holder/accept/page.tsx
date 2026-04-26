import { Suspense } from "react";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Загрузка…</div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
