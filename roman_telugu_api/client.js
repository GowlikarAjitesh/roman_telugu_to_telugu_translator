/** Translate Roman Telugu text through the hosted API from a browser-based editor. */
export async function translateRomanTelugu(text, apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || `Translation request failed (${response.status})`);
  }
  return result.translation;
}

// Example:
// const translated = await translateRomanTelugu(editor.getValue(), "https://YOUR-SPACE.hf.space");
// editor.replaceSelection(translated);
