// In public/js/connections.js
document.querySelectorAll('.ajax-form').forEach(form => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      const requestItem = form.closest('.request-item');
      requestItem.style.opacity = '0';
      setTimeout(() => requestItem.remove(), 300);
      // Update badge count
      updateNotificationBadge();
    }
  });
});