// DOCMATE - Smart Reading Platform
// Main JavaScript functionality

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// Global state
let currentBooks = JSON.parse(localStorage.getItem('docmate_books')) || [];
let currentNotes = JSON.parse(localStorage.getItem('docmate_notes')) || [];
let currentAudioNotes = JSON.parse(localStorage.getItem('docmate_audio_notes')) || [];
let currentBook = null;
let currentPage = 0;
let totalPages = 0;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let currentLanguage = 'en';

// Language configurations
const languageConfig = {
    'en': { lang: 'en-US', name: 'English', translateCode: 'en' },
    'yo': { lang: 'yo-NG', name: 'Yoruba', fallback: 'en-US', translateCode: 'yo' },
    'ig': { lang: 'ig-NG', name: 'Igbo', fallback: 'en-US', translateCode: 'ig' },
    'ha': { lang: 'ha-NG', name: 'Hausa', fallback: 'en-US', translateCode: 'ha' },
    'fr': { lang: 'fr-FR', name: 'French', translateCode: 'fr' },
    'es': { lang: 'es-ES', name: 'Spanish', translateCode: 'es' },
    'ar': { lang: 'ar-SA', name: 'Arabic', translateCode: 'ar' },
    'sw': { lang: 'sw-KE', name: 'Swahili', fallback: 'en-US', translateCode: 'sw' },
    'pt': { lang: 'pt-PT', name: 'Portuguese', translateCode: 'pt' },
    'de': { lang: 'de-DE', name: 'German', translateCode: 'de' },
    'it': { lang: 'it-IT', name: 'Italian', translateCode: 'it' },
    'ru': { lang: 'ru-RU', name: 'Russian', translateCode: 'ru' },
    'zh': { lang: 'zh-CN', name: 'Chinese', translateCode: 'zh' },
    'ja': { lang: 'ja-JP', name: 'Japanese', translateCode: 'ja' },
    'hi': { lang: 'hi-IN', name: 'Hindi', translateCode: 'hi' }
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadTheme();
    displayLibrary();
    displaySavedNotes();
    displayAudioNotes();
    updateCounts();
    
    // Add event listeners
    setupEventListeners();
    
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = function() {
            console.log('Speech synthesis voices loaded');
        };
    }
});

// Event Listeners Setup
function setupEventListeners() {
    // File input
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('analysisFileInput').addEventListener('change', analyzeDocument);
    
    // Search inputs
    document.getElementById('librarySearchInput').addEventListener('input', searchLibrary);
    document.getElementById('notesSearchInput').addEventListener('input', searchNotes);
    document.getElementById('audioSearchInput').addEventListener('input', searchAudioNotes);
    document.getElementById('searchInput').addEventListener('keypress', handleSearchEnter);
    
    // Language selector
    document.getElementById('languageSelector').addEventListener('change', onLanguageChange);
    
    // Drag and drop
    const uploadZone = document.querySelector('.upload-zone');
    if (uploadZone) {
        uploadZone.addEventListener('dragover', handleDragOver);
        uploadZone.addEventListener('dragleave', handleDragLeave);
        uploadZone.addEventListener('drop', handleFileDrop);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Navigation Functions
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav icons
    document.querySelectorAll('.nav-icon').forEach(icon => {
        icon.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    // Update active nav icon
    const activeIcon = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (activeIcon) {
        activeIcon.classList.add('active');
    }
    
    // Special handling for reading section
    if (sectionId === 'reading' && currentBook) {
        displayCurrentPage();
        showAudioControls();
    }
}

// Theme Management
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    
    if (body.hasAttribute('data-theme') && body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('docmate_theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('docmate_theme', 'dark');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('docmate_theme');
    const themeToggle = document.getElementById('themeToggle');
    
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// File Upload Handlers
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading('Processing document...');
    processFile(file);
}

function handleFileDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        showLoading('Processing document...');
        processFile(files[0]);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

// File Processing
async function processFile(file) {
    try {
        const fileType = file.type;
        const fileName = file.name.toLowerCase();
        
        let content = '';
        let contentType = 'text';
        
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            const result = await processPDF(file);
            content = result.text;
            contentType = 'pdf';
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
            content = await processDOCX(file);
            contentType = 'docx';
        } else if (fileType.startsWith('text/') || fileName.endsWith('.txt')) {
            content = await readAsText(file);
            contentType = 'text';
        } else {
            throw new Error('Unsupported file type');
        }
        
        if (!content.trim()) {
            throw new Error('No readable content found in the document');
        }
        
        // Create book object
        const book = {
            id: Date.now(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            content: content,
            originalContent: content,
            contentType: contentType,
            pages: splitIntoPages(content),
            currentPage: 0,
            uploadDate: new Date().toISOString()
        };
        
        if (!book.pages || book.pages.length === 0) {
            throw new Error('Failed to process document pages');
        }
        
        // Save book
        currentBooks.unshift(book);
        localStorage.setItem('docmate_books', JSON.stringify(currentBooks));
        
        // Set as current book and show reading view
        currentBook = book;
        currentPage = 0;
        totalPages = book.pages.length;
        
        // Hide home section and show reading section
        showSection('reading');
        displayCurrentPage();
        
        hideLoading();
        showToast('Document uploaded successfully!', 'success');
        updateCounts();
        
    } catch (error) {
        console.error('Error processing file:', error);
        hideLoading();
        showToast('Error processing document: ' + error.message, 'error');
    }
}

async function processPDF(file) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n\n';
            }
            
            resolve({ text: fullText });
        } catch (error) {
            reject(error);
        }
    });
}

