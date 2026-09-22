/**
 * Google Apps Script Backend for Static Hiring Web Form
 * Handles doPost (form submissions & file uploads) and doGet (health check).
 */

function doGet(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var spreadsheetId = props.getProperty("SPREADSHEET_ID") || "12zL8uoISWtPDURgyvLHtfO-eM5UEx_DgFOsXVASDABo";
    var sheetName = props.getProperty("SHEET_NAME") || "Sheet1";
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    var headers = [];
    if (sheet && sheet.getLastRow() >= 1) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      service: "hiring-form",
      spreadsheetId: spreadsheetId,
      sheet: sheetName,
      headers: headers,
      version: "1.0.0",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var sharedToken = props.getProperty("SHARED_TOKEN") || "";
  var allowedOrigins = props.getProperty("ALLOWED_ORIGINS") || "";
  var spreadsheetId = props.getProperty("SPREADSHEET_ID") || "12zL8uoISWtPDURgyvLHtfO-eM5UEx_DgFOsXVASDABo";
  var sheetName = props.getProperty("SHEET_NAME") || "Sheet1";
  var driveFolderId = props.getProperty("DRIVE_FOLDER_ID") || "1q0nXrlx0xHH2HKOviNEBTwHGKjDHo-vs";
  var timestampColumn = props.getProperty("TIMESTAMP_COLUMN") || "Timestamp";
  var notifyEmails = props.getProperty("NOTIFY_EMAILS") || "";

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, status: 400, code: "EMPTY_BODY", message: "Request body is empty" });
    }

    var payload = JSON.parse(e.postData.contents);

    // 1. Shared Token Check
    if (sharedToken && payload.token !== sharedToken) {
      return jsonResponse({ ok: false, status: 403, code: "INVALID_TOKEN", message: "Unauthorized submission token" });
    }

    // 2. Advisory Origin Check
    if (allowedOrigins) {
      var origins = allowedOrigins.split(",").map(function(s) { return s.trim(); });
      var ref = (payload.meta && payload.meta.referrer) || "";
      var matched = origins.some(function(o) { return ref.indexOf(o) === 0; });
      if (!matched && ref) {
        // Log advisory origin mismatch
        Logger.log("Advisory origin mismatch: referrer " + ref + " not in " + allowedOrigins);
      }
    }

    // 3. Anti-Spam Honeypot Check (Silently drop bots)
    if (payload.honeypot && payload.honeypot.toString().trim() !== "") {
      return jsonResponse({ ok: true, status: 200, submissionId: payload.submissionId, dropped: true });
    }

    // 4. Deduplication via CacheService
    var cache = CacheService.getScriptCache();
    var submissionId = payload.submissionId || ("sub_" + new Date().getTime());
    var cachedResponse = cache.get(submissionId);
    if (cachedResponse) {
      return jsonResponse(JSON.parse(cachedResponse));
    }

    // 5. Server-side Validation
    var answers = payload.answers || {};
    var validationErrors = {};
    if (!answers["Candidate Full Name"]) {
      validationErrors["Candidate Full Name"] = "Candidate Full Name is required";
    }
    if (!answers["Candidate Personal Email ID"] || answers["Candidate Personal Email ID"].indexOf("@") === -1) {
      validationErrors["Candidate Personal Email ID"] = "Valid Personal Email ID is required";
    }
    if (!answers["Candidate Contact Number"]) {
      validationErrors["Candidate Contact Number"] = "Candidate Contact Number is required";
    }

    if (Object.keys(validationErrors).length > 0) {
      return jsonResponse({
        ok: false,
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Server-side validation failed",
        fieldErrors: validationErrors
      });
    }

    // 6. Lock Service to serialize concurrency
    var lock = LockService.getScriptLock();
    var acquired = lock.tryLock(30000);
    if (!acquired) {
      return jsonResponse({ ok: false, status: 503, code: "LOCK_TIMEOUT", message: "Server busy, please try submitting again in a moment." });
    }

    try {
      var ss = SpreadsheetApp.openById(spreadsheetId);
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      // Read Row 1 Column Headers
      var lastCol = Math.max(sheet.getLastColumn(), 1);
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

      // Handle File Uploads (Resume) - STRICT TRANSACTIONAL POLICY
      if (payload.files && payload.files.length > 0) {
        for (var i = 0; i < payload.files.length; i++) {
          var fileItem = payload.files[i];
          if (fileItem.dataBase64 && fileItem.sheetColumn) {
            try {
              var candidateName = answers["Candidate Full Name"] || "Candidate";
              var safeFilename = candidateName.replace(/[^a-zA-Z0-9_\- ]/g, "") + " - " + fileItem.filename;
              var bytes = Utilities.base64Decode(fileItem.dataBase64);
              var blob = Utilities.newBlob(bytes, fileItem.mimeType || "application/pdf", safeFilename);
              
              var fileUrl = "";
              if (driveFolderId) {
                try {
                  var folder = DriveApp.getFolderById(driveFolderId);
                  var savedFile = folder.createFile(blob);
                  try {
                    savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                  } catch (shareErr) {
                    Logger.log("Sharing permission warning: " + shareErr.toString());
                  }
                  fileUrl = savedFile.getUrl();
                } catch (folderErr) {
                  Logger.log("Folder access fallback to Drive root: " + folderErr.toString());
                  var defaultSaved = DriveApp.createFile(blob);
                  try {
                    defaultSaved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                  } catch (shareErr2) {}
                  fileUrl = defaultSaved.getUrl();
                }
              } else {
                var defaultSaved = DriveApp.createFile(blob);
                try {
                  defaultSaved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                } catch (shareErr3) {}
                fileUrl = defaultSaved.getUrl();
              }

              if (!fileUrl) {
                throw new Error("Failed to generate file URL");
              }

              answers[fileItem.sheetColumn] = fileUrl;
            } catch (fileErr) {
              Logger.log("File upload error: " + fileErr.toString());
              // ABORT TRANSACTION: Do not write row to Google Sheet if file upload fails!
              return jsonResponse({
                ok: false,
                status: 500,
                code: "FILE_UPLOAD_FAILED",
                message: "Failed to upload resume file to Google Drive: " + fileErr.message + ". Application was NOT saved. Please try again."
              });
            }
          }
        }
      }

      // Timestamp
      answers[timestampColumn] = payload.submittedAt || new Date().toISOString();

      // Dynamic header expansion policy
      Object.keys(answers).forEach(function(key) {
        if (headers.indexOf(key) === -1) {
          headers.push(key);
          sheet.getRange(1, headers.length).setValue(key);
        }
      });

      // Construct Row Data
      var row = headers.map(function(h) {
        var val = answers[h];
        if (val === undefined || val === null) return "";
        if (Array.isArray(val)) return val.join(", ");
        return val;
      });

      // Append Row
      sheet.appendRow(row);
      var newRowIndex = sheet.getLastRow();

      var successResult = {
        ok: true,
        status: 200,
        submissionId: submissionId,
        row: newRowIndex,
        message: "Application recorded successfully"
      };

      // Cache result for 6 hours
      cache.put(submissionId, JSON.stringify(successResult), 21600);

      // HR Email Notification (non-blocking)
      if (notifyEmails) {
        try {
          var candidateName = answers["Candidate Full Name"] || "Candidate";
          var position = answers["Positions Applied For"] || "Application";
          var emailBody = "New Job Application Received!\n\n" +
            "Candidate: " + candidateName + "\n" +
            "Email: " + (answers["Candidate Personal Email ID"] || "N/A") + "\n" +
            "Phone: " + (answers["Candidate Contact Number"] || "N/A") + "\n" +
            "Position: " + position + "\n" +
            "Resume Link: " + (answers["Resume Link"] || "N/A") + "\n" +
            "Sheet Row: #" + newRowIndex + "\n\n" +
            "View Spreadsheet: https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit";
            
          MailApp.sendEmail(notifyEmails, "New Application: " + candidateName + " (" + position + ")", emailBody);
        } catch (mailErr) {
          Logger.log("Mail send error: " + mailErr.toString());
        }
      }

      return jsonResponse(successResult);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResponse({
      ok: false,
      status: 500,
      code: "SERVER_ERROR",
      message: "An internal server error occurred: " + err.toString()
    });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
