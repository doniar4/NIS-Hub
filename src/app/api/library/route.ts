import { getViewer } from "@/lib/auth";
import { initialLibraryFilters } from "@/lib/library";
import { getLibraryPage, getLibraryPersonal } from "@/lib/library-server";

export async function GET(request: Request) {
  if (!(await getViewer()).user)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const p = new URL(request.url).searchParams;
  try {
    const data =
      p.get("personal") === "1"
        ? await getLibraryPersonal()
        : await getLibraryPage(
            initialLibraryFilters(Object.fromEntries(p)),
            Number(p.get("offset") ?? 0),
          );
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Не удалось загрузить библиотеку. Повторите попытку." },
      { status: 400 },
    );
  }
}
