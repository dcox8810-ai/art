# Studio Log

Portrait painting habit and progress tracker.

## Deploy On GitHub Pages

This is a static app: HTML, CSS, JavaScript, manifest, icon, and service worker.

1. Create a new public GitHub repository.
2. Upload every file in this folder to the repository root.
3. In the repository, open Settings > Pages.
4. Under Build and deployment, choose Deploy from a branch.
5. Select the main branch and root folder.
6. Save, then open the Pages URL GitHub gives you.

On iPhone, open the Pages URL in Safari and choose Share > Add to Home Screen.

## Data And Backups

Data is stored in the browser on each device, so data entered on localhost will not automatically move to the hosted GitHub Pages URL.

Use Projects > Backup > Export backup to download a JSON copy of the current artworks, time logs, metadata, ratings, and stored images. Import backup has two modes:

- Add new only: imports artworks whose IDs are not already on this device.
- Add new and update matches: adds new artworks and replaces matching IDs with the imported version.

Imports never delete existing local artworks that are missing from the backup file.

Saved overlay positions are stored with each artwork and included in backup exports.
