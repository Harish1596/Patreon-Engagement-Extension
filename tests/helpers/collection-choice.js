const { expect } = require('@playwright/test');
// Lifecycle specs use native keyboard selection; menu specs separately exercise
// pointer selection, arrow keys and the measured iframe's actual geometry.
async function startCollectionDownload(frame, name, options) {
  const single = name.startsWith('Single ');
  const format = name.replace(/^Single /, '');
  for (const [group, value] of [['Format', format], ['Packaging', single ? 'Single file' : 'Separate files (ZIP)']]) {
    const radio = frame.getByRole('group', { name: group, exact: true }).getByRole('radio', { name: value, exact: true });
    await expect(radio).toBeEnabled();
    await expect(radio).not.toHaveAttribute('aria-disabled', 'true');
    await radio.press('Space');
    await expect(radio).toBeChecked();
  }
  await frame.locator('#download-collection').click(options);
}
module.exports = { startCollectionDownload };
