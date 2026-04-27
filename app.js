const STORAGE_KEY = "portrait-practice-tracker-v1";
const UI_PREFS_KEY = "portrait-practice-ui-v1";
const DEFAULT_STAGES = ["Reference", "Block-in", "30 mins", "Final artwork"];
const DEFAULT_OVERLAY = { x: 0, y: 0, width: 280, height: 350, rotate: 0, opacity: 85 };
const DEFAULT_TRACE_COLOR = "#ffffff";

const state = {
  artworks: [],
  uploadStages: [],
  draftSessions: [],
  editingId: null,
  stageFilterTouched: false,
  reviewItems: [],
  reviewIndex: 0,
  reviewZoom: { scale: 1, x: 0, y: 0 },
  overlayHistory: [],
  traceColor: DEFAULT_TRACE_COLOR,
  overlay: { ...DEFAULT_OVERLAY },
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  try {
    bindElements();
    loadData();
    setupTabs();
    setupForm();
    setupFilters();
    setupOverlay();
    renderAll();
  } catch (error) {
    showBootError(error);
    throw error;
  }
});

function bindElements() {
  Object.assign(els, {
    form: document.querySelector("#artworkForm"),
    formTitle: document.querySelector("#formTitle"),
    artworkDateInput: document.querySelector("#artworkDateInput"),
    newArtworkButton: document.querySelector("#newArtworkButton"),
    saveArtworkButton: document.querySelector("#saveArtworkButton"),
    saveStatus: document.querySelector("#saveStatus"),
    totalTimeDisplay: document.querySelector("#totalTimeDisplay"),
    sessionDateInput: document.querySelector("#sessionDateInput"),
    sessionMinutesInput: document.querySelector("#sessionMinutesInput"),
    addSessionButton: document.querySelector("#addSessionButton"),
    sessionList: document.querySelector("#sessionList"),
    uploadGrid: document.querySelector("#uploadGrid"),
    uploadTemplate: document.querySelector("#uploadTemplate"),
    addStageButton: document.querySelector("#addStageButton"),
    mediumSelect: document.querySelector("#mediumSelect"),
    surfaceSelect: document.querySelector("#surfaceSelect"),
    sizeSelect: document.querySelector("#sizeSelect"),
    subjectSelect: document.querySelector("#subjectSelect"),
    customMediumWrap: document.querySelector("#customMediumWrap"),
    customSurfaceWrap: document.querySelector("#customSurfaceWrap"),
    customSizeWrap: document.querySelector("#customSizeWrap"),
    customSubjectWrap: document.querySelector("#customSubjectWrap"),
    reviewGrid: document.querySelector("#reviewGrid"),
    reviewViewer: document.querySelector("#reviewViewer"),
    viewerStage: document.querySelector("#viewerStage"),
    viewerImage: document.querySelector("#viewerImage"),
    viewerTitle: document.querySelector("#viewerTitle"),
    viewerDetails: document.querySelector("#viewerDetails"),
    prevImageButton: document.querySelector("#prevImageButton"),
    nextImageButton: document.querySelector("#nextImageButton"),
    closeViewerButton: document.querySelector("#closeViewerButton"),
    editFromViewerButton: document.querySelector("#editFromViewerButton"),
    stageFilter: document.querySelector("#stageFilter"),
    ratingFilter: document.querySelector("#ratingFilter"),
    sortFilter: document.querySelector("#sortFilter"),
    searchFilter: document.querySelector("#searchFilter"),
    projectSearch: document.querySelector("#projectSearch"),
    projectList: document.querySelector("#projectList"),
    newProjectButton: document.querySelector("#newProjectButton"),
    exportBackupButton: document.querySelector("#exportBackupButton"),
    importBackupInput: document.querySelector("#importBackupInput"),
    importModeSelect: document.querySelector("#importModeSelect"),
    backupStatus: document.querySelector("#backupStatus"),
    statsGrid: document.querySelector("#statsGrid"),
    trendChart: document.querySelector("#trendChart"),
    heatmap: document.querySelector("#calendarHeatmap"),
    breakdownList: document.querySelector("#breakdownList"),
    overlayArtwork: document.querySelector("#overlayArtwork"),
    overlayImage: document.querySelector("#overlayImage"),
    referenceLayer: document.querySelector("#referenceLayer"),
    artworkBaseLayer: document.querySelector("#artworkBaseLayer"),
    compareFrame: document.querySelector("#compareFrame"),
    tracePhotoLayer: document.querySelector("#tracePhotoLayer"),
    traceCanvas: document.querySelector("#traceCanvas"),
    overlayStage: document.querySelector("#overlayStage"),
    toggleOverlayFullscreenButton: document.querySelector("#toggleOverlayFullscreenButton"),
    exitOverlayFullscreenButton: document.querySelector("#exitOverlayFullscreenButton"),
    exportOverlayButton: document.querySelector("#exportOverlayButton"),
    exportOverlayFullscreenButton: document.querySelector("#exportOverlayFullscreenButton"),
    undoOverlayButton: document.querySelector("#undoOverlayButton"),
    resetOverlayButton: document.querySelector("#resetOverlayButton"),
    traceToggle: document.querySelector("#traceToggle"),
    traceThresholdControl: document.querySelector("#traceThresholdControl"),
    traceColorInputs: document.querySelectorAll("input[name='traceColor']"),
    overlayOpacityInputs: document.querySelectorAll("input[name='overlayOpacity']"),
    textSizeSelect: document.querySelector("#textSizeSelect"),
  });
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  state.artworks = normalizeArtworks(saved ? JSON.parse(saved) : seedArtworks());
  if (!saved) saveData();
  state.uploadStages = DEFAULT_STAGES.map((name) => ({ name, rating: 0, dataUrl: "" }));
  state.draftSessions = [];
  loadUiPrefs();
}

function loadUiPrefs() {
  const saved = localStorage.getItem(UI_PREFS_KEY);
  const prefs = saved ? JSON.parse(saved) : {};
  applyTextSize(prefs.textSize || "default");
  if (els.textSizeSelect) els.textSizeSelect.value = prefs.textSize || "default";
}

function saveUiPrefs() {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ textSize: els.textSizeSelect.value }));
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.artworks));
}

function setupTabs() {
  toArray(document.querySelectorAll(".tab")).forEach((tab) => {
    tab.addEventListener("click", () => {
      toArray(document.querySelectorAll(".tab, .view")).forEach((node) => node.classList.remove("active"));
      tab.classList.add("active");
      const view = document.querySelector(`#view-${tab.dataset.view}`);
      if (!view) return;
      view.classList.add("active");
      if (tab.dataset.view === "overlay") renderOverlaySelectors();
      if (tab.dataset.view === "projects") renderProjects();
      if (tab.dataset.view === "review") renderReview();
    });
  });
}

