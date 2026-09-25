import { redirect } from "next/navigation";
import { AuthExperience } from "@/components/auth-experience";
import { getViewer } from "@/lib/auth";
export default async function SignupPage() {
    const viewer = await getViewer();
    if (viewer.user)
        redirect("/profile");
    return <AuthExperience mode="signup" next="/profile" configured={viewer.configured}/>;
}
