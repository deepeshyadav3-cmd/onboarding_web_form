# Deployment Guide — Google Apps Script Web App

This guide walks you through deploying the `apps-script/Code.gs` backend script to Google Apps Script and linking it with your Google Sheet and Google Drive folder.

---

## Step-by-Step Deployment Instructions

### Step 1: Open Apps Script Editor
1. Open your Google Sheet: `https://docs.google.com/spreadsheets/d/12zL8uoISWtPDURgyvLHtfO-eM5UEx_DgFOsXVASDABo/edit`
2. Click **Extensions** → **Apps Script** in the top menu bar.

### Step 2: Paste the Backend Code
1. Delete any code inside `Code.gs`.
2. Copy the full contents of `apps-script/Code.gs` from this repository and paste it into the editor.
3. Click the gear icon (**Project Settings**) on the left navigation bar.
4. Check the box **"Show 'appsscript.json' manifest file in editor"**.
5. Return to the editor tab (`< >`), open `appsscript.json`, and replace its contents with `apps-script/appsscript.json`.

### Step 3: Configure Script Properties
1. Go to **Project Settings** (gear icon) → scroll down to **Script Properties**.
2. Click **Edit script properties** → **Add script property** for each of the following keys:

| Property Key | Value | Description |
|---|---|---|
| `SPREADSHEET_ID` | `12zL8uoISWtPDURgyvLHtfO-eM5UEx_DgFOsXVASDABo` | The Google Sheet ID |
| `SHEET_NAME` | `Sheet1` | Target tab name |
| `DRIVE_FOLDER_ID` | `1q0nXrlx0xHH2HKOviNEBTwHGKjDHo-vs` | Google Drive folder for resumes |
| `SHARED_TOKEN` | *(Optional)* | Secret token matching `config.json` |
| `ALLOWED_ORIGINS` | *(Optional)* | Allowed origins (e.g. `https://yourusername.github.io`) |
| `NOTIFY_EMAILS` | *(Optional)* | Comma-separated email list for HR notifications |

3. Click **Save script properties**.

### Step 4: Deploy as Web App
1. At the top right, click **Deploy** → **New deployment**.
2. Select the gear icon next to "Select type" → choose **Web app**.
3. Configure the settings:
   - **Description**: `Production Hiring Form Backend`
   - **Execute as**: `Me (your-email@domain.com)`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. Authorize the application when prompted:
   - Click **Authorize access** → select your Google Account.
   - Click **Advanced** → **Go to Hiring Form (unsafe)**.
   - Click **Allow**.
6. Copy the **Web App URL** (ends with `/exec`).

### Step 5: Update `config/config.json`
1. Open `config/config.json` in your local project.
2. Replace `endpointUrl` with the copied Web App URL:
   ```json
   "endpointUrl": "https://script.google.com/macros/s/AKfycb.../exec"
   ```

### Step 6: Test the Deployment
- Open the `/exec` URL in your web browser.
- You should see a health check JSON response like:
  ```json
  {
    "ok": true,
    "service": "hiring-form",
    "spreadsheetId": "12zL8uoISWtPDURgyvLHtfO-eM5UEx_DgFOsXVASDABo",
    "sheet": "Sheet1",
    "headers": ["Timestamp", "Candidate Full Name", ...]
  }
  ```

---

## Updating the Code Later
> [!IMPORTANT]
> If you make any changes to `Code.gs` in Apps Script later, saving alone **does not update the live Web App**.
> You **must**: Click **Deploy** → **Manage deployments** → Click the edit pencil icon → Select **Version: New version** → Click **Deploy**.