function setupForm() {
  els.artworkDateInput.value = new Date().toISOString().slice(0, 10);
  els.sessionDateInput.valueAsDate = new Date();
  setupCustomSelect(els.mediumSelect, els.customMediumWrap);
  setupCustomSelect(els.surfaceSelect, els.customSurfaceWrap);
  setupCustomSelect(els.sizeSelect, els.customSizeWrap);
  setupCustomSelect(els.subjectSelect, els.customSubjectWrap);

  els.textSizeSelect.addEventListener("change", () => {
    applyTextSize(els.textSizeSelect.value);
    saveUiPrefs();
  });

  els.addStageButton.addEventListener("click", () => {
    state.uploadStages.push({ name: `Progress ${state.uploadStages.length - 2}`, rating: 0, dataUrl: "" });
    renderUploadStages();
  });

  els.addSessionButton.addEventListener("click", () => {
    const minutes = Number(els.sessionMinutesInput.value);
    if (!minutes || minutes < 0) return;
    state.draftSessions.push({
      id: createId(),
      date: els.sessionDateInput.value || new Date().toISOString().slice(0, 10),
      minutes,
    });
    els.sessionMinutesInput.value = "";
    persistEditingArtwork();
    renderSessions();
    renderStats();
    renderReview();
  });

  els.newArtworkButton.addEventListener("click", resetForm);
  els.newProjectButton.addEventListener("click", () => {
    resetForm();
    activateTab("log");
  });
  els.exportBackupButton.addEventListener("click", exportBackup);
  els.importBackupInput.addEventListener("change", importBackup);

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const wasEditing = Boolean(state.editingId);
    const data = new FormData(els.form);
    const subject = data.get("subject") === "Other" ? data.get("customSubject") || "Other" : data.get("subject");
    const medium = data.get("medium") === "Other" ? data.get("customMedium") || "Other" : data.get("medium");
    const surface = data.get("surface") === "Other" ? data.get("customSurface") || "Other" : data.get("surface");
    const size = data.get("size") === "Other" ? data.get("customSize") || "Other" : data.get("size");
    const defaultDate = state.draftSessions[0] ? state.draftSessions[0].date : new Date().toISOString().slice(0, 10);
    const images = state.uploadStages
      .filter((stage) => stage.name.trim() || stage.dataUrl)
      .map((stage) => ({ ...stage, name: stage.name.trim() || "Untitled stage" }));

    const artwork = {
      id: state.editingId || createId(),
      title: data.get("title"),
      date: data.get("date") || els.sessionDateInput.value || defaultDate,
      minutes: totalMinutes(state.draftSessions),
      sessions: [...state.draftSessions],
      overallRating: Number(data.get("overallRating")),
      medium,
      surface,
      size,
      subject,
      notes: data.get("notes"),
      images,
      overlayPositions: state.editingId ? { ...(currentArtwork().overlayPositions || {}) } : {},
      createdAt: state.editingId ? currentArtwork().createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = state.artworks.findIndex((item) => item.id === artwork.id);
    if (existingIndex >= 0) {
      state.artworks.splice(existingIndex, 1, artwork);
    } else {
      state.artworks.unshift(artwork);
    }

    saveData();
    resetForm();
    renderAll();
    announceSave(wasEditing ? "Saved changes." : "Saved artwork.");
    activateTab("projects");
  });

  renderUploadStages();
  renderSessions();
}

function setupCustomSelect(select, wrap) {
  select.addEventListener("change", () => {
    wrap.classList.toggle("hidden", select.value !== "Other");
  });
}

function setupFilters() {
  els.stageFilter.addEventListener("input", () => {
    state.stageFilterTouched = true;
    renderReview();
  });
  [els.ratingFilter, els.sortFilter, els.searchFilter].forEach((control) => {
    control.addEventListener("input", renderReview);
  });
  els.projectSearch.addEventListener("input", renderProjects);

  els.reviewGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-review-index]");
    if (!card) return;
    openReviewViewer(Number(card.dataset.reviewIndex));
  });

  els.projectList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-artwork-id]");
    if (deleteButton) {
      deleteArtwork(deleteButton.dataset.deleteArtworkId);
      return;
    }
    const card = event.target.closest("[data-artwork-id]");
    if (!card) return;
    loadArtworkForEditing(card.dataset.artworkId);
  });

  els.prevImageButton.addEventListener("click", () => stepReview(-1));
  els.nextImageButton.addEventListener("click", () => stepReview(1));
  els.closeViewerButton.addEventListener("click", () => {
    els.reviewViewer.classList.add("hidden");
    els.reviewGrid.classList.remove("hidden");
  });
  els.editFromViewerButton.addEventListener("click", () => {
    const item = state.reviewItems[state.reviewIndex];
    if (item) loadArtworkForEditing(item.artwork.id);
  });

  setupReviewZoom();
}

function setupOverlay() {
  els.toggleOverlayFullscreenButton.addEventListener("click", toggleOverlayFullscreen);
  els.exitOverlayFullscreenButton.addEventListener("click", () => {
    if (document.querySelector("#view-overlay").classList.contains("overlay-fullscreen")) toggleOverlayFullscreen();
  });
  els.exportOverlayButton.addEventListener("click", exportOverlayImage);
  els.exportOverlayFullscreenButton.addEventListener("click", exportOverlayImage);
  els.undoOverlayButton.addEventListener("click", undoOverlay);
  els.overlayArtwork.addEventListener("change", () => {
    renderOverlayImageOptions();
    renderOverlayImages();
  });
  els.overlayImage.addEventListener("change", renderOverlayImages);
  els.referenceLayer.addEventListener("load", renderReferenceTrace);
  els.artworkBaseLayer.addEventListener("load", () => {
    if (state.overlay.baseSpace) applyBaseSpace(state.overlay.baseSpace);
    clampOverlayToStage();
    applyOverlayTransform();
  });
  els.traceToggle.addEventListener("change", applyOverlayMode);
  els.traceThresholdControl.addEventListener("input", renderReferenceTrace);
  toArray(els.traceColorInputs).forEach((input) => {
    input.addEventListener("change", () => {
      state.traceColor = input.value;
      renderReferenceTrace();
    });
  });
  toArray(els.overlayOpacityInputs).forEach((input) => {
    input.addEventListener("change", () => {
      state.overlay.opacity = Number(input.value);
      applyOverlayTransform();
      saveCurrentOverlayPosition();
    });
  });

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(eventName, preventBrowserZoom, { passive: false });
  });
  document.addEventListener("touchmove", preventBrowserTouchZoom, { passive: false });

  els.resetOverlayButton.addEventListener("click", () => {
    pushOverlayHistory();
    state.overlay = { ...DEFAULT_OVERLAY };
    syncOverlayControls();
    clampOverlayToStage();
    applyOverlayTransform();
    saveCurrentOverlayPosition();
  });

  const pointers = new Map();
  let gesture = null;
  els.compareFrame.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pushOverlayHistory();
    pointers.set(event.pointerId, pointerPoint(event));
    gesture = startOverlayGesture(event, pointers);
    els.compareFrame.setPointerCapture(event.pointerId);
  });
  els.compareFrame.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    event.preventDefault();
    pointers.set(event.pointerId, pointerPoint(event));
    updateOverlayFromGesture(event, pointers, gesture);
    syncOverlayControls();
    applyOverlayTransform();
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    els.compareFrame.addEventListener(eventName, (event) => {
      pointers.delete(event.pointerId);
      saveCurrentOverlayPosition();
      gesture = pointers.size ? startOverlayGesture(event, pointers) : null;
    });
  });
}

