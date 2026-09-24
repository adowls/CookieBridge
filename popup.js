const SETTINGS_KEYS = {
    GITHUB_TOKEN: 'githubToken',
    GIST_ID: 'gistId',
    PASSWORD: 'password',
    SITE_SETTINGS: 'siteSettings'
};

let allSiteSettings = {};

const cookieListState = {
    cookies: [],
    selectedNames: new Set(),
    sortKey: 'name',
    sortDirection: 'asc'
};
const cookieCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const getEl = (id) => document.getElementById(id);

const showStatus = (msg, type) => {
    const el = getEl('status');
    el.textContent = msg;
    el.className = type === 'error' ? 'status-error' : 'status-success';
    setTimeout(() => {
        el.textContent = '';
        el.className = '';
    }, 3000);
};

const updateDomainList = () => {
    const datalist = getEl('domainList');
    datalist.innerHTML = '';
    Object.keys(allSiteSettings).forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        datalist.appendChild(option);
    });
};

const findMatchingDomain = (hostname) => {
    if (!hostname) return null;
    if (allSiteSettings[hostname]) return hostname;

    const parts = hostname.split('.');
    while (parts.length > 1) {
        const parentDomain = parts.join('.');
        if (allSiteSettings[parentDomain]) return parentDomain;
        parts.shift();
    }
    return null;
};

const loadSiteSpecificUI = (domain) => {
    const settings = allSiteSettings[domain] || {};

    getEl('filename').value = settings.filename || (domain ? `${domain}.json` : 'cookies.json');
    getEl('autoPull').checked = settings.autoPull || false;
    getEl('reloadAfterPull').checked = settings.reloadAfterPull || false;
    getEl('reloadAfterPullUrl').value = settings.reloadAfterPullUrl || '';
    getEl('clearBeforePull').checked = settings.clearBeforePull || false;
    getEl('autoPush').checked = settings.autoPush || false;
    getEl('domTriggerSelector').value = settings.domTriggerSelector || '';

    toggleReloadPath();
    toggleDomTrigger();

    return settings.cookieNamesToSync || '';
};

const loadSettings = async () => {
    const data = await chrome.storage.local.get(null);

    getEl('githubToken').value = data[SETTINGS_KEYS.GITHUB_TOKEN] || '';
    getEl('gistId').value = data[SETTINGS_KEYS.GIST_ID] || '';
    getEl('password').value = data[SETTINGS_KEYS.PASSWORD] || '';

    allSiteSettings = data[SETTINGS_KEYS.SITE_SETTINGS] || {};
    updateDomainList();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let initialDomain = '115.com';

    if (tab && tab.url && tab.url.startsWith('http')) {
        try {
            const hostname = new URL(tab.url).hostname;
            initialDomain = findMatchingDomain(hostname) || hostname;
        } catch (e) {}
    }

    getEl('targetDomain').value = initialDomain;
    const selectedCookies = loadSiteSpecificUI(initialDomain);

    return {
        selectedCookies,
        targetDomain: initialDomain
    };
};

const toggleDomTrigger = () => {
    getEl('domTriggerContainer').style.display = getEl('autoPush').checked ? 'flex' : 'none';
};

const toggleReloadPath = () => {
    getEl('reloadPathContainer').style.display = getEl('reloadAfterPull').checked ? 'flex' : 'none';
};

const currentTabMatchesDomain = (tab, domain) => {
    if (!tab || !tab.url || !domain) return false;
    try {
        const hostname = new URL(tab.url).hostname.toLowerCase();
        const configuredDomain = domain.toLowerCase();
        return hostname === configuredDomain || hostname.endsWith(`.${configuredDomain}`);
    } catch (e) {
        return false;
    }
};

const mergeCookies = (groups) => {
    const seen = new Set();
    const cookies = [];

    for (const group of groups) {
        for (const cookie of group) {
            const key = [
                cookie.name || '',
                cookie.domain || '',
                cookie.path || '/',
                cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : ''
            ].join('|');
            if (!seen.has(key)) {
                seen.add(key);
                cookies.push(cookie);
            }
        }
    }

    return cookies;
};

