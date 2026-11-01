const $ = (id) => document.getElementById(id);

function updateCountBadge(count) {
  const el = $('countBadge');
  if (count && count > 0) {
    el.textContent = `${count} removido${count > 1 ? 's' : ''}`;
    el.style.display = 'inline-block';
  } else {
    el.style.display = 'none';
  }
}

(async () => {
  $('ver').textContent = `v${chrome.runtime.getManifest().version}`;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const ok = tab && /^https?:/.test(tab.url || '');
  const host = ok ? new URL(tab.url).hostname : '';
  $('host').textContent = ok ? host : 'Abra uma página de notícia para usar.';

  if (!ok) {
    ['global', 'site', 'blockScripts', 'removeAds', 'run', 'reader', 'picker', 'clearData'].forEach(
      (i) => ($(i).disabled = true)
    );
    return;
  }

  const cfg = await chrome.storage.local.get({
    enabled: true,
    blockScripts: true,
    removeAds: true,
    disabledHosts: []
  });

  $('global').checked = cfg.enabled;
  $('blockScripts').checked = cfg.blockScripts;
  $('removeAds').checked = cfg.removeAds;
  $('site').checked = !cfg.disabledHosts.includes(host);

  try {
    const status = await chrome.tabs.sendMessage(tab.id, { type: 'STATUS' });
    if (status && status.total) updateCountBadge(status.total);
  } catch {}

  $('global').onchange = (e) => {
    chrome.storage.local.set({ enabled: e.target.checked });
    $('msg').textContent = 'Recarregue a página para aplicar.';
  };

  $('blockScripts').onchange = (e) => {
    chrome.storage.local.set({ blockScripts: e.target.checked });
    $('msg').textContent = 'Recarregue a página para aplicar.';
  };

  $('removeAds').onchange = (e) => {
    chrome.storage.local.set({ removeAds: e.target.checked });
    $('msg').textContent = 'Recarregue a página para aplicar.';
  };

  $('site').onchange = async (e) => {
    const cur = await chrome.storage.local.get({ disabledHosts: [] });
    const set = new Set(cur.disabledHosts);
    e.target.checked ? set.delete(host) : set.add(host);
    await chrome.storage.local.set({ disabledHosts: [...set] });
    $('msg').textContent = 'Recarregue a página para aplicar.';
  };

  $('run').onclick = async () => {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'RUN' });
      if (res && res.total) updateCountBadge(res.total);
      $('msg').textContent =
        res && res.changed
          ? `${res.changed} ajuste(s) aplicado(s).`
          : 'Nada novo encontrado (tente Modo Leitura ou archive.ph).';
    } catch {
      $('msg').textContent = 'Recarregue a página e tente de novo.';
    }
  };

  $('reader').onclick = async () => {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'READER' });
      if (res && res.empty) {
        $('msg').textContent = 'Não foi possível extrair o artigo desta página.';
      } else {
        window.close();
      }
    } catch {
      $('msg').textContent = 'Recarregue a página e tente de novo.';
    }
  };

  $('picker').onclick = async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'PICKER' });
      window.close();
    } catch {
      $('msg').textContent = 'Recarregue a página e tente de novo.';
    }
  };

  $('clearData').onclick = async () => {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_DATA' });
      const count = (res && res.cleared) || 0;
      $('msg').textContent = `Dados locais limpos (${count} itens). Recarregando...`;
      setTimeout(() => chrome.tabs.reload(tab.id), 700);
    } catch {
      $('msg').textContent = 'Recarregue a página e tente de novo.';
    }
  };
})();