function toggleOverlayFullscreen() {
  const view = document.querySelector("#view-overlay");
  const baseSpace = overlayToBaseSpace();
  const isFullscreen = view.classList.toggle("overlay-fullscreen");
  document.body.classList.toggle("overlay-fullscreen-active", isFullscreen);
  els.toggleOverlayFullscreenButton.textContent = isFullscreen ? "Exit full screen" : "Full screen overlay";
  setTimeout(() => {
    if (baseSpace) applyBaseSpace(baseSpace);
    clampOverlayToStage();
    applyOverlayTransform();
    saveCurrentOverlayPosition();
  }, 0);
}

function renderAll() {
  renderStageFilter();
  renderReview();
  renderProjects();
  renderStats();
  renderOverlaySelectors();
}

function renderUploadStages() {
  els.uploadGrid.innerHTML = "";
  state.uploadStages.forEach((stage, index) => {
    const node = els.uploadTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = node.querySelector(".stage-name");
    const fileInput = node.querySelector(".stage-file");
    const ratingInput = node.querySelector(".stage-rating");
    const preview = node.querySelector(".preview");
    const status = node.querySelector(".upload-status");

    nameInput.value = stage.name;
    ratingInput.value = stage.rating;
    if (stage.dataUrl) {
      preview.src = stage.dataUrl;
      preview.classList.add("has-image");
    }

    nameInput.addEventListener("input", () => {
      state.uploadStages[index].name = nameInput.value;
    });
    ratingInput.addEventListener("input", () => {
      state.uploadStages[index].rating = Number(ratingInput.value);
    });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      status.textContent = "";
      preview.classList.remove("is-unsupported");
      if (isHeic(file)) {
        status.textContent = "HEIC is saved by iPhone, but this browser prototype cannot decode it. Export as JPEG/PNG, or the native iPhone app can use PhotoKit for this later.";
        state.uploadStages[index].dataUrl = "";
        preview.removeAttribute("src");
        preview.classList.remove("has-image");
        preview.classList.add("is-unsupported");
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      state.uploadStages[index].dataUrl = dataUrl;
      preview.src = dataUrl;
      preview.classList.add("has-image");
    });

    els.uploadGrid.append(node);
  });
}

function renderSessions() {
  const total = totalMinutes(state.draftSessions);
  els.totalTimeDisplay.textContent = `${total} min`;
  els.sessionList.innerHTML = state.draftSessions.length
    ? state.draftSessions
        .map((session) => `
          <div class="session-row">
            <span>${escapeHtml(session.date)}</span>
            <strong>${session.minutes} min</strong>
            <button type="button" data-session-id="${session.id}" aria-label="Remove session">×</button>
          </div>
        `)
        .join("")
    : `<p class="helper">No time logged yet. Start at zero and add sessions when you work.</p>`;

  toArray(els.sessionList.querySelectorAll("[data-session-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      state.draftSessions = state.draftSessions.filter((session) => session.id !== button.dataset.sessionId);
      persistEditingArtwork();
      renderSessions();
      renderStats();
      renderReview();
    });
  });
}

function totalMinutes(sessions) {
  return sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
}

function renderStageFilter() {
  const previous = els.stageFilter.value;
  const stages = new Set(["All images"]);
  state.artworks.forEach((artwork) => artwork.images.forEach((image) => stages.add(image.name)));
  const stageList = [...stages];
  els.stageFilter.innerHTML = stageList.map((stage) => `<option>${escapeHtml(stage)}</option>`).join("");
  if (!state.stageFilterTouched && stageList.includes("Final artwork")) {
    els.stageFilter.value = "Final artwork";
  } else if (stageList.includes(previous)) {
    els.stageFilter.value = previous;
  } else if (stageList.includes("Final artwork")) {
    els.stageFilter.value = "Final artwork";
  }
}

function renderReview() {
  const selectedStage = els.stageFilter.value || "All images";
  const minRating = Number(els.ratingFilter.value);
  const sort = els.sortFilter.value;
  const search = els.searchFilter.value.trim().toLowerCase();
  const items = [];

  state.artworks.forEach((artwork) => {
    artwork.images.forEach((image) => {
      if (!image.dataUrl) return;
      const haystack = [artwork.title, artwork.medium, artwork.surface, artwork.size, artwork.subject, artwork.notes, image.name]
        .join(" ")
        .toLowerCase();
      if (selectedStage !== "All images" && image.name !== selectedStage) return;
      if (Number(image.rating) < minRating) return;
      if (search && !haystack.includes(search)) return;
      items.push({ artwork, image });
    });
  });
  items.sort((a, b) => compareCards(a, b, sort));
  state.reviewItems = items;

  els.reviewGrid.innerHTML = items.length
    ? items.map((item, index) => reviewThumb(item.artwork, item.image, index)).join("")
    : `<div class="panel empty-state">No matching images yet. Use Projects to reopen artworks that do not have images.</div>`;
  els.reviewViewer.classList.add("hidden");
  els.reviewGrid.classList.remove("hidden");
}

function reviewThumb(artwork, image, index) {
  return `
    <button class="thumb-card" type="button" data-review-index="${index}" aria-label="Open ${escapeHtml(image.name)} for ${escapeHtml(artwork.title)}">
      <img src="${image.dataUrl}" alt="${escapeHtml(image.name)} for ${escapeHtml(artwork.title)}">
      <div>
        <strong>${escapeHtml(artwork.title)}</strong>
        <span>${escapeHtml(image.name)} · ${stars(image.rating)}</span>
      </div>
    </button>
  `;
}

function openReviewViewer(index) {
  state.reviewIndex = index;
  els.reviewGrid.classList.add("hidden");
  els.reviewViewer.classList.remove("hidden");
  resetReviewZoom();
  renderReviewViewer();
}

function stepReview(direction) {
  if (!state.reviewItems.length) return;
  state.reviewIndex = (state.reviewIndex + direction + state.reviewItems.length) % state.reviewItems.length;
  resetReviewZoom();
  renderReviewViewer();
}

function renderReviewViewer() {
  const item = state.reviewItems[state.reviewIndex];
  if (!item) return;
  els.viewerImage.src = item.image.dataUrl;
  els.viewerImage.alt = `${item.image.name} for ${item.artwork.title}`;
  els.viewerTitle.textContent = item.artwork.title;
  els.viewerDetails.textContent = `${item.image.name} · ${item.artwork.medium || "Medium open"} · ${item.artwork.subject || "Subject open"} · ${item.artwork.minutes} min · ${state.reviewIndex + 1}/${state.reviewItems.length}`;
  applyReviewZoom();
}

function setupReviewZoom() {
  if (!els.viewerStage) return;
  const pointers = new Map();
  let gesture = null;

  const startGesture = () => ({
    pointers: objectValuesFromMap(pointers),
    transform: { ...state.reviewZoom },
  });

  els.viewerStage.addEventListener("pointerdown", (event) => {
    if (!state.reviewItems.length) return;
    event.preventDefault();
    pointers.set(event.pointerId, pointerPoint(event));
    gesture = startGesture();
    els.viewerStage.setPointerCapture(event.pointerId);
  });

  els.viewerStage.addEventListener("pointermove", (event) => {
    if (!gesture || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, pointerPoint(event));
    updateReviewZoomFromGesture(gesture, objectValuesFromMap(pointers));
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    els.viewerStage.addEventListener(eventName, (event) => {
      pointers.delete(event.pointerId);
      if (!pointers.size) gesture = null;
    });
  });
}

