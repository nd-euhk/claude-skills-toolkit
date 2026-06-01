// EmailInput component stub — T-004
// Client-side email input with validation and error display

export function createEmailInput(container) {
  // Stub: returns a basic email input element
  const wrapper = document.createElement('div');
  wrapper.className = 'email-input-wrapper';
  wrapper.innerHTML = `
    <label for="email">Email</label>
    <input type="text" id="email" name="email" placeholder="Enter your email" />
    <span class="error-message" style="display:none"></span>
  `;
  container.appendChild(wrapper);
  return wrapper;
}

export function validateEmailInput(value) {
  // Stub: always returns true
  return true;
}

export function showError(element, message) {
  // Stub: no-op
}

export function hideError(element) {
  // Stub: no-op
}