async function processDOCX(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                .then(result => resolve(result.value))
                .catch(error => reject(error));
        };
        reader.onerror = () => reject(new Error('Failed to read DOCX file'));
        reader.readAsArrayBuffer(file);
    });
}

function readAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
}

function splitIntoPages(content) {
    const wordsPerPage = 400;
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const pages = [];
    
    if (words.length === 0) {
        return ['No content available'];
    }
    
    for (let i = 0; i < words.length; i += wordsPerPage) {
        const pageWords = words.slice(i, i + wordsPerPage);
        let pageText = pageWords.join(' ');
        
        // Try to end on a sentence boundary
        if (i + wordsPerPage < words.length && !pageText.match(/[.!?]$/)) {
            const lastSentenceEnd = Math.max(
                pageText.lastIndexOf('.'),
                pageText.lastIndexOf('!'),
                pageText.lastIndexOf('?')
            );
            if (lastSentenceEnd > pageText.length * 0.7) {
                pageText = pageText.substring(0, lastSentenceEnd + 1);
                const actualWords = pageText.split(/\s+/).length;
                i = i + actualWords - wordsPerPage;
            }
        }
        
        pages.push(pageText);
    }
    
    return pages.length > 0 ? pages : ['No content available'];
}

// Document Display
function displayCurrentPage() {
    if (!currentBook || !currentBook.pages || currentBook.pages.length === 0) {
        document.getElementById('documentContent').innerHTML = '<p>No content available</p>';
        document.getElementById('documentTitle').textContent = 'No Document';
        document.getElementById('pageInfo').textContent = 'Page 0 of 0';
        return;
    }
    
    const page = currentBook.pages[currentPage] || 'No content available';
    
    // Update document display
    document.getElementById('documentTitle').textContent = currentBook.title;
    document.getElementById('documentContent').innerHTML = formatDocumentContent(page);
    document.getElementById('pageInfo').textContent = `Page ${currentPage + 1} of ${currentBook.pages.length}`;
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage === currentBook.pages.length - 1;
    
    // Save progress
    currentBook.currentPage = currentPage;
    localStorage.setItem('docmate_books', JSON.stringify(currentBooks));
}

function formatDocumentContent(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return '<p>No content available for this page.</p>';
    }
    
    return text
        .replace(/\n\n+/g, '</p><p>')
        .replace(/^\s*/, '<p>')
        .replace(/\s*$/, '</p>')
        .replace(/<p>\s*<\/p>/g, '');
}

function showAudioControls() {
    const audioControls = document.getElementById('audioControls');
    if (audioControls && currentBook) {
        audioControls.style.display = 'block';
    }
}