function updateReviewZoomFromGesture(gesture, points) {
  if (!points.length) return;
  if (points.length >= 2 && gesture.pointers.length >= 2) {
    const center = pointsCenter(points);
    const startDistance = Math.max(1, pointsDistance(gesture.pointers));
    const scale = clampReviewScale(gesture.transform.scale * (pointsDistance(points) / startDistance));
    state.reviewZoom.scale = scale;
    state.reviewZoom.x = gesture.transform.x + (center.x - pointsCenter(gesture.pointers).x);
    state.reviewZoom.y = gesture.transform.y + (center.y - pointsCenter(gesture.pointers).y);
  } else if (gesture.transform.scale > 1) {
    const current = points[0];
    const start = gesture.pointers[0];
    state.reviewZoom.x = gesture.transform.x + (current.x - start.x);
    state.reviewZoom.y = gesture.transform.y + (current.y - start.y);
  }
  applyReviewZoom();
}

function applyReviewZoom() {
  if (!els.viewerImage) return;
  els.viewerImage.style.transform = `translate(calc(-50% + ${state.reviewZoom.x}px), calc(-50% + ${state.reviewZoom.y}px)) scale(${state.reviewZoom.scale})`;
}

function resetReviewZoom() {
  state.reviewZoom = { scale: 1, x: 0, y: 0 };
  applyReviewZoom();
}

function clampReviewScale(value) {
  return Math.min(4, Math.max(1, Number(value.toFixed(3))));
}

function renderProjects() {
  const search = els.projectSearch.value.trim().toLowerCase();
  const projects = state.artworks
    .filter((artwork) => [artwork.title, artwork.medium, artwork.surface, artwork.size, artwork.subject, artwork.notes].join(" ").toLowerCase().includes(search))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || b.date) - new Date(a.updatedAt || a.createdAt || a.date));

  els.projectList.innerHTML = projects.length
    ? projects.map(projectCard).join("")
    : `<div class="panel empty-state">No projects yet. Start one from the Log tab.</div>`;
}

function projectCard(artwork) {
  const thumb = firstImage(artwork);
  return `
    <article class="project-card">
      <button class="project-open" type="button" data-artwork-id="${artwork.id}" aria-label="Update ${escapeHtml(artwork.title)}">
      ${thumb ? `<img src="${thumb.dataUrl}" alt="">` : `<span class="project-placeholder">No image</span>`}
      <div>
        <strong>${escapeHtml(artwork.title || "Untitled artwork")}</strong>
        <span>${escapeHtml(artwork.medium || "Medium open")} · ${escapeHtml(artwork.subject || "Subject open")}</span>
        <span>${artwork.minutes} min · ${artwork.images.filter((image) => image.dataUrl).length} images</span>
      </div>
      <b>Update</b>
      </button>
      <button class="delete-project" type="button" data-delete-artwork-id="${artwork.id}" aria-label="Delete ${escapeHtml(artwork.title)}">Delete</button>
    </article>
  `;
}

function deleteArtwork(id) {
  const artwork = state.artworks.find((item) => item.id === id);
  if (!artwork) return;
  const confirmed = window.confirm(`Delete "${artwork.title || "Untitled artwork"}"? This removes its time, metadata, and images from this device.`);
  if (!confirmed) return;
  state.artworks = state.artworks.filter((item) => item.id !== id);
  if (state.editingId === id) resetForm();
  saveData();
  renderAll();
  activateTab("projects");
}

