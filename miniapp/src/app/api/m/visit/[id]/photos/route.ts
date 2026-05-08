import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getFullVisitForCM, insertVisitPhoto, signPhotoUrls } from "@/lib/queries";
import { supabase } from "@/lib/supabase";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });

  const { id: visitId } = await params;
  const visit = await getFullVisitForCM(cm.telegram_id, visitId);
  if (!visit) return Response.json({ error: "Visit not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Images only" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Max 10 MB per photo" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : "jpg";
  const photoId = crypto.randomUUID();
  const storagePath = `${visit.store_id}/${visitId}/${photoId}.${ext}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("sva-photos")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }

  await insertVisitPhoto(visitId, storagePath, file.size);

  const urls = await signPhotoUrls([storagePath]);
  return Response.json({ url: urls[0] ?? null, path: storagePath });
}
