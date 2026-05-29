export type PropertyMatch = {
  id: string;
  name: string;
  property_type: string | null;
  city: string | null;
  location: string | null;
  bhk_config: string | null;
  price: string | null;
  carpet_area: string | null;
  possession: string | null;
  amenities: string[] | null;
  rera_id: string | null;
  description: string | null;
  image_urls: string[] | null;
  similarity: number;
};

export type ConversationType =
  | "property_inquiry"
  | "pricing_query"
  | "site_visit_booking"
  | "general_query"
  | "investment_inquiry";

// Final structured response the agent produces via the `respond` tool.
export type AgentResult = {
  message: string;               // full detail — sent as WhatsApp text
  voice_summary: string;         // short line spoken back when input was voice
  has_image: boolean;
  image_urls: string[];
  properties_mentioned: string[];
  customer_name: string;
  customer_phone: string;
  budget: string;
  preferred_location: string;
  bhk_config: string;
  purpose: string;               // end-use | investment
  appointment_requested: boolean;
  appointment_info: string;
  calendar_event_link: string;
  visit_date: string;
  visit_time: string;
  conversation_type: ConversationType;
  conversation_complete: boolean;
};

export type AgentContext = {
  phone: string;                 // WhatsApp wa_id
  waDisplayName: string;         // profile name from WhatsApp
  userText: string;             // incoming text or STT transcript
  languageCode?: string;        // detected language for voice replies
  isVoice: boolean;
  imageDataUrl?: string;        // inbound image as data URL, passed to the vision model
};

export type ChatTurn = { role: "user" | "assistant"; content: string };
