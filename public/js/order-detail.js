document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('cancel-order-modal-overlay');
  const openBtn = document.getElementById('open-cancel-order-modal');
  const cancelBtn = document.getElementById('cancel-cancel-order-modal');

  if (!overlay || !openBtn) return;

  openBtn.addEventListener('click', () => {
    overlay.hidden = false;
  });

  cancelBtn.addEventListener('click', () => {
    overlay.hidden = true;
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
});
