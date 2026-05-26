import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { reembedProperty } from "@/lib/properties";

export const runtime = "nodejs";

// Admin uploads a property image: store in bucket, append URL to the property,
// then re-embed so the new media is reflected in search.
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const propertyId = String(form.get("propertyId") || "");
  const file = form.get("file");
  if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${propertyId}/${Date.now()}.${ext}`;

  const sb = supabaseAdmin();
  const { error: upErr } = await sb.storage
    .from("property-images")
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = sb.storage.from("property-images").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  // Append to the property's image_urls
  const { data: prop, error: getErr } = await sb
    .from("properties")
    .select("image_urls")
    .eq("id", propertyId)
    .single();
  if (getErr || !prop) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const updated = [...(prop.image_urls ?? []), publicUrl];
  await sb.from("properties").update({ image_urls: updated }).eq("id", propertyId);

  try {
    await reembedProperty(propertyId);
  } catch (e) {
    return NextResponse.json({ url: publicUrl, warning: `embedding refresh failed: ${(e as Error).message}` });
  }

  return NextResponse.json({ url: publicUrl, image_urls: updated });
}
