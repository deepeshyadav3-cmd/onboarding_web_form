# Build Prompt — Static Hiring Application Form on GitHub Pages → Google Sheets

> Paste this whole file as the prompt to a coding agent. Fill in the `TODO:` markers first.

---

## 1. Goal

Replace an existing Google Form (hiring applications) with a self-hosted web form that:

- Is a **static site** served from **GitHub Pages** (no server, no build step, no npm).
- Writes each submission as a **new row in a Google Sheet** — ideally the *same* sheet the Google Form already writes to.
- Behaves like the Google Form for the applicant: same fields, same validation feel, a success screen.
- Keeps **every connection point configurable**, because the target Google account / Sheet **will change later**. Swapping the destination must never require editing application code.
- Lives in **one repository** containing the frontend, the backend script, and the deployment workflow.

**Non-goals:** user accounts, admin dashboard, database, React/Vue/Next, CI test suite, Docker.

---

## 2. Architecture

```
┌──────────────────────────────┐
│  GitHub Pages (static)       │
│                              │
│  index.html                  │
│  assets/app.js  ──────┐      │
│  assets/styles.css    │      │
│  config/config.json   │ (1) fetched at runtime
│  config/form-schema.json      │
└───────────────────────┼──────┘
                        │ (2) POST JSON as text/plain
                        ▼
┌──────────────────────────────┐
│  Google Apps Script Web App  │
│  (doPost)                    │
│                              │
│  - origin allowlist          │
│  - shared-token check        │
│  - server-side validation    │
│  - LockService (no races)    │
│  - header-driven column map  │
│  - optional Drive upload     │
└───────────────────────┼──────┘
                        │ (3) SpreadsheetApp.appendRow
                        ▼
┌──────────────────────────────┐
│  Google Sheet (responses)    │
│  + Drive folder (resumes)    │
└──────────────────────────────┘
```

### Why Apps Script and not the Sheets API

A static page cannot hold a Google service-account key or OAuth client secret — anything shipped to the browser is public. An **Apps Script Web App deployed as "Execute as: Me / Who has access: Anyone"** gives a public HTTPS endpoint that runs under the sheet owner's own authority, with no credentials in the frontend. This is the only safe zero-backend route.

### Two independent layers of configurability

| What changes | Where it's changed | Redeploy needed? |
|---|---|---|
| Destination spreadsheet / tab / Drive folder | Apps Script **Script Properties** (key–value UI, no code) | No — endpoint URL stays the same |
| Which Apps Script endpoint the site talks to | `config/config.json` in the repo | Commit + Pages rebuild only |
| Which fields the form shows | `config/form-schema.json` | Commit + Pages rebuild only |

So handing the form to a different Google account = deploy a fresh Apps Script from `apps-script/Code.gs`, paste the new `/exec` URL into `config.json`. No JS is touched.

---

## 3. Repository layout

```
.
├── index.html                    # single page, renders form from schema
├── assets/
│   ├── styles.css                # plain CSS, no framework
│   └── app.js                    # vanilla ES module, no bundler
├── config/
│   ├── config.json               # endpoint + behaviour settings
│   ├── config.example.json       # committed template with placeholders
│   └── form-schema.json          # field definitions (source of truth for the form)
├── apps-script/
│   ├── Code.gs                   # doPost / doGet backend
│   ├── appsscript.json           # manifest (timezone, scopes, webapp access)
│   └── DEPLOY.md                 # click-by-click deployment steps + screenshots list
├── .github/workflows/pages.yml   # deploy static content to GitHub Pages
├── .nojekyll                     # stop Jekyll mangling asset paths
├── README.md                     # what this is, how to run locally, how to deploy
├── CONFIGURATION.md              # every config key, what it does, how to rotate accounts
└── LICENSE
```

Single repo, deployed from branch `main`, root directory (or `/docs` — pick one and document it).

---

## 4. Frontend requirements

### 4.1 Schema-driven rendering

`config/form-schema.json` is the single source of truth. `app.js` fetches it and builds the DOM. Adding or removing a question = editing JSON only.

> **The real schema ships alongside this prompt as `form-schema.json`** — 19 fields transcribed from the live Google Form, all required. Drop it into `config/` and build the renderer against it. The block below is an abridged illustration of the format only; **do not use it as the field list.**

