// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processUrls") {
    chrome.storage.local.set(
      {
        urls: request.urls,
        totalUrls: request.urls.length,
        processedCount: 0,
        processing: true,
      },
      () => {
        // Determine the intended resource and construct the expected URL.
        const intendedResourceId = getIntendedResourceId(request.urls);
        const expectedUrl = `https://search.google.com/search-console/removals?resource_id=${intendedResourceId}`;

        // Update the active tab to the expected URL just once.
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          chrome.tabs.update(tab.id, { url: expectedUrl }, (updatedTab) => {
            // Wait for the tab to finish loading before starting processing.
            chrome.tabs.onUpdated.addListener(function onUpdated(tabId, info) {
              if (tabId === updatedTab.id && info.status === "complete") {
                chrome.tabs.onUpdated.removeListener(onUpdated);
                startProcessing();
              }
            });
          });
        });
      }
    );
    sendResponse({ success: true, message: "Processing started" });
    return true;
  } else if (request.action === "clearCache") {
    chrome.storage.local.set({ urls: [], totalUrls: 0, processedCount: 0, processing: false }, () => {
      sendResponse({ success: true, message: "Cache cleared and process stopped" });
    });
    return true;
  }
});

function getIntendedResourceId(urls) {
  if (!urls || urls.length === 0) return "";

  try {
    const urlObj = new URL(urls[0]);
    const hostname = urlObj.hostname;

    // Toggle this if needed
    const useDomainProperty = true;

    if (useDomainProperty) {
      return encodeURIComponent(`sc-domain:${hostname}`);
    } else {
      return encodeURIComponent(urlObj.origin);
    }
  } catch (e) {
    console.error("Invalid URL:", urls[0]);
    return "";
  }
}

async function startProcessing() {
  chrome.storage.local.get(["urls", "processedCount", "totalUrls", "processing"], async (data) => {
    if (!data.processing || !data.urls) return;
    let currentIndex = data.processedCount || 0;
    const urls = data.urls;
    const totalUrls = data.totalUrls;

    const processNextUrl = async () => {
      // Check if processing is still active before continuing.
      chrome.storage.local.get("processing", async (storageData) => {
        if (!storageData.processing) {
          console.log("Processing has been stopped.");
          return;
        }

        // If all URLs have been processed, mark processing as complete.
        if (currentIndex >= totalUrls) {
          chrome.storage.local.set({ processing: false });
          return;
        }

        // Get the active tab.
        const tab = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab)));

        // Send the processUrl message to the content script without refreshing the page.
        chrome.tabs.sendMessage(tab.id, { action: "processUrl", url: urls[currentIndex] }, async (response) => {
          currentIndex++;
          chrome.storage.local.set({ processedCount: currentIndex });
          // Wait a short period before processing the next URL.
          setTimeout(processNextUrl, 300);
        });
      });
    };

    processNextUrl();
  });
}

// Resume processing if needed when the extension loads.
chrome.storage.local.get(["urls", "processedCount", "totalUrls", "processing"], (data) => {
  if (data.processing && data.urls && data.processedCount < data.totalUrls) {
    startProcessing();
  }
});
