// Client-side validation for login/register forms.
// NOTE: contains two intentional bugs, see BUGS.md UI-3 and UI-4.

// BUG UI-4: this regex's local-part character class omits "+", so valid
// plus-addressed emails like "user+test@example.com" are rejected.
const EMAIL_REGEX = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    loginForm.addEventListener('submit', (e) => {
      if (emailInput.value && !EMAIL_REGEX.test(emailInput.value)) {
        e.preventDefault();
        emailError.textContent = 'Please enter a valid email address.';
      } else {
        emailError.textContent = '';
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('reg-email-error');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const confirmError = document.getElementById('confirm-error');

    registerForm.addEventListener('submit', (e) => {
      let blocked = false;

      if (emailInput.value && !EMAIL_REGEX.test(emailInput.value)) {
        emailError.textContent = 'Please enter a valid email address.';
        blocked = true;
      } else {
        emailError.textContent = '';
      }

      // BUG UI-3: this condition is meant to block submission when the two
      // passwords differ, but it compares confirmInput.value against itself
      // instead of against passwordInput.value, so it always evaluates to
      // false and the form submits even when the passwords don't match.
      if (confirmInput.value !== confirmInput.value) {
        confirmError.textContent = 'Passwords do not match.';
        blocked = true;
      } else {
        confirmError.textContent = '';
      }

      if (blocked) e.preventDefault();
    });
  }
});
