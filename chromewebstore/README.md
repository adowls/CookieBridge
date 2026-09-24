# Chrome Web Store listing kit — Sync My Cookies

Copy-and-paste source for <https://chrome.google.com/webstore/devconsole>.
Field limits are the ones enforced by the Developer Console.

## 1. Store listing

### Item name (max 45)

```text
Sync My Cookies
```

### Short description (max 132)

```text
Back up any site's cookies to your own private GitHub Gist and restore them in one click. Per-domain, encrypted.
```

### Detailed description (plain text, max 16,000)

The Developer Console does not render Markdown. Paste this block as-is.

```text
Sync My Cookies backs up the cookies of any website to a private GitHub Gist and restores them whenever you need them.

Built for people who work across several browsers, profiles or machines, or who need to keep a site session alive after clearing cookies.

WHAT IT DOES

* Push - saves the cookies of the current domain to a Gist file you choose, optionally encrypted with AES.
* Pull - restores those cookies into the browser, with an option to clear stale cookies first.
* Per-domain settings - every domain keeps its own file name, cookie selection and automation options.
* Cookie picker - the popup lists every cookie for the current domain in a sortable Name / Path table, so you can sync only the cookies you care about.
* Reload after pull - refresh the current page, or jump to a specific path on the same site.
* DOM trigger - push automatically once a chosen element appears on the page. CSS selectors and XPath are both supported, including elements that only render after a redirect or a client-side navigation.

HOW TO USE

1. Create a GitHub personal access token with the "gist" scope.
2. Create a Gist and copy its ID.
3. Open the extension, paste the token and the Gist ID, set a file name and the target domain, then click Save.
4. Click Push to upload the current cookies, or Pull to restore them.

PRIVACY

Everything stays under your control. Cookies are written to your own GitHub Gist, never to a server operated by the developer. The extension contains no analytics and sends no data anywhere else. If you set an encryption password, cookie data is encrypted before it leaves the browser.

Cookies are equivalent to login credentials. Keep your Gist secret and set an encryption password.
```

### Category and language

| Field | Suggested value |
| --- | --- |
| Category | Productivity |
| Primary language | English (United States) |
| Additional locale | Chinese (Simplified) — reuse the fields above, or translate from `README.md` |

## 2. Privacy tab

### Single purpose description

```text
Sync My Cookies has one purpose: to back up and restore the cookies of websites the user explicitly configures, storing them in a GitHub Gist that the user owns.
```

### Permission justifications

```text
storage
Saves the user's own settings locally: GitHub token, Gist ID, encryption password, per-domain file names, the selected cookies and the automation options.

cookies
This is the core feature. The extension reads the cookies of the domain the user is configuring so they can be uploaded, and writes cookies back when the user pulls them. Cookies are only read or written for domains the user has explicitly configured.

activeTab
Identifies the domain of the active tab when the popup opens, so the popup can show that domain's cookies and saved settings, and delivers the in-page result notification after a push or a pull.

Host permission (<all_urls>)
The user can configure any website, so the extension has to read and write cookies for arbitrary domains. The content script also runs on the configured domain to watch for the DOM trigger element the user defined. It only checks whether that CSS or XPath selector matches; page content is not read, stored or transmitted.
```

### Data usage disclosures

| Question | Answer |
| --- | --- |
| Does the extension collect or use user data? | Yes — cookies for domains the user configures. |
| Data category to declare | Authentication information |
| Where the data goes | The user's own GitHub Gist (via `api.github.com`). No developer-operated server. |
| Sold to third parties | No |
| Used for advertising, credit or lending | No |
| Remote code | No. All code ships inside the package; `lib/crypto-js.min.js` is bundled locally. |

Answer the certification questions yourself from the facts above — the transfer to GitHub is part of the single purpose the user opted into, but the wording of those questions is a legal statement about your own practices.

## 3. Graphic assets checklist

| Asset | Required size | Status |
| --- | --- | --- |
| Store icon | 128x128 | Ready — `icons/icon128.png` |
| Screenshot 1 | 1280x800 | Ready — `store/screenshots/01-cookie-sync-1280x800.png` |
| Screenshot 2 | 1280x800 | Ready — `store/screenshots/02-automation-1280x800.png` |
| Screenshot 3 | 1280x800 | Ready — `store/screenshots/03-controls-1280x800.png` |
| Small promo tile | 440x280 | Ready — `store/small-promo-tile-440x280.png` |
| Marquee promo tile | 1400x560 | Ready — `store/marquee-tile-1400x560.png` (only needed if you apply for featuring) |

Every asset above is 24-bit PNG with no alpha channel, which satisfies the "JPEG or 24-bit PNG without transparency" rule. The promo tiles reuse the icon and the `www.google.com` example, so no credentials appear in them.

## 4. Before you submit

- Do not put a real GitHub token, Gist ID or live session cookie into a screenshot or the listing text. The current screenshots use a `www.google.com` example with no credentials filled in.
- The listing text above describes cookies as the single purpose. Keep that framing consistent in the "single purpose" field, the permission justifications and the detailed description, because reviewers cross-check them.
- After any code change, bump `version` in `manifest.json`; the Developer Console rejects a re-upload with a version that was already published.
- Test the packaged build before uploading: `chrome://extensions` → **Load unpacked**, then verify Push and Pull against a throwaway Gist.