function exportBackup() {
  const backup = {
    app: "studio-log",
    version: 1,
    exportedAt: new Date().toISOString(),
    artworks: state.artworks,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `studio-log-backup-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  els.backupStatus.textContent = `Exported ${state.artworks.length} artworks.`;
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await readFileAsText(file);
    const parsed = JSON.parse(text);
    const incoming = Array.isArray(parsed) ? parsed : parsed.artworks;
    if (!Array.isArray(incoming)) throw new Error("Backup file does not contain artworks.");
    const normalized = normalizeArtworks(incoming);
    const mode = els.importModeSelect.value;
    const summary = mergeImportedArtworks(normalized, mode);
    const message = mode === "add-only"
      ? `Import ${summary.added} new artworks and skip ${summary.skipped} existing ones?`
      : `Import ${summary.added} new artworks and update ${summary.updated} existing ones? Nothing will be deleted.`;
    if (!window.confirm(message)) return;
    state.artworks = summary.nextArtworks;
    saveData();
    renderAll();
    activateTab("projects");
    els.backupStatus.textContent = `Imported: ${summary.added} added, ${summary.updated} updated, ${summary.skipped} skipped.`;
  } catch (error) {
    els.backupStatus.textContent = `Import failed: ${error.message}`;
  } finally {
    event.target.value = "";
  }
}

function mergeImportedArtworks(incoming, mode) {
  const existingById = {};
  state.artworks.forEach((artwork) => {
    existingById[artwork.id] = artwork;
  });
  const nextById = { ...existingById };
  let added = 0;
  let updated = 0;
  let skipped = 0;

  incoming.forEach((artwork) => {
    if (!artwork.id) artwork.id = createId();
    if (!nextById[artwork.id]) {
      nextById[artwork.id] = artwork;
      added += 1;
      return;
    }
    if (mode === "merge-update") {
      nextById[artwork.id] = artwork;
      updated += 1;
    } else {
      skipped += 1;
    }
  });

  return {
    added,
    updated,
    skipped,
    nextArtworks: objectValues(nextById).sort((a, b) => new Date(b.updatedAt || b.createdAt || b.date) - new Date(a.updatedAt || a.createdAt || a.date)),
  };
}

function firstImage(artwork) {
  return preferredProjectImage(artwork);
}

function preferredProjectImage(artwork) {
  return artwork.images.find((image) => image.name === "Final artwork" && image.dataUrl)
    || artwork.images.find((image) => image.name === "Reference" && image.dataUrl)
    || artwork.images.find((image) => image.dataUrl);
}

function compareCards(a, b, sort) {
  const ratingA = Number(a.image.rating || a.artwork.overallRating || 0);
  const ratingB = Number(b.image.rating || b.artwork.overallRating || 0);
  const dateA = new Date(a.artwork.date).getTime();
  const dateB = new Date(b.artwork.date).getTime();
  if (sort === "date-asc") return dateA - dateB;
  if (sort === "rating-desc") return ratingB - ratingA;
  if (sort === "rating-asc") return ratingA - ratingB;
  if (sort === "time-desc") return b.artwork.minutes - a.artwork.minutes;
  if (sort === "time-asc") return a.artwork.minutes - b.artwork.minutes;
  if (sort === "medium-asc") return String(a.artwork.medium).localeCompare(String(b.artwork.medium));
  if (sort === "subject-asc") return String(a.artwork.subject).localeCompare(String(b.artwork.subject));
  return dateB - dateA;
}

function renderStats() {
  const totalMinutes = state.artworks.reduce((sum, art) => sum + art.minutes, 0);
  const practiceDates = [];
  state.artworks.forEach((art) => {
    art.sessions.forEach((session) => practiceDates.push(session.date));
  });
  const practiceDays = new Set(practiceDates).size;
  const finished = state.artworks.filter((art) => art.images.some((image) => image.name === "Final artwork" && image.dataUrl)).length;
  const averageRating = average(state.artworks.map((art) => art.overallRating).filter(Boolean));

  els.statsGrid.innerHTML = [
    statCard(Math.round(totalMinutes / 60), "hours"),
    statCard(practiceDays, "practice days"),
    statCard(finished, "finished pieces"),
    statCard(averageRating ? averageRating.toFixed(1) : "—", "avg rating"),
  ].join("");

  renderHeatmap();
  renderTrend();
  renderBreakdown();
}

function statCard(value, label) {
  return `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`;
}

function renderHeatmap() {
  const minutesByDay = new Map();
  state.artworks.forEach((art) => {
    art.sessions.forEach((session) => {
      minutesByDay.set(session.date, (minutesByDay.get(session.date) || 0) + Number(session.minutes || 0));
    });
  });

  const today = new Date();
  const days = [];
  for (let i = 34; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const minutes = minutesByDay.get(key) || 0;
    const level = minutes >= 90 ? 3 : minutes >= 30 ? 2 : minutes > 0 ? 1 : 0;
    days.push(`<span class="day level-${level}" title="${key}: ${minutes} minutes">${minutes}</span>`);
  }
  els.heatmap.innerHTML = days.join("");
}

function renderTrend() {
  const rows = state.artworks
    .map((art) => ({ date: art.date, minutes: art.minutes, rating: Number(art.overallRating || 0) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!rows.length) {
    els.trendChart.innerHTML = `<p class="helper">No trend data yet.</p>`;
    return;
  }

  const grouped = rows.reduce((days, row) => {
    if (!days[row.date]) days[row.date] = { date: row.date, count: 0, minutes: 0, rating: 0, rated: 0 };
    days[row.date].count += 1;
    days[row.date].minutes += row.minutes;
    if (row.rating) {
      days[row.date].rating += row.rating;
      days[row.date].rated += 1;
    }
    return days;
  }, {});
  const points = objectValues(grouped).map((day) => ({
    date: day.date,
    avgMinutes: day.minutes / day.count,
    avgRating: day.rated ? day.rating / day.rated : 0,
  }));

  const width = 360;
  const height = 150;
  const pad = 18;
  const maxMinutes = Math.max(30, ...points.map((point) => point.avgMinutes));
  const xFor = (index) => points.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (points.length - 1);
  const yMinutes = (value) => height - pad - (value / maxMinutes) * (height - pad * 2);
  const yRating = (value) => height - pad - (value / 5) * (height - pad * 2);
  const path = (getter, yGetter) => points.map((point, index) => `${index ? "L" : "M"} ${xFor(index).toFixed(1)} ${yGetter(getter(point)).toFixed(1)}`).join(" ");

  els.trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Average time and rating trend">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
      <path class="trend-time" d="${path((point) => point.avgMinutes, yMinutes)}" />
      <path class="trend-rating" d="${path((point) => point.avgRating, yRating)}" />
      ${points.map((point, index) => `<circle class="trend-dot-time" cx="${xFor(index)}" cy="${yMinutes(point.avgMinutes)}" r="4"><title>${point.date}: ${Math.round(point.avgMinutes)} min avg</title></circle>`).join("")}
      ${points.map((point, index) => `<circle class="trend-dot-rating" cx="${xFor(index)}" cy="${yRating(point.avgRating)}" r="4"><title>${point.date}: ${point.avgRating.toFixed(1)} star avg</title></circle>`).join("")}
    </svg>`;
}

function renderBreakdown() {
  const byMedium = groupMinutes("medium");
  const mediumValues = objectValues(byMedium);
  const max = Math.max.apply(null, [1].concat(mediumValues));
  els.breakdownList.innerHTML = objectEntries(byMedium)
    .sort((a, b) => b[1] - a[1])
    .map(([label, minutes]) => {
      const width = Math.round((minutes / max) * 100);
      return `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar"><span style="width:${width}%"></span></div><strong>${minutes}</strong></div>`;
    })
    .join("");
}

function groupMinutes(key) {
  return state.artworks.reduce((groups, artwork) => {
    const label = artwork[key] || "Unspecified";
    groups[label] = (groups[label] || 0) + artwork.minutes;
    return groups;
  }, {});
}

function renderOverlaySelectors() {
  const comparable = state.artworks.filter((art) => art.images.some((image) => image.name === "Reference" && image.dataUrl));
  els.overlayArtwork.innerHTML = comparable.map((art) => `<option value="${art.id}">${escapeHtml(art.title)}</option>`).join("");
  renderOverlayImageOptions();
  renderOverlayImages();
}

function renderOverlayImageOptions() {
  const artwork = currentOverlayArtwork();
  if (!artwork) {
    els.overlayImage.innerHTML = "";
    return;
  }
  els.overlayImage.innerHTML = artwork.images
    .filter((image) => image.name !== "Reference" && image.dataUrl)
    .map((image, index) => `<option value="${index}">${escapeHtml(image.name)}</option>`)
    .join("");
}

function renderOverlayImages() {
  const artwork = currentOverlayArtwork();
  if (!artwork) {
    els.referenceLayer.src = "";
    els.artworkBaseLayer.src = "";
    els.tracePhotoLayer.src = "";
    clearTrace();
    return;
  }
  const reference = artwork.images.find((image) => image.name === "Reference");
  const candidates = artwork.images.filter((image) => image.name !== "Reference" && image.dataUrl);
  const compare = candidates[Number(els.overlayImage.value)] || candidates[0];
  els.referenceLayer.src = reference ? reference.dataUrl : "";
  els.tracePhotoLayer.src = reference ? reference.dataUrl : "";
  els.artworkBaseLayer.src = compare ? compare.dataUrl : "";
  loadOverlayPosition(artwork, compare);
  if (!reference) clearTrace();
  if (reference && els.referenceLayer.complete) renderReferenceTrace();
  clampOverlayToStage();
  applyOverlayMode();
  applyOverlayTransform();
}

function currentOverlayArtwork() {
  return state.artworks.find((art) => art.id === els.overlayArtwork.value) || state.artworks[0];
}

function syncOverlayControls() {
  toArray(els.overlayOpacityInputs).forEach((input) => {
    input.checked = Number(input.value) === state.overlay.opacity;
  });
  if (els.undoOverlayButton) els.undoOverlayButton.disabled = !state.overlayHistory.length;
}

function applyOverlayTransform() {
  els.compareFrame.style.opacity = state.overlay.opacity / 100;
  els.compareFrame.style.width = `${state.overlay.width}px`;
  els.compareFrame.style.height = `${state.overlay.height}px`;
  els.compareFrame.style.transform = `translate(calc(-50% + ${state.overlay.x}px), calc(-50% + ${state.overlay.y}px)) rotate(${state.overlay.rotate}deg)`;
}

function loadOverlayPosition(artwork, compareImage) {
  const key = overlayPositionKey(compareImage);
  const saved = key && artwork.overlayPositions ? artwork.overlayPositions[key] : null;
  state.overlay = sanitizeOverlay(saved || DEFAULT_OVERLAY);
  state.overlayHistory = [];
  if (state.overlay.baseSpace) applyBaseSpace(state.overlay.baseSpace);
  syncOverlayControls();
}

function pushOverlayHistory() {
  const snapshot = sanitizeOverlay(state.overlay);
  const previous = state.overlayHistory[state.overlayHistory.length - 1];
  if (previous && overlaySnapshotsMatch(previous, snapshot)) return;
  state.overlayHistory.push(snapshot);
  if (state.overlayHistory.length > 5) state.overlayHistory.shift();
  syncOverlayControls();
}

function undoOverlay() {
  const previous = state.overlayHistory.pop();
  if (!previous) return;
  state.overlay = sanitizeOverlay(previous);
  syncOverlayControls();
  clampOverlayToStage();
  applyOverlayTransform();
  saveCurrentOverlayPosition();
}

function overlaySnapshotsMatch(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.rotate === b.rotate && a.opacity === b.opacity;
}

function saveCurrentOverlayPosition() {
  const artwork = currentOverlayArtwork();
  const compareImage = currentOverlayCompareImage();
  const key = overlayPositionKey(compareImage);
  if (!artwork || !key) return;
  if (!artwork.overlayPositions) artwork.overlayPositions = {};
  artwork.overlayPositions[key] = {
    ...sanitizeOverlay(state.overlay),
    baseSpace: overlayToBaseSpace(),
  };
  artwork.updatedAt = new Date().toISOString();
  saveData();
}

function currentOverlayCompareImage() {
  const artwork = currentOverlayArtwork();
  if (!artwork) return null;
  const candidates = artwork.images.filter((image) => image.name !== "Reference" && image.dataUrl);
  return candidates[Number(els.overlayImage.value)] || candidates[0] || null;
}

function overlayPositionKey(image) {
  return image && image.name ? image.name : "";
}

function sanitizeOverlay(value) {
  const overlay = { ...DEFAULT_OVERLAY, ...(value || {}) };
  return {
    x: Number(overlay.x) || 0,
    y: Number(overlay.y) || 0,
    width: clamp(Number(overlay.width) || DEFAULT_OVERLAY.width, 80, 2400),
    height: clamp(Number(overlay.height) || DEFAULT_OVERLAY.height, 80, 3000),
    rotate: clamp(Number(overlay.rotate) || 0, -180, 180),
    opacity: clamp(Number(overlay.opacity) || 0, 0, 100),
    baseSpace: sanitizeBaseSpace(overlay.baseSpace),
  };
}

function sanitizeBaseSpace(value) {
  if (!value) return null;
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    width: Number(value.width) || 0,
    height: Number(value.height) || 0,
  };
}

