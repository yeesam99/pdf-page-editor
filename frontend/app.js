const API_BASE_URL =
  String(
    window.APP_CONFIG?.API_BASE_URL ||
    "http://127.0.0.1:8083"
  ).replace(/\/$/, "");

const SESSION_STORAGE_KEY =
  `pdfPageEditorSession:${API_BASE_URL}`;

let sessionId =
  sessionStorage.getItem(SESSION_STORAGE_KEY);

let appState = null;

let dragPageId = null;

let didDragPage = false;

let selectionAnchorId = null;

let isSavingOrder = false;

let isRotatingPages = false;

const selectedPageIds =
  new Set();

const HEALTH_INTERVAL_MS =
  5 * 60 * 1000;

const HEALTH_RETRY_MS =
  30 * 1000;

const STARTUP_REQUEST_TIMEOUT_MS =
  12 * 1000;

const STARTUP_RETRY_DELAY_MS =
  2500;

let healthTimer = null;

let healthRequestInFlight = false;

const fileInput =
  document.getElementById("fileInput");

const dropZone =
  document.getElementById("dropZone");

const fileList =
  document.getElementById("fileList");

const fileCount =
  document.getElementById("fileCount");

const pageGrid =
  document.getElementById("pageGrid");

const pageCount =
  document.getElementById("pageCount");

const uploadStatus =
  document.getElementById("uploadStatus");

const resetBtn =
  document.getElementById("resetBtn");

const exportBtn =
  document.getElementById("exportBtn");

const loadingOverlay =
  document.getElementById("loadingOverlay");

const loadingText =
  document.getElementById("loadingText");

const toast =
  document.getElementById("toast");

const previewModal =
  document.getElementById("previewModal");

const previewImage =
  document.getElementById("previewImage");

const previewTitle =
  document.getElementById("previewTitle");

const closePreviewBtn =
  document.getElementById("closePreviewBtn");

const selectionCount =
  document.getElementById("selectionCount");

const rotateLeftBtn =
  document.getElementById("rotateLeftBtn");

const rotateRightBtn =
  document.getElementById("rotateRightBtn");

const moveFirstBtn =
  document.getElementById("moveFirstBtn");

const moveLeftBtn =
  document.getElementById("moveLeftBtn");

const moveRightBtn =
  document.getElementById("moveRightBtn");

const moveLastBtn =
  document.getElementById("moveLastBtn");

const clearSelectionBtn =
  document.getElementById("clearSelectionBtn");

const serverStatus =
  document.getElementById("serverStatus");

const serverStatusText =
  document.getElementById("serverStatusText");

const serverStatusTime =
  document.getElementById("serverStatusTime");

const startupOverlay =
  document.getElementById("startupOverlay");

const startupSpinner =
  document.getElementById("startupSpinner");

const startupSuccessIcon =
  document.getElementById("startupSuccessIcon");

const startupTitle =
  document.getElementById("startupTitle");

const startupMessage =
  document.getElementById("startupMessage");

const startupElapsed =
  document.getElementById("startupElapsed");

const startupStartBtn =
  document.getElementById("startupStartBtn");

const startupRetryBtn =
  document.getElementById("startupRetryBtn");

const startupNote =
  document.getElementById("startupNote");

let startupElapsedTimer = null;

let startupStartedAt = 0;

let startupAttemptToken = 0;


