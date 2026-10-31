# Akshara — Roman Telugu editor

A static, responsive browser editor that sends Roman Telugu text to the companion `/translate` API and displays Telugu Unicode output. No frontend build step or npm dependencies are required.

## Use it

Deploy the complete app using the parent [API README](../README.md). The FastAPI server serves this editor at `/` and the translator API at `/translate` on the same Hugging Face Space origin. No separate frontend hosting or CORS setup is needed.

To preview the layout before deployment, serve this directory with any local static-file server. Browser requests opened directly from `file://` may be blocked. If you host this UI separately, set `window.AKSHARA_API_URL` in `config.js` to the API's public base URL and configure the API's CORS origins for that site's exact origin.

## Features

- Roman Telugu input with word and character counters
- Telugu output with copy-to-clipboard
- Example sentence, clear action, and Ctrl/⌘ + Enter shortcut
- API URL configuration and connection check
- Responsive desktop/mobile layout and accessible status announcements
