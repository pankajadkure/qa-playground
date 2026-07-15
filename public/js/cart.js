// Live-updates line totals and the cart "Total" as quantity inputs change,
// without a full page reload.
document.addEventListener('DOMContentLoaded', () => {
  const rows = Array.from(document.querySelectorAll('[data-testid="cart-row"]'));
  const liveTotalEl = document.getElementById('cart-live-total');
  if (rows.length === 0 || !liveTotalEl) return;

  function recalc() {
    let total = 0;
    rows.forEach((row) => {
      const price = parseFloat(row.getAttribute('data-price'));
      const qtyInput = row.querySelector('.qty-input');
      const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      const lineTotal = price * qty;
      row.querySelector('[data-testid="cart-line-total"]').textContent = '$' + lineTotal.toFixed(2);
      total += lineTotal;
    });
    // BUG UI-8 / DB-2: this live total only ever sums line items - it never
    // adds the shipping fee that the checkout page and the database's
    // orders.total column include. Compare this figure to the final total
    // after placing an order.
    liveTotalEl.textContent = '$' + total.toFixed(2);
  }

  rows.forEach((row) => {
    const qtyInput = row.querySelector('.qty-input');
    qtyInput.addEventListener('input', recalc);
  });
});
