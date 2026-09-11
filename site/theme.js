(() => {
  let theme = 'dark';
  try { if (localStorage.getItem('graveyard-theme') === 'light') theme = 'light'; } catch { /* Storage can be disabled. */ }
  document.documentElement.dataset.theme = theme;
})();