function applyTextSize(size) {
  const next = size === "small" || size === "large" ? size : "default";
  if (next === "default") {
    document.documentElement.removeAttribute("data-text-size");
    return;
  }
  document.documentElement.setAttribute("data-text-size", next);
}

function announceSave(message) {
  if (!els.saveStatus) return;
  els.saveStatus.textContent = message;
  clearTimeout(announceSave.timer);
  announceSave.timer = window.setTimeout(() => {
    if (els.saveStatus.textContent === message) els.saveStatus.textContent = "";
  }, 2200);
}

function overlayToBaseSpace() {
  const stageSize = overlayStageSize();
  const baseRect = artworkDisplayRect(stageSize.width, stageSize.height);
  if (!baseRect) return null;
  const centerX = stageSize.width / 2 + state.overlay.x;
  const centerY = stageSize.height / 2 + state.overlay.y;
  return {
    x: (centerX - (baseRect.x + baseRect.width / 2)) / baseRect.width,
    y: (centerY - (baseRect.y + baseRect.height / 2)) / baseRect.height,
    width: state.overlay.width / baseRect.width,
    height: state.overlay.height / baseRect.height,
  };
}

function applyBaseSpace(baseSpace) {
  const stageSize = overlayStageSize();
  const baseRect = artworkDisplayRect(stageSize.width, stageSize.height);
  if (!baseRect || !baseSpace) return;
  const centerX = baseRect.x + baseRect.width / 2 + baseSpace.x * baseRect.width;
  const centerY = baseRect.y + baseRect.height / 2 + baseSpace.y * baseRect.height;
  state.overlay.x = centerX - stageSize.width / 2;
  state.overlay.y = centerY - stageSize.height / 2;
  state.overlay.width = baseSpace.width * baseRect.width;
  state.overlay.height = baseSpace.height * baseRect.height;
}

function applyOverlayMode() {
  els.overlayStage.classList.toggle("trace-mode", els.traceToggle.checked);
  els.overlayStage.classList.toggle("photo-mode", !els.traceToggle.checked);
  els.compareFrame.style.opacity = state.overlay.opacity / 100;
  els.referenceLayer.style.opacity = "0";
}

function renderReferenceTrace() {
  if (!els.referenceLayer.complete || !els.referenceLayer.naturalWidth) return;
  const canvas = els.traceCanvas;
  const width = 420;
  const height = 525;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const scratchCtx = scratch.getContext("2d");
  scratchCtx.fillStyle = "#fff";
  scratchCtx.fillRect(0, 0, width, height);
  const rect = containRect(els.referenceLayer.naturalWidth, els.referenceLayer.naturalHeight, width, height);
  scratchCtx.drawImage(els.referenceLayer, rect.x, rect.y, rect.width, rect.height);
  const image = scratchCtx.getImageData(0, 0, width, height);
  const data = image.data;
  const threshold = Number(els.traceThresholdControl.value);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = hexToRgba(state.traceColor, 0.95);

  const xStart = Math.max(1, Math.floor(rect.x));
  const yStart = Math.max(1, Math.floor(rect.y));
  const xEnd = Math.min(width - 1, Math.ceil(rect.x + rect.width));
  const yEnd = Math.min(height - 1, Math.ceil(rect.y + rect.height));

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const center = grayAt(data, width, x, y);
      const right = grayAt(data, width, x + 1, y);
      const down = grayAt(data, width, x, y + 1);
      const diag = grayAt(data, width, x + 1, y + 1);
      const edge = Math.abs(center - right) + Math.abs(center - down) + Math.abs(center - diag) * 0.5;
      if (edge > threshold) ctx.fillRect(x, y, 1.8, 1.8);
    }
  }
}

function containRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function overlayStageSize() {
  const rect = els.overlayStage.getBoundingClientRect();
  return { width: rect.width || 1, height: rect.height || 1 };
}

function artworkDisplayRect(stageWidth, stageHeight) {
  if (!els.artworkBaseLayer.naturalWidth || !els.artworkBaseLayer.naturalHeight) return null;
  const rect = containRect(els.artworkBaseLayer.naturalWidth, els.artworkBaseLayer.naturalHeight, stageWidth * 0.82, stageHeight * 0.88);
  return {
    x: (stageWidth - rect.width) / 2,
    y: (stageHeight - rect.height) / 2,
    width: rect.width,
    height: rect.height,
  };
}

function preventBrowserZoom(event) {
  event.preventDefault();
}

function preventBrowserTouchZoom(event) {
  if (event.touches && event.touches.length > 1) event.preventDefault();
}

