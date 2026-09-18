import { redirect } from "next/navigation";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { id } = await params;
  const { variant } = await searchParams;
  redirect(`/books/${id}/read${variant ? `?variant=${encodeURIComponent(variant)}` : ""}`);
}
