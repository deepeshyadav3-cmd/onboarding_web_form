/**
 * Draft Manager Module
 * Manages autosaving form fields to localStorage & restoring draft data
 */

const DRAFT_KEY = 'hiring_form_draft_v1';

export class DraftManager {
  constructor(formElement, schema, options = {}) {
    this.form = formElement;
    this.schema = schema;
    this.enabled = options.enabled !== false;
    this.debounceMs = options.debounceMs || 500;
    this.timer = null;
  }

  init() {
    if (!this.enabled || !this.form) return;

    // Attach debounced autosave listeners
    this.form.addEventListener('input', () => this.scheduleSave());
    this.form.addEventListener('change', () => this.scheduleSave());

    // Check for existing draft
    this.checkForDraft();
  }

  scheduleSave() {
    if (!this.enabled) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveDraft(), this.debounceMs);
  }

  saveDraft() {
    try {
      const data = this.extractFormData();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: data
      }));
    } catch (e) {
      console.warn('Unable to save form draft to localStorage', e);
    }
  }

  extractFormData() {
    const data = {};
    if (!this.schema || !this.schema.sections) return data;

    this.schema.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.type === 'file') return; // Skip files

        if (field.type === 'checkbox') {
          const checkboxes = this.form.querySelectorAll(`input[name="${field.id}[]"]:checked`);
          const values = Array.from(checkboxes).map(c => c.value);
          data[field.id] = values;
          if (values.includes('__OTHER__')) {
            const otherInput = this.form.querySelector(`#${field.id}_other_input`);
            data[`${field.id}_other`] = otherInput ? otherInput.value : '';
          }
        } else if (field.type === 'radio') {
          const checkedRadio = this.form.querySelector(`input[name="${field.id}"]:checked`);
          if (checkedRadio) {
            data[field.id] = checkedRadio.value;
            if (checkedRadio.value === '__OTHER__') {
              const otherInput = this.form.querySelector(`#${field.id}_other_input`);
              data[`${field.id}_other`] = otherInput ? otherInput.value : '';
            }
          }
        } else if (field.type === 'consent') {
          const consentEl = this.form.querySelector(`#${field.id}`);
          if (consentEl) data[field.id] = consentEl.checked;
        } else {
          const el = this.form.querySelector(`#${field.id}`);
          if (el) data[field.id] = el.value;
        }
      });
    });

    return data;
  }

  checkForDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && Object.keys(parsed.data).length > 0) {
        this.showDraftNotice(parsed);
      }
    } catch (e) {
      console.warn('Error reading saved draft', e);
    }
  }

  showDraftNotice(draftObj) {
    const noticeEl = document.createElement('div');
    noticeEl.className = 'draft-notice-bar';
    const formattedDate = new Date(draftObj.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    noticeEl.innerHTML = `
      <span>We found an unsaved draft from earlier (${formattedDate}). Would you like to restore it?</span>
      <div class="draft-notice-buttons">
        <button type="button" class="btn-sm btn-restore-draft">Restore Draft</button>
        <button type="button" class="btn-sm btn-clear-draft">Discard</button>
      </div>
    `;

    this.form.parentNode.insertBefore(noticeEl, this.form);

    noticeEl.querySelector('.btn-restore-draft').addEventListener('click', () => {
      this.restoreDraft(draftObj.data);
      noticeEl.remove();
    });

    noticeEl.querySelector('.btn-clear-draft').addEventListener('click', () => {
      this.clearDraft();
      noticeEl.remove();
    });
  }

  restoreDraft(data) {
    if (!data) return;

    Object.keys(data).forEach(fieldId => {
      const val = data[fieldId];

      if (fieldId.endsWith('_other')) return; // Handled alongside parent

      const fieldEl = this.form.querySelector(`#${fieldId}`);
      if (fieldEl) {
        if (fieldEl.type === 'checkbox') {
          fieldEl.checked = Boolean(val);
        } else {
          fieldEl.value = val;
        }
      }

      // Checkboxes
      const checkboxes = this.form.querySelectorAll(`input[name="${fieldId}[]"]`);
      if (checkboxes.length > 0 && Array.isArray(val)) {
        checkboxes.forEach(cb => {
          cb.checked = val.includes(cb.value);
          if (cb.value === '__OTHER__' && cb.checked) {
            const otherInput = this.form.querySelector(`#${fieldId}_other_input`);
            if (otherInput) {
              otherInput.disabled = false;
              otherInput.value = data[`${fieldId}_other`] || '';
            }
          }
        });
      }

      // Radios
      const radios = this.form.querySelectorAll(`input[name="${fieldId}"]`);
      if (radios.length > 0 && typeof val === 'string') {
        radios.forEach(radio => {
          if (radio.value === val) {
            radio.checked = true;
            if (val === '__OTHER__') {
              const otherInput = this.form.querySelector(`#${fieldId}_other_input`);
              if (otherInput) {
                otherInput.disabled = false;
                otherInput.value = data[`${fieldId}_other`] || '';
              }
            }
          }
        });
      }
    });
  }

  clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      console.warn('Unable to clear localStorage draft', e);
    }
  }
}
