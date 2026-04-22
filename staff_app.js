document.addEventListener('DOMContentLoaded', () => {
  if (!window.AudiFiApp) return;
  window.AudiFiApp.setupLecturerLoginPage();
  void window.AudiFiApp.setupStaffPortal();
  void window.AudiFiApp.setupTimetableUploadPage();
  void window.AudiFiApp.setupTimetableCalendarPage();
});