```json
{
  "title": "Hiring Application",
  "description": "Short intro shown above the form.",
  "sections": [
    {
      "id": "personal",
      "title": "Personal details",
      "fields": [
        {
          "id": "full_name",
          "label": "Full name",
          "sheetColumn": "Full Name",
          "type": "text",
          "required": true,
          "maxLength": 100,
          "placeholder": "As per your ID"
        },
        {
          "id": "email",
          "label": "Email address",
          "sheetColumn": "Email Address",
          "type": "email",
          "required": true
        },
        {
          "id": "phone",
          "label": "Mobile number",
          "sheetColumn": "Phone",
          "type": "tel",
          "required": true,
          "pattern": "^[6-9]\\d{9}$",
          "patternError": "Enter a valid 10-digit Indian mobile number"
        },
        {
          "id": "experience_years",
          "label": "Total experience (years)",
          "sheetColumn": "Experience",
          "type": "number",
          "min": 0,
          "max": 50,
          "step": 0.5,
          "required": true
        },
        {
          "id": "role",
          "label": "Role applied for",
          "sheetColumn": "Role",
          "type": "select",
          "required": true,
          "options": ["Backend Engineer", "Frontend Engineer", "SRE", "Other"]
        },
        {
          "id": "skills",
          "label": "Primary skills",
          "sheetColumn": "Skills",
          "type": "checkbox",
          "options": ["Java", "Python", "Go", "Node.js", "Kubernetes"],
          "joinWith": ", "
        },
        {
          "id": "notice_period",
          "label": "Notice period",
          "sheetColumn": "Notice Period",
          "type": "radio",
          "required": true,
          "options": ["Immediate", "15 days", "30 days", "60 days", "90 days"]
        },
        {
          "id": "available_from",
          "label": "Available from",
          "sheetColumn": "Available From",
          "type": "date"
        },
        {
          "id": "cover_note",
          "label": "Why this role?",
          "sheetColumn": "Cover Note",
          "type": "textarea",
          "rows": 5,
          "maxLength": 1500
        },
        {
          "id": "resume",
          "label": "Resume (PDF/DOC, max 5 MB)",
          "sheetColumn": "Resume Link",
          "type": "file",
          "required": true,
          "accept": [".pdf", ".doc", ".docx"],
          "maxSizeMb": 5
        },
        {
          "id": "consent",
          "label": "I consent to my data being stored for recruitment purposes",
          "sheetColumn": "Consent",
          "type": "consent",
          "required": true
        }
      ]
    }
  ]
}
```

Supported `type` values the renderer must handle: `text`, `email`, `tel`, `url`, `number`, `date`, `textarea`, `select`, `radio`, `checkbox` (multi), `consent` (single required checkbox), `file`.

Additional per-field behaviours the renderer must support:

- **`allowOther: true`** on `radio` and `checkbox` — renders an extra "Other:" choice with an inline text input beside it, mirroring Google Forms. The text input is disabled until that choice is selected, and becomes required once it is. The submitted value is the typed text, not the literal string "Other". For `checkbox`, the typed value is appended to the selected options and the whole set is joined with `joinWith` into one cell.
- **`placeholder`** on `select` — renders as a disabled, non-selectable first `<option>` (Google Forms shows "Choose"). It must never pass validation as a real answer.
- **`otherTriggerValue`** on `select` — names the option that means "not in this list" (here, `"Others"`). Purely informational for now.
- **`showIf`** (optional, implement if cheap): `{ "field": "pg_college", "equals": "Others" }` hides a field until the condition holds. **Default to not using it** — the live Google Form shows the PG-college-other field unconditionally and asks for "NA", so unconditional display preserves current behaviour and keeps the sheet column always populated.
- **`helpText`** — small grey text under the label, above the input.

Section grouping is cosmetic: each `sections[]` entry becomes a `<fieldset>` with a `<legend>`. The original Google Form is one flat list, so grouping is an improvement, not a behaviour change. Keep it single-page — do not add a multi-step wizard.

> **`sheetColumn` is the contract with the existing sheet.** It must match the existing header text **exactly**, including spacing and case. This is what lets the new form append to the same sheet the Google Form was filling.

### 4.2 `config/config.json`

```json
{
  "endpointUrl": "https://script.google.com/macros/s/XXXXXXXX/exec",
  "sharedToken": "",
  "submitTimeoutMs": 20000,
  "retryAttempts": 2,
  "successMessage": "Thanks — your application has been received.",
  "successRedirectUrl": "",
  "showSubmissionId": true,
  "saveDraftLocally": true,
  "antiSpam": {
    "honeypotField": "company_website",
    "minFillSeconds": 3,
    "recaptcha": { "enabled": false, "siteKey": "" }
  },
  "branding": {
    "logoUrl": "",
    "primaryColor": "#1a56db",
    "footerText": ""
  }
}
```

