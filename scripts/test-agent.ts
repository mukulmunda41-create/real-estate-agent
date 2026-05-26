// Quick local test of the agent core (OpenAI + RAG + Supabase). No WhatsApp/Sarvam needed.
// Run: npm run test:agent -- "show me plots in Pune"
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { orchestrate } = await import("../lib/agents/orchestrator");
  const query = process.argv.slice(2).join(" ") || "I want to see a plot in Pune";
  const stage = process.env.STAGE || "new";

  console.log(`\n> Customer: ${query}  (stage: ${stage})\n`);
  const result = await orchestrate(
    { phone: "919999999999", waDisplayName: "Test User", userText: query, isVoice: false },
    stage,
    []
  );
  console.log(`Agents run: ${result.agentsRun.join(" → ")}`);
  console.log(`Final stage: ${result.stage}\n`);
  console.log("Result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