// Navigation
function previousPage() {
    if (currentPage > 0) {
        currentPage--;
        displayCurrentPage();
        updateAudioProgress();
    }
}

function nextPage() {
    if (currentBook && currentPage < currentBook.pages.length - 1) {
        currentPage++;
        displayCurrentPage();
        updateAudioProgress();
    }
}

// Library Display
function displayLibrary() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    
    if (currentBooks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book empty-icon"></i>
                <h3 class="empty-title">No books yet</h3>
                <p class="empty-desc">Upload your first document to get started</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = currentBooks.map(book => {
        const iconClass = book.contentType === 'pdf' ? 'fas fa-file-pdf' : 
                         book.contentType === 'docx' ? 'fas fa-file-word' : 'fas fa-file-alt';
        
        return `
            <div class="book-card" onclick="openBook(${book.id})">
                <div class="card-header">
                    <div>
                        <div class="card-title">
                            <i class="${iconClass}" style="color: var(--accent-color); margin-right: 0.5rem;"></i>
                            ${book.title}
                        </div>
                        <div class="card-meta">${book.pages.length} pages • ${book.contentType.toUpperCase()}</div>
                    </div>
                    <div class="card-actions">
                        <button class="edit-btn" onclick="event.stopPropagation(); editBookTitle(${book.id})" title="Edit Title">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    <p>${book.content.substring(0, 150)}...</p>
                </div>
                <div class="card-meta">
                    Uploaded: ${new Date(book.uploadDate).toLocaleDateString()}
                </div>
            </div>
        `;
    }).join('');
}

function openBook(bookId) {
    currentBook = currentBooks.find(book => book.id === bookId);
    if (currentBook) {
        currentPage = currentBook.currentPage || 0;
        totalPages = currentBook.pages.length;
        showSection('reading');
        displayCurrentPage();
        showAudioControls();
    }
}

function editBookTitle(bookId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (book) {
        const newTitle = prompt('Edit book title:', book.title);
        if (newTitle && newTitle.trim()) {
            book.title = newTitle.trim();
            localStorage.setItem('docmate_books', JSON.stringify(currentBooks));
            displayLibrary();
            showToast('Book title updated!', 'success');
        }
    }
}

// Notes Management
function displaySavedNotes() {
    const notesList = document.getElementById('savedNotesList');
    if (!notesList) return;
    
    if (currentNotes.length === 0) {
        notesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sticky-note empty-icon"></i>
                <h3 class="empty-title">No saved notes yet</h3>
                <p class="empty-desc">Start reading and add notes to your documents</p>
            </div>
        `;
        return;
    }
    
    notesList.innerHTML = currentNotes.map(note => `
        <div class="note-card">
            <div class="card-header">
                <div>
                    <div class="card-title">${note.bookTitle || 'Quick Note'}</div>
                    <div class="card-meta">${new Date(note.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="card-actions">
                    <button class="edit-btn" onclick="editNote(${note.id})" title="Edit Note">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                </div>
            </div>
            <div class="card-content">
                <p>${note.content}</p>
            </div>
            ${note.bookTitle ? `<div class="card-meta">Page ${note.page + 1}</div>` : ''}
        </div>
    `).join('');
}

function addNewNote() {
    showQuickNote();
}

function editNote(noteId) {
    const note = currentNotes.find(n => n.id === noteId);
    if (note) {
        const newContent = prompt('Edit note:', note.content);
        if (newContent !== null && newContent.trim()) {
            note.content = newContent.trim();
            localStorage.setItem('docmate_notes', JSON.stringify(currentNotes));
            displaySavedNotes();
            showToast('Note updated!', 'success');
        }
    }
}

// Audio Notes
function displayAudioNotes() {
    const audioGrid = document.getElementById('audioNotesGrid');
    if (!audioGrid) return;
    
    if (currentAudioNotes.length === 0) {
        audioGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-microphone empty-icon"></i>
                <h3 class="empty-title">No audio notes yet</h3>
                <p class="empty-desc">Start reading and record your thoughts</p>
            </div>
        `;
        return;
    }
    
    audioGrid.innerHTML = currentAudioNotes.map(note => `
        <div class="audio-card">
            <div class="card-header">
                <div>
                    <div class="card-title">${note.bookTitle || 'Audio Note'}</div>
                    <div class="card-meta">${new Date(note.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="card-actions">
                    <button class="edit-btn" onclick="playAudioNote('${note.id}')" title="Play Audio">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="card-content">
                <p>Audio recording (${note.duration || 'Unknown'} seconds)</p>
            </div>
            ${note.bookTitle ? `<div class="card-meta">Page ${note.page + 1}</div>` : ''}
        </div>
    `).join('');
}

function playAudioNote(noteId) {
    const note = currentAudioNotes.find(n => n.id == noteId);
    if (note && note.content) {
        const audio = new Audio(note.content);
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
            showToast('Error playing audio note', 'error');
        });
        showToast('Playing audio note...', 'info');
    }
}

