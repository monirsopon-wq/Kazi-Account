# GitHub Pages PWA Package

Upload ALL files to the repository root:

- index.html
- sw.js
- dynamic-manifest.json
- icon-192.png
- icon-512.png

Then:
GitHub -> Repository -> Settings -> Pages
Source: Deploy from a branch
Branch: main
Folder: / (root)

Important:
1. Open the GitHub Pages HTTPS URL.
2. Log in to the app.
3. Open Company Info.
4. Enter Company Name and upload Company Logo.
5. Press Save.
6. Wait a few seconds, refresh once if Chrome has already cached the old manifest.
7. Install the app again if an older version was already installed.

The app now sends the saved company name/logo to the service worker. The service worker creates 192px and 512px PNG install icons and serves a manifest using that company name.
