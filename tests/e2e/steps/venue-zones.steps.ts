import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { When } = createBdd(test);

// ── Add Area mode ───────────────────────────────────────────────────────────────

When('I enable Add Area mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Area' }).click();
});

// Places three vertices around the map's center, then a fourth click back
// near the first vertex to close the loop — mirrors how a real user finishes
// a polygon (handleAreaImageClick treats a click within
// ZONE_CLOSE_THRESHOLD_PERCENT of the start point as "close", not "add a
// vertex"), so no separate double-click step is needed.
When('I draw a triangular area on the venue map', async ({ page }) => {
  const mapImage = page.getByAltText('Venue map');
  const box = await mapImage.boundingBox();
  if (!box) throw new Error('Venue map image bounding box not found');

  const first = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.3 };
  const second = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.3 };
  const third = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };

  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  await page.mouse.click(third.x, third.y);
  await page.mouse.click(first.x, first.y);
});

When('I name the area {string}', async ({ page }, name: string) => {
  await page.getByPlaceholder('Area name').fill(name);
  await page.getByRole('button', { name: 'Confirm' }).click();
});

When('I name the area {string} and mark it a dispatch zone', async ({ page }, name: string) => {
  await page.getByPlaceholder('Area name').fill(name);
  await page.getByText('Mark as Dispatch Zone').click();
  await page.getByRole('button', { name: 'Confirm' }).click();
});