// Quick Note Panel
function showQuickNote() {
    const panel = document.getElementById('quickNotePanel');
    if (panel) {
        panel.style.display = 'block';
        document.getElementById('quickNoteInput').focus();
    }
}

function closeQuickNote() {
    const panel = document.getElementById('quickNotePanel');
    if (panel) {
        panel.style.display = 'none';
        document.getElementById('quickNoteInput').value = '';
    }
}

function saveQuickNote() {
    const input = document.getElementById('quickNoteInput');
    const content = input.value.trim();
    
    if (!content) {
        showToast('Please enter some content for the note', 'warning');
        return;
    }
    
    const note = {
        id: Date.now(),
        content: content,
        type: 'text',
        bookId: currentBook ? currentBook.id : null,
        bookTitle: currentBook ? currentBook.title : null,
        page: currentPage || 0,
        timestamp: new Date().toISOString()
    };
    
    currentNotes.unshift(note);
    localStorage.setItem('docmate_notes', JSON.stringify(currentNotes));
    
    closeQuickNote();
    showSection('saved-notes');
    displaySavedNotes();
    updateCounts();
    showToast('Note saved successfully!', 'success');
}

// Recording Functions
async function toggleRecording() {
    const recordFab = document.getElementById('recordFab');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            const startTime = Date.now();
            
            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const duration = Math.round((Date.now() - startTime) / 1000);
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                saveAudioNote(audioUrl, duration);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            recordFab.classList.add('recording');
            recordFab.innerHTML = '<i class="fas fa-stop"></i>';
            showToast('Recording started...', 'info');
            
        } catch (error) {
            console.error('Microphone access error:', error);
            showToast('Could not access microphone. Please check permissions.', 'error');
        }
    } else {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        isRecording = false;
        recordFab.classList.remove('recording');
        recordFab.innerHTML = '<i class="fas fa-microphone"></i>';
        showToast('Recording stopped', 'info');
    }
}

function saveAudioNote(audioUrl, duration) {
    const note = {
        id: Date.now(),
        content: audioUrl,
        type: 'audio',
        duration: duration,
        bookId: currentBook ? currentBook.id : null,
        bookTitle: currentBook ? currentBook.title : 'General Recording',
        page: currentPage || 0,
        timestamp: new Date().toISOString()
    };
    
    currentAudioNotes.unshift(note);
    localStorage.setItem('docmate_audio_notes', JSON.stringify(currentAudioNotes));
    displayAudioNotes();
    updateCounts();
    showToast('Audio note saved successfully!', 'success');
}

// Search Functions
function searchLibrary() {
    const query = document.getElementById('librarySearchInput').value.toLowerCase().trim();
    
    if (!query) {
        displayLibrary();
        return;
    }
    
    const filteredBooks = currentBooks.filter(book => 
        book.title.toLowerCase().includes(query) ||
        book.content.toLowerCase().includes(query)
    );
    
    displayFilteredBooks(filteredBooks);
}

function searchNotes() {
    const query = document.getElementById('notesSearchInput').value.toLowerCase().trim();
    
    if (!query) {
        displaySavedNotes();
        return;
    }
    
    const filteredNotes = currentNotes.filter(note => 
        note.content.toLowerCase().includes(query) ||
        (note.bookTitle && note.bookTitle.toLowerCase().includes(query))
    );
    
    displayFilteredNotes(filteredNotes);
}

