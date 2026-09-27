import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/validation";
export default async function LoginPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const viewer = await getViewer();
    const params = await searchParams;
    const next = safeNext(params.next);
    if (viewer.user)
        redirect(next);
    const welcomeParams = new URLSearchParams({ auth: "login", next });
    if (params.confirmation === "failed") welcomeParams.set("confirmation", "failed");
    redirect(`/?${welcomeParams.toString()}#welcome-auth`);
}
