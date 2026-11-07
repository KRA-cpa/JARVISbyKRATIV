/**
 * Price display switch (user, 8 Nov 2026: "a toggle we can change in the code to hide / show the prices; set to hide first").
 *
 *   SHOW_PRICES = false  -> no prices anywhere: the plan cards show no price / setup fee, the "Need more? Add-ons" box
 *                           lists the block sizes without prices, the price note is dropped and any promo banner marked
 *                           `needsPrices` (src/config/promo.js) is hidden. The price figures are also left OUT of the
 *                           build (plansProposed.js / promo.js put them behind this flag), so they aren't readable in main.js.
 *   SHOW_PRICES = true   -> the proposed prices (src/config/plansProposed.js) and the founding banner come back.
 *
 * Change the value and redeploy. Prices are still shown on PREVIEW builds only (Vercel preview + local development);
 * production keeps the live catalogue without prices (website decision W2) whatever this says.
 * Layer: config (leaf, no imports).
 */
export const SHOW_PRICES = false;