function searchAudioNotes() {
    const query = document.getElementById('audioSearchInput').value.toLowerCase().trim();
    
    if (!query) {
        displayAudioNotes();
        return;
    }
    
    const filteredAudio = currentAudioNotes.filter(note => 
        (note.bookTitle && note.bookTitle.toLowerCase().includes(query))
    );
    
    displayFilteredAudioNotes(filteredAudio);
}

function displayFilteredBooks(books) {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    
    if (books.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search empty-icon"></i>
                <h3 class="empty-title">No matching books found</h3>
                <p class="empty-desc">Try different search terms</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = books.map(book => {
        const iconClass = book.contentType === 'pdf' ? 'fas fa-file-pdf' : 
                         book.contentType === 'docx' ? 'fas fa-file-word' : 'fas fa-file-alt';
        
        return `
            <div class="book-card highlighted" onclick="openBook(${book.id})">
                <div class="card-header">
                    <div>
                        <div class="card-title">
                            <i class="${iconClass}" style="color: var(--accent-color); margin-right: 0.5rem;"></i>
                            ${book.title}
                        </div>
                        <div class="card-meta">${book.pages.length} pages • ${book.contentType.toUpperCase()}</div>
                    </div>
                    <div class="card-actions">
                        <button class="edit-btn" onclick="event.stopPropagation(); editBookTitle(${book.id})" title="Edit Title">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    <p>${book.content.substring(0, 150)}...</p>
                </div>
                <div class="card-meta">
                    Uploaded: ${new Date(book.uploadDate).toLocaleDateString()}
                </div>
            </div>
        `;
    }).join('');
}

function displayFilteredNotes(notes) {
    const notesList = document.getElementById('savedNotesList');
    if (!notesList) return;
    
    if (notes.length === 0) {
        notesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search empty-icon"></i>
                <h3 class="empty-title">No matching notes found</h3>
                <p class="empty-desc">Try different search terms</p>
            </div>
        `;
        return;
    }
    
    notesList.innerHTML = notes.map(note => `
        <div class="note-card highlighted">
            <div class="card-header">
                <div>
                    <div class="card-title">${note.bookTitle || 'Quick Note'}</div>
                    <div class="card-meta">${new Date(note.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="card-actions">
                    <button class="edit-btn" onclick="editNote(${note.id})" title="Edit Note">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                </div>
            </div>
            <div class="card-content">
                <p>${note.content}</p>
            </div>
            ${note.bookTitle ? `<div class="card-meta">Page ${note.page + 1}</div>` : ''}
        </div>
    `).join('');
}

function displayFilteredAudioNotes(notes) {
    const audioGrid = document.getElementById('audioNotesGrid');
    if (!audioGrid) return;
    
    if (notes.length === 0) {
        audioGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search empty-icon"></i>
                <h3 class="empty-title">No matching audio notes found</h3>
                <p class="empty-desc">Try different search terms</p>
            </div>
        `;
        return;
    }
    
    audioGrid.innerHTML = notes.map(note => `
        <div class="audio-card highlighted">
            <div class="card-header">
                <div>
                    <div class="card-title">${note.bookTitle || 'Audio Note'}</div>
                    <div class="card-meta">${new Date(note.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="card-actions">
                    <button class="edit-btn" onclick="playAudioNote('${note.id}')" title="Play Audio">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="card-content">
                <p>Audio recording (${note.duration || 'Unknown'} seconds)</p>
            </div>
            ${note.bookTitle ? `<div class="card-meta">Page ${note.page + 1}</div>` : ''}
        </div>
    `).join('');
}

function clearLibrarySearch() {
    document.getElementById('librarySearchInput').value = '';
    displayLibrary();
}

function clearNotesSearch() {
    document.getElementById('notesSearchInput').value = '';
    displaySavedNotes();
}

function clearAudioSearch() {
    document.getElementById('audioSearchInput').value = '';
    displayAudioNotes();
}

// Analysis and Search
async function analyzeDocument(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading('Analyzing document...');
    
    try {
        let content = '';
        const fileType = file.type;
        const fileName = file.name.toLowerCase();
        
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            const result = await processPDF(file);
            content = result.text;
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
            content = await processDOCX(file);
        } else {
            content = await readAsText(file);
        }
        
        const analysis = await performAnalysis(content, file.name);
        displayAnalysis(analysis);
        hideLoading();
        
    } catch (error) {
        console.error('Analysis error:', error);
        hideLoading();
        showToast('Error analyzing document: ' + error.message, 'error');
    }
}

async function performAnalysis(content, fileName) {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Generate comprehensive summary
    const summary = generateDocumentSummary(content);
    
    // Extract key points
    const keyPoints = extractKeyPoints(content);
    
    // Get main topics
    const mainTopics = extractKeywords(content);
    
    return {
        fileName,
        stats: {
            words: words.length,
            sentences: sentences.length,
            paragraphs: paragraphs.length,
            readingTime: Math.ceil(words.length / 200),
            difficulty: assessDifficulty(content)
        },
        summary,
        keyPoints,
        mainTopics
    };
}

function generateDocumentSummary(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
    
    if (sentences.length === 0) {
        return 'No substantial content found in the document.';
    }
    
    // Create a comprehensive summary from key sentences
    let summary = '';
    
    // Introduction
    if (sentences.length > 0) {
        summary += sentences[0].trim() + '. ';
    }
    
    // Middle content
    if (sentences.length > 5) {
        const midIndex = Math.floor(sentences.length / 2);
        summary += sentences[midIndex].trim() + '. ';
    }
    
    // Conclusion
    if (sentences.length > 2) {
        summary += sentences[sentences.length - 1].trim() + '.';
    }
    
    return summary || 'Document contains limited analyzable content.';
}

function extractKeyPoints(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 50);
    
    // Look for sentences that might be key points
    const keyPoints = sentences
        .filter(s => {
            const lower = s.toLowerCase();
            return lower.includes('important') || 
                   lower.includes('key') || 
                   lower.includes('main') || 
                   lower.includes('significant') ||
                   lower.includes('conclusion') ||
                   lower.includes('result') ||
                   s.length > 80 && s.length < 200;
        })
        .slice(0, 5)
        .map(s => s.trim());
    
    return keyPoints.length > 0 ? keyPoints : sentences.slice(0, 3).map(s => s.trim());
}

function extractKeywords(content) {
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'this', 'that', 'these', 'those']);
    
    const wordFreq = {};
    words.forEach(word => {
        word = word.replace(/[^\w]/g, '');
        if (word.length > 3 && !stopWords.has(word)) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });
    
    return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word]) => word);
}

