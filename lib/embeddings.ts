import { openai } from "./openai";
import { env } from "./env";

export async function embed(text: string): Promise<number[]> {
  const res = await openai().embeddings.create({
    model: env.openaiEmbeddingModel,
    input: text.replace(/\n/g, " ").slice(0, 8000),
  });
  return res.data[0].embedding;
}

// Build the text blob that represents a property for embedding.
export function propertyContent(p: {
  name: string;
  property_type?: string | null;
  city?: string | null;
  location?: string | null;
  bhk_config?: string | null;
  price?: string | null;
  carpet_area?: string | null;
  possession?: string | null;
  amenities?: string[] | null;
  description?: string | null;
}): string {
  const parts = [
    p.name,
    p.property_type && `Type: ${p.property_type}`,
    p.city && `City: ${p.city}`,
    p.location && `Location: ${p.location}`,
    p.bhk_config && `Configuration: ${p.bhk_config}`,
    p.price && `Price: ${p.price}`,
    p.carpet_area && `Carpet area: ${p.carpet_area}`,
    p.possession && `Possession: ${p.possession}`,
    p.amenities?.length && `Amenities: ${p.amenities.join(", ")}`,
    p.description,
  ].filter(Boolean);
  return parts.join(". ");
}
