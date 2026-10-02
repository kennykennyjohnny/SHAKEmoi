import type { Page } from '@playwright/test';

/** Glissé tactile (vrais événements touch) depuis `from` vers `to`, en n étapes.
 *  `release: false` garde le doigt posé (pour une capture en plein geste). */
export async function swipe(page: Page, selector: string, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12, stepMs = 12, release = true) {
  await page.evaluate(async ({ selector, from, to, steps, stepMs, release }) => {
    const el = document.querySelector(selector) as HTMLElement;
    const target = document.elementFromPoint(from.x, from.y) || el;
    const mk = (x: number, y: number) => new Touch({ identifier: 1, target, clientX: x, clientY: y });
    const fire = (type: string, x: number, y: number) => {
      const t = mk(x, y);
      const end = type === 'touchend';
      target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: end ? [] : [t], targetTouches: end ? [] : [t], changedTouches: [t] }));
    };
    fire('touchstart', from.x, from.y);
    for (let i = 1; i <= steps; i++) {
      await new Promise((r) => setTimeout(r, stepMs));
      fire('touchmove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    }
    if (release) fire('touchend', to.x, to.y);
  }, { selector, from, to, steps, stepMs, release });
}
