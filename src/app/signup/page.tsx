import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
export default async function SignupPage() {
    const viewer = await getViewer();
    if (viewer.user)
        redirect("/profile");
    redirect("/?auth=signup#welcome-auth");
}
