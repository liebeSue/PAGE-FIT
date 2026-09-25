const dialog = document.querySelector('#shortcut-dialog');
const install = document.querySelector('#install-app');
const status = document.querySelector('#install-status');
let promptEvent = null;
document.querySelector('#shortcut-open').addEventListener('click', () => {
  if (promptEvent) requestInstall();
  else dialog.showModal();
});
document.querySelector('#shortcut-close').addEventListener('click', () => dialog.close());
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  promptEvent = event;
  install.hidden = false;
});
async function requestInstall() {
  if (!promptEvent) return;
  const current = promptEvent;
  promptEvent = null;
  install.hidden = true;
  try {
    await current.prompt();
    const choice = await current.userChoice;
    if (!dialog.open) dialog.showModal();
    status.textContent = choice.outcome === 'accepted' ? 'Follow your browser’s installation steps to finish.' : 'You can add Page Fit later using this button.';
  } catch {
    if (!dialog.open) dialog.showModal();
    status.textContent = 'Use your browser’s install menu to add Page Fit.';
  }
}
install.addEventListener('click', requestInstall);
window.addEventListener('appinstalled', () => {
  promptEvent = null;
  install.hidden = true;
  status.textContent = 'Page Fit has been installed.';
});
