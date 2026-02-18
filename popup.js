const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const processBtn = document.getElementById("processBtn");
const clearCacheBtn = document.getElementById("clearCacheBtn");
const statusMessage = document.getElementById("statusMessage");
const statsDiv = document.getElementById("stats");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "#1a73e8";
});
dropZone.addEventListener("dragleave", () => {
  dropZone.style.borderColor = "#dadce0";
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "#dadce0";
  const file = e.dataTransfer.files[0];
  handleFile(file);
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  handleFile(file);
});

function handleFile(file) {
  if (file && file.name.endsWith(".csv")) {
    fileName.textContent = file.name;
    // Enable the Process URLs button when a new file is uploaded.
    processBtn.disabled = false;
    showStatus("File ready for processing", "success");
    const reader = new FileReader();
    reader.onload = (event) => {
      const urls = event.target.result
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      chrome.storage.local.set({ urls, totalUrls: urls.length, processedCount: 0 });
      updateStatsDisplay(urls.length, 0);
    };
    reader.readAsText(file);
  } else {
    showStatus("Please upload a valid CSV file", "error");
    processBtn.disabled = true;
  }
}

processBtn.addEventListener("click", () => {
  // Disable the Process URLs button so it stays disabled until another file is uploaded.
  processBtn.disabled = true;
  processBtn.innerHTML = '<div class="processing-spinner"></div> Processing...';
  chrome.storage.local.get("urls", ({ urls }) => {
    chrome.runtime.sendMessage({ action: "processUrls", urls }, (response) => {
      if (response && response.success) {
      } else {
        showStatus("Error processing URLs. Ensure you're on Google Search Console.", "error");
      }
      // Restore the button text without re-enabling the button.
      processBtn.innerHTML = "Process URLs";
    });
  });
});

clearCacheBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "clearCache" }, (response) => {
    if (response && response.success) {
      showStatus("Cache cleared and process stopped", "success");
      fileName.textContent = "";
      statsDiv.textContent = "";
      processBtn.disabled = true;
      chrome.storage.local.set({ urls: [], totalUrls: 0, processedCount: 0 });
    } else {
      showStatus("Error clearing cache", "error");
    }
  });
});

function showStatus(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = "block";
  setTimeout(() => {
    statusMessage.style.display = "none";
  }, 5000);
}

function updateStatsDisplay(total, processed) {
  if (total > 0) {
    statsDiv.textContent = `URLs Submitted: ${processed} / ${total}`;
  } else {
    statsDiv.textContent = "";
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.processedCount || changes.totalUrls)) {
    chrome.storage.local.get(["totalUrls", "processedCount"], (data) => {
      updateStatsDisplay(data.totalUrls || 0, data.processedCount || 0);
    });
  }
});

chrome.storage.local.get(["urls", "totalUrls", "processedCount"], (data) => {
  if (data.urls && data.urls.length) {
    fileName.textContent = "Imported: " + data.urls.length + " URLs";
  }
  updateStatsDisplay(data.totalUrls || 0, data.processedCount || 0);
});
