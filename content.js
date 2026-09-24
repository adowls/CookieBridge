(async () => {
    const SETTINGS_KEYS = {
        SITE_SETTINGS: 'siteSettings'
    };

    const getSettings = async () => {
        return await chrome.storage.local.get(null);
    };

    const allSettings = await getSettings();
    const siteSettings = allSettings[SETTINGS_KEYS.SITE_SETTINGS] || {};
    const hostname = window.location.hostname;

    const findMatchingDomain = () => {
        if (siteSettings[hostname]) return hostname;

        const parts = hostname.split('.');
        while (parts.length > 1) {
            const parentDomain = parts.join('.');
            if (siteSettings[parentDomain]) return parentDomain;
            parts.shift();
        }
        return null;
    };

    const matchedDomain = findMatchingDomain();
    const currentSiteConfig = matchedDomain ? siteSettings[matchedDomain] : null;

    if (!currentSiteConfig) return;

    if (sessionStorage.getItem('smc_just_reloaded') === 'true') {
        sessionStorage.removeItem('smc_just_reloaded');
        console.log('[SMC] Reloaded after pull. Ready.');
    } else if (currentSiteConfig.autoPull) {
        console.log('[SMC] Auto-pulling cookies...');

        if (currentSiteConfig.reloadAfterPull) {
            sessionStorage.setItem('smc_just_reloaded', 'true');
        }

        chrome.runtime.sendMessage({ action: 'PULL_COOKIES' }, (response) => {
            if (!response || !response.success) {
                console.error('[SMC] Auto-pull failed:', response ? response.error : 'Unknown');
                sessionStorage.removeItem('smc_just_reloaded');
            } else {
                console.log('[SMC] Auto-pull success.');
            }
        });
    }

    const normalizeDomTrigger = (selector) => {
        let value = String(selector || '').trim();

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1).trim();
        }

        // Remove accidental escaping inserted by JSON, markdown or copy/paste.
        return value.replace(/\\([#.*[\]()@:'"])/g, '$1');
    };

    const findDomTrigger = (rawSelector) => {
        const value = normalizeDomTrigger(rawSelector);

        try {
            if (value.startsWith('//') || value.startsWith('(')) {
                const result = document.evaluate(
                    value,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );
                return result.snapshotLength > 0;
            }
            return !!document.querySelector(value);
        } catch (error) {
            console.warn('[SMC] Invalid DOM Trigger selector:', value, error);
            return false;
        }
    };

    if (currentSiteConfig.autoPush && currentSiteConfig.domTriggerSelector) {
        const selector = currentSiteConfig.domTriggerSelector;
        console.log(`[SMC] Watching for trigger: ${selector}`);

        let hasPushed = false;
        const handleFound = (observer) => {
            if (hasPushed) return;
            hasPushed = true;
            console.log('[SMC] Trigger found! Push initiated.');
            chrome.runtime.sendMessage({ action: 'AUTO_PUSH_TRIGGER' });
            if (observer) observer.disconnect();
        };

        // SPA navigation and delayed rendering may add the element after load.
        const observer = new MutationObserver((mutations, obs) => {
            if (findDomTrigger(selector)) handleFound(obs);
        });
        const observeTarget = document.documentElement || document.body;
        observer.observe(observeTarget, { childList: true, subtree: true });

        // Normal navigation can already have the trigger present at document_end.
        if (findDomTrigger(selector)) handleFound(observer);
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'SHOW_NOTIFICATION') {
            showNotification(request.message, request.type);
        }
    });

    function showNotification(message, type) {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 10px 20px;
            border-radius: 5px; color: white; z-index: 2147483647; font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2); font-family: sans-serif;
            background-color: ${type === 'error' ? '#dc3545' : '#28a745'};
            transition: opacity 0.5s; opacity: 0;
        `;
        div.textContent = `[SMC] ${message}`;
        document.body.appendChild(div);

        requestAnimationFrame(() => div.style.opacity = '1');

        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 500);
        }, 5000);
    }
})();