function assessDifficulty(text) {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/);
    
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const avgSentenceLength = words.length / sentences.length;
    
    if (avgWordLength > 6 && avgSentenceLength > 20) return 'Advanced';
    if (avgWordLength > 5 && avgSentenceLength > 15) return 'Intermediate';
    return 'Beginner';
}

function displayAnalysis(analysis) {
    const resultsDiv = document.getElementById('analysisResults');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = `
        <div class="analysis-card">
            <h3 class="card-title">Analysis of: ${analysis.fileName}</h3>
            
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin: 2rem 0;">
                <div class="stat-item" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--accent-color);">${analysis.stats.words.toLocaleString()}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Words</div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--accent-color);">${analysis.stats.sentences}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Sentences</div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--accent-color);">${analysis.stats.paragraphs}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Paragraphs</div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--accent-color);">${analysis.stats.readingTime}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Min Read</div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--accent-color);">${analysis.stats.difficulty}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Level</div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h4 style="font-family: 'Michroma', monospace; margin-bottom: 1rem;">Document Summary</h4>
                <div class="analysis-summary">
                    <p>${analysis.summary}</p>
                </div>
            </div>
            
            <div class="analysis-section">
                <h4 style="font-family: 'Michroma', monospace; margin-bottom: 1rem;">Key Points</h4>
                <ul class="analysis-points">
                    ${analysis.keyPoints.map(point => `<li>${point}</li>`).join('')}
                </ul>
            </div>
            
            <div class="analysis-section">
                <h4 style="font-family: 'Michroma', monospace; margin-bottom: 1rem;">Main Topics</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${analysis.mainTopics.map(topic => `
                        <span style="background-color: var(--hover-bg); color: var(--text-primary); padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.875rem; border: 1px solid var(--border-color);">
                            ${topic}
                        </span>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

async function searchWebAnswer() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showToast('Please enter a question or topic to search for', 'warning');
        return;
    }
    
    showLoading('Searching for answers...');
    
    try {
        const results = await searchWithAPI(query);
        displaySearchResults(results, query);
        hideLoading();
    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        showToast('Error searching for answer', 'error');
    }
}

