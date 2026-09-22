/**
 * Main Application Entry Point
 * Orchestrates schema rendering, form validation, draft saving, file encoding, and submission
 */

import { SchemaRenderer } from './js/schema-renderer.js';
import { validateField, validateForm } from './js/validator.js';
import { DraftManager } from './js/draft-manager.js';
import { submitFormPayload } from './js/api-client.js';

let appConfig = null;
let appSchema = null;
let draftManager = null;
let renderTimestamp = Date.now();

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  const container = document.getElementById('app-container');
  if (!container) return;

  try {
    // 1. Fetch config and schema with timestamp query to prevent browser caching
    const timestamp = Date.now();
    const [configRes, schemaRes] = await Promise.all([
      fetch(`./config/config.json?v=${timestamp}`, { cache: 'no-store' }),
      fetch(`./config/form-schema.json?v=${timestamp}`, { cache: 'no-store' })
    ]);

    if (!configRes.ok || !schemaRes.ok) {
      throw new Error('Failed to load application configuration or form schema.');
    }

    appConfig = await configRes.json();
    appSchema = await schemaRes.json();

    // Debug logging if enabled
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === '1') {
      console.log('[DEBUG] Resolved Config:', appConfig);
      console.log('[DEBUG] Resolved Schema:', appSchema);
    }

    // Apply branding CSS variables if present
    if (appConfig.branding && appConfig.branding.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', appConfig.branding.primaryColor);
    }

    // Check Endpoint URL
    const isEndpointConfigured = appConfig.endpointUrl && 
      !appConfig.endpointUrl.includes('YOUR_APPS_SCRIPT') && 
      !appConfig.endpointUrl.includes('XXXXXXXX');

    if (!isEndpointConfigured) {
      renderSetupBanner(container, appConfig);
    }

    // 2. Render Form from Schema
    const renderer = new SchemaRenderer(container, appSchema);
    renderer.render();

    const formEl = document.getElementById('hiring-application-form');
    if (!formEl) return;

    // 3. Render Anti-Spam Honeypot Input
    renderHoneypot(formEl, appConfig);

    // 4. Initialize Draft Persistence
    if (appConfig.saveDraftLocally !== false) {
      draftManager = new DraftManager(formEl, appSchema, { enabled: true });
      draftManager.init();
    }

    // 5. Attach Validation & Submission Listeners
    attachFormEvents(formEl);

  } catch (err) {
    console.error('App Initialization Error:', err);
    container.innerHTML = `
      <div class="alert-banner alert-error">
        <h3>Initialization Error</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function renderSetupBanner(container, config) {
  const banner = document.createElement('div');
  banner.className = 'setup-warning-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      <div>
        <strong>Endpoint Configuration Required</strong>
        <p>Apps Script <code>endpointUrl</code> is not set in <code>config/config.json</code>. Form submissions will fail until configured. Follow the <a href="apps-script/DEPLOY.md" target="_blank">DEPLOY.md guide</a> to get your endpoint URL.</p>
      </div>
    </div>
  `;
  container.parentNode.insertBefore(banner, container);
}

function renderHoneypot(formEl, config) {
  const honeypotFieldName = (config.antiSpam && config.antiSpam.honeypotField) || 'company_website';
  const wrapper = document.createElement('div');
  wrapper.className = 'honeypot-field-wrapper';
  wrapper.style.display = 'none';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = `
    <label for="${honeypotFieldName}">Leave this field empty</label>
    <input type="text" id="${honeypotFieldName}" name="${honeypotFieldName}" tabindex="-1" autocomplete="off">
  `;
  formEl.insertBefore(wrapper, formEl.firstChild);
}

function attachFormEvents(formEl) {
  // Live validation on blur
  formEl.addEventListener('focusout', (e) => {
    const target = e.target;
    if (!target || !target.id) return;

    // Find field schema
    const field = findFieldSchema(target.id);
    if (!field) return;

    validateAndShowError(formEl, field);
  });

  // Submit Handler
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFormSubmit(formEl);
  });
}

function findFieldSchema(fieldId) {
  if (!appSchema || !appSchema.sections) return null;
  const cleanId = fieldId.replace('_other_input', '').replace('_opt_other', '');
  for (const section of appSchema.sections) {
    const found = section.fields.find(f => f.id === cleanId || fieldId.startsWith(f.id));
    if (found) return found;
  }
  return null;
}

