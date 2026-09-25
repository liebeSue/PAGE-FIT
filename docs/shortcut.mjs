const dialog = document.querySelector('#shortcut-dialog');
const install = document.querySelector('#install-app');
const status = document.querySelector('#install-status');
let promptEvent = null;
document.querySelector('#shortcut-open').addEventListener('click', () => dialog.showModal());
document.querySelector('#shortcut-close').addEventListener('click', () => dialog.close());
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  promptEvent = event;
  install.hidden = false;
});
install.addEventListener('click', async () => {
  if (!promptEvent) return;
  const current = promptEvent;
  promptEvent = null;
  install.hidden = true;
  try {
    await current.prompt();
    const choice = await current.userChoice;
    status.textContent = choice.outcome === 'accepted' ? 'Follow your browser’s installation steps to finish.' : 'You can still use the shortcut steps below.';
  } catch {
    status.textContent = 'Use the shortcut steps below to add Page Fit.';
  }
});
window.addEventListener('appinstalled', () => {
  promptEvent = null;
  install.hidden = true;
  status.textContent = 'Page Fit has been installed.';
});