function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${
    path.startsWith("/")
      ? path
      : `/${path}`
  }`;
}


function wait(delay) {
  return new Promise(
    resolve => window.setTimeout(resolve, delay)
  );
}


function startStartupElapsedTimer() {
  window.clearInterval(startupElapsedTimer);

  startupStartedAt = Date.now();

  startupElapsed.textContent =
    "경과 시간: 0초";

  startupElapsedTimer =
    window.setInterval(
      () => {
        const elapsedSeconds =
          Math.floor(
            (Date.now() - startupStartedAt) / 1000
          );

        startupElapsed.textContent =
          `경과 시간: ${elapsedSeconds}초`;

        if (elapsedSeconds >= 60) {
          startupMessage.innerHTML =
            "서버 연결이 예상보다 지연되고 있습니다.<br />자동으로 계속 연결을 시도하고 있습니다.";

          startupRetryBtn.classList.remove(
            "hidden"
          );
        }
      },
      1000
    );
}


function setStartupConnecting() {
  startupOverlay.classList.remove(
    "hidden",
    "ready",
    "error"
  );

  document.body.classList.add(
    "startup-locked"
  );

  startupSpinner.classList.remove(
    "hidden"
  );

  startupSuccessIcon.classList.add(
    "hidden"
  );

  startupStartBtn.classList.add(
    "hidden"
  );

  startupRetryBtn.classList.add(
    "hidden"
  );

  startupTitle.textContent =
    "서버 연결 중";

  startupMessage.innerHTML =
    "무료 서버를 시작하고 있습니다.<br />약 10초~1분 정도 소요될 수 있습니다.";

  startupNote.textContent =
    "연결 중에는 이 창을 닫지 마세요.";

  startStartupElapsedTimer();
}


function setStartupReady() {
  window.clearInterval(startupElapsedTimer);

  startupOverlay.classList.add(
    "ready"
  );

  startupSpinner.classList.add(
    "hidden"
  );

  startupSuccessIcon.classList.remove(
    "hidden"
  );

  startupRetryBtn.classList.add(
    "hidden"
  );

  startupTitle.textContent =
    "서버 연결 완료";

  startupMessage.innerHTML =
    "PDF 편집기를 사용할 준비가 완료되었습니다.";

  startupStartBtn.classList.remove(
    "hidden"
  );

  startupNote.textContent =
    "시작하기 버튼을 눌러 편집기를 열어주세요.";

  startupStartBtn.focus();
}


async function requestHealth(
  timeoutMs = STARTUP_REQUEST_TIMEOUT_MS
) {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        apiUrl("/api/health"),
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Accept": "application/json"
          },
          signal: controller.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        "서버가 아직 시작 중입니다."
      );
    }

    const data =
      await response.json();

    if (data?.status !== "ok") {
      throw new Error(
        "서버 상태를 확인할 수 없습니다."
      );
    }

    return data;
  }
  finally {
    window.clearTimeout(timeoutId);
  }
}


async function connectStartup() {
  const attemptToken =
    ++startupAttemptToken;

  setStartupConnecting();

  while (attemptToken === startupAttemptToken) {
    try {
      await requestHealth();

      if (attemptToken !== startupAttemptToken) {
        return;
      }

      setServerStatus(
        "online",
        "서버 연결됨",
        `확인 ${formatHealthTime()}`
      );

      await ensureSession();

      if (attemptToken !== startupAttemptToken) {
        return;
      }

      setStartupReady();
      startHealthMonitor(false);
      return;
    }
    catch (_) {
      if (attemptToken !== startupAttemptToken) {
        return;
      }

      setServerStatus(
        "checking",
        "서버 시작 중",
        "연결될 때까지 기다리고 있습니다."
      );

      await wait(STARTUP_RETRY_DELAY_MS);
    }
  }
}


function formatHealthTime(
  date = new Date()
) {
  return date.toLocaleTimeString(
    "ko-KR",
    {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}


function setServerStatus(
  status,
  message,
  detail
) {
  serverStatus.classList.remove(
    "online",
    "checking",
    "offline"
  );

  serverStatus.classList.add(status);
  serverStatusText.textContent = message;
  serverStatusTime.textContent = detail;
}


function scheduleHealthCheck(
  delay
) {
  window.clearTimeout(healthTimer);

  healthTimer =
    window.setTimeout(
      sendHealthCheck,
      delay
    );
}


async function sendHealthCheck() {
  if (healthRequestInFlight) {
    return;
  }

  healthRequestInFlight = true;

  try {
    await requestHealth();

    setServerStatus(
      "online",
      "서버 유지 중",
      `마지막 확인 ${formatHealthTime()}`
    );

    scheduleHealthCheck(
      HEALTH_INTERVAL_MS
    );
  }
  catch (_) {
    setServerStatus(
      "offline",
      "서버 연결 확인 중",
      "30초 후 다시 확인합니다."
    );

    scheduleHealthCheck(
      HEALTH_RETRY_MS
    );
  }
  finally {
    healthRequestInFlight = false;
  }
}


function startHealthMonitor(
  immediate = true
) {
  setServerStatus(
    "checking",
    "서버 연결 확인 중",
    "첫 연결을 확인하고 있습니다."
  );

  if (immediate) {
    sendHealthCheck();
  }
  else {
    setServerStatus(
      "online",
      "서버 유지 중",
      `마지막 확인 ${formatHealthTime()}`
    );

    scheduleHealthCheck(
      HEALTH_INTERVAL_MS
    );
  }
}


function showLoading(
  text = "처리 중입니다..."
) {
  loadingText.textContent = text;

  loadingOverlay.classList.remove("hidden");
}


function hideLoading() {
  loadingOverlay.classList.add("hidden");
}


function showToast(
  message,
  timeout = 3500
) {
  toast.textContent = message;

  toast.classList.remove("hidden");

  window.clearTimeout(showToast._timer);

  showToast._timer =
    window.setTimeout(
      () => {
        toast.classList.add("hidden");
      },
      timeout
    );
}


async function api(
  url,
  options = {}
) {
  const response =
    await fetch(
      apiUrl(url),
      options
    );

  let data = null;

  const contentType =
    response.headers.get("content-type") || "";

  if (
    contentType.includes("application/json")
  ) {
    data = await response.json();
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
      "요청 처리 중 오류가 발생했습니다."
    );
  }

  return data;
}


async function ensureSession() {
  if (sessionId) {
    try {
      appState =
        await api(
          `/api/session/${sessionId}/state`
        );

      render();

      return;
    }
    catch (e) {
      sessionId = null;

      sessionStorage.removeItem(
        SESSION_STORAGE_KEY
      );
    }
  }

  appState =
    await api(
      "/api/session/new",
      {
        method: "POST"
      }
    );

  sessionId =
    appState.session_id;

  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    sessionId
  );

  render();
}


function getPage(pageId) {
  return appState.pages.find(
    page => page.id === pageId
  );
}


function pruneSelection() {
  const currentIds =
    new Set(appState?.order || []);

  [...selectedPageIds].forEach(
    pageId => {
      if (!currentIds.has(pageId)) {
        selectedPageIds.delete(pageId);
      }
    }
  );

  if (
    selectionAnchorId &&
    !currentIds.has(selectionAnchorId)
  ) {
    selectionAnchorId = null;
  }
}


function getSelectedRange() {
  if (
    !appState ||
    !selectedPageIds.size
  ) {
    return null;
  }

  const indices =
    appState.order
      .map(
        (pageId, index) =>
          selectedPageIds.has(pageId)
            ? index
            : -1
      )
      .filter(index => index >= 0);

  if (!indices.length) {
    return null;
  }

  const start = indices[0];
  const end = indices[indices.length - 1];

  if (
    end - start + 1 !==
    indices.length
  ) {
    return null;
  }

  return {
    start,
    end,
    count: indices.length
  };
}


function updateSelectionToolbar() {
  pruneSelection();

  const range =
    getSelectedRange();

  const selectedCount =
    range?.count || 0;

  selectionCount.textContent =
    selectedCount
      ? `${selectedCount}개 페이지 선택됨`
      : "선택된 페이지 없음";

  const hasSelection =
    selectedCount > 0;

  const atFirst =
    !range || range.start === 0;

  const atLast =
    !range ||
    range.end === appState.order.length - 1;

  const isBusy =
    isSavingOrder || isRotatingPages;

  rotateLeftBtn.disabled =
    !hasSelection || isBusy;

  rotateRightBtn.disabled =
    !hasSelection || isBusy;

  moveFirstBtn.disabled =
    !hasSelection || atFirst || isBusy;

  moveLeftBtn.disabled =
    !hasSelection || atFirst || isBusy;

  moveRightBtn.disabled =
    !hasSelection || atLast || isBusy;

  moveLastBtn.disabled =
    !hasSelection || atLast || isBusy;

  clearSelectionBtn.disabled =
    !hasSelection || isBusy;
}


function clearSelection(
  rerender = true
) {
  selectedPageIds.clear();
  selectionAnchorId = null;

  if (rerender) {
    renderPages();
  }
}


function selectPage(
  pageId,
  useRange = false
) {
  const currentIndex =
    appState.order.indexOf(pageId);

  if (currentIndex < 0) {
    return;
  }

  if (
    useRange &&
    selectionAnchorId
  ) {
    const anchorIndex =
      appState.order.indexOf(
        selectionAnchorId
      );

    if (anchorIndex >= 0) {
      const start =
        Math.min(
          anchorIndex,
          currentIndex
        );

      const end =
        Math.max(
          anchorIndex,
          currentIndex
        );

      selectedPageIds.clear();

      appState.order
        .slice(start, end + 1)
        .forEach(
          selectedId =>
            selectedPageIds.add(
              selectedId
            )
        );

      renderPages();
      return;
    }
  }

  const onlyThisPageSelected =
    selectedPageIds.size === 1 &&
    selectedPageIds.has(pageId);

  selectedPageIds.clear();

  if (onlyThisPageSelected) {
    selectionAnchorId = null;
  }
  else {
    selectedPageIds.add(pageId);
    selectionAnchorId = pageId;
  }

  renderPages();
}


async function saveOrder(
  newOrder,
  successMessage = "페이지 순서를 변경했습니다."
) {
  const previousOrder =
    [...appState.order];

  appState.order =
    newOrder;

  isSavingOrder = true;
  renderPages();

  try {
    appState =
      await api(
        `/api/session/${sessionId}/order`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              {
                order: newOrder
              }
            )
        }
      );

    pruneSelection();
    showToast(successMessage);
  }
  catch (e) {
    appState.order =
      previousOrder;

    showToast(e.message);

    try {
      appState =
        await api(
          `/api/session/${sessionId}/state`
        );
    }
    catch (_) {
      // 기존 화면 상태를 유지합니다.
    }

    pruneSelection();
  }
  finally {
    isSavingOrder = false;
    render();
  }
}


async function moveSelectedPages(
  direction
) {
  const range =
    getSelectedRange();

  if (!range) {
    showToast(
      "서로 붙어 있는 페이지를 선택해주세요."
    );
    return;
  }

  const order =
    [...appState.order];

  const block =
    order.slice(
      range.start,
      range.end + 1
    );

  const remaining = [
    ...order.slice(0, range.start),
    ...order.slice(range.end + 1)
  ];

  let insertIndex =
    range.start;

  if (direction === "first") {
    insertIndex = 0;
  }
  else if (direction === "left") {
    insertIndex =
      Math.max(0, range.start - 1);
  }
  else if (direction === "right") {
    insertIndex =
      Math.min(
        remaining.length,
        range.start + 1
      );
  }
  else if (direction === "last") {
    insertIndex =
      remaining.length;
  }

  remaining.splice(
    insertIndex,
    0,
    ...block
  );

  if (
    remaining.every(
      (pageId, index) =>
        pageId === order[index]
    )
  ) {
    return;
  }

  await saveOrder(
    remaining,
    `${range.count}개 페이지를 이동했습니다.`
  );
}


async function rotateSelectedPages(
  degrees
) {
  const range =
    getSelectedRange();

  if (!range) {
    showToast(
      "서로 붙어 있는 페이지를 선택해주세요."
    );
    return;
  }

  const pageIds =
    appState.order.slice(
      range.start,
      range.end + 1
    );

  isRotatingPages = true;
  renderPages();

  showLoading(
    `${range.count}개 페이지를 회전하고 있습니다...`
  );

  try {
    appState =
      await api(
        `/api/session/${sessionId}/rotate`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              {
                page_ids: pageIds,
                degrees
              }
            )
        }
      );

    pruneSelection();

    showToast(
      `${range.count}개 페이지를 ${degrees < 0 ? "왼쪽" : "오른쪽"}으로 90도 회전했습니다.`
    );
  }
  catch (e) {
    showToast(
      e.message,
      5000
    );
  }
  finally {
    isRotatingPages = false;
    hideLoading();
    render();
  }
}


function formatRotation(rotation) {
  const normalized =
    ((Number(rotation) || 0) % 360 + 360) % 360;

  if (normalized === 90) {
    return "오른쪽 90°";
  }

  if (normalized === 180) {
    return "180°";
  }

  if (normalized === 270) {
    return "왼쪽 90°";
  }

  return "";
}


function render() {
  pruneSelection();
  renderFiles();
  renderPages();
}


function renderFiles() {
  fileCount.textContent =
    String(appState.files.length);

  if (!appState.files.length) {
    fileList.className =
      "file-list empty-message";

    fileList.textContent =
      "아직 추가된 PDF가 없습니다.";

    return;
  }

  fileList.className =
    "file-list";

  fileList.innerHTML = "";

  for (
    const file of appState.files
  ) {
    const item =
      document.createElement("div");

    item.className =
      "file-item";

    const icon =
      document.createElement("div");

    icon.className =
      "file-type";

    icon.textContent =
      "PDF";

    const body =
      document.createElement("div");

    const name =
      document.createElement("div");

    name.className =
      "file-name";

    name.title =
      file.name;

    name.textContent =
      file.name;

    const meta =
      document.createElement("div");

    meta.className =
      "file-meta";

    const currentPageCount =
      appState.pages.filter(
        page =>
          page.file_id === file.id
      ).length;

    meta.textContent =
      `${currentPageCount} / ${file.page_count} 페이지 사용`;

    body.append(
      name,
      meta
    );

    const deleteBtn =
      document.createElement("button");

    deleteBtn.className =
      "file-delete-btn";

    deleteBtn.type =
      "button";

    deleteBtn.title =
      "이 PDF 전체 제거";

    deleteBtn.textContent =
      "🗑";

    deleteBtn.addEventListener(
      "click",
      async () => {
        await deleteFile(file);
      }
    );

    item.append(
      icon,
      body,
      deleteBtn
    );

    fileList.appendChild(item);
  }
}


function renderPages() {
  pruneSelection();

  pageCount.textContent =
    `${appState.order.length} pages`;

  updateSelectionToolbar();

  if (!appState.order.length) {
    pageGrid.className =
      "page-grid empty-grid";

    pageGrid.innerHTML = `
      <div class="empty-state">

        <div class="empty-visual">
          PDF
        </div>

        <strong>
          PDF 파일을 추가하세요.
        </strong>

        <span>
          업로드한 PDF 페이지가 여기에 표시됩니다.
        </span>

      </div>
    `;

    return;
  }

  pageGrid.className =
    "page-grid";

  pageGrid.innerHTML = "";

  appState.order.forEach(
    (
      pageId,
      orderIndex
    ) => {
      const page =
        getPage(pageId);

      if (!page) {
        return;
      }

      const card =
        document.createElement("article");

      card.className =
        "page-card";

      const isSelected =
        selectedPageIds.has(page.id);

      if (isSelected) {
        card.classList.add(
          "selected"
        );
      }

      card.setAttribute(
        "aria-selected",
        String(isSelected)
      );

      card.draggable =
        selectedPageIds.size <= 1;

      card.dataset.pageId =
        page.id;


      const thumbWrap =
        document.createElement("div");

      thumbWrap.className =
        "thumb-wrap";


      const img =
        document.createElement("img");

      const rotation =
        Number(page.rotation || 0) % 360;

      img.src =
        apiUrl(
          `/api/session/${sessionId}/thumbnail/${page.id}?rotation=${rotation}`
        );

      img.alt =
        `${page.source_name} ${page.page_index + 1}페이지`;


      const pageNo =
        document.createElement("div");

      pageNo.className =
        "page-no";

      pageNo.textContent =
        String(orderIndex + 1)
          .padStart(2, "0");


      const selectBtn =
        document.createElement("button");

      selectBtn.className =
        "page-select-btn";

      selectBtn.type =
        "button";

      selectBtn.title =
        "페이지 선택 (Shift+클릭: 연속 선택)";

      selectBtn.setAttribute(
        "aria-label",
        `${orderIndex + 1}페이지 선택`
      );

      selectBtn.setAttribute(
        "aria-pressed",
        String(isSelected)
      );

      selectBtn.textContent =
        isSelected ? "✓" : "";

      selectBtn.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          selectPage(
            page.id,
            event.shiftKey
          );
        }
      );


      thumbWrap.append(
        img,
        pageNo,
        selectBtn
      );


      const info =
        document.createElement("div");

      info.className =
        "page-info";


      const sourceName =
        document.createElement("div");

      sourceName.className =
        "source-name";

      sourceName.title =
        page.source_name;

      sourceName.textContent =
        page.source_name;


      const sourcePage =
        document.createElement("div");

      sourcePage.className =
        "source-page";

      const rotationText =
        formatRotation(page.rotation);

      sourcePage.textContent =
        `원본 ${page.page_index + 1}페이지${rotationText ? ` · ${rotationText}` : ""}`;


      const actions =
        document.createElement("div");

      actions.className =
        "card-actions";


      const previewBtn =
        document.createElement("button");

      previewBtn.className =
        "preview-btn";

      previewBtn.type =
        "button";

      previewBtn.textContent =
        "미리보기";

      previewBtn.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          openPreview(page);
        }
      );


      const deleteBtn =
        document.createElement("button");

      deleteBtn.className =
        "page-delete-btn";

      deleteBtn.type =
        "button";

      deleteBtn.title =
        "이 페이지 삭제";

      deleteBtn.textContent =
        "🗑";

      deleteBtn.addEventListener(
        "click",
        async event => {
          event.stopPropagation();

          await deletePage(page);
        }
      );


      actions.append(
        previewBtn,
        deleteBtn
      );

      info.append(
        sourceName,
        sourcePage,
        actions
      );

      card.append(
        thumbWrap,
        info
      );


      card.addEventListener(
        "click",
        event => {
          if (
            didDragPage ||
            event.target.closest("button")
          ) {
            return;
          }

          selectPage(
            page.id,
            event.shiftKey
          );
        }
      );


      card.addEventListener(
        "dragstart",
        event => {
          if (selectedPageIds.size > 1) {
            event.preventDefault();
            return;
          }

          didDragPage = true;

          dragPageId =
            page.id;

          card.classList.add(
            "dragging"
          );
        }
      );


      card.addEventListener(
        "dragend",
        () => {
          dragPageId =
            null;

          document
            .querySelectorAll(
              ".page-card"
            )
            .forEach(
              element =>
                element.classList.remove(
                  "dragging",
                  "drag-target"
                )
            );

          window.setTimeout(
            () => {
              didDragPage = false;
            },
            0
          );
        }
      );


      card.addEventListener(
        "dragover",
        event => {
          event.preventDefault();

          if (
            dragPageId &&
            dragPageId !== page.id
          ) {
            card.classList.add(
              "drag-target"
            );
          }
        }
      );


      card.addEventListener(
        "dragleave",
        () => {
          card.classList.remove(
            "drag-target"
          );
        }
      );


      card.addEventListener(
        "drop",
        async event => {
          event.preventDefault();

          card.classList.remove(
            "drag-target"
          );

          if (
            !dragPageId ||
            dragPageId === page.id
          ) {
            return;
          }

          const newOrder =
            [...appState.order];

          const fromIndex =
            newOrder.indexOf(
              dragPageId
            );

          const targetIndex =
            newOrder.indexOf(
              page.id
            );

          if (
            fromIndex < 0 ||
            targetIndex < 0
          ) {
            return;
          }

          newOrder.splice(
            fromIndex,
            1
          );


          const cardRect =
            card.getBoundingClientRect();

          const after =
            event.clientY >
            cardRect.top +
            cardRect.height / 2;


          let insertIndex =
            newOrder.indexOf(
              page.id
            );

          if (after) {
            insertIndex += 1;
          }


          newOrder.splice(
            insertIndex,
            0,
            dragPageId
          );


          await saveOrder(
            newOrder
          );
        }
      );


      pageGrid.appendChild(
        card
      );
    }
  );
}


async function uploadFiles(files) {
  const selected =
    [...files];

  const valid =
    selected.filter(
      file =>
        file.name
          .toLowerCase()
          .endsWith(".pdf")
    );

  if (!valid.length) {
    showToast(
      "PDF 파일만 선택해주세요."
    );

    return;
  }

  const form =
    new FormData();

  valid.forEach(
    file =>
      form.append(
        "files",
        file
      )
  );


  showLoading(
    "PDF를 분석하고 있습니다..."
  );

  uploadStatus.textContent =
    `${valid.length}개 PDF 처리 중...`;


  try {
    const result =
      await api(
        `/api/session/${sessionId}/upload`,
        {
          method: "POST",
          body: form
        }
      );

    appState =
      result.state;

    clearSelection(false);

    render();


    if (
      result.errors &&
      result.errors.length
    ) {
      uploadStatus.textContent =
        result.errors.join("\n");

      showToast(
        result.errors[0],
        5000
      );
    }
    else {
      uploadStatus.textContent =
        `${valid.length}개 PDF 추가 완료`;

      showToast(
        "PDF를 추가했습니다."
      );
    }
  }
  catch (e) {
    uploadStatus.textContent =
      e.message;

    showToast(
      e.message,
      5000
    );
  }
  finally {
    hideLoading();

    fileInput.value = "";
  }
}


async function deletePage(page) {
  const ok =
    confirm(
      `${page.source_name}의 원본 ${page.page_index + 1}페이지를 최종 PDF에서 제외할까요?`
    );

  if (!ok) {
    return;
  }

  try {
    appState =
      await api(
        `/api/session/${sessionId}/page/${page.id}`,
        {
          method:
            "DELETE"
        }
      );

    selectedPageIds.delete(page.id);

    if (selectionAnchorId === page.id) {
      selectionAnchorId = null;
    }

    render();

    showToast(
      "페이지를 삭제했습니다."
    );
  }
  catch (e) {
    showToast(
      e.message
    );
  }
}


async function deleteFile(file) {
  const currentPageCount =
    appState.pages.filter(
      page =>
        page.file_id === file.id
    ).length;

  const ok =
    confirm(
      `${file.name} 전체를 제거할까요?\n현재 ${currentPageCount}개 페이지가 최종 PDF에서 제거됩니다.`
    );

  if (!ok) {
    return;
  }

  try {
    appState =
      await api(
        `/api/session/${sessionId}/file/${file.id}`,
        {
          method:
            "DELETE"
        }
      );

    pruneSelection();

    render();

    showToast(
      "PDF 파일을 제거했습니다."
    );
  }
  catch (e) {
    showToast(
      e.message
    );
  }
}


function openPreview(page) {
  const rotationText =
    formatRotation(page.rotation);

  previewTitle.textContent =
    `${page.source_name} · 원본 ${page.page_index + 1}페이지${rotationText ? ` · ${rotationText}` : ""}`;

  previewImage.src =
    apiUrl(
      `/api/session/${sessionId}/preview/${page.id}?t=${Date.now()}`
    );

  previewModal.classList.remove(
    "hidden"
  );
}


function closePreview() {
  previewModal.classList.add(
    "hidden"
  );

  previewImage.src = "";
}


async function exportPdf() {
  if (!appState.order.length) {
    showToast(
      "최종 PDF에 포함할 페이지가 없습니다."
    );

    return;
  }

  let outputName =
    prompt(
      "생성할 PDF 파일명을 입력하세요.",
      "통합본.pdf"
    );

  if (
    outputName === null
  ) {
    return;
  }

  outputName =
    outputName.trim() ||
    "통합본.pdf";


  const form =
    new FormData();

  form.append(
    "output_name",
    outputName
  );


  showLoading(
    "최종 PDF를 생성하고 있습니다..."
  );


  try {
    const result =
      await api(
        `/api/session/${sessionId}/export`,
        {
          method: "POST",
          body: form
        }
      );


    showToast(
      "최종 PDF 생성이 완료되었습니다."
    );


    window.location.href =
      apiUrl(result.download_url);
  }
  catch (e) {
    showToast(
      e.message,
      5000
    );
  }
  finally {
    hideLoading();
  }
}


async function resetSession() {
  const ok =
    confirm(
      "추가한 PDF와 편집 내용을 모두 초기화할까요?"
    );

  if (!ok) {
    return;
  }

  showLoading(
    "초기화 중입니다..."
  );

  try {
    appState =
      await api(
        `/api/session/${sessionId}/reset`,
        {
          method: "POST"
        }
      );

    clearSelection(false);

    uploadStatus.textContent = "";

    render();

    showToast(
      "초기화했습니다."
    );
  }
  catch (e) {
    showToast(
      e.message
    );
  }
  finally {
    hideLoading();
  }
}


fileInput.addEventListener(
  "change",
  () => {
    if (
      fileInput.files &&
      fileInput.files.length
    ) {
      uploadFiles(
        fileInput.files
      );
    }
  }
);


[
  "dragenter",
  "dragover"
].forEach(
  eventName => {
    dropZone.addEventListener(
      eventName,
      event => {
        event.preventDefault();

        dropZone.classList.add(
          "drag-over"
        );
      }
    );
  }
);


[
  "dragleave",
  "drop"
].forEach(
  eventName => {
    dropZone.addEventListener(
      eventName,
      event => {
        event.preventDefault();

        dropZone.classList.remove(
          "drag-over"
        );
      }
    );
  }
);


dropZone.addEventListener(
  "drop",
  event => {
    if (
      event.dataTransfer.files &&
      event.dataTransfer.files.length
    ) {
      uploadFiles(
        event.dataTransfer.files
      );
    }
  }
);


resetBtn.addEventListener(
  "click",
  resetSession
);


exportBtn.addEventListener(
  "click",
  exportPdf
);


rotateLeftBtn.addEventListener(
  "click",
  () => rotateSelectedPages(-90)
);


rotateRightBtn.addEventListener(
  "click",
  () => rotateSelectedPages(90)
);


moveFirstBtn.addEventListener(
  "click",
  () => moveSelectedPages("first")
);


moveLeftBtn.addEventListener(
  "click",
  () => moveSelectedPages("left")
);


moveRightBtn.addEventListener(
  "click",
  () => moveSelectedPages("right")
);


moveLastBtn.addEventListener(
  "click",
  () => moveSelectedPages("last")
);


clearSelectionBtn.addEventListener(
  "click",
  () => clearSelection()
);


closePreviewBtn.addEventListener(
  "click",
  closePreview
);


previewModal
  .querySelector(
    ".modal-backdrop"
  )
  .addEventListener(
    "click",
    closePreview
  );


window.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      !previewModal.classList.contains(
        "hidden"
      )
    ) {
      closePreview();
    }
  }
);


window.addEventListener(
  "online",
  () => {
    if (
      !startupOverlay.classList.contains(
        "hidden"
      ) &&
      !startupOverlay.classList.contains(
        "ready"
      )
    ) {
      connectStartup();
    }
    else {
      scheduleHealthCheck(0);
    }
  }
);


window.addEventListener(
  "offline",
  () => {
    window.clearTimeout(healthTimer);

    setServerStatus(
      "offline",
      "인터넷 연결 끊김",
      "연결되면 자동으로 다시 확인합니다."
    );

    if (
      !startupOverlay.classList.contains(
        "hidden"
      )
    ) {
      startupTitle.textContent =
        "인터넷 연결 끊김";

      startupMessage.innerHTML =
        "인터넷 연결을 확인해주세요.<br />연결되면 자동으로 다시 시도합니다.";
    }
  }
);


document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState === "visible"
    ) {
      scheduleHealthCheck(0);
    }
  }
);


startupStartBtn.addEventListener(
  "click",
  () => {
    startupOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "startup-locked"
    );
  }
);


startupRetryBtn.addEventListener(
  "click",
  connectStartup
);


connectStartup();