function validateAndShowError(formEl, field) {
  const formValues = collectFormValues(formEl);
  const filesMap = collectFilesMap(formEl);
  const errorMsg = validateField(field, formValues[field.id], filesMap, formValues);

  const errorEl = formEl.querySelector(`#error-${field.id}`);
  const groupEl = formEl.querySelector(`[data-field-id="${field.id}"]`);

  if (errorEl && groupEl) {
    if (errorMsg) {
      errorEl.textContent = errorMsg;
      errorEl.style.display = 'block';
      groupEl.classList.add('has-error');
      const inputEl = formEl.querySelector(`#${field.id}`) || formEl.querySelector(`input[name="${field.id}"]`);
      if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
    } else {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
      groupEl.classList.remove('has-error');
      const inputEl = formEl.querySelector(`#${field.id}`) || formEl.querySelector(`input[name="${field.id}"]`);
      if (inputEl) inputEl.removeAttribute('aria-invalid');
    }
  }

  return !errorMsg;
}

function collectFormValues(formEl) {
  const values = {};
  if (!appSchema || !appSchema.sections) return values;

  appSchema.sections.forEach(section => {
    section.fields.forEach(field => {
      if (field.type === 'file') return;

      if (field.type === 'checkbox') {
        const checked = Array.from(formEl.querySelectorAll(`input[name="${field.id}[]"]:checked`)).map(c => c.value);
        if (checked.includes('__OTHER__')) {
          const otherText = (formEl.querySelector(`#${field.id}_other_input`)?.value || '').trim();
          const filtered = checked.filter(c => c !== '__OTHER__');
          if (otherText) filtered.push(otherText);
          values[field.id] = filtered.join(field.joinWith || ', ');
        } else {
          values[field.id] = checked.join(field.joinWith || ', ');
        }
      } else if (field.type === 'radio') {
        const checkedRadio = formEl.querySelector(`input[name="${field.id}"]:checked`);
        if (checkedRadio) {
          if (checkedRadio.value === '__OTHER__') {
            values[field.id] = (formEl.querySelector(`#${field.id}_other_input`)?.value || '').trim();
          } else {
            values[field.id] = checkedRadio.value;
          }
        } else {
          values[field.id] = '';
        }
      } else if (field.type === 'consent') {
        const consentBox = formEl.querySelector(`#${field.id}`);
        values[field.id] = consentBox ? (consentBox.checked ? 'Yes' : 'No') : 'No';
      } else {
        const input = formEl.querySelector(`#${field.id}`);
        values[field.id] = input ? input.value.trim() : '';
      }
    });
  });

  return values;
}

function collectFilesMap(formEl) {
  const files = {};
  if (!appSchema || !appSchema.sections) return files;

  appSchema.sections.forEach(section => {
    section.fields.forEach(field => {
      if (field.type === 'file') {
        const fileInput = formEl.querySelector(`#${field.id}`);
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          files[field.id] = fileInput.files[0];
        }
      }
    });
  });

  return files;
}

