// Conta quante persone hanno pagato 1 euro e scrive il risultato in count.json.
//
// Legge i pagamenti completati del Payment Link (quello scritto in index.html)
// con la chiave Stripe in STRIPE_KEY. Basta una chiave limitata in sola lettura:
// Checkout Sessions → Read, Payment Links → Read.
//
// Uso: node scripts/conta.mjs [file di destinazione]

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const destinazione = process.argv[2] ?? "count.json";
const chiave = process.env.STRIPE_KEY?.trim();
const api = process.env.STRIPE_API ?? "https://api.stripe.com";

// Quante impronte di pagamenti recenti pubblicare: servono alla pagina per capire
// se chi ha appena pagato è già nel conto o va aggiunto a mano.
const RECENTI = 100;

const impronta = (id) => createHash("sha256").update(id).digest("hex").slice(0, 12);

async function scrivi(dati) {
  await writeFile(destinazione, JSON.stringify(dati) + "\n");
}

function contoPrecedente() {
  try {
    const testo = execFileSync("git", ["show", "refs/remotes/origin/gh-pages:count.json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const dati = JSON.parse(testo);
    return { persone: Number(dati.persone) || 0, ultimi: Array.isArray(dati.ultimi) ? dati.ultimi : [] };
  } catch {
    return null;
  }
}

class ErroreStripe extends Error {
  constructor(messaggio, stato) {
    super(messaggio);
    this.stato = stato;
  }
}

async function stripe(percorso, parametri = {}) {
  const url = new URL(`/v1/${percorso}`, api);
  for (const [nome, valore] of Object.entries(parametri)) {
    if (valore !== undefined) url.searchParams.set(nome, valore);
  }
  for (let tentativo = 1; ; tentativo++) {
    const risposta = await fetch(url, {
      headers: { Authorization: `Bearer ${chiave}`, "Stripe-Version": "2024-06-20" },
    });
    if (risposta.status === 429 && tentativo < 4) {
      await new Promise((ok) => setTimeout(ok, 1000 * tentativo));
      continue;
    }
    const corpo = await risposta.json().catch(() => ({}));
    if (!risposta.ok) {
      throw new ErroreStripe(corpo?.error?.message ?? `HTTP ${risposta.status}`, risposta.status);
    }
    return corpo;
  }
}

async function* tutti(percorso, parametri = {}) {
  let dopo;
  do {
    const pagina = await stripe(percorso, { limit: 100, ...parametri, starting_after: dopo });
    yield* pagina.data;
    dopo = pagina.has_more && pagina.data.length ? pagina.data.at(-1).id : undefined;
  } while (dopo);
}

async function linkDiPagamento() {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  return html.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+/)?.[0];
}

async function idDelLink(link) {
  try {
    for await (const pl of tutti("payment_links")) {
      if (pl.url === link) return pl.id;
    }
    console.log(`::warning::Non trovo ${link} tra i Payment Link di questo account Stripe. ` +
      "La chiave è della stessa modalità del link (test o live)? Intanto conto tutti i pagamenti da 1 euro.");
  } catch (errore) {
    if (errore.stato !== 403) throw errore;
    console.log("::warning::La chiave non può leggere i Payment Link (permesso «Payment Links: Read»). " +
      "Intanto conto tutti i pagamenti da 1 euro.");
  }
  return undefined;
}

async function main() {
  if (!chiave) {
    await scrivi(contoPrecedente() ?? { persone: 0, ultimi: [] });
    console.log("::notice::Manca il secret STRIPE_KEY: il numero resta quello di prima.");
    return;
  }
  if (chiave.startsWith("pk_")) {
    throw new Error("STRIPE_KEY è una chiave pubblicabile (pk_…): serve una chiave limitata (rk_…) o segreta.");
  }

  const link = await linkDiPagamento();
  const idLink = link ? await idDelLink(link) : undefined;
  if (!link) console.log("::warning::In index.html non c'è ancora un link https://buy.stripe.com/…: conto tutti i pagamenti da 1 euro.");

  let persone = 0;
  const ultimi = [];
  for await (const sessione of tutti("checkout/sessions", { status: "complete", payment_link: idLink })) {
    if (sessione.payment_status !== "paid") continue;
    if (!idLink && !(sessione.amount_total === 100 && sessione.currency === "eur")) continue;
    persone++;
    if (ultimi.length < RECENTI) ultimi.push(impronta(sessione.id));
  }

  await scrivi({ persone, ultimi });
  console.log(`${persone} ${persone === 1 ? "persona ha" : "persone hanno"} pagato un euro.`);
}

main().catch((errore) => {
  console.error(`::error::${errore.message}`);
  process.exit(1);
});
