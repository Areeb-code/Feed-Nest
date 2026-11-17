(() => {
  "use strict";

  const state = {
    file: null,
    headers: [],
    currentAnalysis: null,
    currentFilename: "",
    currentAnalysisId: null,
    history: [],
    activeView: "dashboard"
  };

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    apiStatus: $("#api-status"),
    dashboardView: $("#dashboard-view"),
    historyView: $("#history-view"),
    topbarLabel: $("#topbar-view-label"),
    topUpload: $("#top-upload-button"),
    heroUpload: $("#hero-upload-button"),
    historyUpload: $("#history-new-analysis"),
    resultsUpload: $("#results-new-analysis"),
    introPanel: $("#intro-panel"),
    uploadPanel: $("#upload-panel"),
    trustStrip: $(".trust-strip"),
    resultsSection: $("#results-section"),
    fileInput: $("#csv-file-input"),
    dropzone: $("#dropzone"),
    selectedFileRow: $("#selected-file-row"),
    selectedFileName: $("#selected-file-name"),
    selectedFileMeta: $("#selected-file-meta"),
    removeFile: $("#remove-file-button"),
    mappingPanel: $("#mapping-panel"),
    mappingMessage: $("#mapping-message"),
    analyzeButton: $("#analyze-button"),
    progress: $("#analysis-progress"),
    progressTitle: $("#progress-title"),
    progressDescription: $("#progress-description"),
    resultsMeta: $("#results-meta"),
    metricGrid: $("#metric-grid"),
    sentimentContent: $("#sentiment-content"),
    recommendations: $("#recommendations-list"),
    topicBody: $("#topic-table-body"),
    topicCount: $("#topic-count"),
    trendList: $("#topic-trends-list"),
    emergingList: $("#emerging-list"),
    feedbackBody: $("#feedback-table-body"),
    feedbackCount: $("#feedback-count"),
    historyList: $("#history-list"),
    refreshHistory: $("#refresh-history-button"),
    exportButton: $("#export-button"),
    toastRegion: $("#toast-region")
  };

  const mappingFields = [
    { target: "review_text", selector: "#map-review", required: true },
    { target: "rating", selector: "#map-rating" },
    { target: "date", selector: "#map-date" },
    { target: "product", selector: "#map-product" },
    { target: "source", selector: "#map-source" }
  ];

  function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? new Intl.NumberFormat().format(number) : "0";
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " is-error" : ""}`;
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4300);
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { detail: await response.text() };

    if (!response.ok) {
      throw new Error(payload.detail || `Request failed (${response.status}).`);
    }
    return payload;
  }

  async function checkApiStatus() {
    try {
      await fetchJson("/api/health");
      elements.apiStatus.classList.remove("is-error");
      elements.apiStatus.classList.add("is-online");
      elements.apiStatus.querySelector("span:last-child").textContent = "API connected";
    } catch (_error) {
      elements.apiStatus.classList.remove("is-online");
      elements.apiStatus.classList.add("is-error");
      elements.apiStatus.querySelector("span:last-child").textContent = "API unavailable";
    }
  }

  function setView(view) {
    state.activeView = view;
    const isHistory = view === "history";
    elements.dashboardView.hidden = isHistory;
    elements.historyView.hidden = !isHistory;
    elements.topbarLabel.textContent = isHistory ? "Analysis history" : "Overview";

    document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    if (isHistory) loadHistory();
  }

  function openNewAnalysis() {
    setView("dashboard");
    elements.introPanel.hidden = false;
    elements.uploadPanel.hidden = false;
    elements.trustStrip.hidden = false;
    elements.resultsSection.hidden = true;
    elements.uploadPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    elements.fileInput.focus({ preventScroll: true });
  }

  function parseCsvHeader(csvText) {
    const text = String(csvText || "").replace(/^\uFEFF/, "");
    const headers = [];
    let field = "";
    let insideQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (insideQuotes && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (character === "," && !insideQuotes) {
        headers.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !insideQuotes) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        headers.push(field);
        break;
      } else {
        field += character;
      }
    }

    if (headers.length === 0 || (headers.length === 1 && field !== "")) {
      headers.push(field);
    } else if (headers.length > 0 && !text.match(/[\r\n]/)) {
      headers.push(field);
    }

    return normalizePandasHeaders(headers);
  }

  function normalizePandasHeaders(headers) {
    const seen = new Map();
    return headers.map((raw, index) => {
      const original = String(raw ?? "").replace(/^\uFEFF/, "");
      const base = original.trim() ? original : `Unnamed: ${index}`;
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}.${count}`;
    });
  }

  function guessColumn(headers, target) {
    const normalized = headers.map((header) => ({
      header,
      key: header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    }));
    const patterns = {
      review_text: [/^review$/, /review text/, /customer feedback/, /feedback/, /comment/, /message/, /^text$/, /response/],
      rating: [/^rating$/, /stars?/, /score/, /review rating/],
      date: [/^date$/, /created at/, /submitted at/, /timestamp/, /review date/],
      product: [/^product$/, /product name/, /item/, /service/],
      source: [/^source$/, /platform/, /channel/, /website/, /store/]
    }[target] || [];

    for (const pattern of patterns) {
      const match = normalized.find((item) => pattern.test(item.key));
      if (match) return match.header;
    }
    return "";
  }

  function populateMappingSelects(headers) {
    mappingFields.forEach((field) => {
      const select = $(field.selector);
      const previousValue = select.value;
      select.replaceChildren();

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = field.required ? "Choose a column" : "Not available";
      select.appendChild(placeholder);

      headers.forEach((header) => {
        const option = document.createElement("option");
        option.value = header;
        option.textContent = header;
        select.appendChild(option);
      });

      const guessed = previousValue && headers.includes(previousValue)
        ? previousValue
        : guessColumn(headers, field.target);
      if (guessed) select.value = guessed;
    });
    updateMappingStatus();
  }

  function updateMappingStatus() {
    const selected = mappingFields
      .map((field) => ({ field, value: $(field.selector).value }))
      .filter((item) => item.value);
    const values = selected.map((item) => item.value);
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    const reviewSelected = Boolean($("#map-review").value);

    if (duplicates.length) {
      elements.mappingMessage.textContent = "Each selected CSV column can only be used once.";
      elements.mappingMessage.classList.add("is-error");
      elements.analyzeButton.disabled = true;
    } else if (!reviewSelected) {
      elements.mappingMessage.textContent = "Choose the feedback text column to continue.";
      elements.mappingMessage.classList.remove("is-error");
      elements.analyzeButton.disabled = true;
    } else {
      elements.mappingMessage.textContent = "Column mapping looks good. Optional fields can stay empty.";
      elements.mappingMessage.classList.remove("is-error");
      elements.analyzeButton.disabled = !state.file;
    }
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showToast("Choose a CSV file to continue.", true);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast("This file is larger than the 20 MB frontend limit.", true);
      return;
    }
    if (file.size === 0) {
      showToast("This CSV file is empty.", true);
      return;
    }

    try {
      const text = await file.slice(0, Math.min(file.size, 256 * 1024)).text();
      const headers = parseCsvHeader(text);
      if (!headers.length || headers.every((header) => !header.trim())) {
        throw new Error("We couldn't find a header row in this CSV.");
      }

      state.file = file;
      state.headers = headers;
      elements.selectedFileName.textContent = file.name;
      elements.selectedFileMeta.textContent = `${(file.size / 1024).toFixed(1)} KB · ${headers.length} columns detected`;
      elements.selectedFileRow.hidden = false;
      elements.mappingPanel.hidden = false;
      elements.progress.hidden = true;
      populateMappingSelects(headers);
      elements.mappingPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      clearSelectedFile();
      showToast(error.message || "Unable to read this CSV file.", true);
    }
  }

  function clearSelectedFile() {
    state.file = null;
    state.headers = [];
    elements.fileInput.value = "";
    elements.selectedFileRow.hidden = true;
    elements.mappingPanel.hidden = true;
    elements.progress.hidden = true;
    elements.analyzeButton.disabled = true;
  }

  function getColumnMapping() {
    const mapping = {};
    for (const field of mappingFields) {
      const sourceColumn = $(field.selector).value;
      if (field.required && !sourceColumn) {
        throw new Error("Please choose the feedback text column.");
      }
      if (sourceColumn) mapping[sourceColumn] = field.target;
    }
    const targets = Object.values(mapping);
    if (new Set(targets).size !== targets.length) {
      throw new Error("A CSV column has been assigned more than once.");
    }
    return mapping;
  }

  async function runAnalysis() {
    if (!state.file) {
      showToast("Choose a CSV file first.", true);
      return;
    }

    let mapping;
    try {
      mapping = getColumnMapping();
    } catch (error) {
      showToast(error.message, true);
      return;
    }

    const formData = new FormData();
    formData.append("file", state.file);
    formData.append("column_mapping", JSON.stringify(mapping));

    elements.analyzeButton.disabled = true;
    elements.progress.hidden = false;
    elements.progressTitle.textContent = "Analyzing your feedback";
    elements.progressDescription.textContent = "Discovering topics and interpreting sentiment. CPU analysis can take a little while.";

    try {
      const result = await fetchJson("/analyze", {
        method: "POST",
        body: formData
      });
      state.currentAnalysisId = result.analysis_id;
      state.currentFilename = state.file.name;
      state.currentAnalysis = result;
      renderResults(result, state.currentFilename, result.analysis_id, new Date().toISOString());
      await loadHistory(false);
      showToast("Analysis completed and saved to your history.");
    } catch (error) {
      showToast(error.message || "Analysis failed. Check the backend logs for details.", true);
      elements.analyzeButton.disabled = false;
      elements.progress.hidden = true;
    }
  }

  function setDashboardToResults() {
    setView("dashboard");
    elements.introPanel.hidden = true;
    elements.uploadPanel.hidden = true;
    elements.trustStrip.hidden = true;
    elements.resultsSection.hidden = false;
  }

  function topicName(topicId, names) {
    const key = String(topicId);
    return names && (names[key] || names[Number(topicId)])
      ? (names[key] || names[Number(topicId)])
      : `Topic ${key}`;
  }

  function renderResults(data, filename, analysisId, createdAt) {
    state.currentAnalysis = data;
    state.currentFilename = filename || "Saved analysis";
    state.currentAnalysisId = analysisId ?? null;
    setDashboardToResults();
    elements.resultsMeta.textContent = `${state.currentFilename} · Analysis #${analysisId ?? "—"} · ${formatDate(createdAt)}`;

    const profile = data.dataset_profile || {};
    const insights = data.insights || {};
    const topics = Array.isArray(insights.topic_metrics) ? insights.topic_metrics : [];
    const sentiments = insights.sentiment_distribution || {};
    const sentimentTotal = Object.values(sentiments).reduce((sum, count) => sum + Number(count || 0), 0);
    const negativeCount = Number(sentiments.negative || sentiments.NEGATIVE || 0);
    const negativePercent = sentimentTotal ? (negativeCount / sentimentTotal) * 100 : 0;
    const languages = profile.language_distribution || {};
    const languageCount = Object.keys(languages).length;

    const metrics = [
      { label: "Reviews analyzed", value: formatNumber(profile.total_reviews), foot: "Valid feedback records", icon: "▤" },
      { label: "Topics discovered", value: formatNumber(topics.length), foot: "Themes found in the data", icon: "⌘" },
      { label: "Negative feedback", value: `${negativePercent.toFixed(1)}%`, foot: `${formatNumber(negativeCount)} negative reviews`, icon: "◒" },
      { label: "Languages detected", value: formatNumber(languageCount), foot: "Based on detected language", icon: "文" }
    ];
    elements.metricGrid.innerHTML = metrics.map((metric) => `
      <article class="metric-card"><div class="metric-head"><span>${escapeHtml(metric.label)}</span><span class="metric-icon">${escapeHtml(metric.icon)}</span></div><div class="metric-value">${escapeHtml(metric.value)}</div><div class="metric-foot">${escapeHtml(metric.foot)}</div></article>
    `).join("");

    renderSentiment(sentiments, sentimentTotal);
    renderRecommendations(data.recommendations || []);
    renderTopics(topics);
    renderTrends(data.topic_trends || [], data.topic_names || {});
    renderEmerging(data.emerging_topics || []);
    renderFeedback(data.analyzed_data || [], data.topic_names || {});
  }

  function renderSentiment(sentiments, total) {
    const counts = {
      positive: Number(sentiments.positive || sentiments.POSITIVE || 0),
      neutral: Number(sentiments.neutral || sentiments.NEUTRAL || 0),
      negative: Number(sentiments.negative || sentiments.NEGATIVE || 0)
    };
    const sum = counts.positive + counts.neutral + counts.negative;
    const denominator = sum || total || 1;
    const percentage = (value) => (value / denominator) * 100;
    elements.sentimentContent.innerHTML = `
      <div class="sentiment-total"><strong>${formatNumber(sum || total)}</strong><span>reviews classified</span></div>
      <div class="sentiment-bar" role="img" aria-label="Positive ${percentage(counts.positive).toFixed(1)} percent, neutral ${percentage(counts.neutral).toFixed(1)} percent, negative ${percentage(counts.negative).toFixed(1)} percent">
        <span class="sentiment-segment positive" style="width:${percentage(counts.positive)}%"></span>
        <span class="sentiment-segment neutral" style="width:${percentage(counts.neutral)}%"></span>
        <span class="sentiment-segment negative" style="width:${percentage(counts.negative)}%"></span>
      </div>
      <div class="sentiment-legend">
        <span class="legend-item"><i class="legend-dot positive"></i>Positive ${formatNumber(counts.positive)}</span>
        <span class="legend-item"><i class="legend-dot neutral"></i>Neutral ${formatNumber(counts.neutral)}</span>
        <span class="legend-item"><i class="legend-dot negative"></i>Negative ${formatNumber(counts.negative)}</span>
      </div>
    `;
  }

  function renderRecommendations(recommendations) {
    if (!recommendations.length) {
      elements.recommendations.innerHTML = '<div class="empty-message">No topics crossed the current attention thresholds. Keep monitoring new feedback.</div>';
      return;
    }
    elements.recommendations.innerHTML = recommendations.slice(0, 5).map((item) => {
      const priority = String(item.priority || "medium").toLowerCase();
      const evidence = item.evidence || {};
      return `<article class="recommendation-item ${priority === "high" ? "high" : "medium"}">
        <span class="recommendation-priority" aria-hidden="true"></span>
        <div><strong>${escapeHtml(item.topic_name || "Feedback area")} · ${escapeHtml(priority)} priority</strong><p>${escapeHtml(item.message || "Review this feedback area.")}</p>
        <span class="recommendation-evidence">${formatNumber(evidence.total_reviews)} reviews · ${Number(evidence.negative_percentage || 0).toFixed(1)}% negative</span></div>
      </article>`;
    }).join("");
  }

  function renderTopics(topics) {
    elements.topicCount.textContent = `${topics.length} ${topics.length === 1 ? "topic" : "topics"}`;
    if (!topics.length) {
      elements.topicBody.innerHTML = '<tr><td colspan="4" class="table-empty">No structured topics were discovered in this dataset. Try a larger or more varied dataset.</td></tr>';
      return;
    }
    elements.topicBody.innerHTML = topics.map((topic) => {
      const percent = Math.max(0, Math.min(100, Number(topic.negative_percentage || 0)));
      return `<tr>
        <td><span class="topic-name-cell">${escapeHtml(topic.topic_name || `Topic ${topic.topic_id}`)}</span><span class="topic-subtext">Topic ID ${escapeHtml(topic.topic_id)}</span></td>
        <td>${formatNumber(topic.total_reviews)}</td>
        <td><span class="negative-value">${percent.toFixed(1)}%</span></td>
        <td><div class="signal-track" role="img" aria-label="${percent.toFixed(1)} percent negative"><div class="signal-fill" style="width:${percent}%"></div></div></td>
      </tr>`;
    }).join("");
  }

  function renderTrends(trends, names) {
    if (!trends.length) {
      elements.trendList.innerHTML = '<div class="empty-message">Add a date column and compare saved analyses to build a clearer picture over time.</div>';
      return;
    }
    elements.trendList.innerHTML = trends.slice(0, 7).map((trend) => {
      const change = trend.change_percentage;
      const text = change === null || change === undefined ? "Baseline" : `${change > 0 ? "+" : ""}${Number(change).toFixed(1)}%`;
      const direction = change > 0 ? "is-up" : change < 0 ? "is-down" : "";
      return `<div class="trend-item"><span class="trend-name">${escapeHtml(topicName(trend.topic_id, names))}</span><span class="trend-number ${direction}">${escapeHtml(text)}</span></div>`;
    }).join("");
  }

  function renderEmerging(items) {
    if (!items.length) {
      elements.emergingList.innerHTML = '<div class="empty-message">No emerging topics flagged. Historical comparisons will appear here when available.</div>';
      return;
    }
    elements.emergingList.innerHTML = items.slice(0, 12).map((item) => `
      <span class="emerging-chip">✦ ${escapeHtml(item.topic_name || "New topic")} <small>${formatNumber(item.review_count)} reviews</small></span>
    `).join("");
  }

  function renderFeedback(rows, names) {
    const sample = rows.slice(0, 15);
    elements.feedbackCount.textContent = `${formatNumber(rows.length)} reviews`;
    if (!sample.length) {
      elements.feedbackBody.innerHTML = '<tr><td colspan="4" class="table-empty">No feedback records to display.</td></tr>';
      return;
    }
    elements.feedbackBody.innerHTML = sample.map((row) => {
      const sentiment = String(row.sentiment || "unknown").toLowerCase();
      const sentimentClass = ["positive", "neutral", "negative"].includes(sentiment) ? sentiment : "neutral";
      const review = row.review_text ?? row.cleaned_text ?? "";
      const confidence = Number(row.sentiment_score || 0);
      return `<tr>
        <td class="feedback-cell">${escapeHtml(review)}</td>
        <td>${escapeHtml(topicName(row.topic_id, names))}</td>
        <td><span class="sentiment-pill ${sentimentClass}">${escapeHtml(sentiment)}</span></td>
        <td class="confidence-cell">${confidence ? `${(confidence * 100).toFixed(1)}%` : "—"}</td>
      </tr>`;
    }).join("");
  }

  async function loadHistory(showErrors = true) {
    elements.historyList.setAttribute("aria-busy", "true");
    try {
      const payload = await fetchJson("/analyses");
      state.history = Array.isArray(payload.analyses) ? payload.analyses : [];
      renderHistory();
    } catch (error) {
      if (showErrors) showToast(error.message || "Unable to load analysis history.", true);
      elements.historyList.innerHTML = '<div class="history-empty"><span class="empty-icon">!</span><strong>Could not load history</strong><p>Check that the Feed Nest API is running, then refresh.</p></div>';
    } finally {
      elements.historyList.removeAttribute("aria-busy");
    }
  }

  function renderHistory() {
    if (!state.history.length) {
      elements.historyList.innerHTML = '<div class="history-empty"><span class="empty-icon">◷</span><strong>No saved analyses yet</strong><p>Your completed analyses will appear here.</p></div>';
      return;
    }
    elements.historyList.innerHTML = state.history.map((item) => `
      <button class="history-row" type="button" data-analysis-id="${Number(item.id)}">
        <span class="history-file-icon">CSV</span>
        <span class="history-row-main"><strong>${escapeHtml(item.filename || `Analysis ${item.id}`)}</strong><small>Analysis #${formatNumber(item.id)} · Saved ${escapeHtml(formatDate(item.created_at))}</small></span>
        <span class="history-row-meta"><span>Open analysis</span><span class="history-row-arrow" aria-hidden="true">→</span></span>
      </button>
    `).join("");

    elements.historyList.querySelectorAll("[data-analysis-id]").forEach((button) => {
      button.addEventListener("click", () => openSavedAnalysis(Number(button.dataset.analysisId)));
    });
  }

  async function openSavedAnalysis(analysisId) {
    try {
      const result = await fetchJson(`/analyses/${analysisId}`);
      renderResults(result.results || {}, result.filename, result.id, result.created_at);
      showToast(`Loaded analysis #${analysisId}.`);
    } catch (error) {
      showToast(error.message || "Unable to open this analysis.", true);
    }
  }

  function exportAnalyzedData() {
    const rows = state.currentAnalysis && state.currentAnalysis.analyzed_data;
    if (!Array.isArray(rows) || !rows.length) {
      showToast("There are no analyzed feedback rows to export.", true);
      return;
    }
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.map(quote).join(","), ...rows.map((row) => columns.map((column) => quote(row[column])).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(state.currentFilename || "feednest-analysis").replace(/\.csv$/i, "")}-analyzed.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Analyzed feedback exported as CSV.");
  }

  // The API accepts a CSV file and a JSON string containing source-to-target column mappings.
  elements.fileInput.addEventListener("change", (event) => handleFile(event.target.files && event.target.files[0]));
  elements.removeFile.addEventListener("click", clearSelectedFile);
  elements.analyzeButton.addEventListener("click", runAnalysis);
  mappingFields.forEach((field) => $(field.selector).addEventListener("change", updateMappingStatus));
  [elements.topUpload, elements.heroUpload, elements.historyUpload, elements.resultsUpload].forEach((button) => {
    button.addEventListener("click", openNewAnalysis);
  });
  elements.exportButton.addEventListener("click", exportAnalyzedData);
  elements.refreshHistory.addEventListener("click", () => loadHistory());
  document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  elements.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropzone.classList.add("is-dragging");
  });
  elements.dropzone.addEventListener("dragleave", () => elements.dropzone.classList.remove("is-dragging"));
  elements.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove("is-dragging");
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  checkApiStatus();
})();
