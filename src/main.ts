const app = document.querySelector<HTMLDivElement>('#app');

if (app === null) {
  throw new Error('Application mount point is missing.');
}

app.innerHTML = `
  <h1>Sailing Training Sloop</h1>
  <p>Prototype foundation. Chromium is the development-only baseline.</p>
`;
