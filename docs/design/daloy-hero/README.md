# Daloy hero animation (create a request → approval flow)

**Replaces** the ticket-only animation (archived in `docs/archive/2026-11/ticketflow-hero/`, user, 2 Nov 2026: "svg
animation doesn't show ticket creation - create new image assets, keep old in archive").

**What it shows (10 s loop, CSS only, no script):**
| Time | Scene |
|---|---|
| 0-0.3 s | "New purchase request" form appears |
| 0.4-1.2 s | "Laptop for new hire" types into *Item* |
| 1.3-1.7 s | "45,000" types into *Amount (PHP)* |
| 1.6-2.4 s | a cursor moves to **Submit** and clicks it |
| 2.5-3.6 s | the form fades and becomes ticket **PR-2026-00000042** |
| 3.6-10 s | the earlier flow: Manager → Finance → Done → **Approved** |

| File | Use |
|---|---|
| `daloy-hero.svg` | Follows the viewer's light / dark setting |
| `daloy-hero-light.svg`, `daloy-hero-dark.svg` | Fixed theme - **copies are in `src/assets/hero/`** (the home page shows the one that matches the app theme) |
| `daloy-hero-static-light.svg`, `daloy-hero-static-dark.svg` | Final frame, no animation |
| `make_daloy_hero.py` | Builds the light / dark files from the archived ticket-only SVG: re-times its 7 s flow into 30-100 % of a 10 s loop and adds the creation phase. `python3 make_daloy_hero.py <archived light svg> <out light> <out dark>` |

With *reduced motion* (or the `still` class) every file shows the final frame: the approved ticket, no form.
Alt text: see `HERO_ALT` in `src/pages/HomePage.js`.
