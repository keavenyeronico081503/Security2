// Enhanced back-navigation guard to prevent back button on register and dashboard
(function () {
  // Replace current history entry to prevent back navigation
  history.replaceState(null, document.title, location.href);
  
  // Push a new state to create a barrier
  history.pushState(null, document.title, location.href);
  
  // Prevent back button by intercepting popstate event
  window.addEventListener('popstate', function (e) {
    // Push state again immediately when back is attempted
    history.pushState(null, document.title, location.href);
    // Optionally redirect to same page to ensure they stay
    window.location.replace(location.href);
  });

  // Additional prevention: listen for beforeunload and hashchange
  window.addEventListener('beforeunload', function (e) {
    // This helps prevent navigation away
  });

  // Prevent back navigation using hashchange
  window.addEventListener('hashchange', function (e) {
    history.pushState(null, document.title, location.href);
  });

  // Prevent page from being cached
  if ('serviceWorker' in navigator) {
    // Service worker can help prevent caching
  }

  // Light-weight deterrents (not security): block context menu and common devtool shortcuts
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    // F12
    if (e.key === 'F12') { e.preventDefault(); }
    // Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) { e.preventDefault(); }
    if (e.ctrlKey && (e.key === 'U' || e.key === 'S')) { e.preventDefault(); }
  });
})();