- Fetch with `cache: "no-store"` (or `?v=<timestamp>`) so config edits take effect immediately.
- If `endpointUrl` is missing or still a placeholder, render a clear setup banner instead of a broken form.
- `config.json` is git-tracked. It contains **no secrets** — `sharedToken` is a low-value anti-drive-by token, not auth. Say this plainly in `CONFIGURATION.md` so nobody assumes it's a security boundary.

### 4.3 Submission mechanics — the CORS detail that matters

Apps Script web apps **cannot respond to a CORS preflight `OPTIONS` request**. A normal `fetch` with `Content-Type: application/json` triggers a preflight and will fail.

The fix: send a **simple request**, so no preflight happens.

```js
const res = await fetch(cfg.endpointUrl, {
  method: "POST",
  // text/plain keeps this a "simple request" → no preflight
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify(payload),
  redirect: "follow"
});
const result = await res.json();
```

Apps Script's `ContentService` response carries `Access-Control-Allow-Origin: *`, so the JSON reply is readable. **Do not use `mode: "no-cors"`** — it makes the response opaque and you lose all error reporting.

Implement the request with `AbortController` for `submitTimeoutMs`, and retry `retryAttempts` times on network error or HTTP 5xx only (never on a 4xx validation error).

### 4.4 Payload shape

```json
{
  "submissionId": "uuid-v4-generated-clientside",
  "token": "value-from-config.sharedToken",
  "submittedAt": "2026-09-22T10:14:00.000Z",
  "meta": { "userAgent": "...", "referrer": "..." },
  "honeypot": "",
  "answers": {
    "Full Name": "…",
    "Email Address": "…",
    "Phone": "…"
  },
  "files": [
    {
      "fieldId": "resume",
      "sheetColumn": "Resume Link",
      "filename": "jayant-resume.pdf",
      "mimeType": "application/pdf",
      "dataBase64": "JVBERi0xLjQK…"
    }
  ]
}
```

`answers` is keyed by `sheetColumn`, not by field id — keeps the backend dumb and header-driven.

**Payload size warning.** The resume field allows 10 MB. Base64 encoding inflates that to roughly 13.3 MB of JSON, plus encoding time on the client. This is within Apps Script's request limit but is the most likely source of timeouts on slow mobile connections. Therefore:

- Set `submitTimeoutMs` to at least `60000` when a file is attached (scale the timeout by file size rather than using one flat value).
- Show real progress during encoding and upload — a 13 MB POST with no feedback looks like a hang, and candidates will double-submit.
- Encode via `FileReader.readAsDataURL` off the main thread if practical, and strip the `data:...;base64,` prefix before sending.
- Surface a clear, specific error on timeout: "Your resume may be too large for your current connection — try a smaller PDF."
- Make `maxSizeMb` easy to lower to 5 in `form-schema.json` if 10 MB proves unreliable in testing.

### 4.5 Client-side behaviour

- Validate on blur and on submit; inline error text under each field, first invalid field focused and scrolled to.
- Disable the submit button while in flight; show a spinner and "Submitting…".
- On success: replace the form with a success panel showing `successMessage` + submission ID (if enabled); clear the saved draft; honour `successRedirectUrl` if set.
- On failure: keep all entered values, show a retry button and a human-readable error. Never silently lose a filled form.
- Draft autosave to `localStorage` (debounced, excludes file inputs), restored with a "we restored your draft — clear it?" notice. Gate on `saveDraftLocally`.
- Anti-spam: hidden honeypot input (off-screen, `tabindex="-1"`, `autocomplete="off"`), plus a render-timestamp check against `minFillSeconds`. Wire reCAPTCHA v3 behind the config flag but leave it disabled by default.
- File input: validate extension and size client-side before base64 encoding; show the chosen filename and size.
- Accessibility: real `<label for>`, `fieldset`/`legend` per section, `aria-describedby` for errors, `aria-live="polite"` status region, visible focus rings, works keyboard-only.
- Responsive down to 360 px. Single-column, generous tap targets.
- No external CSS/JS/font CDNs unless reCAPTCHA is enabled — self-contained and fast.
- `?debug=1` query param logs the resolved config, the outgoing payload, and the raw response to the console.

---

