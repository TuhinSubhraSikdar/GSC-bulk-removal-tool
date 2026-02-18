// content_script.js
const waitForElement = (selector, options = {}) => {
  const { timeout = 1000 } = options;
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timeout waiting for element: " + selector));
    }, timeout);
  });
};

const waitForButtonWithText = (text, options = {}) => {
  const { timeout = 1000 } = options;
  return new Promise((resolve, reject) => {
    const checkButtons = () => {
      const buttons = document.querySelectorAll("button, div[role='button']");
      for (const btn of buttons) {
        if (btn.textContent.trim() === text) {
          return btn;
        }
      }
      return null;
    };

    const found = checkButtons();
    if (found) {
      return resolve(found);
    }

    const observer = new MutationObserver(() => {
      const btn = checkButtons();
      if (btn) {
        observer.disconnect();
        resolve(btn);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timeout waiting for button with text: " + text));
    }, timeout);
  });
};

const waitForDialogToDisappear = (options = {}) => {
  const { timeout = 1000 } = options;
  return new Promise((resolve, reject) => {
    const checkDialogGone = () => !document.querySelector("div[role='dialog']");
    if (checkDialogGone()) {
      return resolve();
    }
    const observer = new MutationObserver(() => {
      if (checkDialogGone()) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timeout waiting for dialog to disappear"));
    }, timeout);
  });
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processUrl") {
    (async () => {
      try {
        // Click the New Request button to open the removal modal using its text
        const newRequestBtn = await waitForButtonWithText("New Request");
        newRequestBtn.click();

        // Wait for the URL input field (without relying on jsname) and enter the URL
        const input = await waitForElement('input[placeholder="Enter URL"]');
        input.value = request.url;
        input.dispatchEvent(new Event("input", { bubbles: true }));

        // Wait a short period for the confirmation modal to load
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Wait for the second "Next" button (in the confirmation modal) and click it
        const secondNextBtn = await waitForButtonWithText("Next");
        secondNextBtn.click();

        // Wait a short period before clicking the "Submit request" button
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Wait for the "Submit request" button in the confirmation popup and click it
        const submitBtn = await waitForButtonWithText("Submit request");
        submitBtn.click();

        // Wait for the dialog to disappear as an indicator that the removal request completed
        await waitForDialogToDisappear({ timeout: 1000 });

        sendResponse({ success: true });
      } catch (error) {
        console.error("Processing error:", error);
        sendResponse({
          success: false,
          error: error.message || "Failed to complete removal process",
        });
      }
    })();
    return true; // Keep message channel open
  }
});
