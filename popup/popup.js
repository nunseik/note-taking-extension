let currentNoteId = null;
let currentFolder = null;
let currentUrl = null;
let autoSaveInterval = null;
let isNoteDirty = false;

// Utility Functions
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function getCurrentPageFolder() {
  return browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
    const url = new URL(tabs[0].url);
    const pathParts = url.pathname.split('/');
    
    // For Class Central courses
    if (url.hostname === 'www.classcentral.com' && pathParts[1] === 'classroom') {
      // Extract the course name (assuming it's always the 3rd part of the path)
      const courseName = pathParts[2];
      return `ClassCentral_${courseName}`;
    }
    
    // For other websites, use hostname + first path segment
    return `${url.protocol}//${url.hostname}${pathParts[1] ? '/' + pathParts[1] : ''}`;
  });
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
  const notesList = document.getElementById('notesList');
  const editor = document.getElementById('editor');
  const newButton = document.getElementById('newButton');
  const saveButton = document.getElementById('saveButton');
  const titleInput = document.getElementById('noteTitle');
  const folderSelect = document.getElementById('folderSelect');
  const renameFolderButton = document.getElementById('renameFolder');
  const deleteFolderButton = document.getElementById('deleteFolder');
  const exportButton = document.getElementById('exportButton');
  const exportFormatSelect = document.getElementById('exportFormat');
  const NOTE_CACHE_SIZE = 20;
  const noteCache = new Map();

  initializeExtension();

  function initializeExtension() {
    getCurrentPageFolder()
      .then((folder) => {
        return loadFolders().then((folders) => ({ folder, folders }));
      })
      .then(({ folder, folders }) => {
        if (folders[folder]) {
          currentFolder = folder;
        } else {
          currentFolder = 'all';
        }
        folderSelect.value = currentFolder;
        updateFolderControls();
        loadNotes();
        startAutoSave();
        preloadNotes();
      })
      .catch((error) => {
        console.error('Error initializing extension:', error);
        showErrorMessage('Failed to initialize. Please reload the extension.');
      });
  }

  // Left Panel Functions
  function loadFolders() {
    return browser.storage.local.get('folders').then((result) => {
      const folders = result.folders || {};
      folderSelect.innerHTML = '<option value="all">All Notes</option>';
      for (let folder in folders) {
        folderSelect.innerHTML += `<option value="${folder}">${folders[folder].name}</option>`;
      }
      folderSelect.value = currentFolder;  // Set the selected folder
      updateFolderControls();
      return folders;
    });
  }

  function updateFolderControls() {
    const isAllNotesSelected = folderSelect.value === 'all';
    renameFolderButton.disabled = isAllNotesSelected;
    deleteFolderButton.disabled = isAllNotesSelected;
  }

  function renameFolder() {
    const currentFolderKey = folderSelect.value;
    const currentFolderName = folderSelect.options[folderSelect.selectedIndex].text;
    const newName = prompt(`Enter new name for folder "${currentFolderName}":`, currentFolderName);
    
    if (newName && newName !== currentFolderName) {
      browser.storage.local.get('folders').then((result) => {
        let folders = result.folders || {};
        folders[currentFolderKey].name = newName;
        return browser.storage.local.set({ folders });
      }).then(() => {
        batchUpdateUI();
      }).catch((error) => {
        console.error('Error renaming folder:', error);
        showErrorMessage('Failed to rename folder. Please try again.');
      });
    }
  }

  function deleteFolder() {
    const folderToDelete = folderSelect.value;
    const folderName = folderSelect.options[folderSelect.selectedIndex].text;
    
    if (confirm(`Are you sure you want to delete the folder "${folderName}" and all its notes?`)) {
      browser.storage.local.get(null).then((result) => {
        const notesToDelete = Object.keys(result).filter(key => 
          key !== 'folders' && result[key].folder === folderToDelete
        );
        
        return browser.storage.local.remove(notesToDelete).then(() => {
          let folders = result.folders || {};
          delete folders[folderToDelete];
          return browser.storage.local.set({ folders });
        });
      }).then(() => {
        currentFolder = 'all';
        batchUpdateUI();
      }).catch((error) => {
        console.error('Error deleting folder:', error);
        showErrorMessage('Failed to delete folder. Please try again.');
      });
    }
  }

  // Notes List Functions
  /**
 * Loads and displays notes in the UI.
 */
  function loadNotes(page = 1, pageSize = 50) {
    browser.storage.local.get(null).then((result) => {
      const notes = filterAndSortNotes(result);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedNotes = notes.slice(startIndex, endIndex);
      
      const fragment = createNotesFragment(paginatedNotes, result);
      updateNotesList(fragment);
      addNoteEventListeners(paginatedNotes);  // Pass paginatedNotes instead of result
      highlightActiveNote();
    }).catch((error) => {
      console.error('Error loading notes:', error);
    });
  }

  /**
   * Filters out non-note entries and sorts notes by last modified date.
   * @param {Object} result - The storage result containing all data.
   * @returns {Array} Sorted array of note entries.
   */
  function filterAndSortNotes(result) {
    return Object.entries(result)
      .filter(([id]) => id !== 'folders')
      .sort(([, a], [, b]) => b.lastModified - a.lastModified);
  }

  /**
   * Creates a document fragment containing note elements.
   * @param {Array} notes - Array of note entries.
   * @param {Object} result - The original storage result.
   * @returns {DocumentFragment} Fragment containing note elements.
   */
  function createNotesFragment(notes, result) {
    const fragment = document.createDocumentFragment();
    for (let [id, noteData] of notes) {
      if (currentFolder === 'all' || noteData.folder === currentFolder) {
        const noteElement = createNoteElement(id, noteData);
        fragment.appendChild(noteElement);
      }
    }
    return fragment;
  }

  /**
   * Creates a single note element.
   * @param {string} id - The note ID.
   * @param {Object} noteData - The note data.
   * @returns {HTMLElement} The created note element.
   */
  function createNoteElement(id, noteData) {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    noteElement.dataset.id = id;
    noteElement.innerHTML = `
      <button class="go-to-page-btn" title="Go to page"><i class="fas fa-external-link-alt"></i></button>
      <span class="note-item-title">${noteData.title || 'Untitled'}</span>
      <button class="delete-note-btn" title="Delete note"><i class="fas fa-trash"></i></button>
    `;
    return noteElement;
  }

  /**
   * Updates the notes list in the DOM.
   * @param {DocumentFragment} fragment - The fragment containing note elements.
   */
  function updateNotesList(fragment) {
    notesList.innerHTML = '';
    notesList.appendChild(fragment);
  }

  /**
   * Adds event listeners to note elements.
   * @param {Object} result - The original storage result.
   */
  function addNoteEventListeners(notes) {
    notesList.querySelectorAll('.note-item').forEach(noteElement => {
      const id = noteElement.dataset.id;
      const noteData = notes.find(([noteId]) => noteId === id)[1];  // Get noteData from notes array
      
      noteElement.querySelector('.note-item-title').addEventListener('click', () => {
        showLoadingIndicator();
        loadNote(id);
      });
      
      noteElement.querySelector('.delete-note-btn').addEventListener('click', e => {
        e.stopPropagation();
        deleteNote(id);
      });
      
      noteElement.querySelector('.go-to-page-btn').addEventListener('click', e => {
        e.stopPropagation();
        if (noteData.urls && noteData.urls.length > 0) {
          goToNotePage(noteData.urls[0]);
        } else {
          console.error('No URL found for this note');
        }
      });
    });
  }
  
  function goToNotePage(url) {
    browser.tabs.create({ url: url });
  }

  function highlightActiveNote() {
    notesList.querySelectorAll('.note-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === currentNoteId);
    });
  }

  function deleteNote(id) {
    browser.storage.local.get(id).then((result) => {
      const noteFolder = result[id].folder;
      return browser.storage.local.remove(id).then(() => noteFolder);
    }).then((folder) => {
      console.log('Note deleted');
      if (currentNoteId === id) {
        newNote();
      }
      return checkAndDeleteEmptyFolder(folder);
    }).then(() => {
      batchUpdateUI();
    }).catch((error) => {
      console.error('Error deleting note:', error);
      showErrorMessage('Failed to delete note. Please try again.');
    });
  }

  function checkAndDeleteEmptyFolder(folder) {
    return browser.storage.local.get(null).then((result) => {
      const notes = Object.entries(result).filter(([key, value]) => key !== 'folders' && value.folder === folder);
      if (notes.length === 0 && folder !== 'all') {
        return browser.storage.local.get('folders').then((result) => {
          let folders = result.folders || {};
          delete folders[folder];
          return browser.storage.local.set({ folders });
        }).then(() => {
          console.log('Empty folder deleted:', folder);
          if (currentFolder === folder) {
            currentFolder = 'all';
            folderSelect.value = 'all';
          }
        });
      }
    });
  }

  // Right Panel Functions
  function loadNote(id) {
    showLoadingIndicator();
  
    // First, check the cache
    if (noteCache.has(id)) {
      const noteData = noteCache.get(id);
      displayNote(noteData);
      currentNoteId = id;
      hideLoadingIndicator();
      return Promise.resolve();
    }
  
    // If not in cache, load from storage
    return browser.storage.local.get(id)
      .then(result => {
        const noteData = result[id];
        if (!noteData) {
          throw new Error('Note not found');
        }
        addToCache(id, noteData);
        displayNote(noteData);
        currentNoteId = id;
      })
      .catch(error => {
        console.error('Error loading note:', error);
        showErrorMessage('Failed to load note. Please try again.');
      })
      .finally(() => {
        hideLoadingIndicator();
      });
  }
  
  // Preload notes for faster access
  function preloadNotes() {
    browser.storage.local.get(null).then(result => {
      const notes = Object.entries(result)
        .filter(([key, value]) => key !== 'folders')
        .sort(([, a], [, b]) => b.lastModified - a.lastModified)
        .slice(0, NOTE_CACHE_SIZE);
      
      notes.forEach(([id, noteData]) => addToCache(id, noteData));
    });
  }

  function displayNote(noteData) {
    currentNoteId = noteData.id;
    editor.innerHTML = noteData.content;
    titleInput.value = noteData.title || '';
    highlightActiveNote();
    isNoteDirty = false;
  }

  function updateCurrentContext() {
    return browser.tabs.query({active: true, currentWindow: true})
      .then(tabs => {
        currentUrl = tabs[0].url;
        return getCurrentPageFolder();
      })
      .then(folderName => {
        currentFolder = folderName;
      });
  }

    /**
   * Saves the current note to storage.
   * @returns {Promise} A promise that resolves when the note is saved.
   */
    function saveNote() {
      if (!isNoteDirty) return Promise.resolve();
    
      const noteContent = editor.innerHTML;
      const noteTitle = titleInput.value;
    
      return (currentFolder && currentUrl ? Promise.resolve() : updateCurrentContext())
        .then(() => saveNoteToStorage(currentFolder, noteContent, noteTitle, currentUrl))
        .then(({ newId, folderName, isNewNote }) => {
          currentNoteId = newId;
          currentFolder = folderName;
          isNoteDirty = false;
          if (isNewNote) {
            addToCache(newId, { id: newId, title: noteTitle, content: noteContent, folder: folderName });
          }
          return batchUpdateUI();
        })
        .catch(error => {
          console.error('Error saving note:', error);
          showErrorMessage('Failed to save note. Please try again.');
        });
    }

  const debouncedSaveNote = debounce(saveNote, 1000); // 1 second delay

  function newNote() {
    currentNoteId = null;
    editor.innerHTML = '';
    titleInput.value = '';
    highlightActiveNote();
    isNoteDirty = false;
    updateCurrentContext().then(() => {
      folderSelect.value = currentFolder;
      updateFolderControls();
    });
  }

  /**
 * Saves a note to storage.
 * @param {string} folderName - The folder to save the note in.
 * @param {string} content - The content of the note.
 * @param {string} title - The title of the note.
 * @returns {Promise} A promise that resolves with the saved note's ID and folder.
 */
  function saveNoteToStorage(folderName, content, title, url) {
    return browser.storage.local.get(null)
      .then(result => {
        const folders = result.folders || {};
        let noteId = currentNoteId;
        let isNewNote = false;
  
        // If currentNoteId is null, we're creating a new note
        if (!noteId) {
          isNewNote = true;
          noteId = `note_${Date.now()}`;
        }
  
        const noteData = {
          id: noteId,
          title: title || 'Untitled',
          content: content,
          folder: folderName,
          lastModified: Date.now(),
          urls: isNewNote ? [url] : (result[noteId]?.urls || [])
        };
  
        // If it's an existing note, update the URL if it's new
        if (!isNewNote && !noteData.urls.includes(url)) {
          noteData.urls.push(url);
        }
  
        if (!folders[folderName]) {
          folders[folderName] = { name: folderName };
        }
  
        return browser.storage.local.set({ 
          [noteId]: noteData,
          folders: folders
        }).then(() => ({ newId: noteId, folderName, isNewNote }));
      });
  }
  
  function batchUpdateUI() {
    loadFolders()
      .then(() => {
        folderSelect.value = currentFolder;
        updateFolderControls();
        loadNotes();
      });
  }

  // Cache Functions
  function addToCache(id, noteData) {
    if (noteCache.size >= NOTE_CACHE_SIZE) {
      const oldestKey = noteCache.keys().next().value;
      noteCache.delete(oldestKey);
    }
    noteCache.set(id, noteData);
  }

  // Indicator Functions
  function showLoadingIndicator() {
    // Add a loading indicator to your HTML
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'block';
    }
  }
  
  function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
  
  function showErrorMessage(message) {
    // Add an error message display to your HTML
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) {
      errorDisplay.textContent = message;
      errorDisplay.style.display = 'block';
      setTimeout(() => {
        errorDisplay.style.display = 'none';
      }, 3000);
    }
  }

  // Event Listeners
  newButton.addEventListener('click', newNote);
  saveButton.addEventListener('click', function() {
    saveNote();
    isNoteDirty = false;
  });
  
  folderSelect.addEventListener('change', function() {
    currentFolder = this.value;
    loadNotes();
    updateFolderControls();
  });

  renameFolderButton.addEventListener('click', renameFolder);
  deleteFolderButton.addEventListener('click', deleteFolder);
  exportButton.addEventListener('click', exportNote);

  editor.addEventListener('input', function() {
    isNoteDirty = true;
    debouncedSaveNote();
  });
  
  titleInput.addEventListener('input', function() {
    isNoteDirty = true;
    debouncedSaveNote();
  });


  // Toolbar Event Listeners
  // Toolbar buttons
  document.getElementById('normal').addEventListener('click', () => document.execCommand('formatBlock', false, 'p'));
  document.getElementById('bold').addEventListener('click', () => document.execCommand('bold'));
  document.getElementById('italic').addEventListener('click', () => document.execCommand('italic'));
  document.getElementById('underline').addEventListener('click', () => document.execCommand('underline'));
  document.getElementById('h1').addEventListener('click', () => document.execCommand('formatBlock', false, 'h1'));
  document.getElementById('h2').addEventListener('click', () => document.execCommand('formatBlock', false, 'h2'));
  
  document.getElementById('highlightYellow').addEventListener('click', (e) => { e.preventDefault(); highlight('yellow'); });
  document.getElementById('highlightRed').addEventListener('click', () => highlight('red'));
  document.getElementById('highlightBlue').addEventListener('click', () => highlight('blue'));

  function highlight(color) {
    editor.focus();
    document.execCommand('removeFormat', false, 'highlight');
    document.execCommand('backColor', false, color === 'yellow' ? '#ffffcc' : color === 'red' ? '#ffcccc' : '#ccf2ff');
    isNoteDirty = true;
    debouncedSaveNote();
  }

  // Auto-save Functions
  function startAutoSave() {
    stopAutoSave(); // Clear any existing interval
    autoSaveInterval = setInterval(() => {
      if (isNoteDirty) {
        saveNote().then(() => {
          console.log('Auto-saved note:', currentNoteId);
        }).catch(error => {
          console.error('Auto-save failed:', error);
        });
      }
    }, 60000); // Auto-save every minute
  }

  function stopAutoSave() {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
    }
  }

  // Export Functions

  function exportNote() {
    if (!currentNoteId || isNoteDirty) {
      alert("Please save the note before exporting.");
      return;
    }

    const format = exportFormatSelect.value;

    browser.storage.local.get(currentNoteId).then((result) => {
      const note = result[currentNoteId];
      let content = '';

      switch (format) {
        case 'txt':
          content = `${note.title}\n\n${stripHtml(note.content)}`;
          break;
        case 'html':
          content = `<h1>${note.title}</h1>\n${note.content}`;
          break;
        case 'md':
          content = `# ${note.title}\n\n${htmlToMarkdown(note.content)}`;
          break;
      }

      browser.runtime.sendMessage({
        action: "exportNote",
        content: content,
        filename: `${note.title}.${format}`,
        type: `text/${format === 'md' ? 'markdown' : format}`
      });
    });
  }
  
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  
  function htmlToMarkdown(html) {
    let markdown = html;
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n');
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n');
    markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<u>(.*?)<\/u>/gi, '_$1_');
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    markdown = markdown.replace(/<\/p>/gi, '\n\n');
    markdown = stripHtml(markdown);
    return markdown.trim();
  }

  // Button Effects
  addButtonClickEffect();

  function addButtonClickEffect() {
    document.querySelectorAll('button').forEach(button => {
      button.addEventListener('mousedown', function() {
        this.classList.add('button-click');
      });
      button.addEventListener('mouseup', function() {
        this.classList.remove('button-click');
      });
      button.addEventListener('mouseleave', function() {
        this.classList.remove('button-click');
      });
    });
  }

  

  // Send message to background script when popup is closing
  window.addEventListener('unload', function() {
    if (isNoteDirty && currentNoteId) {
      browser.runtime.sendMessage({
        action: "saveNote",
        noteId: currentNoteId,
        title: titleInput.value,
        content: editor.innerHTML
      });
    }
  });

});