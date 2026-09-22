/**
 * Validator Module for Dynamic Form Fields
 */

export function validateField(field, value, files, formValues = {}) {
  const isValueEmpty = (val) => val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0);

  // 1. Required check
  if (field.required) {
    if (field.type === 'file') {
      if (!files || !files[field.id]) {
        return `${field.label} is required`;
      }
    } else if (field.type === 'consent') {
      if (!value) {
        return `You must consent to proceed`;
      }
    } else if (isValueEmpty(value)) {
      return `${field.label} is required`;
    }
  }

  if (isValueEmpty(value) && field.type !== 'file') {
    return null; // Empty optional field is valid
  }

  // 2. Email format
  if (field.type === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
  }

  // 3. Tel / Pattern check
  if (field.pattern && value) {
    const regex = new RegExp(field.pattern);
    if (!regex.test(value)) {
      return field.patternError || 'Invalid format';
    }
  }

  // 4. Length checks
  if (typeof value === 'string') {
    if (field.maxLength && value.length > field.maxLength) {
      return `Maximum length is ${field.maxLength} characters`;
    }
    if (field.minLength && value.length < field.minLength) {
      return `Minimum length is ${field.minLength} characters`;
    }
  }

  // 5. Number checks
  if (field.type === 'number' && value !== '' && value !== null) {
    const num = Number(value);
    if (isNaN(num)) {
      return 'Must be a valid number';
    }
    if (field.min !== undefined && num < field.min) {
      return `Minimum allowed value is ${field.min}`;
    }
    if (field.max !== undefined && num > field.max) {
      return `Maximum allowed value is ${field.max}`;
    }
  }

  // 6. Select "Choose" placeholder check
  if (field.type === 'select' && field.placeholder && value === field.placeholder) {
    if (field.required) {
      return `Please select a valid option for ${field.label}`;
    }
  }

  // 7. File validation
  if (field.type === 'file' && files && files[field.id]) {
    const file = files[field.id];
    if (field.maxSizeMb && file.size > field.maxSizeMb * 1024 * 1024) {
      return `File size exceeds maximum allowed ${field.maxSizeMb} MB`;
    }
    if (field.accept && field.accept.length > 0) {
      const fileName = file.name.toLowerCase();
      const matchedExt = field.accept.some(ext => fileName.endsWith(ext.toLowerCase()));
      if (!matchedExt) {
        return `Allowed file types: ${field.accept.join(', ')}`;
      }
    }
  }

  return null;
}

export function validateForm(schema, formValues, filesMap) {
  const errors = {};
  let isValid = true;

  if (!schema || !schema.sections) return { isValid, errors };

  schema.sections.forEach(section => {
    if (section.fields) {
      section.fields.forEach(field => {
        const val = formValues[field.id];
        const err = validateField(field, val, filesMap, formValues);
        if (err) {
          errors[field.id] = err;
          isValid = false;
        }
      });
    }
  });

  return { isValid, errors };
}
