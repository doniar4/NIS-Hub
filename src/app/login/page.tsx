import { redirect } from "next/navigation";
import { AuthExperience } from "@/components/auth-experience";
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
    return <AuthExperience mode="login" next={next} configured={viewer.configured} confirmationFailed={params.confirmation === "failed"}/>;
}
