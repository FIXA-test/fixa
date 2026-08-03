// Tar bort testärenden skapade av scripts/seed-test-data.js.
// Hittar dem via markören "*@fixa-testdata.invalid" i kund_epost.
//
// Dry-run (visar bara vad som skulle tas bort):
//   node scripts/remove-test-data.js
// Ta faktiskt bort:
//   node scripts/remove-test-data.js --confirm

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const TEST_EMAIL_DOMAIN = "fixa-testdata.invalid";

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key] = value;
  });
  return env;
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  const { data: matches, error: selectError } = await supabase
    .from("cases")
    .select("id, kund_namn, kund_epost")
    .like("kund_epost", `%@${TEST_EMAIL_DOMAIN}`);

  if (selectError) {
    console.error("Kunde inte hämta testärenden:", selectError);
    process.exit(1);
  }

  if (matches.length === 0) {
    console.log("Ingen testdata hittad (inget kund_epost matchar @" + TEST_EMAIL_DOMAIN + ").");
    return;
  }

  console.log(`Hittade ${matches.length} testärenden:`);
  matches.forEach((m) => console.log(`  - ${m.kund_namn} (${m.id})`));

  if (!confirm) {
    console.log("\nDry-run - inget togs bort. Kör med --confirm för att faktiskt radera dessa rader.");
    return;
  }

  const { error: deleteError } = await supabase
    .from("cases")
    .delete()
    .like("kund_epost", `%@${TEST_EMAIL_DOMAIN}`);

  if (deleteError) {
    console.error("Kunde inte ta bort testdata:", deleteError);
    process.exit(1);
  }
  console.log(`\n${matches.length} testärenden borttagna.`);
}

main();
