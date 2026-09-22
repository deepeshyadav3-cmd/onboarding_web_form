/**
 * API Client Module
 * Handles POST requests to Google Apps Script Web App without CORS preflight
 */

export async function submitFormPayload(endpointUrl, payload, options = {}) {
  const timeoutMs = options.submitTimeoutMs || 60000;
  const maxRetries = options.retryAttempts !== undefined ? options.retryAttempts : 2;

  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Using text/plain;charset=utf-8 ensures simple POST request -> NO CORS PREFLIGHT
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (err) {
      lastError = err;
      attempt++;

      if (err.name === 'AbortError') {
        throw new Error('Submission timed out. Your attachment or connection may be slow — please try again.');
      }

      // Don't retry on client validation or non-retriable errors
      if (attempt > maxRetries) {
        break;
      }

      // Exponential backoff delay: 1000ms, 2000ms...
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError || new Error('Network error preventing form submission');
}
