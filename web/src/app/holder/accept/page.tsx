import { Suspense } from "react";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { LoadingState } from "@/components/PageState";
import { HolderAuthLayout } from "@/components/holder/HolderAuthLayout";
import { tr } from "@/lib/i18n";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <HolderAuthLayout title={tr("holderAuth", "loadingTitle")} maxWidth="max-w-md">
          <LoadingState />
        </HolderAuthLayout>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