async function exportOverlayImage() {
  const blob = await renderOverlayBlob();
  if (!blob) return;
  const artwork = currentOverlayArtwork();
  const filename = `${slugify(artwork ? artwork.title : "studio-log-overlay")}-overlay.png`;

  if (typeof File !== "undefined" && navigator.canShare && navigator.share) {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Studio Log overlay" });
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderOverlayBlob() {
  return new Promise((resolve) => {
    const stageSize = overlayStageSize();
    const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(stageSize.width * scale);
    canvas.height = Math.round(stageSize.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fbfaf7";
    ctx.fillRect(0, 0, stageSize.width, stageSize.height);

    drawContainedImage(ctx, els.artworkBaseLayer, artworkDisplayRect(stageSize.width, stageSize.height));
    drawOverlayExport(ctx, stageSize);
    canvas.toBlob(resolve, "image/png", 0.96);
  });
}

function drawOverlayExport(ctx, stageSize) {
  ctx.save();
  ctx.globalAlpha = state.overlay.opacity / 100;
  ctx.translate(stageSize.width / 2 + state.overlay.x, stageSize.height / 2 + state.overlay.y);
  ctx.rotate((state.overlay.rotate * Math.PI) / 180);
  const frame = {
    x: -state.overlay.width / 2,
    y: -state.overlay.height / 2,
    width: state.overlay.width,
    height: state.overlay.height,
  };
  if (els.traceToggle.checked) {
    ctx.drawImage(els.traceCanvas, frame.x, frame.y, frame.width, frame.height);
  } else {
    drawContainedImage(ctx, els.tracePhotoLayer, { x: frame.x, y: frame.y, width: frame.width, height: frame.height });
  }
  ctx.restore();
}

function drawContainedImage(ctx, image, target) {
  if (!target || !image || !image.naturalWidth || !image.naturalHeight) return;
  const rect = containRect(image.naturalWidth, image.naturalHeight, target.width, target.height);
  ctx.drawImage(image, target.x + rect.x, target.y + rect.y, rect.width, rect.height);
}

function slugify(value) {
  return String(value || "studio-log-overlay").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "studio-log-overlay";
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function grayAt(data, width, x, y) {
  const index = (y * width + x) * 4;
  return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
}

function clearTrace() {
  const ctx = els.traceCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.traceCanvas.width, els.traceCanvas.height);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pointerPoint(event) {
  return { id: event.pointerId, x: event.clientX, y: event.clientY };
}

function startOverlayGesture(event, pointers) {
  const points = objectValuesFromMap(pointers);
  const handle = event.target.closest("[data-action]");
  const action = handle ? handle.dataset.action : "move";
  return {
    action,
    points,
    center: pointsCenter(points),
    distance: pointsDistance(points),
    angle: pointsAngle(points),
    overlay: { ...state.overlay },
  };
}

function updateOverlayFromGesture(event, pointers, gesture) {
  const points = objectValuesFromMap(pointers);
  if (points.length >= 2 && gesture.points.length >= 2) {
    updateOverlayFromPinch(points, gesture);
  } else {
    updateOverlayFromSinglePointer(event, gesture);
  }
  clampOverlayToStage();
}

function updateOverlayFromSinglePointer(event, gesture) {
  const startPoint = gesture.points[0] || { x: event.clientX, y: event.clientY };
  const dx = event.clientX - startPoint.x;
  const dy = event.clientY - startPoint.y;
  if (gesture.action === "move") {
    state.overlay.x = gesture.overlay.x + dx;
    state.overlay.y = gesture.overlay.y + dy;
  }
  if (gesture.action.indexOf("resize") === 0) {
    resizeOverlayFromCorner(gesture.action, gesture.overlay, dx, dy);
  }
  if (gesture.action === "rotate") {
    state.overlay.rotate = clamp(gesture.overlay.rotate + dx / 3, -180, 180);
  }
}

function updateOverlayFromPinch(points, gesture) {
  const center = pointsCenter(points);
  const startDistance = Math.max(1, gesture.distance);
  const scale = pointsDistance(points) / startDistance;
  const aspect = gesture.overlay.height / gesture.overlay.width;
  const nextWidth = gesture.overlay.width * scale;
  const angleDelta = pointsAngle(points) - gesture.angle;
  state.overlay.width = nextWidth;
  state.overlay.height = nextWidth * aspect;
  state.overlay.rotate = clamp(gesture.overlay.rotate + angleDelta, -180, 180);
  state.overlay.x = gesture.overlay.x + (center.x - gesture.center.x);
  state.overlay.y = gesture.overlay.y + (center.y - gesture.center.y);
}

function resizeOverlayFromCorner(action, start, dx, dy) {
  const horizontal = action.endsWith("e") ? dx : -dx;
  const vertical = action.indexOf("s") > -1 ? dy : -dy;
  const delta = Math.abs(horizontal) > Math.abs(vertical) ? horizontal : vertical;
  const aspect = start.height / start.width;
  const stageRect = els.overlayStage.getBoundingClientRect();
  const maxWidth = Math.max(360, stageRect.width * 2.25);
  const minWidth = 120;
  const nextWidth = clamp(start.width + delta, minWidth, maxWidth);
  const widthDelta = nextWidth - start.width;
  state.overlay.width = nextWidth;
  state.overlay.height = Math.round(nextWidth * aspect);
  const xDirection = action.endsWith("e") ? 1 : -1;
  const yDirection = action.indexOf("s") > -1 ? 1 : -1;
  state.overlay.x = start.x + (widthDelta / 2) * xDirection;
  state.overlay.y = start.y + ((state.overlay.height - start.height) / 2) * yDirection;
}

function objectValuesFromMap(map) {
  return Array.from(map.values());
}

function pointsCenter(points) {
  if (!points.length) return { x: 0, y: 0 };
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function pointsDistance(points) {
  if (points.length < 2) return 1;
  const [a, b] = points;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointsAngle(points) {
  if (points.length < 2) return 0;
  const [a, b] = points;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function clampOverlayToStage() {
  const stageRect = els.overlayStage.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return;
  const maxWidth = Math.max(360, stageRect.width * 2.25);
  const maxHeight = Math.max(450, stageRect.height * 2.25);
  if (state.overlay.width > maxWidth) {
    state.overlay.width = maxWidth;
    state.overlay.height = Math.round(maxWidth * 1.25);
  }
  if (state.overlay.height > maxHeight) {
    state.overlay.height = maxHeight;
    state.overlay.width = Math.round(maxHeight / 1.25);
  }
  const halfWidth = state.overlay.width / 2;
  const halfHeight = state.overlay.height / 2;
  const reachableStrip = 44;
  const maxX = Math.max(0, stageRect.width / 2 + halfWidth - reachableStrip);
  const maxY = Math.max(0, stageRect.height / 2 + halfHeight - reachableStrip);
  state.overlay.x = clamp(state.overlay.x, -maxX, maxX);
  state.overlay.y = clamp(state.overlay.y, -maxY, maxY);
}

function resetForm() {
  els.form.reset();
  state.editingId = null;
  els.artworkDateInput.value = new Date().toISOString().slice(0, 10);
  els.sessionDateInput.valueAsDate = new Date();
  state.draftSessions = [];
  state.uploadStages = DEFAULT_STAGES.map((name) => ({ name, rating: 0, dataUrl: "" }));
  els.formTitle.textContent = "New Artwork";
  els.saveArtworkButton.textContent = "Save artwork";
  if (els.saveStatus) els.saveStatus.textContent = "";
  els.newArtworkButton.classList.add("hidden");
  [els.customMediumWrap, els.customSurfaceWrap, els.customSizeWrap, els.customSubjectWrap].forEach((wrap) => wrap.classList.add("hidden"));
  els.customSubjectWrap.classList.add("hidden");
  renderSessions();
  renderUploadStages();
}

function loadArtworkForEditing(id) {
  const artwork = state.artworks.find((item) => item.id === id);
  if (!artwork) return;
  state.editingId = id;
  els.formTitle.textContent = "Artwork Details";
  els.saveArtworkButton.textContent = "Save changes";
  if (els.saveStatus) els.saveStatus.textContent = "";
  els.newArtworkButton.classList.remove("hidden");
  els.form.elements.title.value = artwork.title || "";
  els.artworkDateInput.value = artwork.date || new Date().toISOString().slice(0, 10);
  els.form.elements.overallRating.value = artwork.overallRating || 0;
  setSelectWithCustom(els.mediumSelect, els.form.elements.customMedium, els.customMediumWrap, artwork.medium);
  setSelectWithCustom(els.surfaceSelect, els.form.elements.customSurface, els.customSurfaceWrap, artwork.surface);
  setSelectWithCustom(els.sizeSelect, els.form.elements.customSize, els.customSizeWrap, artwork.size);
  setSelectWithCustom(els.subjectSelect, els.form.elements.customSubject, els.customSubjectWrap, artwork.subject);
  els.form.elements.notes.value = artwork.notes || "";
  els.sessionMinutesInput.value = "";
  els.sessionDateInput.value = artwork.date || new Date().toISOString().slice(0, 10);
  state.draftSessions = [...artwork.sessions];
  state.uploadStages = artwork.images.length ? artwork.images.map((image) => ({ ...image })) : DEFAULT_STAGES.map((name) => ({ name, rating: 0, dataUrl: "" }));
  renderSessions();
  renderUploadStages();
  activateTab("log");
}

function setSelectWithCustom(select, input, wrap, value) {
  const options = toArray(select.options).map((option) => option.value);
  if (options.includes(value)) {
    select.value = value;
    input.value = "";
    wrap.classList.add("hidden");
  } else {
    select.value = "Other";
    input.value = value || "";
    wrap.classList.remove("hidden");
  }
}

function persistEditingArtwork() {
  if (!state.editingId) return;
  const artwork = currentArtwork();
  if (!artwork) return;
  artwork.sessions = [...state.draftSessions];
  artwork.minutes = totalMinutes(state.draftSessions);
  artwork.updatedAt = new Date().toISOString();
  saveData();
}

function currentArtwork() {
  return state.artworks.find((item) => item.id === state.editingId);
}

function activateTab(name) {
  document.querySelector(`.tab[data-view="${name}"]`).click();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function isHeic(file) {
  const name = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

function stars(value) {
  const count = Number(value) || 0;
  return "★".repeat(count) + "☆".repeat(5 - count);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  const random = window.crypto && window.crypto.getRandomValues
    ? window.crypto.getRandomValues(new Uint32Array(2)).join("")
    : `${Math.random().toString(36).slice(2)}${Date.now()}`;
  return `id-${Date.now()}-${random}`;
}

function toArray(list) {
  return Array.prototype.slice.call(list);
}

function objectValues(object) {
  return Object.keys(object).map((key) => object[key]);
}

function objectEntries(object) {
  return Object.keys(object).map((key) => [key, object[key]]);
}

function showBootError(error) {
  const main = document.querySelector(".app-shell") || document.body;
  const message = document.createElement("div");
  message.className = "boot-error";
  message.innerHTML = `
    <strong>Studio Log could not start.</strong>
    <span>${escapeHtml(error && error.message ? error.message : "Unknown startup error")}</span>
  `;
  main.prepend(message);
}

function normalizeArtworks(artworks) {
  return artworks.map((artwork) => {
    const sessions = Array.isArray(artwork.sessions) && artwork.sessions.length
      ? artwork.sessions
      : [{ id: createId(), date: artwork.date || new Date().toISOString().slice(0, 10), minutes: Number(artwork.minutes || 0) }];
    const overlayPositions = {};
    Object.entries(artwork.overlayPositions || {}).forEach(([key, value]) => {
      overlayPositions[key] = sanitizeOverlay(value);
    });
    return {
      ...artwork,
      sessions,
      minutes: totalMinutes(sessions),
      images: Array.isArray(artwork.images) ? artwork.images : [],
      overlayPositions,
    };
  });
}

function seedArtworks() {
  const today = new Date().toISOString().slice(0, 10);
  const sessions = [
    { id: createId(), date: today, minutes: 35 },
    { id: createId(), date: today, minutes: 60 },
  ];
  return [
    {
      id: createId(),
      title: "Warm light portrait",
      date: today,
      minutes: totalMinutes(sessions),
      sessions,
      overallRating: 4,
      medium: "Oil",
      surface: "Canvas panel",
      size: "9 x 12 in",
      subject: "Portrait",
      notes: "Good color temperature shift; check eye alignment earlier next time.",
      createdAt: new Date().toISOString(),
      images: [
        { name: "Reference", rating: 4, dataUrl: portraitSvg("#f3d2b8", "#46322a", "#167d7f", 0) },
        { name: "Block-in", rating: 3, dataUrl: portraitSvg("#ead6c5", "#5b504c", "#c4514a", 1) },
        { name: "30 mins", rating: 4, dataUrl: portraitSvg("#e9c4a7", "#3c2e2a", "#c9952d", 2) },
        { name: "Final artwork", rating: 4, dataUrl: portraitSvg("#f0c49b", "#31241f", "#5c5aa8", 3) },
      ],
    },
  ];
}

function portraitSvg(skin, ink, accent, detail) {
  const looseness = detail * 5;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400">
      <rect width="320" height="400" fill="#f6f1ea"/>
      <rect x="34" y="32" width="252" height="336" rx="8" fill="${accent}" opacity=".14"/>
      <path d="M92 ${120 + looseness} C105 57 218 55 231 ${126 - looseness} C242 185 213 268 160 276 C111 268 80 184 92 ${120 + looseness}Z" fill="${skin}"/>
      <path d="M92 132 C99 59 218 54 230 126 C211 93 126 96 92 132Z" fill="${ink}"/>
      <path d="M118 178 Q136 168 151 180" stroke="${ink}" stroke-width="${detail + 2}" fill="none"/>
      <path d="M174 180 Q194 168 211 179" stroke="${ink}" stroke-width="${detail + 2}" fill="none"/>
      <path d="M162 187 C153 212 149 224 166 229" stroke="${ink}" stroke-width="3" fill="none" opacity=".58"/>
      <path d="M132 245 C151 258 179 258 199 244" stroke="${ink}" stroke-width="4" fill="none"/>
      <path d="M110 282 C142 308 184 307 216 282 L238 360 L77 360Z" fill="${accent}" opacity=".74"/>
      <path d="M76 96 C45 150 54 255 98 317" stroke="${ink}" stroke-width="${3 + detail}" fill="none" opacity=".2"/>
      <path d="M244 96 C279 153 264 255 220 318" stroke="${ink}" stroke-width="${3 + detail}" fill="none" opacity=".2"/>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
