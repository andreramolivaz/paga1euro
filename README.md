# paga1euro

Paga un euro per sapere quante persone hanno pagato un euro.

**Sito:** https://andreramolivaz.github.io/paga1euro/

## Come funziona

- `index.html` è tutto il sito: una frase, una striscia argentata, un bottone. Nessun tracciamento, nessun font da server esterni.
- Il bottone porta a un Payment Link di Stripe. Dopo il pagamento Stripe rimanda al sito con `?session_id=…` e la striscia si può grattare (o aprire con «Mostra il numero»).
- Ogni 10 minuti il workflow [`pubblica.yml`](.github/workflows/pubblica.yml) chiede a Stripe quante persone hanno pagato ([`scripts/conta.mjs`](scripts/conta.mjs)), scrive `count.json` e ripubblica il sito sul branch `gh-pages`, ma solo se il numero è cambiato.
- Chi ha appena pagato viene contato subito dalla pagina, anche prima del prossimo aggiornamento.

## Collegare Stripe

1. **Payment Link.** Nella dashboard di Stripe crea un Payment Link per un prodotto da 1,00 €. Nella scheda dopo il pagamento scegli di non mostrare la pagina di conferma e di reindirizzare al sito:
   ```
   https://andreramolivaz.github.io/paga1euro/?session_id={CHECKOUT_SESSION_ID}
   ```
2. **Link nel sito.** In `index.html` metti il link (`https://buy.stripe.com/…`) al posto del `#` nel bottone `id="paga"`.
3. **Chiave in sola lettura.** In Stripe, tra le chiavi API, crea una chiave limitata con due soli permessi in lettura: *Checkout Sessions* e *Payment Links*.
4. **Secret su GitHub.** Settings → Secrets and variables → Actions → New repository secret, nome `STRIPE_KEY`, valore la chiave `rk_…`.

Per aggiornare il numero subito: Actions → Pubblica → Run workflow.

Conviene provare prima tutto in modalità test (carta `4242 4242 4242 4242`), poi rifare link e chiave in modalità live.

## Da sapere

- Il blocco è nella pagina: `count.json` è un file pubblico come il resto del sito.
- GitHub spegne i workflow pianificati dopo 60 giorni senza commit. Se `main` resta ferma 50 giorni, il workflow fa un commit minuscolo in `.github/keepalive` per tenere acceso il contatore.
- Il font è [Bodoni Moda](https://github.com/indestructible-type/Bodoni), con licenza SIL Open Font License (`fonts/OFL.txt`).
