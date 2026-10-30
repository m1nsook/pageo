const candidates = ["paglora", "docvori", "paglorio", "doclorio"];
const registry = "https://registry.npmjs.org/";
for (const name of candidates) {
  const variants = [name, name.replace(/(pag|doc)/, "$1-"), name.replace(/(pag|doc)/, "$1_")];
  console.log("\n## " + name);
  for (const variant of variants) {
    try {
      const response = await fetch(registry + encodeURIComponent(variant), { headers: { accept: "application/vnd.npm.install-v1+json" } });
      console.log("  exact " + variant + ": " + response.status);
    } catch (error) { console.log("  exact " + variant + ": REQUEST_FAILED " + error.message); }
  }
  try {
    const response = await fetch(registry + "-/v1/search?text=" + encodeURIComponent(name) + "&size=35");
    if (!response.ok) { console.log("  search status: " + response.status); continue; }
    const results = (await response.json()).objects?.map(item => item.package?.name) ?? [];
    const others = results.filter(value => value && value !== name);
    console.log("  search neighbors: " + (others.slice(0, 15).join(", ") || "(none returned)"));
  } catch (error) { console.log("  search failed: " + error.message); }
}
console.log("\nNote: only npm publish can conclusively validate an unscoped name.");
