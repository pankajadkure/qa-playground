// Live client-side "quick filter" on the product grid.
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('live-search');
  const cards = Array.from(document.querySelectorAll('[data-testid="product-card"]'));
  if (!input || cards.length === 0) return;

  input.addEventListener('input', () => {
    const query = input.value;
    // BUG UI-5: this is a plain case-sensitive substring match. Typing
    // "mouse" will not match "Wireless Mouse" because of the capital W...
    // actually because the product name itself is title-cased ("Wireless
    // Mouse") a lowercase query like "wireless" will fail to match too.
    cards.forEach((card) => {
      const name = card.getAttribute('data-product-name') || '';
      const matches = query === '' || name.includes(query);
      card.style.display = matches ? '' : 'none';
    });
  });
});