const setCookieListMessage = (message) => {
    cookieListState.cookies = [];
    cookieListState.selectedNames = new Set();
    const listEl = getEl('cookie-list');
    listEl.innerHTML = '';

    const empty = document.createElement('div');
    empty.className = 'cookie-empty';
    empty.textContent = message;
    listEl.appendChild(empty);
};

const getSortedCookies = () => {
    const direction = cookieListState.sortDirection === 'asc' ? 1 : -1;
    const key = cookieListState.sortKey;

    return [...cookieListState.cookies].sort((a, b) => {
        const aValue = key === 'path' ? (a.path || '/') : (a.name || '');
        const bValue = key === 'path' ? (b.path || '/') : (b.name || '');
        const primary = cookieCollator.compare(aValue, bValue);
        if (primary !== 0) return primary * direction;

        const secondary = cookieCollator.compare(a.name || '', b.name || '') ||
            cookieCollator.compare(a.path || '/', b.path || '/');
        return secondary * direction;
    });
};

const captureSelectedCookieNames = () => {
    const selected = new Set(
        Array.from(document.querySelectorAll('#cookie-list input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value)
    );
    cookieListState.selectedNames = selected;
};

const renderCookieHeader = (listEl) => {
    const header = document.createElement('div');
    header.className = 'cookie-header';

    const spacer = document.createElement('span');
    spacer.className = 'cookie-checkbox-spacer';
    spacer.setAttribute('aria-hidden', 'true');

    const makeSortButton = (key, label) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cookie-sort';
        button.dataset.sortKey = key;
        button.textContent = label;

        const arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.textContent = cookieListState.sortKey === key
            ? (cookieListState.sortDirection === 'asc' ? ' ▲' : ' ▼')
            : '';
        button.appendChild(arrow);
        button.setAttribute(
            'aria-sort',
            cookieListState.sortKey === key ? cookieListState.sortDirection : 'none'
        );

        button.addEventListener('click', () => {
            captureSelectedCookieNames();
            if (cookieListState.sortKey === key) {
                cookieListState.sortDirection = cookieListState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                cookieListState.sortKey = key;
                cookieListState.sortDirection = 'asc';
            }
            renderCookieList();
        });

        return button;
    };

    header.appendChild(spacer);
    header.appendChild(makeSortButton('name', 'Name'));
    header.appendChild(makeSortButton('path', 'Path'));
    listEl.appendChild(header);
};

const renderCookieList = () => {
    const listEl = getEl('cookie-list');
    listEl.innerHTML = '';
    renderCookieHeader(listEl);

    if (cookieListState.cookies.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cookie-empty';
        empty.textContent = 'No cookies found.';
        listEl.appendChild(empty);
        return;
    }

    const rows = document.createElement('div');
    rows.className = 'cookie-rows';

    getSortedCookies().forEach((cookie, index) => {
        const row = document.createElement('div');
        row.className = 'cookie-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `cookie-${index}`;
        checkbox.value = cookie.name;
        checkbox.checked = cookieListState.selectedNames.has(cookie.name);

        const nameLabel = document.createElement('label');
        nameLabel.htmlFor = checkbox.id;
        nameLabel.className = 'cookie-name';
        nameLabel.textContent = cookie.name;
        nameLabel.title = cookie.value || '';

        const pathLabel = document.createElement('label');
        pathLabel.htmlFor = checkbox.id;
        pathLabel.className = 'cookie-path';
        pathLabel.textContent = cookie.path || '/';
        pathLabel.title = cookie.path || '/';

        row.appendChild(checkbox);
        row.appendChild(nameLabel);
        row.appendChild(pathLabel);
        rows.appendChild(row);
    });

    listEl.appendChild(rows);
};

const populateCookieList = async (savedCookieNamesStr, targetDomain) => {
    const listEl = getEl('cookie-list');
    listEl.innerHTML = 'Loading cookies...';

    const savedNames = (savedCookieNamesStr || '').split(',').map(name => name.trim()).filter(Boolean);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!currentTabMatchesDomain(tab, targetDomain)) {
        setCookieListMessage(`Navigate to ${targetDomain} to select cookies.`);
        return;
    }

    const cookieGroups = [];
    try {
        cookieGroups.push(await chrome.cookies.getAll({ domain: targetDomain }));
        cookieGroups.push(await chrome.cookies.getAll({ url: tab.url }));
    } catch (error) {
        setCookieListMessage(error.message || 'Failed to load cookies.');
        return;
    }

    cookieListState.cookies = mergeCookies(cookieGroups);
    cookieListState.selectedNames = new Set(savedNames);

    if (cookieListState.cookies.length === 0) {
        setCookieListMessage(`No cookies found for ${targetDomain}.`);
        return;
    }

    renderCookieList();
};

