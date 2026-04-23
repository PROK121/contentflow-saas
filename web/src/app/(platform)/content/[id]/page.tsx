import { CatalogItemDetail } from "@/components/content/CatalogItemDetail";

export default async function ContentItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CatalogItemDetail catalogItemId={id} />;
}
