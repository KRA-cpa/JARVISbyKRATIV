# TicketFlow hero animation

A 7-second looping hero animation, 560×280, made as SVG with CSS keyframes. It has no images and no JavaScript.

The ticket card (PR-2026-00000042 · Purchase request) slides in and moves through three steps: Manager, Finance, Done. The active step is blue (#2563EB) with a ticking clock. Each finished step gets a check mark and turns green (#22C55E). The loop ends on an **Approved** pill, then restarts.

| File | Use |
|---|---|
| `ticketflow-hero.svg` | Main file. Follows the viewer's light or dark setting. With reduced motion turned on, it shows the final frame instead of animating. |
| `ticketflow-hero-light.svg` | Always light, for a page that sets its own theme. |
| `ticketflow-hero-dark.svg` | Always dark, for a page that sets its own theme. |
| `ticketflow-hero-static-light.svg` | Final frame, no animation, light. |
| `ticketflow-hero-static-dark.svg` | Final frame, no animation, dark. |

Embed with `<img src="ticketflow-hero.svg" width="560" height="280" alt="Purchase request moving through Manager, Finance and Done approval, ending Approved">`. It scales down to 320 px wide.

Notes:
- The check marks and the "Approved" text are dark green (#052E16) on the green, because white on #22C55E has a contrast of only about 2.3:1.
- Text uses the system font, so its width varies a little between platforms.
- Design canvas (private): https://claude.ai/artifact/HAriUGhZSCJd1eTG7Wtgav
