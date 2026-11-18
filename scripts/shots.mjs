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
    if (['autoask', 'ask', 'ask-chat'].includes(state)) {
      await page.locator('.result-details').waitFor({ state: 'visible' });
      await page.getByRole('complementary', { name: 'Ask Surfy' }).waitFor({ state: 'visible' });
    }
    if (state === 'feedback') {
      await page.getByRole('dialog', { name: 'How did Surfare do?' }).waitFor({ state: 'visible' });
    }
    if (['autoask', 'ask', 'ask-chat', 'feedback'].includes(state)) {
      const selector = state === 'feedback' ? '.feedback-dialog' : '.ask-dialog';
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

  const assertWaveLayout = async (width) => {
    const layout = await page.locator('.wave-stage').evaluate((stage) => {
      const image = stage.querySelector('img');
      const imageBounds = image.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      const edgeFill = getComputedStyle(stage, '::before');
      return {
        src: image.getAttribute('src'),
        nativeWidth: image.naturalWidth,
        nativeHeight: image.naturalHeight,
        renderedWidth: imageBounds.width,
        stageWidth: stageBounds.width,
        leftFillWidth: parseFloat(edgeFill.borderLeftWidth),
        rightFillWidth: parseFloat(edgeFill.borderRightWidth),
        edgeFillSource: edgeFill.borderImageSource,
      };
    });
    if (layout.src !== '/assets/Headbanner.png' || layout.nativeWidth !== 2172
      || layout.nativeHeight !== 414 || layout.renderedWidth > layout.nativeWidth + 1) {
      throw new Error(`The hero wave is not using the native Headbanner asset at ${width}px: ${JSON.stringify(layout)}.`);
    }
    if (width > layout.nativeWidth) {
      const expectedFillWidth = (layout.stageWidth - layout.renderedWidth) / 2;
      if (Math.abs(layout.leftFillWidth - expectedFillWidth) > 1
        || Math.abs(layout.rightFillWidth - expectedFillWidth) > 1
        || !layout.edgeFillSource.includes('Headbanner.png')) {
        throw new Error(`The wide hero wave edge fills do not match the sampled edges at ${width}px: ${JSON.stringify(layout)}.`);
      }
    }
  };

  const assertGoldenRulesIdleLayout = async (width) => {
    const layout = await page.locator('.check-input-column').evaluate((column) => {
      const bounds = (selector) => column.querySelector(selector).getBoundingClientRect();
      const columnBounds = column.getBoundingClientRect();
      const inputBounds = bounds('.input-card');
      const headline = bounds('.golden-rules h3');
      const style = getComputedStyle(column.querySelector('.golden-rules h3'));
      return {
        horizontalOffset: (headline.left + headline.right - columnBounds.left - columnBounds.right) / 2,
        freeAreaProgress: ((headline.top + headline.bottom) / 2 - inputBounds.bottom)
          / (columnBounds.bottom - inputBounds.bottom),
        textWrap: style.textWrap,
        maxWidth: style.maxWidth,
      };
    });
    if (Math.abs(layout.horizontalOffset) > 1 || layout.freeAreaProgress < 0.36
      || layout.freeAreaProgress > 0.44 || layout.textWrap !== 'balance' || layout.maxWidth !== '460px') {
      throw new Error(`Golden rules are not centered in the idle free space at ${width}px: ${JSON.stringify(layout)}.`);
    }
  };

  const assertGoldenRulesAskLayout = async (width) => {
    const layout = await page.locator('.check-input-column').evaluate((column) => {
      const bounds = (selector) => column.querySelector(selector).getBoundingClientRect();
      const columnBounds = column.getBoundingClientRect();
      const label = bounds('.golden-rules > p');
      const headline = bounds('.golden-rules h3');
      const panelPosition = column.querySelector('.ask-panel-position').getBoundingClientRect();
      const mascot = column.querySelector('.ask-brand img').getBoundingClientRect();
      const brand = column.querySelector('.ask-brand').getBoundingClientRect();
      const title = column.querySelector('.ask-brand h2').getBoundingClientRect();
      const chat = column.querySelector('.ask-content').getBoundingClientRect();
      const panel = column.querySelector('.ask-dialog').getBoundingClientRect();
      return {
        labelOffset: label.left - columnBounds.left,
        headlineOffset: headline.left - columnBounds.left,
        labelHeadlineGap: headline.top - label.bottom,
        panelGap: panelPosition.top - headline.bottom,
        mascotWidth: mascot.width,
        mascotPanelRatio: mascot.width / panel.width,
        mascotBrandCenterOffset: (mascot.left + mascot.right - brand.left - brand.right) / 2,
        mascotTitleGap: title.top - mascot.bottom,
        mascotChatGap: chat.left - mascot.right,
      };
    });
    if (Math.abs(layout.labelOffset) > 1 || Math.abs(layout.headlineOffset) > 1
      || layout.labelHeadlineGap < 3 || layout.labelHeadlineGap > 5) {
      throw new Error(`Golden rules are not left-aligned above the headline at ${width}px: ${JSON.stringify(layout)}.`);
    }
    if (width > 640 && (Math.abs(layout.panelGap - 14) > 1 || layout.mascotWidth < 140
      || layout.mascotPanelRatio < 0.165 || layout.mascotPanelRatio > 0.19
      || Math.abs(layout.mascotBrandCenterOffset) > 1 || layout.mascotTitleGap < 12
      || layout.mascotChatGap < 12)) {
      throw new Error(`Ask Surfy desktop mascot or spacing is incorrect at ${width}px: ${JSON.stringify(layout)}.`);
    }
    if (width <= 640 && Math.abs(layout.mascotWidth - 100) > 1) {
      throw new Error(`Ask Surfy mobile mascot should be 100px at ${width}px: ${JSON.stringify(layout)}.`);
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
      (image) => ({
        src: image.getAttribute('src'),
        width: image.naturalWidth,
        height: image.naturalHeight,
      }),
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
    if (waveDimensions.src !== '/assets/Headbanner.png'
      || waveDimensions.width !== 2172 || waveDimensions.height !== 414) {
      throw new Error(`Unexpected wave asset: ${JSON.stringify(waveDimensions)}.`);
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

  const captureRoundSevenSections = async (viewport) => {
    await page.setViewportSize(viewport);
    await loadPage('idle');
    await assertNoOverflow(viewport.width);

    const layout = await page.evaluate(() => {
      const box = (element) => {
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, right: bounds.right, width: bounds.width, height: bounds.height };
      };
      const cards = Array.from(document.querySelectorAll('.risk-card'));
      const grid = document.querySelector('.risk-grid');
      const gridStyle = getComputedStyle(grid);
      return {
        howLabelColor: getComputedStyle(document.querySelector('.how-section .section-eyebrow')).color,
        howStepTitleColor: getComputedStyle(document.querySelector('.step-card h3')).color,
        howSteps: box(document.querySelector('.steps-list')),
        riskBackground: getComputedStyle(document.querySelector('.risks-section')).backgroundImage,
        riskLabelColor: getComputedStyle(document.querySelector('.risks-section .section-eyebrow')).color,
        footerBackground: getComputedStyle(document.querySelector('.site-footer')).backgroundImage,
        grid: box(grid),
        columns: gridStyle.gridTemplateColumns.trim().split(/\s+/).length,
        cards: cards.map((card) => ({
          box: box(card),
          panelHeight: card.querySelector('.risk-card-color').getBoundingClientRect().height,
          copyAlignment: getComputedStyle(card.querySelector('.risk-card-copy')).textAlign,
          badgeColor: getComputedStyle(card.querySelector('.risk-pill')).color,
          descriptionBottom: card.querySelector('p').getBoundingClientRect().bottom,
        })),
      };
    });

    const expectedColumns = viewport.width >= 1024 ? 4 : viewport.width >= 640 ? 2 : 1;
    if (layout.howLabelColor !== 'rgb(210, 63, 60)'
      || layout.howStepTitleColor !== 'rgb(210, 63, 60)') {
      throw new Error(`How it works accent colors are incorrect at ${viewport.width}px.`);
    }
    if (layout.columns !== expectedColumns || layout.cards.length !== 4
      || !layout.riskBackground.includes('rgb(149, 193, 255)')
      || !layout.riskBackground.includes('rgb(60, 104, 204)')
      || !layout.footerBackground.includes('rgb(60, 104, 204)')
      || !layout.footerBackground.includes('rgb(15, 24, 141)')) {
      throw new Error(`Risk layout or section gradients are incorrect at ${viewport.width}px: ${JSON.stringify(layout)}.`);
    }
    if (viewport.width === 1440
      && (Math.abs(layout.grid.x / viewport.width - 0.08) > 0.015
        || Math.abs(layout.grid.right / viewport.width - 0.93) > 0.02
        || Math.abs(layout.cards[0].box.height - 292) > 1
        || Math.abs(layout.cards[0].panelHeight - 157) > 1
        || Math.abs(layout.howSteps.x / viewport.width - 0.29) > 0.02)) {
      throw new Error(`Desktop section geometry is outside the wireframe targets: ${JSON.stringify(layout)}.`);
    }
    if (layout.cards.some((card) => card.copyAlignment !== 'left'
      || card.badgeColor !== 'rgb(255, 255, 255)'
      || card.descriptionBottom > card.box.bottom - 6)) {
      throw new Error(`Risk card copy is misaligned, unreadable, or overflowing at ${viewport.width}px: ${JSON.stringify(layout.cards)}.`);
    }
    if (viewport.width < 640 && layout.cards.some((card) => card.box.width > 340)) {
      throw new Error('Mobile risk cards should be limited to 340px.');
    }

    await page.locator('.how-section').screenshot({
      path: path.join(outputDirectory, `${viewport.width}-round7-how.png`),
      animations: 'disabled',
    });
    const hideStickyHeader = await page.addStyleTag({
      content: '.site-header { visibility: hidden !important; }',
    });
    await page.locator('.risks-section').screenshot({
      path: path.join(outputDirectory, `${viewport.width}-round7-risk.png`),
      animations: 'disabled',
    });
    await hideStickyHeader.evaluate((style) => style.remove());
  };

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const state of [
      'idle', 'suspicious', 'low', 'high', 'unknown', 'ask', 'ask-chat', 'autoask', 'feedback',
    ]) {
      await loadPage(state);
      await assertNoOverflow(viewport.width);
      if (state === 'idle') {
        await assertGoldenRulesIdleLayout(viewport.width);
        const navbar = await page.locator('.site-header').evaluate((header) => {
          const logo = header.querySelector('.brand img');
          const wordmark = header.querySelector('.brand span');
          const connection = header.querySelector('.connection-status');
          return {
            height: header.getBoundingClientRect().height,
            logoWidth: logo.getBoundingClientRect().width,
            logoHeight: logo.getBoundingClientRect().height,
            wordmarkSize: getComputedStyle(wordmark).fontSize,
            wordmarkLineHeight: getComputedStyle(wordmark).lineHeight,
            connectionHeight: connection.getBoundingClientRect().height,
            connectionTextVisible: getComputedStyle(connection.querySelector('span')).display !== 'none',
            languageChevronVisible: getComputedStyle(
              header.querySelector('.language-control > svg:last-child'),
            ).display !== 'none',
          };
        });
        const mobile = viewport.width <= 640;
        if (navbar.height !== (mobile ? 52 : 56)
          || navbar.logoWidth !== (mobile ? 34 : 38)
          || navbar.logoHeight !== (mobile ? 34 : 38)
          || navbar.wordmarkSize !== (mobile ? '24px' : '28px')
          || navbar.wordmarkLineHeight !== (mobile ? '24px' : '28px')
          || navbar.connectionHeight !== (mobile ? 28 : 30)
          || !navbar.connectionTextVisible
          || navbar.languageChevronVisible === mobile) {
          throw new Error(`Unexpected navbar dimensions or mobile controls: ${JSON.stringify(navbar)}.`);
        }
        await page.screenshot({
          path: path.join(outputDirectory, `${viewport.width}-navbar.png`),
          animations: 'disabled',
        });
      }
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
      if (['ask', 'ask-chat', 'autoask'].includes(state)) {
        await assertGoldenRulesAskLayout(viewport.width);
        const panel = page.getByRole('complementary', { name: 'Ask Surfy' });
        if (await panel.count() !== 1 || await page.getByRole('button', { name: /Close Ask Surfy/ }).count()) {
          throw new Error('Ask Surfy should be a persistent complementary panel without a close button.');
        }
        if (await panel.getAttribute('aria-modal') !== null
          || await page.getByRole('dialog', { name: 'Ask Surfy' }).count() !== 0) {
          throw new Error('Ask Surfy should not use dialog or modal semantics.');
        }
        if (viewport.width > 640) {
          const panelPosition = await page.locator('.ask-panel-position').evaluate(
            (element) => getComputedStyle(element).position,
          );
          if (panelPosition !== 'relative') throw new Error('Desktop Ask Surfy should be inline in the left column.');
          const parentClass = await page.locator('.ask-dialog').evaluate(
            (element) => element.parentElement.parentElement.classList.contains('check-input-column'),
          );
          if (!parentClass) throw new Error('Ask Surfy is not positioned inside the checker’s left column.');
        }
        if (state === 'ask-chat') {
          const chatArea = page.locator('.ask-messages');
          const overflow = await chatArea.evaluate((element) => element.scrollHeight > element.clientHeight);
          if (!overflow) throw new Error('The populated Ask Surfy demo should show an overflowing chat area.');
        }
        const chipLabels = await page.locator('.ask-chip').allInnerTexts();
        if (viewport.width > 640 && chipLabels.join('|') !== [
          'Why was this flagged?',
          'What should I do now?',
          'Does this work without internet?',
          'Do you keep my photo?',
          'What if you are not sure?',
          'Is this link safe to open?',
        ].join('|')) {
          throw new Error(`Ask Surfy chips are not in the required order: ${chipLabels.join(' | ')}.`);
        }
        if (viewport.width <= 640) {
          const sheetBounds = await panel.boundingBox();
          if (!sheetBounds || Math.abs(sheetBounds.y + sheetBounds.height - viewport.height) > 1) {
            throw new Error('The mobile Ask Surfy sheet should be docked to the bottom of the viewport.');
          }
          const collapse = page.getByRole('button', { name: 'Collapse Ask Surfy' });
          await collapse.click();
          if (await panel.getAttribute('class').then((className) => !className.includes('is-collapsed'))) {
            throw new Error('Mobile Ask Surfy did not collapse.');
          }
          await page.getByRole('button', { name: 'Expand Ask Surfy' }).click();
          if (await panel.getAttribute('class').then((className) => className.includes('is-collapsed'))) {
            throw new Error('Mobile Ask Surfy did not expand.');
          }
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
      if (['ask', 'ask-chat'].includes(state) && viewport.width > 640) {
        await page.locator('.ask-panel-position').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(outputDirectory, `1440-${state}-layout.png`),
          animations: 'disabled',
        });
        await page.locator('.ask-dialog').screenshot({
          path: path.join(outputDirectory, `1440-${state}-panel.png`),
          animations: 'disabled',
        });
      }
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
    }
  }

  for (const viewport of [
    { width: 1024, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ]) {
    const { width } = viewport;
    await page.setViewportSize(viewport);
    await loadPage('idle');
    await assertNoOverflow(width);
    await assertWaveLayout(width);
    await page.screenshot({
      path: path.join(outputDirectory, `${width}-idle.png`),
      animations: 'disabled',
    });
    if (width === 1920) {
      await loadPage('ask');
      await assertNoOverflow(width);
      await assertWaveLayout(width);
      await assertGoldenRulesAskLayout(width);
      await page.locator('.ask-panel-position').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(outputDirectory, `${width}-ask-layout.png`),
        animations: 'disabled',
      });
    }
  }

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await captureRoundSevenSections(viewport);
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
  const askPanel = page.locator('.ask-dialog');
  await page.getByRole('complementary', { name: 'Ask Surfy' }).waitFor({ state: 'visible' });
  if (await page.locator('.tab-panel textarea').isDisabled()) {
    throw new Error('The checker input should stay enabled while Ask Surfy is open.');
  }
  await page.locator('.result-details').waitFor({ state: 'visible' });
  await page.locator('.tab-panel textarea').click();
  await page.getByRole('tab', { name: 'Links' }).click();
  if (await askPanel.count() !== 1) throw new Error('Switching tabs closed Ask Surfy.');
  await page.getByRole('tab', { name: 'Text' }).click();
  await page.locator('select[aria-label="Choose language"]').selectOption('tl');
  await page.locator('html[lang="fil"]').waitFor();
  if (await askPanel.count() !== 1) throw new Error('Changing language closed Ask Surfy.');
  await page.locator('select[aria-label="Pumili ng wika"]').selectOption('en');
  await page.locator('html[lang="en"]').waitFor();
  await page.locator('.hero-content').click({ position: { x: 10, y: 10 } });
  if (await askPanel.count() !== 1) throw new Error('Clicking the page background closed Ask Surfy.');
  await page.locator('.result-panel').click({ position: { x: 12, y: 100 } });
  await page.keyboard.press('Escape');
  if (await askPanel.count() !== 1) throw new Error('Clicking the result or pressing Escape closed Ask Surfy.');

  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('.ask-result-divider').waitFor({ state: 'visible' });
  if (await askPanel.count() !== 1
    || await page.locator('.chat-bubble.chat-surfy').count() < 2) {
    throw new Error('Rechecking should keep Ask Surfy open and append a new result summary.');
  }
  await page.screenshot({
    path: path.join(outputDirectory, '1440-ask-rechecked.png'),
    animations: 'disabled',
  });

  const askInput = page.locator('#ask-input');
  await askInput.fill('Why was this flagged?');
  await askInput.press('Shift+Enter');
  await askInput.type('Please explain more.');
  if (!(await askInput.inputValue()).includes('\n')
    || await askInput.evaluate((element) => element.getBoundingClientRect().height) <= 56) {
    throw new Error('Shift+Enter should add a line and grow the Ask Surfy input.');
  }
  const previousUserMessages = await page.locator('.chat-bubble.chat-user').count();
  await askInput.press('Enter');
  if (await askInput.inputValue() !== '') throw new Error('Enter should submit and clear the message input.');
  await page.getByRole('status', { name: 'Surfy is thinking' }).waitFor({ state: 'visible' });
  await page.getByRole('status', { name: 'Surfy is thinking' }).waitFor({ state: 'hidden' });
  if (await page.locator('.chat-bubble.chat-user').count() !== previousUserMessages + 1) {
    throw new Error('Ask Surfy did not keep the submitted question in the conversation.');
  }

  await page.getByRole('button', { name: 'Save Report' }).click();
  await page.getByRole('dialog', { name: 'Save Report' }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New Check' }).click();
  const feedbackDialog = page.getByRole('dialog', { name: 'How did Surfare do?' });
  await feedbackDialog.waitFor({ state: 'visible' });
  if (await askPanel.count() !== 0 || await page.locator('.ask-messages').count() !== 0) {
    throw new Error('New Check should close Ask Surfy and clear its conversation before feedback.');
  }
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
