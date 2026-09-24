importScripts('lib/crypto-js.min.js');

const SETTINGS_KEYS = {
    GITHUB_TOKEN: 'githubToken',
    GIST_ID: 'gistId',
    PASSWORD: 'password',
    SITE_SETTINGS: 'siteSettings'
};

const getSettings = async () => {
    return await chrome.storage.local.get(null);
};

const getHostname = (url) => {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch (e) {
        return null;
    }
};

const findMatchingDomain = (siteSettings, hostname) => {
    if (!siteSettings || !hostname) return null;
    if (siteSettings[hostname]) return hostname;

    const parts = hostname.split('.');
    while (parts.length > 1) {
        const parentDomain = parts.join('.');
        if (siteSettings[parentDomain]) return parentDomain;
        parts.shift();
    }
    return null;
};

const getSiteSettings = (allSettings, url) => {
    if (!url || !allSettings[SETTINGS_KEYS.SITE_SETTINGS]) return null;
    const hostname = getHostname(url);
    const matchedDomain = findMatchingDomain(allSettings[SETTINGS_KEYS.SITE_SETTINGS], hostname);
    return matchedDomain ? allSettings[SETTINGS_KEYS.SITE_SETTINGS][matchedDomain] : null;
};

const notify = async (message, type = 'basic', preferredTabId = null) => {
    console.log(`[CookieBridge]: ${message}`);

    let tabId = preferredTabId;
    if (!tabId) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tab ? tab.id : null;
    }

    if (tabId) {
        chrome.tabs.sendMessage(tabId, {
            action: 'SHOW_NOTIFICATION',
            message,
            type
        }).catch(() => {});
    }
};

const githubRequest = async (method, url, token, data = null) => {
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.statusText}`);
    }
    return await response.json();
};

const encrypt = (text, password) => {
    if (!password) return text;
    return CryptoJS.AES.encrypt(text, password).toString();
};

const decrypt = (ciphertext, password) => {
    if (!password) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, password);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedText) throw new Error('Decrypted text is empty');
        return decryptedText;
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
};

const getActiveTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
};

const getCookieUrl = (cookie) => {
    const protocol = cookie.secure ? 'https://' : 'http://';
    const domain = String(cookie.domain || '').replace(/^\./, '');
    return `${protocol}${domain}${cookie.path || '/'}`;
};

const getClearTargets = (siteDomain, url) => {
    const domains = new Set();
    const currentHost = getHostname(url);

    if (currentHost) domains.add(currentHost);
    if (siteDomain) {
        domains.add(siteDomain);
        // Include the registrable parent when the configured site is a subdomain.
        const parts = siteDomain.split('.');
        if (parts.length > 2) domains.add(parts.slice(-2).join('.'));
    }

    return [...domains].filter(Boolean);
};

const clearCookiesBeforePull = async (siteDomain, url) => {
    const targets = getClearTargets(siteDomain, url);
    const seen = new Set();
    let clearedCount = 0;

    for (const domain of targets) {
        const cookies = await chrome.cookies.getAll({ domain });
        for (const cookie of cookies) {
            const key = [cookie.name, cookie.domain || '', cookie.path || '/'].join('|');
            if (seen.has(key)) continue;
            seen.add(key);

            await chrome.cookies.remove({
                url: getCookieUrl(cookie),
                name: cookie.name
            });
            clearedCount++;
        }
    }

    return clearedCount;
};

const pushCookies = async (tabId, url) => {
    try {
        const settings = await getSettings();
        const siteConfig = getSiteSettings(settings, url);

        if (!siteConfig) throw new Error('No settings found for this domain.');

        const { githubToken, gistId, password } = settings;
        const { filename, cookieNamesToSync } = siteConfig;
        if (!githubToken || !gistId || !filename) {
            throw new Error('Missing GitHub settings or Filename.');
        }

        const cookies = await chrome.cookies.getAll({ url });
        const namesToSync = (cookieNamesToSync || '')
            .split(',')
            .map(name => name.trim())
            .filter(Boolean);

        const cookiesToExport = namesToSync.length
            ? cookies.filter(cookie => namesToSync.includes(cookie.name))
            : cookies;

        const simplifiedCookies = cookiesToExport.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate
        }));

        if (simplifiedCookies.length === 0) {
            throw new Error('No cookies found to sync.');
        }

        const content = encrypt(JSON.stringify(simplifiedCookies, null, 2), password);
        const files = { [filename]: { content } };
        await githubRequest('PATCH', `https://api.github.com/gists/${gistId}`, githubToken, { files });

        await notify('Cookies pushed successfully!', 'success', tabId);
        return { success: true };
    } catch (error) {
        console.error(error);
        await notify(`Push failed: ${error.message}`, 'error', tabId);
        return { success: false, error: error.message };
    }
};

