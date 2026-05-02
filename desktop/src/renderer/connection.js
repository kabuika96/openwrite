const form = document.querySelector("#connect-form");
const input = document.querySelector("#server-url");
const status = document.querySelector("#status");
const button = form.querySelector("button");

window.openwriteDesktop.getSavedServer().then(({ serverUrl }) => {
  if (serverUrl) input.value = serverUrl;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  button.disabled = true;

  const result = await window.openwriteDesktop.connect(input.value);
  if (!result.ok) {
    status.textContent = result.reason;
    button.disabled = false;
  }
});
