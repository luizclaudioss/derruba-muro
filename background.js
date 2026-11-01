const PAYWALL_SCRIPT_DOMAINS = [
  'tinypass.com',
  'piano.io',
  'poool.fr',
  'pelcro.com',
  'evolok.net',
  'zephr.com',
  'ensighten.com'
];

const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'googletagservices.com',
  'criteo.com',
  'criteo.net',
  'creativecdn.com',
  'adnxs.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'taboola.com',
  'outbrain.com',
  'teads.tv',
  'smartadserver.com',
  'mgid.com',
  'adsafeprotected.com',
  'moatads.com',
  'amazon-adsystem.com',
  'ad.uol.com.br',
  'bn.uol.com.br',
  'dynad.net'
];

async function syncNetRules() {
  const cfg = await chrome.storage.local.get({
    enabled: true,
    blockScripts: true,
    removeAds: true,
    disabledHosts: []
  });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  if (!cfg.enabled) {
    if (removeRuleIds.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const excludedInitiatorDomains = (cfg.disabledHosts || []).filter(Boolean);
  const domainsToBlock = [];

  if (cfg.blockScripts) domainsToBlock.push(...PAYWALL_SCRIPT_DOMAINS);
  if (cfg.removeAds) domainsToBlock.push(...AD_DOMAINS);

  if (!domainsToBlock.length) {
    if (removeRuleIds.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const addRules = domainsToBlock.map((domain, idx) => {
    const condition = {
      urlFilter: `||${domain}^`,
      resourceTypes: ['script', 'xmlhttprequest', 'sub_frame', 'image', 'media']
    };
    if (excludedInitiatorDomains.length) {
      condition.excludedInitiatorDomains = excludedInitiatorDomains;
    }
    return {
      id: idx + 1,
      priority: 1,
      action: { type: 'block' },
      condition
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'derruba-picker',
      title: 'Clicar para remover elemento da página',
      contexts: ['page', 'frame', 'selection']
    });
    chrome.contextMenus.create({
      id: 'derruba-reader',
      title: 'Abrir em Modo Leitura',
      contexts: ['page', 'frame', 'selection']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  syncNetRules();
  setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  syncNetRules();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'local' &&
    (changes.enabled || changes.blockScripts || changes.removeAds || changes.disabledHosts)
  ) {
    syncNetRules();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'derruba-picker' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'PICKER' }).catch(() => {});
  } else if (info.menuItemId === 'derruba-reader' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'READER' }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  if (command === 'run-unblock') {
    chrome.tabs.sendMessage(tab.id, { type: 'RUN' }).catch(() => {});
  } else if (command === 'toggle-reader') {
    chrome.tabs.sendMessage(tab.id, { type: 'READER' }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'SET_BADGE' && sender.tab && sender.tab.id) {
    const count = msg.count || 0;
    const text = count > 0 ? String(count > 99 ? '99+' : count) : '';
    chrome.action.setBadgeText({ tabId: sender.tab.id, text }).catch(() => {});
    if (count > 0) {
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#1b7f37' }).catch(() => {});
    }
    sendResponse({ ok: true });
  }
});