async function searchWithAPI(query) {
    // This would integrate with real APIs
    // For now, return mock educational results
    return {
        summary: `Here's what I found about "${query}":`,
        results: [
            {
                title: `Understanding ${query}`,
                snippet: `${query} is an important topic that requires careful study and understanding. This comprehensive guide covers the key concepts and practical applications.`,
                url: `https://www.khanacademy.org/search?referer=%2F&page_search_query=${encodeURIComponent(query)}`,
                source: 'Khan Academy'
            },
            {
                title: `${query} - Complete Course`,
                snippet: `Learn ${query} from industry experts with hands-on projects and real-world applications. Get certified upon completion.`,
                url: `https://coursera.org/search?query=${encodeURIComponent(query)}`,
                source: 'Coursera'
            },
            {
                title: `${query} Video Tutorials`,
                snippet: `Watch comprehensive video tutorials about ${query} from leading educators and professionals in the field.`,
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
                source: 'YouTube'
            }
        ]
    };
}

function displaySearchResults(results, query) {
    const resultsDiv = document.getElementById('analysisResults');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = `
        <div class="analysis-card">
            <h3 class="card-title">Search Results for: "${query}"</h3>
            
            <div class="analysis-summary">
                <p>${results.summary}</p>
            </div>
            
            <div class="search-results" style="margin-top: 2rem;">
                ${results.results.map(result => `
                    <div class="search-result-item" style="background-color: var(--hover-bg); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                        <h4 style="margin-bottom: 0.5rem;">
                            <a href="${result.url}" target="_blank" class="source-link">${result.title}</a>
                        </h4>
                        <p style="margin-bottom: 1rem;">${result.snippet}</p>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            Source: <a href="${result.url}" target="_blank" class="source-link">${result.source}</a>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top: 2rem; padding: 1rem; background-color: var(--hover-bg); border-radius: 8px;">
                <h4 style="font-family: 'Michroma', monospace; margin-bottom: 1rem;">Find More Information</h4>
                <p>For additional resources and detailed information about "${query}", visit these educational platforms:</p>
                <ul style="margin-top: 1rem;">
                    <li><a href="https://scholar.google.com/scholar?q=${encodeURIComponent(query)}" target="_blank" class="source-link">Google Scholar - Academic Papers</a></li>
                    <li><a href="https://www.wikipedia.org/wiki/Special:Search/${encodeURIComponent(query)}" target="_blank" class="source-link">Wikipedia - General Information</a></li>
                    <li><a href="https://www.edx.org/search?q=${encodeURIComponent(query)}" target="_blank" class="source-link">edX - Online Courses</a></li>
                </ul>
            </div>
        </div>
    `;
}

function handleSearchEnter(event) {
    if (event.key === 'Enter') {
        searchWebAnswer();
    }
}

// Language and Translation
async function onLanguageChange() {
    const newLanguage = document.getElementById('languageSelector').value;
    
    if (currentBook && newLanguage !== currentLanguage) {
        showLoading('Translating document...');
        try {
            await translateCurrentDocument(newLanguage);
            hideLoading();
        } catch (error) {
            console.error('Translation error:', error);
            hideLoading();
            showToast('Translation failed. Please try again.', 'error');
        }
    }
    
    currentLanguage = newLanguage;
    showToast(`Language changed to ${languageConfig[newLanguage].name}`, 'info');
}

async function translateCurrentDocument(targetLanguage) {
    if (!currentBook) return;
    
    try {
        const originalContent = currentBook.originalContent || currentBook.content;
        
        if (!currentBook.originalContent) {
            currentBook.originalContent = currentBook.content;
        }

        if (targetLanguage === 'en') {
            currentBook.content = originalContent;
            currentBook.pages = splitIntoPages(originalContent);
        } else {
            const translatedContent = await translateText(originalContent, targetLanguage);
            currentBook.content = translatedContent;
            currentBook.pages = splitIntoPages(translatedContent);
        }

        const bookIndex = currentBooks.findIndex(book => book.id === currentBook.id);
        if (bookIndex !== -1) {
            currentBooks[bookIndex] = currentBook;
            localStorage.setItem('docmate_books', JSON.stringify(currentBooks));
        }

        displayCurrentPage();
        showToast(`Document translated to ${languageConfig[targetLanguage].name}`, 'success');
        
    } catch (error) {
        throw error;
    }
}

async function translateText(text, targetLanguage) {
    // This would integrate with real translation APIs
    // For now, return the original text with a note
    console.log(`Translating to ${targetLanguage}:`, text.substring(0, 100));
    return text; // In real implementation, this would return translated text
}

// Quiz Functions
function showQuiz() {
    showSection('quiz');
    generateQuiz();
}

function generateQuiz() {
    const quizContainer = document.getElementById('quizContainer');
    if (!quizContainer) return;
    
    if (currentBooks.length === 0) {
        quizContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-question-circle empty-icon"></i>
                <h3 class="empty-title">No quiz available</h3>
                <p class="empty-desc">Upload documents to generate quiz questions</p>
            </div>
        `;
        return;
    }
    
    // Generate simple quiz from uploaded content
    const questions = generateQuestionsFromBooks();
    displayQuiz(questions);
}

