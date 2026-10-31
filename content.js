(() => {
  if (window.__derrubaMuroLoaded) return;
  window.__derrubaMuroLoaded = true;

  const HOST = location.hostname;
  let totalAdjustments = 0;
  let adsEnabled = true;

  // Textos típicos de muros de assinatura e avisos de adblock
  const WALL_TEXT = new RegExp(
    [
      'assine', 'assinatura', 'assinante', 'subscribe', 'subscription', 'paywall',
      'continue lendo', 'conte[uú]do exclusivo', 'exclusive content',
      'fa[cç]a login para (continuar|ler)', 'sign in to continue',
      'create (a free )?account to continue', 'cadastre-se gratuitamente para ler',
      'voc[eê] atingiu o limite', 'limite de (leitura|mat[eé]rias)',
      'free articles? remaining', 'articles? left this month',
      'desative.{0,40}(bloqueador|adblock)', 'ad ?block', 'bloqueador de an[uú]ncios',
      'permita an[uú]ncios', 'disable your ad'
    ].join('|'),
    'i'
  );

  // Rótulos de blocos de publicidade no meio de matérias ("CONTINUA DEPOIS DA PUBLICIDADE", etc.)
  const AD_LABEL_EXACT = new RegExp(
    '^\\s*(' +
      'continua\\s+(depois|ap[oó]s)\\s+(d?a\\s+)?(publicidade|an[uú]ncio)|' +
      'o\\s+texto\\s+continua\\s+(depois|ap[oó]s)\\s+(d?a\\s+)?publicidade|' +
      'publicidade(\\s*[-–•]\\s*continue\\s+lendo(\\s+abaixo)?)?|' +
      'an[uú]ncio(\\s+publicit[aá]rio)?|' +
      'continua\\s+ap[oó]s\\s+publicidade|' +
      'texto\\s+continua\\s+abaixo|' +
      'advertisement|' +
      'sponsored(\\s+advertisement)?' +
      ')\\s*:?\\s*$',
    'i'
  );

  // Seletores conhecidos de blocos de anúncios (Google Ads/GPT/AdSense, Criteo, Taboola, Outbrain, UOL/Motorsport e portais BR)
  const AD_SELECTORS = [
    'ins.adsbygoogle',
    '[id^="div-gpt-ad"]',
    '[id*="div-gpt-ad" i]',
    '[id^="google_ads_iframe"]',
    '[data-google-query-id]',
    '[id^="ads_"]',
    '[id^="banner-"][id$="-area"]',
    '.ms-ap',
    '[data-ad-unit]',
    '[data-ad-unit-id]',
    '[data-ad-slot]',
    '[data-dfp-code]',
    '[data-dfp-attrs]',
    '[data-msnt-label]',
    '[data-ad-label]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="criteo."]',
    'iframe[src*="safeframe.googlesyndication.com"]',
    'iframe[id*="google_ads"]',
    'amp-ad',
    'amp-embed',
    'amp-sticky-ad',
    '[id*="taboola" i]',
    '[class*="taboola" i]',
    '[id*="outbrain" i]',
    '[class*="outbrain" i]',
    '[id*="uolads" i]',
    '[class*="uolads" i]',
    '.dfp-ad',
    '.ad-slot',
    '.ad-banner',
    '.ad-container',
    '.ad-wrapper',
    '.ads-container',
    '.ads-wrapper',
    '.content-ads',
    '.mc-ad',
    '.publicidade',
    '.box-publicidade',
    '.banner-publicidade',
    '.bloco-publicidade',
    '.container-publicidade',
    '[class*="publicidade-container" i]',
    '[class*="ad-unit" i]',
    '[data-testid*="ad-slot" i]',
    '[aria-label="Publicidade" i]',
    '[aria-label="Anúncio" i]',
    '[aria-label="Advertisement" i]'
  ];

  // Seletores de ferramentas conhecidas (Piano, Google Funding Choices, Poool, Zephr, Evolok, Pelcro)
  const KNOWN = [
    '.tp-modal',
    '.tp-backdrop',
    '.tp-iframe-wrapper',
    '.fc-ab-root',
    '.fc-dialog-overlay',
    '#poool-widget',
    '.poool-banner',
    '.zephr-overlay',
    '.zephr-modal',
    '#ev-paywall',
    '.ev-open-modal-paywall',
    '.pelcro-modal',
    '[id*="paywall" i][class*="modal" i]',
    '[class*="paywall-overlay" i]',
    '[class*="paywall-modal" i]',
    '[class*="adblock-modal" i]',
    '[class*="adblock-overlay" i]'
  ];

  const PAYWALL_CLASSES =
    '[class*="paywall" i],[class*="teaser" i],[class*="truncat" i],[class*="gated" i],' +
    '[class*="locked" i],[class*="restrict" i],[class*="article-body" i],[class*="story-body" i]';

  const SCROLL_LOCK_CLASS =
    /\b(no-?scroll|modal-open|overflow-hidden|is-locked|scroll-lock(ed)?|has-modal|disable-scroll|tp-modal-open|paywall-active|with-paywall|noscroll)\b/gi;

  const PROTECTED =
    'article, nav, main, header, [itemprop="articleBody"], #derruba-muro-reader, #derruba-muro-picker-banner';

  function updateBadge(added) {
    if (added > 0) {
      totalAdjustments += added;
      try {
        chrome.runtime.sendMessage({ type: 'SET_BADGE', count: totalAdjustments });
      } catch {}
    }
  }

  function injectStyle() {
    if (document.getElementById('derruba-muro-style')) return;
    const st = document.createElement('style');
    st.id = 'derruba-muro-style';
    const adCss = adsEnabled
      ? `
      ${AD_SELECTORS.join(',\n      ')} {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
    `
      : '';

    // Remove degradês que "apagam" o fim do texto nos blocos de paywall, esconde slots de anúncio e libera seleção
    st.textContent = `
      [class*="paywall" i]::before, [class*="paywall" i]::after,
      [class*="teaser" i]::before, [class*="teaser" i]::after,
      [class*="truncat" i]::before, [class*="truncat" i]::after,
      [class*="fade" i][class*="article" i]::after {
        display: none !important;
        background: none !important;
      }
      article, [itemprop="articleBody"] {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      ${adCss}
    `;
    (document.head || document.documentElement).appendChild(st);
  }

  function isProtected(el) {
    return el.matches(PROTECTED) || !!el.querySelector(PROTECTED);
  }

  // Sobe na árvore DOM até encontrar o wrapper externo que só envolve o anúncio e o rótulo "CONTINUA DEPOIS DA PUBLICIDADE"
  function findSafeAdWrapper(el) {
    let curr = el;
    let parent = curr.parentElement;
    let steps = 0;

    while (
      parent &&
      steps < 4 &&
      parent !== document.body &&
      parent !== document.documentElement &&
      !parent.matches('article, main, header, nav, footer, [itemprop="articleBody"]') &&
      !parent.querySelector('article, main, nav, h1, h2, h3, [itemprop="articleBody"]')
    ) {
      // Se o elemento pai tiver parágrafos reais da notícia, paramos antes dele
      const hasArticleParagraph = [...parent.querySelectorAll('p')].some((p) => {
        const t = (p.innerText || '').trim();
        return t.length > 90 && !AD_LABEL_EXACT.test(t);
      });
      if (hasArticleParagraph) break;

      const text = (parent.innerText || '').trim();
      const stripped = text.replace(AD_LABEL_EXACT, '').trim();
      if (stripped.length > 80) break;

      curr = parent;
      parent = curr.parentElement;
      steps++;
    }
    return curr;
  }

  function collapseParentIfEmpty(parent) {
    if (!parent || parent === document.body || parent === document.documentElement) return;
    const visibleText = (parent.innerText || '').replace(AD_LABEL_EXACT, '').trim();
    if (!visibleText && !parent.querySelector('img, video, canvas, article, h1, h2, h3, p')) {
      parent.style.setProperty('min-height', '0', 'important');
      parent.style.setProperty('height', 'auto', 'important');
      parent.style.setProperty('margin', '0', 'important');
      parent.style.setProperty('padding', '0', 'important');
    }
  }

  function removeAds() {
    if (!adsEnabled || !document.body) return 0;
    let n = 0;

    // 1. Remove elementos de anúncios conhecidos e seus containers diretos (para não sobrar espaço vazio ou bordas)
    document.querySelectorAll(AD_SELECTORS.join(',')).forEach((el) => {
      if (!el.isConnected || isProtected(el)) return;
      const wrapper = findSafeAdWrapper(el);
      if (!isProtected(wrapper)) {
        const parent = wrapper.parentElement;
        wrapper.remove();
        collapseParentIfEmpty(parent);
        n++;
      }
    });

    // 2. Procura blocos com o texto "CONTINUA DEPOIS DA PUBLICIDADE" / "PUBLICIDADE" / "ANÚNCIO"
    // (inclusive quando o texto vem de ::before/::after, atributos data-*label ou span/div)
    const candidates = document.querySelectorAll(
      'article div, article aside, article section, article figure, article span, article p, ' +
        'main div, main aside, main section, main figure, main span, main p, ' +
        'aside div, [class*="ad" i], [class*="pub" i], [id*="ad" i], [id*="pub" i], [id*="banner" i]'
    );

    for (const el of candidates) {
      if (!el.isConnected || isProtected(el)) continue;

      // Usa innerText (não textContent) para não pegar código de <script> interno
      const directText = (el.innerText || '').trim();
      let matchesLabel = directText.length > 0 && directText.length <= 70 && AD_LABEL_EXACT.test(directText);

      // Alguns portais (como Motorsport/UOL) colocam "ANÚNCIO" ou "CONTINUA DEPOIS DA PUBLICIDADE" em ::before / ::after
      if (!matchesLabel && directText.length <= 20) {
        const before = (getComputedStyle(el, '::before').content || '').replace(/^["']|["']$/g, '').trim();
        const after = (getComputedStyle(el, '::after').content || '').replace(/^["']|["']$/g, '').trim();
        if (
          (before && AD_LABEL_EXACT.test(before)) ||
          (after && AD_LABEL_EXACT.test(after))
        ) {
          matchesLabel = true;
        }
      }

      if (matchesLabel) {
        const wrapper = findSafeAdWrapper(el);
        if (!isProtected(wrapper)) {
          const parent = wrapper.parentElement;
          wrapper.remove();
          collapseParentIfEmpty(parent);
          n++;
        }
      }
    }

    return n;
  }

  function collectCandidateOverlays() {
    const candidates = new Set();
    if (!document.body) return candidates;

    // 1. Filhos diretos e de 2º/3º nível do body e de roots de frameworks SPA (#__next, #root, #app)
    const shallowSelectors = [
      'body > *',
      'body > * > *',
      '#__next > *',
      '#__next > * > *',
      '#root > *',
      '#app > *'
    ];
    document.querySelectorAll(shallowSelectors.join(',')).forEach((el) => candidates.add(el));

    // 2. Elementos de posição fixa ou modal/dialog em qualquer profundidade
    document
      .querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [style*="fixed"], [class*="modal" i], [class*="overlay" i], [class*="backdrop" i]'
      )
      .forEach((el) => candidates.add(el));

    return candidates;
  }

  function removeOverlays() {
    let n = 0;

    for (const sel of KNOWN) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!isProtected(el)) {
          el.remove();
          n++;
        }
      });
    }

    const nodes = collectCandidateOverlays();

    for (const el of nodes) {
      if (!el.isConnected || el.matches('script,style,link,noscript,header,nav,footer')) continue;

      const cs = getComputedStyle(el);
      if (!['fixed', 'sticky', 'absolute'].includes(cs.position)) continue;
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;

      const r = el.getBoundingClientRect();
      if (r.width < innerWidth * 0.45 || r.height < 80) continue;
      if (cs.position === 'absolute' && r.height < innerHeight * 0.45) continue;
      if ((parseInt(cs.zIndex, 10) || 0) < 5) continue;
      if (isProtected(el)) continue;

      const text = (el.innerText || '').trim();

      const isBackdrop =
        text.length < 20 &&
        r.width >= innerWidth * 0.85 &&
        r.height >= innerHeight * 0.85 &&
        !el.querySelector('img,video,canvas,p,article');

      const isWall = text.length < 2800 && WALL_TEXT.test(text);

      // Barras flutuantes de anúncio no rodapé/topo (sticky/fixed banners)
      const isFloatingAd =
        adsEnabled &&
        ['fixed', 'sticky'].includes(cs.position) &&
        r.height <= 220 &&
        (AD_LABEL_EXACT.test(text) ||
          !!el.querySelector('iframe[src*="doubleclick"], iframe[src*="googlesyndication"], ins.adsbygoogle, [id^="div-gpt-ad"]'));

      if (isBackdrop || isWall || isFloatingAd) {
        el.remove();
        n++;
      }
    }
    return n;
  }

  function unlockScroll() {
    let n = 0;
    const roots = [
      document.documentElement,
      document.body,
      document.getElementById('__next'),
      document.getElementById('root'),
      document.getElementById('app')
    ].filter(Boolean);

    for (const el of roots) {
      const cs = getComputedStyle(el);

      if (
        cs.overflowY === 'hidden' ||
        cs.overflow === 'hidden' ||
        cs.overflowY === 'clip' ||
        cs.overflow === 'clip'
      ) {
        el.style.setProperty('overflow', 'auto', 'important');
        el.style.setProperty('overflow-y', 'auto', 'important');
        n++;
      }
      if (cs.position === 'fixed') {
        el.style.setProperty('position', 'static', 'important');
        el.style.setProperty('top', 'auto', 'important');
        el.style.setProperty('height', 'auto', 'important');
        n++;
      }
      if (cs.height === `${window.innerHeight}px` && el.scrollHeight > window.innerHeight + 100) {
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        n++;
      }
      if (cs.pointerEvents === 'none') {
        el.style.setProperty('pointer-events', 'auto', 'important');
        n++;
      }
      if (el.className && typeof el.className === 'string' && SCROLL_LOCK_CLASS.test(el.className)) {
        el.className = el.className.replace(SCROLL_LOCK_CLASS, '').replace(/\s+/g, ' ').trim();
        n++;
      }
      SCROLL_LOCK_CLASS.lastIndex = 0;
    }
    return n;
  }

  function unclip() {
    let n = 0;
    const roots = document.querySelectorAll(PAYWALL_CLASSES + ',article,[itemprop="articleBody"],main');
    const targets = new Set();
    roots.forEach((r) => {
      targets.add(r);
      [...r.children].forEach((c) => targets.add(c));
    });

    for (const el of targets) {
      const cs = getComputedStyle(el);
      let changed = false;

      const textLen = (el.textContent || '').length;
      const clipped =
        (cs.overflowY === 'hidden' || cs.overflowY === 'clip') &&
        el.scrollHeight > el.clientHeight + 60 &&
        textLen > 250;

      if (clipped) {
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        changed = true;
      }
      if (cs.filter && cs.filter.includes('blur')) {
        el.style.setProperty('filter', 'none', 'important');
        changed = true;
      }
      const mask = cs.maskImage || cs.webkitMaskImage;
      if (mask && mask !== 'none' && mask.includes('gradient')) {
        el.style.setProperty('-webkit-mask-image', 'none', 'important');
        el.style.setProperty('mask-image', 'none', 'important');
        changed = true;
      }
      if (changed) n++;
    }

    // Revela parágrafos ocultos dentro do artigo
    document
      .querySelectorAll('article p[style*="display: none"], [itemprop="articleBody"] p[style*="display: none"]')
      .forEach((p) => {
        if ((p.textContent || '').trim().length > 40) {
          p.style.setProperty('display', 'block', 'important');
          n++;
        }
      });

    return n;
  }

  function extractStructuredArticle() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    let bestBody = '';
    let bestTitle = '';
    let bestHeadline = '';

    function inspectObj(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(inspectObj);
        return;
      }
      if (obj['@graph']) inspectObj(obj['@graph']);

      const body = typeof obj.articleBody === 'string' ? obj.articleBody.trim() : '';
      if (body.length > bestBody.length) {
        bestBody = body;
        bestTitle = obj.headline || obj.name || '';
        bestHeadline = obj.description || '';
      }
    }

    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        inspectObj(data);
      } catch {}
    }

    // Fallback: procura texto em __NEXT_DATA__ se JSON-LD não tiver articleBody
    if (bestBody.length < 400) {
      const nextScript = document.getElementById('__NEXT_DATA__');
      if (nextScript) {
        try {
          const raw = nextScript.textContent || '';
          const match = raw.match(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (match && match[1]) {
            const decoded = JSON.parse(`"${match[1]}"`);
            if (decoded.length > bestBody.length) bestBody = decoded;
          }
        } catch {}
      }
    }

    return { title: bestTitle, description: bestHeadline, body: bestBody };
  }

  function restoreFromJsonLd(force = false) {
    if (document.getElementById('derruba-muro-restored')) return 0;

    const { body } = extractStructuredArticle();
    if (!body || body.length < 500) return 0;

    const articleEl =
      document.querySelector('[itemprop="articleBody"]') ||
      document.querySelector('article') ||
      document.querySelector('main');
    if (!articleEl) return 0;

    const visibleText = (articleEl.innerText || '').trim();
    // Só injeta automaticamente se o texto no JSON-LD for muito maior que o visível no artigo
    if (!force && body.length < visibleText.length * 1.45) return 0;

    const box = document.createElement('div');
    box.id = 'derruba-muro-restored';
    box.style.cssText =
      'margin: 24px 0; padding: 20px; border: 1px solid #d0d7de; border-left: 4px solid #1b7f37; ' +
      'border-radius: 8px; background: #fcfcfd; color: #1f2328; font-family: Georgia, serif; ' +
      'font-size: 18px; line-height: 1.7;';

    const header = document.createElement('div');
    header.style.cssText =
      'font: 600 12px system-ui, sans-serif; color: #1b7f37; text-transform: uppercase; ' +
      'letter-spacing: 0.04em; margin-bottom: 12px;';
    header.textContent = 'Texto completo recuperado (Derruba Muro)';
    box.appendChild(header);

    const paragraphs = body
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}|\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    for (const text of paragraphs) {
      const p = document.createElement('p');
      p.style.cssText = 'margin: 0 0 14px 0;';
      p.textContent = text;
      box.appendChild(p);
    }

    articleEl.appendChild(box);
    return 1;
  }

  function toggleReaderMode() {
    const existing = document.getElementById('derruba-muro-reader');
    if (existing) {
      existing.remove();
      document.documentElement.style.overflow = '';
      return { active: false };
    }

    const structured = extractStructuredArticle();
    const title =
      structured.title ||
      (document.querySelector('h1') && document.querySelector('h1').innerText.trim()) ||
      document.title;

    let paragraphs = [];
    if (structured.body && structured.body.length > 400) {
      paragraphs = structured.body
        .replace(/\r\n/g, '\n')
        .split(/\n{2,}|\r?\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 20);
    }

    const domParagraphs = [
      ...document.querySelectorAll('article p, [itemprop="articleBody"] p, main p')
    ]
      .map((p) => (p.innerText || '').trim())
      .filter((t) => t.length > 35 && !WALL_TEXT.test(t) && !AD_LABEL_EXACT.test(t));

    if (domParagraphs.join(' ').length > paragraphs.join(' ').length) {
      paragraphs = domParagraphs;
    }

    if (!paragraphs.length) {
      return { active: false, empty: true };
    }

    const overlay = document.createElement('div');
    overlay.id = 'derruba-muro-reader';
    overlay.style.cssText =
      'position: fixed; inset: 0; z-index: 2147483647; background: #fbfaf8; color: #1c1e21; ' +
      'overflow-y: auto; padding: 40px 20px 80px; font-family: Georgia, "Times New Roman", serif;';

    const container = document.createElement('div');
    container.style.cssText = 'max-width: 680px; margin: 0 auto;';

    const topBar = document.createElement('div');
    topBar.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; ' +
      'padding-bottom: 12px; border-bottom: 1px solid #e1dfdd; font-family: system-ui, sans-serif; font-size: 13px;';

    const badge = document.createElement('span');
    badge.style.cssText = 'font-weight: 600; color: #1b7f37;';
    badge.textContent = `Modo Leitura • ${HOST}`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar (Esc)';
    closeBtn.style.cssText =
      'padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; background: #fff; ' +
      'color: #222; cursor: pointer; font-size: 13px;';
    closeBtn.onclick = () => toggleReaderMode();

    topBar.appendChild(badge);
    topBar.appendChild(closeBtn);
    container.appendChild(topBar);

    const h1 = document.createElement('h1');
    h1.style.cssText = 'font-size: 30px; line-height: 1.25; margin: 0 0 16px; color: #111;';
    h1.textContent = title;
    container.appendChild(h1);

    if (structured.description) {
      const sub = document.createElement('p');
      sub.style.cssText = 'font-size: 18px; line-height: 1.5; color: #555; margin: 0 0 24px; font-style: italic;';
      sub.textContent = structured.description;
      container.appendChild(sub);
    }

    const bodyWrap = document.createElement('div');
    bodyWrap.style.cssText = 'font-size: 19px; line-height: 1.75; color: #222;';
    const seen = new Set();
    for (const text of paragraphs) {
      if (seen.has(text)) continue;
      seen.add(text);
      const p = document.createElement('p');
      p.style.cssText = 'margin: 0 0 18px;';
      p.textContent = text;
      bodyWrap.appendChild(p);
    }
    container.appendChild(bodyWrap);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', onKey);
        if (document.getElementById('derruba-muro-reader')) toggleReaderMode();
      }
    };
    window.addEventListener('keydown', onKey);

    return { active: true };
  }

  function startPicker() {
    if (document.getElementById('derruba-muro-picker-banner')) return;

    let hovered = null;
    const prevOutline = new WeakMap();

    const banner = document.createElement('div');
    banner.id = 'derruba-muro-picker-banner';
    banner.style.cssText =
      'position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647; ' +
      'background: #1f2328; color: #fff; padding: 8px 16px; border-radius: 999px; ' +
      'font: 500 13px system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.3); pointer-events: none;';
    banner.textContent = 'Clique no bloqueio ou anúncio para removê-lo (Esc para cancelar)';
    document.body.appendChild(banner);

    function clearHighlight(el) {
      if (!el) return;
      el.style.outline = prevOutline.get(el) || '';
    }

    function onMove(e) {
      const target = e.target;
      if (!target || target === banner || target === document.body || target === document.documentElement) return;
      if (hovered !== target) {
        clearHighlight(hovered);
        hovered = target;
        prevOutline.set(hovered, hovered.style.outline);
        hovered.style.setProperty('outline', '3px solid #e53935', 'important');
      }
    }

    function cleanup() {
      clearHighlight(hovered);
      banner.remove();
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      const target = hovered || e.target;
      cleanup();
      if (target && target !== document.body && target !== document.documentElement) {
        target.remove();
        unlockScroll();
        updateBadge(1);
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
      }
    }

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
  }

  function clearSiteData() {
    let cleared = 0;
    try {
      cleared += localStorage.length;
      localStorage.clear();
    } catch {}
    try {
      cleared += sessionStorage.length;
      sessionStorage.clear();
    } catch {}
    try {
      const cookies = document.cookie.split(';');
      const parts = HOST.split('.');
      const rootDomain = parts.slice(-2).join('.');
      for (const c of cookies) {
        const name = c.split('=')[0].trim();
        if (!name) continue;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${HOST}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${HOST}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${rootDomain}`;
        cleared++;
      }
    } catch {}
    return cleared;
  }

  function run(manual = false) {
    injectStyle();
    const total =
      removeAds() +
      removeOverlays() +
      unlockScroll() +
      unclip() +
      restoreFromJsonLd(manual);
    if (total) {
      updateBadge(total);
      console.debug('[Derruba Muro] ajustes aplicados:', total);
    }
    return total;
  }

  function start() {
    run(false);
    let timer;
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => run(false), 250);
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    // Desativa o MutationObserver pesado após 20s, mas mantém verificação leve no scroll
    setTimeout(() => obs.disconnect(), 20000);

    let scrollTick = false;
    window.addEventListener(
      'scroll',
      () => {
        if (scrollTick) return;
        scrollTick = true;
        setTimeout(() => {
          scrollTick = false;
          run(false);
        }, 800);
      },
      { passive: true }
    );
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'RUN') {
      sendResponse({ changed: run(true), total: totalAdjustments });
    } else if (msg.type === 'READER') {
      sendResponse(toggleReaderMode());
    } else if (msg.type === 'PICKER') {
      startPicker();
      sendResponse({ ok: true });
    } else if (msg.type === 'CLEAR_DATA') {
      sendResponse({ cleared: clearSiteData() });
    } else if (msg.type === 'STATUS') {
      sendResponse({ total: totalAdjustments });
    }
  });

  chrome.storage.local.get(
    { enabled: true, removeAds: true, disabledHosts: [] },
    (cfg) => {
      adsEnabled = cfg.removeAds !== false;
      if (cfg.enabled && !cfg.disabledHosts.includes(HOST)) start();
    }
  );
})();
