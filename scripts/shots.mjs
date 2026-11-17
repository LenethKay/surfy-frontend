import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.SURFARE_BASE_URL ?? 'http://127.0.0.1:5173';
const outputDirectory = path.resolve('shots');
const browser = await chromium.launch({ headless: true });

try {
  await mkdir(outputDirectory, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const loadPage = async (state) => {
    await page.goto(`${baseUrl}/?demo=${state}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      images.forEach((image) => { image.loading = 'eager'; });
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    });
    if (state === 'autoask') {
      await page.locator('.result-details').waitFor({ state: 'visible' });
      await page.getByRole('dialog', { name: 'Ask Surfy!' }).waitFor({ state: 'visible' });
    }
    if (state === 'feedback') {
      await page.getByRole('dialog', { name: 'How did Surfare do?' }).waitFor({ state: 'visible' });
    }
    if (state === 'autoask' || state === 'feedback') {
      const selector = state === 'autoask' ? '.ask-dialog' : '.feedback-dialog';
      await page.locator(selector).evaluate((element) => Promise.all(
        element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
      ));
    }
  };

  const assertNoOverflow = async (width) => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
      throw new Error(`Horizontal overflow at ${width}px.`);
    }
  };

  const assertPageSections = async () => {
    const foamCount = await page.locator('img[src$="/1.png"]').count();
    const foamInsideCard = await page.locator('.check-card img[src$="/1.png"]').count();
    const tabs = await page.locator('.check-tabs button').count();
    const riskCards = await page.locator('.risk-card').count();
    const cap = await page.locator('.result-wave-top').evaluate((image) => ({
      src: image.getAttribute('src'),
      width: image.naturalWidth,
      height: image.naturalHeight,
      renderedWidth: image.getBoundingClientRect().width,
      renderedHeight: image.getBoundingClientRect().height,
      position: getComputedStyle(image).position,
      containerWidth: image.parentElement.getBoundingClientRect().width,
      overlap: image.getBoundingClientRect().bottom
        - image.parentElement.nextElementSibling.getBoundingClientRect().top,
      headingGap: image.parentElement.nextElementSibling.querySelector('.result-heading')
        .getBoundingClientRect().top - image.getBoundingClientRect().bottom,
      title: image.parentElement.querySelector('span').innerText,
    }));
    const foamRatio = await page.locator('.check-card').evaluate((card) =>
      card.querySelector('.check-foam').getBoundingClientRect().width / card.getBoundingClientRect().width);
    const waveDimensions = await page.locator('.wave-stage img').evaluate(
      (image) => ({ width: image.naturalWidth, height: image.naturalHeight }),
    );
    const meter = await page.locator('.risk-meter').evaluate((element) => ({
      indicators: element.querySelectorAll('.meter-indicator').length,
      colors: Array.from(element.querySelectorAll('.meter-segment'), (segment) =>
        getComputedStyle(segment).backgroundColor),
    }));
    const panelBackground = await page.locator('.result-panel').evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );
    const panelStyles = await page.locator('.result-panel').evaluate((element) => ({
      radius: getComputedStyle(element).borderRadius,
      footerBorder: getComputedStyle(element.querySelector('.result-footer')).borderTopStyle,
      bodyOverflow: getComputedStyle(element.querySelector('.result-body')).overflowY,
    }));
    if (foamCount !== 1 || foamInsideCard !== 1 || tabs !== 4 || riskCards !== 4) {
      throw new Error('Required checker tabs, single foam asset, or risk cards are missing.');
    }
    if (waveDimensions.width !== 2172 || waveDimensions.height !== 414) {
      throw new Error(`Unexpected wave asset dimensions: ${waveDimensions.width}x${waveDimensions.height}.`);
    }
    if (cap.src !== '/assets/orange-cap.png' || cap.width !== 1000 || cap.height !== 124
      || cap.position !== 'static' || cap.title !== 'Your Result'
      || Math.abs(cap.renderedWidth - cap.containerWidth) > 1
      || Math.abs(cap.renderedWidth / cap.renderedHeight - (1000 / 124)) > 0.03
      || Math.abs(cap.overlap - 16) > 1 || cap.headingGap < 0 || cap.headingGap > 4) {
      throw new Error('The result cap image is missing or not rendered at its natural aspect ratio.');
    }
    if (Math.abs(foamRatio - 0.27) > 0.02) {
      throw new Error(`The lower-left foam should be 27% of the card width; found ${(foamRatio * 100).toFixed(1)}%.`);
    }
    if (meter.indicators !== 0
      || meter.colors.join(',') !== 'rgb(189, 189, 189),rgb(158, 158, 158),rgb(140, 140, 140)'
      || !panelBackground.includes('160deg') || panelStyles.radius !== '24px'
      || panelStyles.footerBorder !== 'none' || panelStyles.bodyOverflow !== 'auto') {
      throw new Error('The idle meter or result-panel styles do not match the specification.');
    }
  };

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const state of ['idle', 'suspicious', 'low', 'high', 'unknown', 'autoask', 'feedback']) {
      await loadPage(state);
      await assertNoOverflow(viewport.width);
      if (['low', 'suspicious', 'high'].includes(state)) {
        if (await page.locator('.result-heading .result-mascot').count() !== 0) {
          throw new Error(`The mascot should be beside the summary, not in the ${state} header.`);
        }
      }
      if (state === 'low') {
        if ((await page.locator('.result-prompt').innerText()) !== '1 warning sign found'
          || await page.locator('.signal-minor').count() !== 1) {
          throw new Error('The low-risk result should use singular copy and an amber minor signal.');
        }
      }
      if (state === 'autoask') {
        const dialog = page.getByRole('dialog', { name: 'Ask Surfy!' });
        if (await dialog.getAttribute('aria-modal') !== 'false') {
          throw new Error('Ask Surfy should remain modeless.');
        }
        if (viewport.width > 700) {
          const overlayPosition = await page.locator('.ask-panel-position').evaluate(
            (element) => getComputedStyle(element).position,
          );
          if (overlayPosition !== 'absolute') throw new Error('Desktop Ask Surfy is not card-anchored.');
        }
      }
      if (state === 'feedback') {
        const dialog = page.getByRole('dialog', { name: 'How did Surfare do?' });
        if (await dialog.getAttribute('aria-modal') !== 'true') {
          throw new Error('The feedback dialog should be modal.');
        }
        const verticalCenterOffset = await dialog.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return Math.abs((bounds.top + bounds.bottom) / 2 - window.innerHeight / 2);
        });
        if (verticalCenterOffset > 2) throw new Error('Feedback should be vertically centered.');
      }
      if (state === 'idle' && viewport.width === 1440) await assertPageSections();
      await page.screenshot({
        path: path.join(outputDirectory, `${viewport.width}-${state}.png`),
        animations: 'disabled',
      });
      if (viewport.width === 1440 && ['idle', 'low', 'suspicious', 'high', 'unknown'].includes(state)) {
        await page.locator('.check-result-column').screenshot({
          path: path.join(outputDirectory, `1440-result-${state}.png`),
          animations: 'disabled',
        });
      }
      if (state === 'idle') {
        await page.screenshot({
          path: path.join(outputDirectory, `${viewport.width}-idle-full.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
      if (state === 'autoask') {
        const dialog = page.getByRole('dialog', { name: 'Ask Surfy!' });
        const before = await dialog.boundingBox();
        const handle = page.getByRole('button', { name: 'Move the Ask Surfy conversation' });
        const handleBounds = await handle.boundingBox();
        await page.mouse.move(
          handleBounds.x + handleBounds.width / 2,
          handleBounds.y + handleBounds.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          handleBounds.x + handleBounds.width / 2,
          handleBounds.y + handleBounds.height / 2 - 40,
          { steps: 4 },
        );
        await page.mouse.up();
        const after = await dialog.boundingBox();
        if (!before || !after || after.y >= before.y - 20) {
          throw new Error('The Ask Surfy panel should move vertically when its handle is dragged.');
        }
      }
    }
  }

  for (const width of [1024, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await loadPage('idle');
    await assertNoOverflow(width);
    await page.screenshot({
      path: path.join(outputDirectory, `${width}-idle.png`),
      animations: 'disabled',
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  const offlineOnly = page.getByRole('checkbox', { name: 'Offline checks only' });
  await offlineOnly.check();
  if (!(await offlineOnly.isChecked())) throw new Error('Offline-only setting did not turn on.');
  await offlineOnly.uncheck();

  for (const tab of ['Links', 'Image', 'QR code', 'Text']) {
    const tabButton = page.getByRole('tab', { name: tab });
    await tabButton.click();
    if (await tabButton.getAttribute('aria-selected') !== 'true') {
      throw new Error(`The ${tab} checker tab did not become active.`);
    }
    if (tab === 'Links') {
      const linkField = page.getByRole('textbox', { name: 'Paste the link' });
      const linkFieldStyle = await linkField.evaluate((element) => ({
        tagName: element.tagName,
        paddingTop: getComputedStyle(element).paddingTop,
        height: element.getBoundingClientRect().height,
      }));
      if (linkFieldStyle.tagName !== 'TEXTAREA' || linkFieldStyle.paddingTop !== '18px'
        || linkFieldStyle.height !== 240) {
        throw new Error('The link text area should start at its top edge.');
      }
      await linkField.fill('https://example.com');
      if (await linkField.inputValue() !== 'https://example.com') {
        throw new Error('The link text area did not accept a URL.');
      }
      await linkField.fill('');
      await page.locator('.tab-panel').screenshot({
        path: path.join(outputDirectory, '1440-link-input-top.png'),
        animations: 'disabled',
      });
    }
    if (tab === 'Text') {
      const messageField = page.getByRole('textbox', { name: 'Paste the message' });
      if (await messageField.evaluate((element) => getComputedStyle(element).resize) !== 'vertical') {
        throw new Error('The message text area should be vertically resizable.');
      }
    }
  }

  await page.locator('select[aria-label="Choose language"]').selectOption('tl');
  await page.locator('html[lang="fil"]').waitFor();
  await page.getByRole('heading', { name: 'May kakaiba ba?' }).waitFor();
  await page.locator('select[aria-label="Pumili ng wika"]').selectOption('en');
  await page.locator('html[lang="en"]').waitFor();

  await page.locator('.tab-panel textarea').fill(
    'Your account will be blocked unless you send your OTP now.',
  );
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  const askDialog = page.getByRole('dialog', { name: 'Ask Surfy!' });
  await askDialog.waitFor({ state: 'visible' });
  if (await askDialog.getAttribute('aria-modal') !== 'false') {
    throw new Error('Ask Surfy should remain modeless during a real check.');
  }
  if (!(await page.locator('.tab-panel textarea').isDisabled())) {
    throw new Error('The checker input should lock while Ask Surfy is open.');
  }
  await page.locator('.result-details').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Close Ask Surfy' }).click();

  await page.getByRole('button', { name: 'Save Report' }).click();
  await page.getByRole('dialog', { name: 'Save Report' }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New Check' }).click();
  const feedbackDialog = page.getByRole('dialog', { name: 'How did Surfare do?' });
  await feedbackDialog.waitFor({ state: 'visible' });
  if (await feedbackDialog.getAttribute('aria-modal') !== 'true') {
    throw new Error('Feedback should use a modal dialog.');
  }
  await page.getByRole('button', { name: 'Skip' }).click();
  if ((await page.locator('.tab-panel textarea').inputValue()) !== '') {
    throw new Error('Skipping feedback should reset the current check.');
  }

  if (errors.length) throw new Error(`Browser console errors:\n${errors.join('\n')}`);
  console.log(`Saved verified screenshots to ${outputDirectory}`);
} finally {
  await browser.close();
}
