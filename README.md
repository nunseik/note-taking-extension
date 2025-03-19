# Note Taking Extension for Firefox

A browser extension for taking rich-text notes with automatic organization by webpage and folder.

## Features

- **Rich Text Editing**: Format your notes with bold, italic, underline, headings, and text highlighting
- **Folder Organization**: Notes are automatically organized by website and path
- **Multi-Page Notes**: Attach notes to specific web pages and access them across browsing sessions
- **Export Options**: Export your notes as TXT, HTML, or Markdown
- **Keyboard Shortcuts**: Efficiently manage and edit notes with keyboard shortcuts
- **Auto-Save**: Notes are automatically saved as you type

## Installation

### Firefox

1. Download the extension files
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select any file in the extension directory (e.g., `manifest.json`)

## Usage

### Basic Controls

- Click the extension icon in the toolbar to open the note-taking interface
- Use the toolbar buttons or keyboard shortcuts to format your text
- Notes are automatically saved as you type
- Click "Save Note" to manually save your work

### Creating and Managing Notes

- Click "New Note" to create a new note for the current webpage
- Notes are automatically organized into folders based on the website URL
- Select a folder from the dropdown to view notes from that site
- Click a note in the list to open it

### Formatting Options

- Bold: Click the Bold button or press Alt+B
- Italic: Click the Italic button or press Alt+I
- Underline: Click the Underline button or press Alt+U
- Heading 1: Click H1 or press Alt+1
- Heading 2: Click H2 or press Alt+2
- Highlight:
  - Yellow: Alt+Y
  - Red: Alt+R
  - Blue: Alt+L

### Keyboard Shortcuts

- Alt+N: Create new note
- Alt+S: Save note
- Alt+D: Delete selected note
- Alt+Enter: Open the webpage associated with the selected note
- Arrow Up/Down: Navigate between notes
- Arrow Right: Focus on editor
- Arrow Left: Focus on folder selection
- Ctrl+Shift+Down (or Command+Shift+Down on Mac): Open the extension

### Exporting Notes

1. Select a note
2. Choose the export format (TXT, HTML, or Markdown)
3. Click "Export Note"
4. Choose a location to save the file

### Folder Management

- Select a folder from the dropdown to view notes from that folder
- Click the rename button (pencil icon) to rename a folder
- Click the delete button (trash icon) to delete a folder and all its notes

## Project Structure

- **manifest.json**: Extension configuration
- **background.js**: Background scripts for data persistence and export functionality
- **popup.html**: Main user interface
- **popup.js**: UI interaction and note management logic
- **popup.css**: Styling for the UI

## Technical Details

### Storage

- Notes are stored in the browser's local storage
- Each note is stored with:
  - Unique ID
  - Title
  - Content (HTML)
  - Folder assignment
  - Associated URLs
  - Last modified timestamp

### Performance Optimization

- Note caching system to improve loading speed
- Debounced saving to reduce storage operations
- Progressive loading of notes for better performance with large collections

## Privacy

- All data is stored locally in your browser
- No data is sent to external servers
- Notes can only be accessed by the extension itself

## Requirements

- Firefox 57+

## Future Enhancements

- Cloud sync across devices
- Image embedding
- Tagging system
- Search functionality
- Dark mode
- Custom formatting options
- List sorting options
- Import notes
- Chrome support

## Troubleshooting

- If notes aren't saving, check your browser's storage permissions
- Clear the extension's storage data through Firefox settings if you encounter persistent issues
- If the extension appears frozen, try closing and reopening it
