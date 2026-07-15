// Global toast helper + AJAX "Add to Cart" behavior used across pages.

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'success');
  toast.textContent = message;
  toast.setAttribute('data-testid', 'toast');
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[action="/cart/add"]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      // Send as application/x-www-form-urlencoded (via URLSearchParams) to
      // match what the server's body parser understands. Sending the raw
      // FormData object here would make fetch encode it as
      // multipart/form-data instead, which express.urlencoded() cannot
      // parse - req.body would come back empty.
      const params = new URLSearchParams();
      for (const [key, value] of formData.entries()) {
        params.append(key, value);
      }
      try {
        const res = await fetch('/cart/add', { method: 'POST', body: params });
        if (res.ok || res.redirected) {
          const badge = document.querySelector('[data-testid="cart-count"]');
          if (badge) {
            badge.textContent = String(Number(badge.textContent || '0') + Number(formData.get('quantity') || 1));
          }
          showToast('Added to cart', 'success');
        } else {
          showToast('Could not add item to cart', 'error');
        }
      } catch (err) {
        showToast('Network error adding to cart', 'error');
      }
    });
  });
});
