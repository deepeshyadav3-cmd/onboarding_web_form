/**
 * Schema Renderer Module
 * Dynamically builds form HTML and DOM elements from form-schema.json
 */

export class SchemaRenderer {
  constructor(containerId, schema) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    this.schema = schema;
  }

  render() {
    if (!this.container || !this.schema) return;
    this.container.innerHTML = '';

    // Render Title & Description Header
    const headerEl = document.createElement('header');
    headerEl.className = 'form-header';

    const titleEl = document.createElement('h1');
    titleEl.className = 'form-title';
    titleEl.textContent = this.schema.title || 'Hiring Application';
    headerEl.appendChild(titleEl);

    if (this.schema.description) {
      const descEl = document.createElement('div');
      descEl.className = 'form-description';
      descEl.innerHTML = this.schema.description.replace(/\n/g, '<br>');
      headerEl.appendChild(descEl);
    }

    if (this.schema.links && this.schema.links.length > 0) {
      const linksContainer = document.createElement('div');
      linksContainer.className = 'form-links';
      this.schema.links.forEach(link => {
        const a = document.createElement('a');
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'form-link-item';
        a.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> ${escapeHtml(link.label)}`;
        linksContainer.appendChild(a);
      });
      headerEl.appendChild(linksContainer);
    }

    if (this.schema.requiredNote) {
      const reqNote = document.createElement('div');
      reqNote.className = 'form-required-note';
      reqNote.textContent = this.schema.requiredNote;
      headerEl.appendChild(reqNote);
    }

    this.container.appendChild(headerEl);

    // Render Form Element
    const formEl = document.createElement('form');
    formEl.id = 'hiring-application-form';
    formEl.noValidate = true;

    // Render Sections
    if (this.schema.sections) {
      this.schema.sections.forEach(section => {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'form-section';
        fieldset.id = `section-${section.id}`;

        if (section.title) {
          const legend = document.createElement('legend');
          legend.className = 'form-section-title';
          legend.textContent = section.title;
          fieldset.appendChild(legend);
        }

        if (section.fields) {
          section.fields.forEach(field => {
            const fieldGroup = this.renderField(field);
            fieldset.appendChild(fieldGroup);
          });
        }

        formEl.appendChild(fieldset);
      });
    }

    // Submit Action Section
    const actionsEl = document.createElement('div');
    actionsEl.className = 'form-actions';

    const sampleBtn = document.createElement('button');
    sampleBtn.type = 'button';
    sampleBtn.id = 'btn-fill-sample';
    sampleBtn.className = 'btn-secondary btn-sample-data';
    sampleBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      <span>Fill Sample Data</span>
    `;

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.id = 'submit-btn';
    submitBtn.className = 'btn-primary';
    submitBtn.innerHTML = `
      <span class="btn-spinner" aria-hidden="true" style="display:none;"></span>
      <span class="btn-text">Submit Application</span>
    `;

    actionsEl.appendChild(sampleBtn);
    actionsEl.appendChild(submitBtn);

    formEl.appendChild(actionsEl);
    this.container.appendChild(formEl);

    this.attachEventListeners(formEl);
  }

  renderField(field) {
    const group = document.createElement('div');
    group.className = 'field-group';
    group.dataset.fieldId = field.id;
    group.dataset.fieldType = field.type;

    const labelContainer = document.createElement('div');
    labelContainer.className = 'field-label-wrapper';

    const label = document.createElement('label');
    label.htmlFor = field.type === 'radio' || field.type === 'checkbox' ? '' : field.id;
    label.className = 'field-label';
    label.innerHTML = `${escapeHtml(field.label)} ${field.required ? '<span class="required-star">*</span>' : ''}`;
    labelContainer.appendChild(label);

    if (field.helpText) {
      const help = document.createElement('div');
      help.className = 'field-help-text';
      help.id = `help-${field.id}`;
      help.textContent = field.helpText;
      labelContainer.appendChild(help);
    }

    group.appendChild(labelContainer);

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'field-input-wrapper';

    switch (field.type) {
      case 'textarea':
        inputWrapper.appendChild(this.renderTextarea(field));
        break;

      case 'select':
        inputWrapper.appendChild(this.renderSelect(field));
        break;

      case 'radio':
        inputWrapper.appendChild(this.renderRadioGroup(field));
        break;

      case 'checkbox':
        inputWrapper.appendChild(this.renderCheckboxGroup(field));
        break;

      case 'file':
        inputWrapper.appendChild(this.renderFileInput(field));
        break;

      case 'consent':
        inputWrapper.appendChild(this.renderConsentInput(field));
        break;

      default: // text, tel, email, number, date, url
        inputWrapper.appendChild(this.renderStandardInput(field));
        break;
    }

    // Error feedback element
    const errorEl = document.createElement('div');
    errorEl.className = 'field-error-message';
    errorEl.id = `error-${field.id}`;
    errorEl.setAttribute('role', 'alert');
    errorEl.style.display = 'none';
    inputWrapper.appendChild(errorEl);

    group.appendChild(inputWrapper);
    return group;
  }

  renderStandardInput(field) {
    const input = document.createElement('input');
    input.type = field.type || 'text';
    input.id = field.id;
    input.name = field.id;
    input.className = 'form-control';
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.required) input.required = true;
    if (field.maxLength) input.maxLength = field.maxLength;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.step) input.step = field.step;
    if (field.pattern) input.pattern = field.pattern;
    if (field.helpText) input.setAttribute('aria-describedby', `help-${field.id}`);

    return input;
  }

  renderTextarea(field) {
    const textarea = document.createElement('textarea');
    textarea.id = field.id;
    textarea.name = field.id;
    textarea.className = 'form-control textarea-control';
    textarea.rows = field.rows || 5;
    if (field.placeholder) textarea.placeholder = field.placeholder;
    if (field.required) textarea.required = true;
    if (field.maxLength) textarea.maxLength = field.maxLength;
    if (field.helpText) textarea.setAttribute('aria-describedby', `help-${field.id}`);

    return textarea;
  }

  renderSelect(field) {
    const select = document.createElement('select');
    select.id = field.id;
    select.name = field.id;
    select.className = 'form-control select-control';
    if (field.required) select.required = true;
    if (field.helpText) select.setAttribute('aria-describedby', `help-${field.id}`);

    if (field.placeholder) {
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = field.placeholder;
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      select.appendChild(defaultOpt);
    }

    if (field.options) {
      field.options.forEach(optVal => {
        const option = document.createElement('option');
        option.value = optVal;
        option.textContent = optVal;
        select.appendChild(option);
      });
    }

    return select;
  }

  renderRadioGroup(field) {
    const container = document.createElement('div');
    container.className = 'options-group radio-group';

    if (field.options) {
      field.options.forEach((optVal, idx) => {
        const radioItem = document.createElement('label');
        radioItem.className = 'option-label radio-label';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = field.id;
        radio.value = optVal;
        radio.id = `${field.id}_opt_${idx}`;
        if (field.required && idx === 0) radio.required = true;

        radioItem.appendChild(radio);
        radioItem.appendChild(document.createTextNode(` ${optVal}`));
        container.appendChild(radioItem);
      });
    }

    if (field.allowOther) {
      const otherItem = document.createElement('div');
      otherItem.className = 'option-label radio-label allow-other-wrapper';

      const radioOther = document.createElement('input');
      radioOther.type = 'radio';
      radioOther.name = field.id;
      radioOther.value = '__OTHER__';
      radioOther.id = `${field.id}_opt_other`;

      const otherLabelSpan = document.createElement('span');
      otherLabelSpan.textContent = field.otherLabel || 'Other: ';

      const otherInput = document.createElement('input');
      otherInput.type = 'text';
      otherInput.id = `${field.id}_other_input`;
      otherInput.className = 'form-control inline-other-input';
      otherInput.placeholder = 'Please specify';
      otherInput.disabled = true;

      otherItem.appendChild(radioOther);
      otherItem.appendChild(otherLabelSpan);
      otherItem.appendChild(otherInput);
      container.appendChild(otherItem);
    }

    return container;
  }

  renderCheckboxGroup(field) {
    const container = document.createElement('div');
    container.className = 'options-group checkbox-group';

    if (field.options) {
      field.options.forEach((optVal, idx) => {
        const checkItem = document.createElement('label');
        checkItem.className = 'option-label checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = `${field.id}[]`;
        checkbox.value = optVal;
        checkbox.id = `${field.id}_chk_${idx}`;

        checkItem.appendChild(checkbox);
        checkItem.appendChild(document.createTextNode(` ${optVal}`));
        container.appendChild(checkItem);
      });
    }

    if (field.allowOther) {
      const otherItem = document.createElement('div');
      otherItem.className = 'option-label checkbox-label allow-other-wrapper';

      const checkOther = document.createElement('input');
      checkOther.type = 'checkbox';
      checkOther.name = `${field.id}[]`;
      checkOther.value = '__OTHER__';
      checkOther.id = `${field.id}_chk_other`;

      const otherLabelSpan = document.createElement('span');
      otherLabelSpan.textContent = field.otherLabel || 'Other: ';

      const otherInput = document.createElement('input');
      otherInput.type = 'text';
      otherInput.id = `${field.id}_other_input`;
      otherInput.className = 'form-control inline-other-input';
      otherInput.placeholder = 'Please specify';
      otherInput.disabled = true;

      otherItem.appendChild(checkOther);
      otherItem.appendChild(otherLabelSpan);
      otherItem.appendChild(otherInput);
      container.appendChild(otherItem);
    }

    return container;
  }

  renderFileInput(field) {
    const container = document.createElement('div');
    container.className = 'file-dropzone-wrapper';

    const input = document.createElement('input');
    input.type = 'file';
    input.id = field.id;
    input.name = field.id;
    input.className = 'file-control-hidden';
    if (field.accept) input.accept = field.accept.join(',');
    if (field.required) input.required = true;

    const dropzone = document.createElement('label');
    dropzone.htmlFor = field.id;
    dropzone.className = 'file-dropzone';
    dropzone.id = `dropzone-${field.id}`;
    dropzone.innerHTML = `
      <div class="dropzone-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
      </div>
      <div class="dropzone-text">
        <span class="dropzone-prompt"><strong>Click to upload</strong> or drag and drop resume</span>
        <span class="dropzone-hint">${field.accept ? field.accept.join(', ').toUpperCase() : 'PDF, DOC, DOCX'} (Max ${field.maxSizeMb || 7} MB)</span>
      </div>
    `;

    const filePreview = document.createElement('div');
    filePreview.className = 'file-preview-card';
    filePreview.id = `file-preview-${field.id}`;
    filePreview.style.display = 'none';
    filePreview.innerHTML = `
      <div class="file-info-wrapper">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        <div class="file-text-details">
          <span class="file-name-text"></span>
          <span class="file-size-badge"></span>
        </div>
      </div>
      <button type="button" class="btn-remove-file" title="Remove file">&times;</button>
    `;

    container.appendChild(input);
    container.appendChild(dropzone);
    container.appendChild(filePreview);

    return container;
  }

  renderConsentInput(field) {
    const container = document.createElement('label');
    container.className = 'option-label consent-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = field.id;
    checkbox.name = field.id;
    if (field.required) checkbox.required = true;

    container.appendChild(checkbox);
    container.appendChild(document.createTextNode(` ${field.label}`));

    return container;
  }

  attachEventListeners(formEl) {
    // Handle inline "Other" input enable/disable toggles
    formEl.addEventListener('change', (e) => {
      const target = e.target;
      if (target.type === 'radio') {
        const radios = formEl.querySelectorAll(`input[name="${target.name}"]`);
        radios.forEach(r => {
          if (r.value === '__OTHER__') {
            const otherInput = formEl.querySelector(`#${target.name}_other_input`);
            if (otherInput) {
              otherInput.disabled = !r.checked;
              if (r.checked) otherInput.focus();
            }
          }
        });
      } else if (target.type === 'checkbox' && target.value === '__OTHER__') {
        const fieldId = target.name.replace('[]', '');
        const otherInput = formEl.querySelector(`#${fieldId}_other_input`);
        if (otherInput) {
          otherInput.disabled = !target.checked;
          if (target.checked) otherInput.focus();
        }
      } else if (target.type === 'file') {
        this.updateFilePreview(formEl, target);
      }
    });

    // File Drag & Drop handlers
    formEl.querySelectorAll('.file-dropzone').forEach(dropzone => {
      const inputId = dropzone.getAttribute('for');
      const fileInput = formEl.querySelector(`#${inputId}`);

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('is-dragover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragover');
        }, false);
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0 && fileInput) {
          fileInput.files = dt.files;
          this.updateFilePreview(formEl, fileInput);
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    // File Remove buttons
    formEl.querySelectorAll('.btn-remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const previewCard = btn.closest('.file-preview-card');
        const container = btn.closest('.file-dropzone-wrapper');
        if (container && previewCard) {
          const fileInput = container.querySelector('input[type="file"]');
          const dropzone = container.querySelector('.file-dropzone');
          if (fileInput) fileInput.value = '';
          previewCard.style.display = 'none';
          if (dropzone) dropzone.style.display = 'flex';
        }
      });
    });
  }

  updateFilePreview(formEl, fileInput) {
    const container = fileInput.closest('.file-dropzone-wrapper');
    if (!container) return;

    const dropzone = container.querySelector('.file-dropzone');
    const previewCard = container.querySelector('.file-preview-card');
    const nameEl = previewCard?.querySelector('.file-name-text');
    const sizeEl = previewCard?.querySelector('.file-size-badge');

    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${sizeMb} MB`;
      if (dropzone) dropzone.style.display = 'none';
      if (previewCard) previewCard.style.display = 'flex';
    } else {
      if (previewCard) previewCard.style.display = 'none';
      if (dropzone) dropzone.style.display = 'flex';
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
