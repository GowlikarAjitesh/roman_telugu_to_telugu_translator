const DEFAULT_API_URL = window.AKSHARA_API_URL || window.location.origin;
const STORAGE_KEY = "akshara-translation-api-url";
const EXAMPLE_TEXT = "nenu intiki vellanu.";

const sourceText = document.querySelector("#sourceText");
const sourceCount = document.querySelector("#sourceCount");
const output = document.querySelector("#translationOutput");
const resultMeta = document.querySelector("#resultMeta");
const translateButton = document.querySelector("#translateButton");
const copyButton = document.querySelector("#copyButton");
const apiUrlInput = document.querySelector("#apiUrl");
const statusMessage = document.querySelector("#statusMessage");
const statusText = document.querySelector("#statusText");
const toast = document.querySelector("#toast");

let toastTimer;

apiUrlInput.value = localStorage.getItem(STORAGE_KEY) || DEFAULT_API_URL;

function getApiBaseUrl() {
  const value = apiUrlInput.value.trim().replace(/\/+$/, "");
  if (!value) throw new Error("Add your translation API URL in Connection settings.");

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a valid API URL, including https:// or http://.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("The API URL must start with http:// or https://.");
  }
  return value;
}

function setStatus(message, kind = "idle") {
  statusText.textContent = message;
  statusMessage.dataset.kind = kind;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function updateCount() {
  const text = sourceText.value;
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  sourceCount.innerHTML = `${words} ${words === 1 ? "word" : "words"} <span class="count-divider">·</span> ${text.length.toLocaleString()} / 4,000`;
}

async function requestJson(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof payload.detail === "string" ? payload.detail : `Request failed (${response.status})`;
      throw new Error(detail);
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The request timed out. The free API may be waking up—please try again.");
    if (error instanceof TypeError) {
      throw new Error("Could not reach the API. Check the URL, API status, and its CORS settings.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function translate() {
  const text = sourceText.value.trim();
  if (!text) {
    sourceText.focus();
    setStatus("Type or paste Roman Telugu first.", "error");
    return;
  }
  if (text.length > 4000) {
    setStatus("Text is too long. The limit is 4,000 characters.", "error");
    return;
  }

  let baseUrl;
  try {
    baseUrl = getApiBaseUrl();
  } catch (error) {
    document.querySelector(".connection-settings").open = true;
    setStatus(error.message, "error");
    return;
  }

  localStorage.setItem(STORAGE_KEY, baseUrl);
  translateButton.disabled = true;
  translateButton.classList.add("is-loading");
  translateButton.querySelector(".button-label").textContent = "Translating";
  setStatus("Sending your text to the translator…", "loading");
  resultMeta.textContent = "Working on your translation";

  try {
    const result = await requestJson(`${baseUrl}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (typeof result.translation !== "string") throw new Error("The API returned an unexpected response.");

    output.textContent = result.translation || "No translation was generated for this text.";
    copyButton.disabled = !result.translation;
    const words = result.translation.trim() ? result.translation.trim().split(/\s+/u).length : 0;
    resultMeta.textContent = `${words} ${words === 1 ? "word" : "words"} · translated just now`;
    setStatus("Translation complete.", "success");
  } catch (error) {
    setStatus(error.message || "Translation failed. Please try again.", "error");
    resultMeta.textContent = "Translation unavailable";
  } finally {
    translateButton.disabled = false;
    translateButton.classList.remove("is-loading");
    translateButton.querySelector(".button-label").textContent = "Translate to Telugu";
  }
}

async function checkConnection() {
  let baseUrl;
  try {
    baseUrl = getApiBaseUrl();
  } catch (error) {
    document.querySelector(".connection-settings").open = true;
    setStatus(error.message, "error");
    return;
  }

  const button = document.querySelector("#checkApiButton");
  button.disabled = true;
  button.textContent = "Checking…";
  try {
    const result = await requestJson(`${baseUrl}/health`, {}, 15_000);
    localStorage.setItem(STORAGE_KEY, baseUrl);
    setStatus(`Connected · ${result.device || "translator ready"}`, "success");
    showToast("Translator connection is ready");
  } catch (error) {
    setStatus(error.message || "Could not connect to the translator.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Check connection";
  }
}

document.querySelector("#translateButton").addEventListener("click", translate);
document.querySelector("#checkApiButton").addEventListener("click", checkConnection);
sourceText.addEventListener("input", updateCount);
sourceText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    translate();
  }
});

document.querySelector("#clearButton").addEventListener("click", () => {
  sourceText.value = "";
  output.innerHTML = '<span class="output-placeholder">Your translation will appear here<span class="placeholder-cursor"></span></span>';
  resultMeta.textContent = "Ready when you are";
  copyButton.disabled = true;
  updateCount();
  setStatus("Enter some Roman Telugu to begin.");
  sourceText.focus();
});

document.querySelector("#sampleButton").addEventListener("click", () => {
  sourceText.value = EXAMPLE_TEXT;
  updateCount();
  sourceText.focus();
  setStatus("Example loaded. Press Translate when ready.");
});

copyButton.addEventListener("click", async () => {
  const text = output.textContent.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Telugu translation copied");
  } catch {
    setStatus("Clipboard access was blocked by the browser.", "error");
  }
});

apiUrlInput.addEventListener("change", () => {
  try {
    const baseUrl = getApiBaseUrl();
    apiUrlInput.value = baseUrl;
    localStorage.setItem(STORAGE_KEY, baseUrl);
  } catch {
    // Show input validation feedback when the user tries to translate or test connection.
  }
});

updateCount();