## 5. Backend — `apps-script/Code.gs`

### 5.1 Script Properties (set in the Apps Script UI, never in code)

| Key | Example | Notes |
|---|---|---|
| `SPREADSHEET_ID` | `1AbC…` | From the sheet URL |
| `SHEET_NAME` | `Form Responses 1` | Existing tab the Google Form writes to |
| `DRIVE_FOLDER_ID` | `1XyZ…` | Where resumes land; blank disables uploads |
| `SHARED_TOKEN` | `some-random-string` | Must equal `config.sharedToken`; blank disables the check |
| `ALLOWED_ORIGINS` | `https://user.github.io` | Comma-separated; blank allows all |
| `TIMESTAMP_COLUMN` | `Timestamp` | Header to write the server time into |
| `NOTIFY_EMAILS` | `hr@example.com` | Comma-separated; blank disables notifications |

### 5.2 `doPost(e)` logic

1. Parse `e.postData.contents` as JSON. Malformed → `400`.
2. If `SHARED_TOKEN` is set and `payload.token` doesn't match → `403`.
3. If `ALLOWED_ORIGINS` is set, check `payload.meta.referrer` against it → `403` on mismatch. (Note in comments: this is advisory only, referrer is spoofable.)
4. If `payload.honeypot` is non-empty → return `200 {ok:true}` but **write nothing** (silently drop bots so they don't retry).
5. Acquire `LockService.getScriptLock()` with a 30 s timeout to serialise appends.
6. Read row 1 of the target sheet → `headers[]`. **This is the column map.**
7. Dedupe: keep a `CacheService` entry keyed by `submissionId` for 6 hours; if seen, return the earlier result instead of writing a duplicate row.
8. Server-side re-validation: required fields present, email shape, max lengths, allowed option values. Never trust the client. Return `400` with a per-field error map.
9. Upload each entry in `files[]` to `DRIVE_FOLDER_ID` via `Utilities.newBlob(Utilities.base64Decode(dataBase64), mimeType, filename)`. Rename to `<Full Name> - <original filename>`. Set sharing to "anyone with the link can view" (make this a constant that's easy to change to domain-restricted). Put the resulting URL into `answers[sheetColumn]`.
10. Build the row: `headers.map(h => answers[h] ?? "")`, with `TIMESTAMP_COLUMN` filled from `new Date()`.
11. **Unknown-header policy:** if `answers` contains a key not present in `headers`, append the new header to row 1 and widen the row — and log it. Document this behaviour; it's what makes the form tolerant of schema drift.
12. `sheet.appendRow(row)`.
13. If `NOTIFY_EMAILS` is set, `MailApp.sendEmail` a short digest to HR (guard with try/catch — a mail failure must not fail the submission, the row is already written).
14. Release the lock in a `finally`.
15. Respond:

```js
return ContentService
  .createTextOutput(JSON.stringify({ ok: true, submissionId, row: rowNumber }))
  .setMimeType(ContentService.MimeType.JSON);
```

Error shape: `{ ok: false, code: "VALIDATION_ERROR", message: "...", fieldErrors: { "Email Address": "..." } }`.

> Apps Script always returns HTTP 200 for `ContentService`. Signal real status via the `ok` flag and a `status` integer in the body, and have the frontend branch on that rather than on `res.status`.

### 5.3 `doGet(e)`

Health check: `{ ok: true, service: "hiring-form", sheet: "<SHEET_NAME>", headers: [...], version: "1.0.0" }`. Lets you verify the endpoint and the column map from a browser before wiring the frontend.

### 5.4 `appsscript.json`

Timezone `Asia/Kolkata`, `webapp.executeAs: USER_DEPLOYING`, `webapp.access: ANYONE_ANONYMOUS`, explicit `oauthScopes` for Spreadsheets, Drive, and Mail.

---

## 6. Deployment

### 6.1 `apps-script/DEPLOY.md`

Numbered, click-by-click, written for someone who has never opened Apps Script:

1. Open the destination Google Sheet → Extensions → Apps Script.
2. Paste `Code.gs`; show hidden `appsscript.json` via Project Settings → "Show appsscript.json".
3. Project Settings → Script Properties → add the keys from §5.1.
4. Deploy → New deployment → type **Web app** → Execute as **Me** → Who has access **Anyone**.
5. Authorise (explain the "unverified app → Advanced → Go to project" screen, since it scares people).
6. Copy the `/exec` URL → paste into `config/config.json` as `endpointUrl`.
7. Verify by opening the `/exec` URL in a browser — expect the `doGet` health JSON.
8. **Rotating to a different Google account:** repeat 1–7 in the new account, then update `endpointUrl`. Nothing else changes. Call this out as its own section.
9. Note: every code edit requires **Deploy → Manage deployments → Edit → Version: New version**. Saving alone does not update the live URL. This trips everyone up once.

### 6.2 `.github/workflows/pages.yml`

Standard `actions/configure-pages` → `actions/upload-pages-artifact` (path `.`) → `actions/deploy-pages`, triggered on push to `main` and `workflow_dispatch`. Include `.nojekyll`.

### 6.3 `README.md`

Purpose, 5-minute setup, local dev (`python3 -m http.server 8000` — note that `file://` breaks `fetch` on the config files), the architecture diagram, troubleshooting table:

| Symptom | Cause | Fix |
|---|---|---|
| CORS error in console | `Content-Type: application/json` triggered a preflight | Use `text/plain;charset=utf-8` |
| 401/redirect to Google login | Web app access isn't "Anyone" | Redeploy with correct access |
| Row appends but columns misaligned | `sheetColumn` doesn't match the header exactly | Compare against `doGet` output |
| Edits to `Code.gs` have no effect | Deployed an old version | Manage deployments → New version |
| Resume link is dead for HR | Drive file sharing too restrictive | Check folder + file permissions |

---

## 7. Acceptance criteria

- [ ] `index.html` opened over `http://localhost` renders every field from `form-schema.json` with zero hardcoded field markup.
- [ ] A valid submission appends exactly one row to the configured sheet, with values under the correct existing headers.
- [ ] A resume upload lands in the Drive folder and its link appears in the sheet.
- [ ] Changing `SPREADSHEET_ID` in Script Properties redirects submissions to a different sheet with **no code or config change**.
- [ ] Changing `endpointUrl` in `config.json` redirects to a different Apps Script deployment with **no code change**.
- [ ] Submitting with the honeypot filled returns success but writes no row.
- [ ] Submitting the same `submissionId` twice writes one row.
- [ ] Network failure preserves the filled form and offers retry.
- [ ] Missing required field is blocked client-side **and** rejected server-side if the client check is bypassed.
- [ ] Keyboard-only completion works end to end; axe DevTools reports no critical issues.
- [ ] Renders correctly at 360 px, 768 px, 1440 px.
- [ ] No secret, key, or token that grants sheet write access exists anywhere in the repo.

---

## 8. Code style

Vanilla ES modules, no transpiler. Small named functions, no framework, no build. Comment the non-obvious bits — especially the `text/plain` CORS workaround and the header-driven column mapping, since both look like mistakes to a reader who doesn't know why. Ship no dead code.

---

## 9. Resolved decisions

- **Fields:** all 19, transcribed into `form-schema.json`. Every field is required.
- **Resume upload:** yes — PDF/DOC/DOCX, max 10 MB, stored in Drive, link written to the sheet.
- **Sheet:** a **new** spreadsheet created for this POC. The original Google Form stays live and untouched; nothing is being retired. The new sheet's header row must be created to match the `sheetColumn` values in `form-schema.json`, in that order, plus a leading `Timestamp` column.
- **Origin allowlist:** leave `ALLOWED_ORIGINS` blank for the POC; fill it once the Pages URL exists.

### Deliberate differences from the Google Form

| Google Form | This form | Why |
|---|---|---|
| Records the signed-in Google account email | Dropped | No Google sign-in on a static page. "Candidate Personal Email ID" covers the need — but note it is self-typed and **unverified**, where the Google one was verified. |
| Emails the candidate a copy of their responses | Not included | Would need `MailApp` in `doPost`. Add later if wanted. |
| Drive upload owned by the candidate's account | Owned by the deploying account | Files land in `DRIVE_FOLDER_ID`; candidate identity comes from the form fields, not the file owner. |

## 10. Remaining gaps to fill before shipping

- `TODO:` `form-schema.json` → `pg_college.options` — paste the exact PG-college dropdown list from the Google Form. Placeholder is present.
- `TODO:` `form-schema.json` → `pg_specialization.options` — paste the exact specialization dropdown list. Placeholder is present.
- `TODO:` Confirm the Indian state/UT list matches the Google Form's dropdown exactly (a full 36-entry list is pre-filled; the form may use a shorter one).
- `TODO:` Decide whether an applicant confirmation email is needed for the POC.