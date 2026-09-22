# Static Hiring Application Form (GitHub Pages → Google Sheets)

A production-ready, schema-driven, self-hosted hiring application web form served from **GitHub Pages** that appends candidate submissions directly to **Google Sheets** and saves uploaded resumes to **Google Drive** via Google Apps Script.

---

## 🌟 Key Features

- **Dynamic Schema Rendering**: Form fields, sections, validation rules, and sheet column mappings are dynamically generated from `config/form-schema.json`.
- **Zero Third-Party Backend**: Powered by a lightweight Google Apps Script Web App (`Code.gs`) executing under the sheet owner's authority.
- **CORS Preflight Prevention**: Uses `Content-Type: text/plain;charset=utf-8` simple POST requests to bypass CORS preflight limitations on Google Apps Script.
- **Header-Driven Column Mapping**: Column headers are dynamically mapped to `sheetColumn` definitions in the schema. Unknown fields trigger dynamic header expansion automatically.
- **Draft Autosaving**: Automatically saves draft inputs to browser `localStorage` and offers recovery on page refresh.
- **Anti-Spam Controls**: Built-in hidden honeypot detection and minimum fill time checks.
- **Resume Attachment Handling**: Client-side base64 encoding with progress feedback and direct storage into Google Drive.
- **Concurrency & Deduplication**: Employs Apps Script `LockService` for safe append operations and `CacheService` for 6-hour client submission deduplication.
- **Fully Configurable**: Account changes, sheet swaps, or form question edits require zero frontend JavaScript changes.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────┐
│ GitHub Pages (Static Web App)           │
│                                         │
│ index.html                              │
│ assets/styles.css                       │
│ assets/app.js  (Modular ES Modules)     │
│   ├── js/schema-renderer.js             │
│   ├── js/validator.js                   │
│   ├── js/draft-manager.js               │
│   └── js/api-client.js                  │
│ config/config.json                      │
│ config/form-schema.json                 │
└────────────────────┬────────────────────┘
                     │ (1) Simple POST Request (text/plain JSON)
                     ▼
┌─────────────────────────────────────────┐
│ Google Apps Script Web App              │
│ (apps-script/Code.gs)                   │
│                                         │
│ - Shared token & advisory origin check  │
│ - Honeypot bot drop                     │
│ - LockService (concurrency control)     │
│ - Server-side validation                │
│ - Resume Base64 decode -> Drive Upload  │
│ - Header-driven column mapping          │
│ - CacheService deduplication            │
└────────────────────┬────────────────────┘
                     │ (2) Append Row & Save File
                     ▼
┌─────────────────────────────────────────┐
│ Google Sheet (Responses)                │
│ + Google Drive Folder (Resumes)         │
└─────────────────────────────────────────┘
```

---

## 🚀 Quickstart & Local Development

### 1. Run Locally
Because the application fetches `config/config.json` and `config/form-schema.json` via ES modules, run a local HTTP server (opening via `file://` will block fetch requests):

```bash
# Run local server using Python 3
python3 -m http.server 8000
```

Open your browser and navigate to: [http://localhost:8000](http://localhost:8000)

Enable debug mode to inspect outgoing JSON payloads and configuration:
[http://localhost:8000?debug=1](http://localhost:8000?debug=1)

---

## 🛠 Deployment Steps

### Step 1: Deploy Google Apps Script
1. Open your destination Google Sheet: `https://docs.google.com/spreadsheets/d/12zL8uoISWtPDURgyvLHtfO-eM5UEx_DgFOsXVASDABo/edit`
2. Follow the detailed step-by-step instructions in [apps-script/DEPLOY.md](apps-script/DEPLOY.md).
3. Copy your deployed `/exec` Web App URL.

### Step 2: Configure Frontend
Update `config/config.json` with your Web App URL:
```json
{
  "endpointUrl": "https://script.google.com/macros/s/AKfycb.../exec"
}
```

### Step 3: Deploy to GitHub Pages
Push your changes to the `main` branch. The included GitHub Action ([.github/workflows/pages.yml](.github/workflows/pages.yml)) will automatically build and publish your site to GitHub Pages.

---

## 🔍 Troubleshooting Matrix

| Symptom | Cause | Solution |
|---|---|---|
| **CORS Error in Console** | `Content-Type: application/json` header triggered preflight | Ensure requests use `Content-Type: text/plain;charset=utf-8` |
| **401 / Google Login Prompt** | Web App access permissions not set to "Anyone" | Redeploy in Apps Script with "Who has access: Anyone" |
| **Column Data Misaligned** | `sheetColumn` in `form-schema.json` doesn't match sheet header | Verify exact string match against `doGet` health output |
| **Code Edits to `Code.gs` Not Applying** | Apps Script Web App running older version | Select **Deploy** → **Manage deployments** → **New version** |
| **Resume Link Broken** | Google Drive folder access restricted | Set Drive folder permissions to "Anyone with the link can view" |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
