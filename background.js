browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.get('folders').then((result) => {
    if (!result.folders) {
      browser.storage.local.set({ folders: {} });
    }
  });
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveNote") {
    browser.storage.local.get(message.noteId).then((result) => {
      const updatedNote = {
        ...result[message.noteId],
        title: message.title,
        content: message.content
      };
      return browser.storage.local.set({ [message.noteId]: updatedNote });
    }).then(() => {
      console.log('Note saved from background script');
    }).catch((error) => {
      console.error('Error saving note from background script:', error);
    });
  } else if (message.action === "exportNote") {
    const blob = new Blob([message.content], {type: message.type});
    const url = URL.createObjectURL(blob);
    
    browser.downloads.download({
      url: url,
      filename: message.filename,
      saveAs: true
    }).then(() => {
      URL.revokeObjectURL(url);
    }).catch((error) => {
      console.error('Error exporting note:', error);
    });
  }
});