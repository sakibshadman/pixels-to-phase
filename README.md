# Pixels-to-Phase project page

Project page for **Pixels-to-Phase: Reliability-Aware Latent State-Space Modeling for Contactless Respiratory Estimation** (WACV 2027).

It is a plain static site (HTML, CSS and a little JavaScript) with no build step, so GitHub Pages can serve it as it is.

## Publish it on GitHub Pages

1. On GitHub, create a new **public** repository named `pixels-to-phase` (no README, no license).
2. Upload everything in this folder to the repository:
   - **In the browser:** open the new repository, choose *uploading an existing file*, drag in all files and folders from this folder, and commit.
   - **With git:**
     ```bash
     cd pixels-to-phase
     git init -b main
     git add .
     git commit -m "Add Pixels-to-Phase project page"
     git remote add origin https://github.com/sakibshadman/pixels-to-phase.git
     git push -u origin main
     ```
3. In the repository, open **Settings → Pages**. Under *Build and deployment*, set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and save.
4. After a minute or two the page is live at **https://sakibshadman.github.io/pixels-to-phase/**.

If you use a different repository name, update the two `og:` URLs near the top of `index.html` so link previews show the right image.

## Before you share the link

These items are placeholders and are marked in `index.html` with `TODO` comments:

- [ ] **Authors.** Replace the two red "Co-author Name" placeholders in the hero, and check the affiliation numbers.
- [ ] **BibTeX.** Replace `and others` in the citation block with the full author list. Update it again with pages and DOI once the proceedings are out.
- [ ] **Paper and supplementary PDFs.** The PDFs used to build this page still show the review header and line numbers. When you have the final camera-ready PDFs, put them in `static/pdfs/` and set `paper` and `supplementary` in `static/js/config.js`.

## Release code, data and other links later

All release links live in one file, `static/js/config.js`. Every button whose link is `null` shows as *soon*. Paste a URL and push, and the button switches on:

```js
window.P2P_LINKS = {
  paper: "static/pdfs/pixels_to_phase_wacv2027.pdf",
  supplementary: "static/pdfs/pixels_to_phase_wacv2027_supp.pdf",
  arxiv: "https://arxiv.org/abs/XXXX.XXXXX",
  code: "https://github.com/sakibshadman/pixels-to-phase-code",
  dataset: "https://…",          // also flips the dataset badge to "Available"
  datacard: "https://…",
  datasetRequest: "https://…",   // a request form works best
  poster: null
};
```

To change what the dataset section says (for example the access terms or a new version number), edit the `#dataset` section in `index.html`.

## What is in the folder

```
index.html                  the page
static/css/site.css         styles (light and dark themes)
static/js/config.js         release links (edit this one)
static/js/site.js           the live update-rule demo, method explorer, charts, tables
static/images/              figures from the paper and supplementary, poster frame, social preview
static/videos/              the explainer video (MP4, H.264, about 12 MB)
static/fonts/               Latin Modern Roman and Sans (WOFF2)
static/katex/               KaTeX for the equations
```

To replace the video, overwrite `static/videos/pixels_to_phase_explainer.mp4` and, if the first frame changes, `static/images/poster.jpg`.

## Credits and licenses

- Latin Modern fonts: GUST e-foundry, GUST Font License.
- KaTeX: MIT License (see `static/katex/LICENSE`).
- Figures, tables and text are from the Pixels-to-Phase paper and supplementary material.
- The live simulation at the top of the page is a toy illustration of the update rule (Eq. 17). It is not output of the trained model.
