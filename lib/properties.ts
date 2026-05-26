import { supabaseAdmin } from "./supabase";
import { embed, propertyContent } from "./embeddings";

export type PropertyInput = {
  name: string;
  property_type?: string | null;
  city?: string | null;
  location?: string | null;
  bhk_config?: string | null;
  price?: string | null;
  price_numeric?: number | null;
  carpet_area?: string | null;
  possession?: string | null;
  amenities?: string[] | null;
  rera_id?: string | null;
  description?: string | null;
  image_urls?: string[] | null;
};

// Insert or update a property and (re)compute its embedding.
export async function upsertPropertyWithEmbedding(
  input: PropertyInput,
  id?: string
): Promise<string> {
  const content = propertyContent(input);
  const embedding = await embed(content);
  const row = {
    ...input,
    amenities: input.amenities ?? [],
    image_urls: input.image_urls ?? [],
    content,
    embedding,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await supabaseAdmin()
      .from("properties")
      .update(row)
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }
  const { data, error } = await supabaseAdmin()
    .from("properties")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

// After adding/removing images, refresh content + embedding for a property.
export async function reembedProperty(id: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("properties")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message || "property not found");
  const content = propertyContent(data);
  const embedding = await embed(content);
  await supabaseAdmin()
    .from("properties")
    .update({ content, embedding, updated_at: new Date().toISOString() })
    .eq("id", id);
}