const getReloadUrl = (configured, currentUrl) => {
    const value = String(configured || '').trim();
    if (!value || !currentUrl) return null;

    const relative = /^https?:\/\//i.test(value) ? value : `/${value.replace(/^\/+/, '')}`;
    const resolved = new URL(relative, currentUrl);

    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        throw new Error('Reload Path must use HTTP or HTTPS.');
    }

    return resolved.href;
};

const pullCookies = async (tabId, url) => {
    try {
        const settings = await getSettings();
        const siteConfig = getSiteSettings(settings, url);

        if (!siteConfig) throw new Error('No settings found for this domain.');

        const { githubToken, gistId, password } = settings;
        const {
            filename,
            clearBeforePull,
            reloadAfterPull,
            reloadAfterPullUrl
        } = siteConfig;

        if (!githubToken || !gistId || !filename) {
            throw new Error('Missing GitHub settings or Filename.');
        }

        let reloadUrl = null;
        if (reloadAfterPull) {
            reloadUrl = getReloadUrl(reloadAfterPullUrl, url);
        }

        const gist = await githubRequest('GET', `https://api.github.com/gists/${gistId}`, githubToken);
        if (!gist.files || !gist.files[filename]) {
            throw new Error(`File '${filename}' not found in Gist.`);
        }

        const decryptedContent = decrypt(gist.files[filename].content, password);
        if (!decryptedContent) throw new Error('Decryption failed. Check password.');

        let cookiesToImport;
        try {
            cookiesToImport = JSON.parse(decryptedContent);
        } catch (e) {
            throw new Error('Failed to parse cookie data.');
        }
        if (!Array.isArray(cookiesToImport)) {
            throw new Error('Cookie data must be an array.');
        }

        if (clearBeforePull) {
            await clearCookiesBeforePull(url ? new URL(url).hostname : null, url);
        }

        let importCount = 0;
        for (const cookie of cookiesToImport) {
            const setDetails = {
                url: getCookieUrl(cookie),
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: !!cookie.secure,
                httpOnly: !!cookie.httpOnly
            };

            if (cookie.hostOnly !== true && cookie.domain) {
                setDetails.domain = cookie.domain;
            } else {
                delete setDetails.domain;
            }

            if (typeof cookie.expirationDate === 'number' &&
                cookie.expirationDate * 1000 > Date.now()) {
                setDetails.expirationDate = cookie.expirationDate;
            } else {
                delete setDetails.expirationDate;
            }

            await chrome.cookies.set(setDetails);
            importCount++;
        }

        await notify(`Imported ${importCount} cookies.`, 'success', tabId);

        if (reloadAfterPull && tabId) {
            if (reloadUrl) {
                await chrome.tabs.update(tabId, { url: reloadUrl });
            } else {
                await chrome.tabs.reload(tabId);
            }
        }

        return { success: true };
    } catch (error) {
        console.error(error);
        await notify(`Pull failed: ${error.message}`, 'error', tabId);
        return { success: false, error: error.message };
    }
};

const testConnection = async () => {
    try {
        const settings = await getSettings();
        const { githubToken, gistId } = settings;
        if (!githubToken || !gistId) throw new Error('Missing Token or ID');

        await githubRequest('GET', `https://api.github.com/gists/${gistId}`, githubToken);
        await notify('Connection successful!', 'success');
        return { success: true };
    } catch (error) {
        await notify(`Connection failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
};

const resolveMessageTarget = async (sender, request) => {
    let tabId = sender.tab ? sender.tab.id : null;
    let url = sender.tab ? sender.tab.url : request.url;

    if (!tabId && !sender.tab) {
        const tab = await getActiveTab();
        tabId = tab ? tab.id : null;
        if (!url && tab) url = tab.url;
    }

    return { tabId, url };
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        const { tabId, url } = await resolveMessageTarget(sender, request);

        if (request.action === 'PUSH_COOKIES') {
            sendResponse(await pushCookies(tabId, url));
        } else if (request.action === 'PULL_COOKIES') {
            sendResponse(await pullCookies(tabId, url));
        } else if (request.action === 'TEST_CONNECTION') {
            sendResponse(await testConnection());
        } else if (request.action === 'AUTO_PUSH_TRIGGER') {
            sendResponse(await pushCookies(tabId, url));
        }
    })();

    return true;
});
