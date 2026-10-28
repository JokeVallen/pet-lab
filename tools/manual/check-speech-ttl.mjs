import { PetSpeech } from "../../js/pet/modules/speech.js";

const seen = [];
const mod = PetSpeech.createSpeechModule({
    renderBubble: (text, ms) => seen.push({ text, ms }),
    renderDialog: () => {},
    isDialogOpen: () => false,
    dedupeMs: 0,
    maxQueue: 5,
    bubbleTtl: 1200
});

const ctx = { on() {}, emit() {}, register() {} };
mod.mount(ctx);

mod._enqueue({ text: "no-ttl", channel: "auto", priority: "ambient" }, ctx);
await new Promise((r) => setTimeout(r, 200));
mod._enqueue({ text: "ttl-800", ttl: 800, channel: "auto", priority: "ambient" }, ctx);
await new Promise((r) => setTimeout(r, 200));

console.log("rendered:", JSON.stringify(seen));
const ok = seen.length >= 2 && seen[0].ms === 1200 && seen[1].ms === 800;
console.log(ok ? "OK default=bubbleTtl(1200), explicit wins(800)" : "FAIL");
process.exit(ok ? 0 : 1);