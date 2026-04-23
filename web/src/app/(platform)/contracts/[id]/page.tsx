import { ContractDetail } from "@/figma/pages/ContractDetail";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContractDetail contractId={id} />;
}