const saveSettings = async () => {
    const cookieCheckboxes = document.querySelectorAll('#cookie-list input[type="checkbox"]:checked');
    const selectedCookies = Array.from(cookieCheckboxes).map(cb => cb.value).join(',');
    const domain = getEl('targetDomain').value.trim();

    if (!domain) {
        showStatus('Target Domain is required', 'error');
        return;
    }

    allSiteSettings[domain] = {
        filename: getEl('filename').value.trim(),
        cookieNamesToSync: selectedCookies,
        autoPull: getEl('autoPull').checked,
        reloadAfterPull: getEl('reloadAfterPull').checked,
        reloadAfterPullUrl: getEl('reloadAfterPullUrl').value.trim(),
        clearBeforePull: getEl('clearBeforePull').checked,
        autoPush: getEl('autoPush').checked,
        domTriggerSelector: getEl('domTriggerSelector').value.trim()
    };

    await chrome.storage.local.set({
        [SETTINGS_KEYS.GITHUB_TOKEN]: getEl('githubToken').value.trim(),
        [SETTINGS_KEYS.GIST_ID]: getEl('gistId').value.trim(),
        [SETTINGS_KEYS.PASSWORD]: getEl('password').value,
        [SETTINGS_KEYS.SITE_SETTINGS]: allSiteSettings
    });

    updateDomainList();
    showStatus('Settings saved!', 'success');
};

const sendMessageToBackground = async (action) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.runtime.sendMessage({ action, url: tab ? tab.url : null });
    if (response && response.success) {
        showStatus('Action successful!', 'success');
    } else {
        showStatus(response ? response.error : 'Unknown error', 'error');
    }
};

const exportSettings = async () => {
    try {
        const data = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sync_my_cookies_settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('Settings exported!', 'success');
    } catch (e) {
        showStatus('Export failed: ' + e.message, 'error');
    }
};

const importSettings = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const settings = JSON.parse(e.target.result);
            if (!settings || typeof settings !== 'object') {
                throw new Error('Invalid JSON format');
            }

            await chrome.storage.local.set(settings);
            showStatus('Settings imported!', 'success');

            const { selectedCookies, targetDomain } = await loadSettings();
            await populateCookieList(selectedCookies, targetDomain);
        } catch (error) {
            showStatus('Import failed: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

document.addEventListener('DOMContentLoaded', async () => {
    const { selectedCookies, targetDomain } = await loadSettings();
    await populateCookieList(selectedCookies, targetDomain);

    getEl('targetDomain').addEventListener('input', (e) => {
        const domain = e.target.value.trim();
        const savedCookies = loadSiteSpecificUI(domain);
        populateCookieList(savedCookies, domain);
    });

    getEl('saveBtn').addEventListener('click', saveSettings);
    getEl('testBtn').addEventListener('click', () => sendMessageToBackground('TEST_CONNECTION'));
    getEl('pushBtn').addEventListener('click', () => sendMessageToBackground('PUSH_COOKIES'));
    getEl('pullBtn').addEventListener('click', () => sendMessageToBackground('PULL_COOKIES'));

    getEl('exportBtn').addEventListener('click', exportSettings);
    getEl('importBtn').addEventListener('click', () => getEl('importFile').click());
    getEl('importFile').addEventListener('change', importSettings);

    getEl('autoPush').addEventListener('change', toggleDomTrigger);
    getEl('reloadAfterPull').addEventListener('change', toggleReloadPath);
});