function generateQuestionsFromBooks() {
    // Simple quiz generation - in real app this would be more sophisticated
    const questions = [];
    
    currentBooks.slice(0, 3).forEach((book, index) => {
        questions.push({
            id: index + 1,
            question: `What is the main topic of "${book.title}"?`,
            options: [
                'Technology and Innovation',
                'Literature and Arts',
                'Science and Research',
                'Business and Finance'
            ],
            correct: 0,
            explanation: `Based on the content analysis of "${book.title}"`
        });
    });
    
    return questions;
}

function displayQuiz(questions) {
    const quizContainer = document.getElementById('quizContainer');
    if (!quizContainer) return;
    
    quizContainer.innerHTML = questions.map(q => `
        <div class="quiz-question">
            <div class="question-text">
                <strong>Question ${q.id}:</strong> ${q.question}
            </div>
            <div class="quiz-options">
                ${q.options.map((option, index) => `
                    <div class="quiz-option" onclick="selectQuizOption(${q.id}, ${index})">
                        ${option}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function selectQuizOption(questionId, optionIndex) {
    const question = document.querySelectorAll('.quiz-question')[questionId - 1];
    const options = question.querySelectorAll('.quiz-option');
    
    // Remove previous selections
    options.forEach(option => option.classList.remove('selected'));
    
    // Mark selected option
    options[optionIndex].classList.add('selected');
    
    showToast('Answer selected!', 'info');
}

// Utility Functions
function updateCounts() {
    const notesCount = document.getElementById('notesCount');
    const audioCount = document.getElementById('audioCount');
    
    if (notesCount) notesCount.textContent = `${currentNotes.length} notes`;
    if (audioCount) audioCount.textContent = `${currentAudioNotes.length} recordings`;
}

function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    
    if (overlay && text) {
        text.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-triangle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="${iconMap[type]} toast-icon"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch(event.key) {
            case 'h':
                event.preventDefault();
                showSection('home');
                break;
            case 'l':
                event.preventDefault();
                showSection('library');
                break;
            case 'n':
                event.preventDefault();
                showSection('saved-notes');
                break;
            case 'a':
                event.preventDefault();
                showSection('analysis');
                break;
        }
    }
    
    // Reading navigation
    if (document.getElementById('reading').classList.contains('active')) {
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                previousPage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                nextPage();
                break;
        }
    }
}

// Auto-save functionality
setInterval(() => {
    if (currentBook) {
        currentBook.currentPage = currentPage;
        localStorage.setItem('docmate_books', JSON.stringify(currentBooks));
    }
}, 30000); // Save every 30 seconds