async function handleFormSubmit(formEl) {
  const formValues = collectFormValues(formEl);
  const filesMap = collectFilesMap(formEl);

  // 1. Full Form Validation
  const { isValid, errors } = validateForm(appSchema, formValues, filesMap);

  // Clear previous global alerts
  clearGlobalAlerts();

  if (!isValid) {
    let firstInvalidGroup = null;

    Object.keys(errors).forEach(fieldId => {
      const field = findFieldSchema(fieldId);
      if (field) {
        validateAndShowError(formEl, field);
      }
      if (!firstInvalidGroup) {
        firstInvalidGroup = formEl.querySelector(`[data-field-id="${fieldId}"]`);
      }
    });

    if (firstInvalidGroup) {
      firstInvalidGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = firstInvalidGroup.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }

    showGlobalAlert('Please correct the highlighted errors before submitting.', 'error');
    return;
  }

  // 2. Anti-Spam Min Fill Time Check
  const minSeconds = (appConfig.antiSpam && appConfig.antiSpam.minFillSeconds) || 3;
  const elapsedSeconds = (Date.now() - renderTimestamp) / 1000;
  if (elapsedSeconds < minSeconds) {
    showGlobalAlert('Submission occurred too quickly. Please review your details and try again.', 'error');
    return;
  }

  // 3. Anti-Spam Honeypot Value
  const honeypotName = (appConfig.antiSpam && appConfig.antiSpam.honeypotField) || 'company_website';
  const honeypotVal = (formEl.querySelector(`#${honeypotName}`)?.value || '').trim();

  // 4. Set UI to Submitting State
  setSubmittingState(formEl, true);

  try {
    // 5. Base64 Encode Attached Files
    const encodedFiles = [];
    for (const section of appSchema.sections) {
      for (const field of section.fields) {
        if (field.type === 'file' && filesMap[field.id]) {
          const file = filesMap[field.id];
          setSubmitProgress(`Encoding ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);
          const base64Data = await readFileAsBase64(file);
          encodedFiles.push({
            fieldId: field.id,
            sheetColumn: field.sheetColumn,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            dataBase64: base64Data
          });
        }
      }
    }

    // 6. Map answers by sheetColumn
    const answersByColumn = {};
    appSchema.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.type !== 'file') {
          answersByColumn[field.sheetColumn] = formValues[field.id] || '';
        }
      });
    });

    // 7. Construct Submission Payload
    const submissionId = generateUUID();
    const payload = {
      submissionId: submissionId,
      token: appConfig.sharedToken || '',
      submittedAt: new Date().toISOString(),
      meta: {
        userAgent: navigator.userAgent,
        referrer: document.referrer
      },
      honeypot: honeypotVal,
      answers: answersByColumn,
      files: encodedFiles
    };

    if (window.location.search.includes('debug=1')) {
      console.log('[DEBUG] Outgoing Payload:', payload);
    }

    const totalPayloadBytes = JSON.stringify(payload).length;
    const totalPayloadMb = (totalPayloadBytes / (1024 * 1024)).toFixed(1);
    setSubmitProgress(`Uploading application (${totalPayloadMb} MB)...`);

    // Timer to update progress text if upload takes > 8 seconds
    const progressTimer = setTimeout(() => {
      setSubmitProgress('Saving resume to Google Drive & updating sheet...');
    }, 8000);

    const progressTimer2 = setTimeout(() => {
      setSubmitProgress('Finalizing application entry...');
    }, 18000);

    // 8. Submit via API Client
    const response = await submitFormPayload(appConfig.endpointUrl, payload, {
      submitTimeoutMs: appConfig.submitTimeoutMs || 60000,
      retryAttempts: appConfig.retryAttempts || 2
    });

    clearTimeout(progressTimer);
    clearTimeout(progressTimer2);

    if (window.location.search.includes('debug=1')) {
      console.log('[DEBUG] Response Data:', response);
    }

    if (response && response.ok) {
      // Clear Draft
      if (draftManager) draftManager.clearDraft();

      // Show Success Screen
      renderSuccessScreen(response, appConfig);
    } else {
      const errMsg = (response && response.message) || 'Submission failed on server. Please try again.';
      showGlobalAlert(errMsg, 'error');
      setSubmittingState(formEl, false);
    }

  } catch (err) {
    console.error('Submission Error:', err);
    showGlobalAlert(err.message || 'An unexpected error occurred during submission. Please try again.', 'error');
    setSubmittingState(formEl, false);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.substring(result.indexOf(',') + 1);
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function setSubmittingState(formEl, isSubmitting) {
  const submitBtn = formEl.querySelector('#submit-btn');
  if (!submitBtn) return;

  const spinner = submitBtn.querySelector('.btn-spinner');
  const btnText = submitBtn.querySelector('.btn-text');

  if (isSubmitting) {
    submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Submitting...';
  } else {
    submitBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';
    if (btnText) btnText.textContent = 'Submit Application';
  }
}

function setSubmitProgress(text) {
  const submitBtn = document.querySelector('#submit-btn .btn-text');
  if (submitBtn) submitBtn.textContent = text;
}

function showGlobalAlert(message, type = 'error') {
  const container = document.getElementById('app-container');
  if (!container) return;

  let alertEl = document.getElementById('global-alert-banner');
  if (!alertEl) {
    alertEl = document.createElement('div');
    alertEl.id = 'global-alert-banner';
    container.parentNode.insertBefore(alertEl, container);
  }

  alertEl.className = `alert-banner alert-${type}`;
  alertEl.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" class="alert-close-btn" onclick="this.parentElement.remove()">&times;</button>
  `;

  alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearGlobalAlerts() {
  const alertEl = document.getElementById('global-alert-banner');
  if (alertEl) alertEl.remove();
}

function renderSuccessScreen(response, config) {
  const container = document.getElementById('app-container');
  if (!container) return;

  const message = config.successMessage || 'Thank you! Your application has been received.';

  container.innerHTML = `
    <div class="success-card">
      <div class="success-icon-wrapper">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h2 class="success-title">Application Submitted!</h2>
      <p class="success-message">${escapeHtml(message)}</p>

      ${config.showSubmissionId && response.submissionId ? `
        <div class="submission-id-box">
          <span class="sub-id-label">Submission Reference ID:</span>
          <code class="sub-id-code">${escapeHtml(response.submissionId)}</code>
        </div>
      ` : ''}

      <div class="success-actions">
        <button type="button" class="btn-primary" onclick="window.location.reload()">Submit Another Application</button>
      </div>
    </div>
  `;

  if (config.successRedirectUrl) {
    setTimeout(() => {
      window.location.href = config.successRedirectUrl;
    }, 3000);
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
