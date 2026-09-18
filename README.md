# Page Fit

Make every page of a PDF the same size, locally in your browser.

## Publish on GitHub Pages

1. Unzip this package. Upload the contents of `page-fit-github`, not the ZIP itself, into a GitHub repository. The repository should contain `README.md` and a `docs` folder directly at its top level.
2. Keep every file inside `docs`, including all the `vendor` subfolders. No build, API key, server, or npm installation is needed.
3. In the repository, open **Settings → Pages**.
4. Choose **Deploy from a branch**, then **main**, then **/docs**, and click **Save**. If your branch has another name, select that branch instead.
5. Wait for GitHub to finish publishing. Open the address shown in Pages settings. A typical address is `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
6. Try a non-sensitive sample PDF first. Check the downloaded pages, fields, and orientation.

GitHub Free supports Pages from public repositories. Other plans may support private repositories; a private code repository does not necessarily make the website private.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

### Getting the files into GitHub

If using GitHub's web upload, preserve the folder structure and upload in batches if its file-count limit is reached. The bundled character-map folder contains many files. Do not skip them. Uploading the ZIP alone will not publish the app.

Alternatively, use GitHub Desktop: create an empty local repository, copy this package's contents into its folder, commit the files, then publish the repository. Keep company PDFs outside the repository.

For users with Git installed, create an empty repository on GitHub, open Terminal in this extracted folder, and run the following after replacing the placeholder URL:

```sh
git init -b main
git add .
git commit -m "Add Page Fit PDF tool"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Authenticate using GitHub's normal sign-in mechanism. Do not put tokens in source files or remote URLs.

## What is included

- `docs/index.html`, `styles.css`, `app.mjs`: interface and browser controls.
- `docs/pdf-core.mjs`, `pdf-worker.mjs`: vector-preserving PDF resizing.
- `docs/visual-copy.mjs`: rendered copies for forms and annotations.
- `docs/vendor/`: PDF.js, pdf-lib, fonts, character maps, WebAssembly assets and third-party licenses, all served from your own site.
- `docs/.nojekyll`: tells GitHub Pages to serve the static files directly.

All application source is included. There are no credentials, company PDFs, original Git history, or ChatGPT hosting configuration in this package. No backend is required. The original hosted Page Fit is unaffected by this export.

## Privacy and conversion behavior

File selection reads the PDF into browser memory. Application code does not upload document bytes or passwords, use analytics, or save document history in browser storage. Downloading explicitly saves the output through the browser. The original is never overwritten by the app. Clearing the session releases its references, not a guaranteed secure memory wipe. GitHub receives normal website/asset requests; browser extensions, device policies, and download synchronization remain outside the app's control. This is not a security certification or company approval.

Ordinary PDFs preserve text and vector graphics. Visual-copy mode captures rendered pages as high-quality JPEG images at up to 300 dpi, with lower resolution for very large pages. It preserves visible form appearances but loses selectable text, editable fields, password protection, and digital-signature validity. Links, bookmarks, attachments, accessibility tags, and popup comment text are not carried over. Review output before use.

Limits: one PDF at a time, 100 MB input, 1,000 pages, 200-inch target dimensions, and 180 MB of encoded output images. Dynamic XFA, damaged PDFs, and printing restrictions may prevent conversion. Recent browsers with module-worker support are required. Open via HTTPS or a local HTTP server; double-clicking index.html is not supported.

## Maintenance

Edit the files in `docs` and commit/push to publish updates. Asset paths are relative, so project-style GitHub Pages URLs work. Keep vendor license files and font licenses with the bundled assets. No open-source license is assigned to the custom application code by this export; third-party code retains its included licenses.

The source version passed automated checks for dimensions, crop origins, UserUnit, blank pages, filled forms and four rotations. The GitHub-hosted deployment and interactive browser flow still need checking after publication.
