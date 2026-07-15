document.addEventListener('DOMContentLoaded', () => {
  const productOverlay = document.getElementById('product-modal-overlay');
  const deleteOverlay = document.getElementById('delete-modal-overlay');
  const productForm = document.getElementById('product-form');
  const deleteForm = document.getElementById('delete-form');
  const modalTitle = document.getElementById('product-modal-title');

  function openAddModal() {
    modalTitle.textContent = 'Add Product';
    productForm.reset();
    productForm.action = '/admin/products';
    productOverlay.hidden = false;
  }

  function openEditModal(btn) {
    modalTitle.textContent = 'Edit Product';
    productForm.action = '/admin/products/' + btn.dataset.id;
    document.getElementById('pf-sku').value = btn.dataset.sku;
    document.getElementById('pf-name').value = btn.dataset.name;
    document.getElementById('pf-category').value = btn.dataset.category;
    document.getElementById('pf-price').value = btn.dataset.price;
    document.getElementById('pf-stock').value = btn.dataset.stock;
    document.getElementById('pf-description').value = btn.dataset.description;
    document.getElementById('pf-emoji').value = btn.dataset.emoji;
    productOverlay.hidden = false;
  }

  function closeProductModal() {
    productOverlay.hidden = true;
  }

  document.getElementById('open-add-modal').addEventListener('click', openAddModal);
  document.getElementById('cancel-product-modal').addEventListener('click', closeProductModal);
  document.querySelectorAll('.edit-product-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn));
  });

  // Product add/edit modal correctly closes when clicking the dark overlay.
  productOverlay.addEventListener('click', (e) => {
    if (e.target === productOverlay) closeProductModal();
  });

  document.querySelectorAll('.delete-product-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('delete-product-name').textContent = btn.dataset.name;
      deleteForm.action = '/admin/products/' + btn.dataset.id + '/delete';
      deleteOverlay.hidden = false;
    });
  });

  document.getElementById('cancel-delete-modal').addEventListener('click', () => {
    deleteOverlay.hidden = true;
  });

  // BUG UI-7: unlike the product modal above, this overlay has no click
  // listener that closes it when the dark backdrop (rather than the modal
  // itself) is clicked. Users must use the Cancel button explicitly - an
  // inconsistency with the add/edit modal's behavior.
});
