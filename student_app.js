document.addEventListener('DOMContentLoaded', () => {
  if (!window.AudiFiApp) return;
  window.AudiFiApp.setupLoginPage();
  void window.AudiFiApp.setupStudentDiscoveryPortal();
  void window.AudiFiApp.setupAvailableHallsPage();
});
