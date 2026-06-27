const SUPABASE_URL = "https://xfdfgitzaeafklaxppze.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZGZnaXR6YWVhZmtsYXhwcHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NDQzNzAsImV4cCI6MjA3NTUyMDM3MH0._F1ezbvwLxB-KKRVg4N8DoZk4B6OHATISNdDjxvwYu4";

// Initialize the Supabase client properly
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentFiles = [];
let uploadTasks = new Map();
let searchTimeout = null;

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showError(message, duration = 5000) {
    const msg = document.getElementById('auth-msg') || document.createElement('div');
    msg.textContent = message;
    msg.style.color = 'var(--error)';
    setTimeout(() => msg.textContent = '', duration);
}

function showSuccess(message, duration = 5000) {
    const msg = document.getElementById('auth-msg') || document.createElement('div');
    msg.textContent = message;
    msg.style.color = 'var(--success)';
    setTimeout(() => msg.textContent = '', duration);
}

// Auth Functions
async function handleAuth(isLogin = true) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    try {
        if (isLogin) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            if (data.user) {
                showSuccess('Login successful!');
                setTimeout(() => {
                    window.location.href = 'files.html';
                }, 1000);
            }
        } else {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (error) throw error;
            
            if (data.user?.identities?.length === 0) {
                showError('This email is already registered. Please log in instead.');
            } else {
                showSuccess('Account created! Please check your email for verification.');
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError(error.message);
    }
}

async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        
        if (!user) {
            window.location.href = 'index.html';
            return false;
        }
        
        currentUser = user;
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'index.html';
        return false;
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// File Management Functions
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
        pdf: 'file-pdf',
        doc: 'file-word', docx: 'file-word',
        xls: 'file-excel', xlsx: 'file-excel',
        ppt: 'file-powerpoint', pptx: 'file-powerpoint',
        jpg: 'file-image', jpeg: 'file-image', png: 'file-image', gif: 'file-image',
        mp3: 'file-audio', wav: 'file-audio',
        mp4: 'file-video', mov: 'file-video',
        zip: 'file-archive', rar: 'file-archive', '7z': 'file-archive',
        txt: 'file-alt',
        default: 'file'
    };
    return icons[ext] || icons.default;
}

function createFileCard(file) {
    const fileIcon = getFileIcon(file.name);
    return `
        <div class="file-card reveal" data-file-path="${file.name}">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas fa-${fileIcon} fa-2x" style="color: var(--accent);"></i>
                <div style="overflow: hidden;">
                    <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</div>
                    <div style="color: var(--muted); font-size: 0.875rem;">${formatFileSize(file.metadata.size)}</div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 0.875rem;">
                <span>${formatDate(file.created_at)}</span>
                <div style="display: flex; gap: 8px;">
                    <button class="preview-btn" style="padding: 4px 8px;"><i class="fas fa-eye"></i></button>
                    <button class="download-btn" style="padding: 4px 8px;"><i class="fas fa-download"></i></button>
                    <button class="delete-btn" style="padding: 4px 8px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `;
}

async function loadFiles(searchQuery = '', sortBy = 'name-asc') {
    if (!await checkAuth()) return;

    const filesList = document.getElementById('files-list');
    try {
    const { data, error } = await supabase.storage
      .from('user-files')
      .list(currentUser.id);

        if (error) throw error;

        if (!data || data.length === 0) {
            filesList.innerHTML = '<div class="reveal" style="text-align: center; color: var(--muted);"><i class="fas fa-folder-open fa-3x"></i><p style="margin-top: 16px;">No files found</p></div>';
            return;
        }

        currentFiles = data.filter(file => 
            file.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const [sortField, sortOrder] = sortBy.split('-');
        currentFiles.sort((a, b) => {
            let comparison;
            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'date':
                    comparison = new Date(a.created_at) - new Date(b.created_at);
                    break;
                case 'size':
                    comparison = a.metadata.size - b.metadata.size;
                    break;
                default:
                    comparison = 0;
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        filesList.innerHTML = currentFiles.length 
            ? currentFiles.map(createFileCard).join('')
            : '<div class="reveal" style="text-align: center; color: var(--muted);"><i class="fas fa-folder-open fa-3x"></i><p style="margin-top: 16px;">No files found</p></div>';

        // Add event listeners to new cards
        document.querySelectorAll('.preview-btn').forEach(btn => 
            btn.addEventListener('click', () => handlePreview(btn.closest('.file-card').dataset.filePath))
        );
        document.querySelectorAll('.download-btn').forEach(btn => 
            btn.addEventListener('click', () => handleDownload(btn.closest('.file-card').dataset.filePath))
        );
        document.querySelectorAll('.delete-btn').forEach(btn => 
            btn.addEventListener('click', () => handleDelete(btn.closest('.file-card').dataset.filePath))
        );
    } catch (error) {
        showError('Error loading files: ' + error.message);
    }
}

async function handlePreview(filePath) {
    try {
        const modal = document.getElementById('preview-modal');
        const filename = document.getElementById('preview-filename');
        const content = document.getElementById('preview-content');
        const downloadBtn = document.getElementById('preview-download');
        const deleteBtn = document.getElementById('preview-delete');

        filename.textContent = filePath;
        modal.classList.add('active');

    const { data, error } = await supabase.storage
      .from('user-files')
      .download(`${currentUser.id}/${filePath}`);

        if (error) throw error;

        const ext = filePath.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
            const url = URL.createObjectURL(data);
            content.innerHTML = `<img src="${url}" style="max-width: 100%; height: auto;">`;
        } else if (['mp4', 'mov', 'webm'].includes(ext)) {
            const url = URL.createObjectURL(data);
            content.innerHTML = `<video controls style="max-width: 100%;"><source src="${url}"></video>`;
        } else if (['mp3', 'wav'].includes(ext)) {
            const url = URL.createObjectURL(data);
            content.innerHTML = `<audio controls style="width: 100%;"><source src="${url}"></audio>`;
        } else {
            content.innerHTML = `<div style="padding: 20px; background: var(--elev); border-radius: 8px;">
                <i class="fas fa-${getFileIcon(filePath)} fa-3x" style="color: var(--accent);"></i>
                <p style="margin-top: 16px;">Preview not available for this file type</p>
            </div>`;
        }

        downloadBtn.onclick = () => handleDownload(filePath);
        deleteBtn.onclick = () => {
            modal.classList.remove('active');
            handleDelete(filePath);
        };
    } catch (error) {
        showError('Error previewing file: ' + error.message);
    }
}

async function handleDownload(filePath) {
    try {
    const { data, error } = await supabase.storage
      .from('user-files')
      .download(`${currentUser.id}/${filePath}`);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showError('Error downloading file: ' + error.message);
    }
}

async function handleDelete(filePath) {
    const modal = document.getElementById('delete-modal');
    const filename = document.getElementById('delete-filename');
    const confirmBtn = document.getElementById('confirm-delete');
    const cancelBtn = document.getElementById('cancel-delete');

    console.log('Initiating delete for:', filePath);

    filename.textContent = filePath;
    modal.classList.add('active');

    confirmBtn.onclick = async () => {
        try {
            const fullPath = `${currentUser.id}/${filePath}`;
            console.log('Deleting file:', fullPath);

      const { error } = await supabase.storage
        .from('user-files')
        .remove([fullPath]);

            if (error) {
                console.error('Delete error:', error);
                throw error;
            }

            console.log('File deleted successfully:', filePath);
            modal.classList.remove('active');
            showSuccess('File deleted successfully');
            await loadFiles(); // Reload the file list
        } catch (error) {
            console.error('Delete error:', error);
            showError('Error deleting file: ' + error.message);
        }
    };

    cancelBtn.onclick = () => modal.classList.remove('active');
}

// Upload Functions
function createProgressElement(file) {
    return `
        <div class="file-progress" data-file="${file.name}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-${getFileIcon(file.name)}"></i>
                    <span style="font-weight: 500;">${file.name}</span>
                </div>
                <span class="progress-percentage">0%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;
}

function updateProgress(fileName, progress) {
    const element = document.querySelector(`[data-file="${fileName}"]`);
    if (element) {
        element.querySelector('.progress-percentage').textContent = `${Math.round(progress)}%`;
        element.querySelector('.progress-fill').style.width = `${progress}%`;
    }
}

async function handleUpload(files) {
    if (!await checkAuth()) return;

    const progressSection = document.getElementById('upload-progress-section');
    const progressList = document.getElementById('upload-progress-list');
    
    progressSection.style.display = 'block';
    files = Array.from(files);

    // Create progress elements
    progressList.innerHTML = files.map(createProgressElement).join('');

    // Upload each file
    const uploads = files.map(async file => {
        try {
      const { error } = await supabase.storage
        .from('user-files')
        .upload(`${currentUser.id}/${file.name}`, file, {
          cacheControl: '3600',
          upsert: true
        });

            if (error) throw error;
            
            const progressElement = document.querySelector(`[data-file="${file.name}"]`);
            progressElement.style.animation = 'fadeOut 0.5s ease forwards';
            setTimeout(() => progressElement.remove(), 500);

        } catch (error) {
            showError(`Error uploading ${file.name}: ${error.message}`);
            const progressElement = document.querySelector(`[data-file="${file.name}"]`);
            progressElement.style.color = 'var(--error)';
        }
    });

    await Promise.all(uploads);
    
    if (!progressList.children.length) {
        progressSection.style.display = 'none';
    }

    loadFiles();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Common elements
    const authForm = document.getElementById('auth-section');
    const authLoginBtn = document.getElementById('login-btn');
    const authSignupBtn = document.getElementById('signup-btn');
    
    // If we're on the login page
    if (authForm && authLoginBtn && authSignupBtn) {
        // Prevent form submission
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
        });

        // Add authentication handlers
        authLoginBtn.addEventListener('click', () => handleAuth(true));
        authSignupBtn.addEventListener('click', () => handleAuth(false));

        // Add enter key handler on password field
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleAuth(true);
                }
            });
        }

        return; // Exit early for login page
    }
    // Auth page
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    if (loginBtn && signupBtn) {
        loginBtn.addEventListener('click', () => handleAuth(true));
        signupBtn.addEventListener('click', () => handleAuth(false));
        return;
    }

    // Files page
    if (!await checkAuth()) return;

    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadFiles(e.target.value, document.getElementById('sort-select').value);
            }, 300);
        });
    }

    // Sort functionality
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            loadFiles(document.getElementById('search-input').value, e.target.value);
        });
    }

    // Upload area
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    
    if (uploadArea && fileInput && browseBtn) {
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            handleUpload(e.dataTransfer.files);
        });

        // Browse button
        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => handleUpload(fileInput.files));
    }

    // Modal close buttons
    document.querySelectorAll('#close-preview, #preview-modal').forEach(element => {
        element.addEventListener('click', (e) => {
            if (e.target === element) {
                document.getElementById('preview-modal').classList.remove('active');
            }
        });
    });

    // Minimize upload section
    const minimizeUpload = document.getElementById('minimize-upload');
    if (minimizeUpload) {
        minimizeUpload.addEventListener('click', () => {
            document.getElementById('upload-progress-section').style.display = 'none';
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Initial load
    loadFiles();
});
const STORAGE_BUCKET = "user-files";

// Demo mode flag - NOW USING REAL SUPABASE!
const DEMO_MODE = false;

// Initialize Supabase - REAL CLOUD STORAGE ACTIVE!
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signup-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authMsg = document.getElementById('auth-msg');

const uploadSection = document.getElementById('upload-section');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const uploadMsg = document.getElementById('upload-msg');
const uploadProgress = document.getElementById('upload-progress');

const filesSection = document.getElementById('files-section');
const filesList = document.getElementById('files-list');
const refreshFilesBtn = document.getElementById('refresh-files-btn');

// Auth helpers
async function signUp(email, password){
  console.log('Attempting signup with:', email);
  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    console.log('Signup result:', { data, error });
    return { data, error };
  } catch (err) {
    console.error('Signup error:', err);
    return { data: null, error: { message: err.message } };
  }
}

async function signIn(email, password){
  console.log('Attempting signin with:', email);
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    console.log('Signin result:', { data, error });
    return { data, error };
  } catch (err) {
    console.error('Signin error:', err);
    return { data: null, error: { message: err.message } };
  }
}

async function signOut(){
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('Signout error:', error);
    } else {
      console.log('Signout successful');
    }
  } catch (err) {
    console.error('Signout error:', err);
  }
}

function showAuthMessage(msg){ authMsg.textContent = msg || ''; }

function setLoggedInState(user){
  if(user){
    signupBtn.classList.add('hidden');
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    uploadSection.classList.remove('hidden');
    filesSection.classList.remove('hidden');
    showAuthMessage('Signed in as ' + (user.email || user.id));
    listFiles();
  } else {
    signupBtn.classList.remove('hidden');
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    uploadSection.classList.add('hidden');
    filesSection.classList.add('hidden');
    filesList.innerHTML = '';
    showAuthMessage('');
  }
}

// Attach events
signupBtn.addEventListener('click', async () => {
  console.log('Signup button clicked!');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if(!email || !password){ 
    showAuthMessage('Enter email and password'); 
    return; 
  }
  
  showAuthMessage('Signing up...');
  console.log('Calling signUp function...');
  const { data, error } = await signUp(email, password);
  
  if(error) {
    console.error('Signup failed:', error);
    showAuthMessage('Signup failed: ' + error.message);
  } else {
    console.log('Signup successful:', data);
    showAuthMessage('Signup successful — check your email to confirm if required.');
  }
});

loginBtn.addEventListener('click', async () => {
  console.log('Login button clicked!');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if(!email || !password){ 
    showAuthMessage('Enter email and password'); 
    return; 
  }
  
  showAuthMessage('Logging in...');
  console.log('Calling signIn function...');
  const { data, error } = await signIn(email, password);
  
  if(error) {
    console.error('Login failed:', error);
    showAuthMessage('Login failed: ' + error.message);
  } else {
    console.log('Login successful:', data);
    setLoggedInState(data.user);
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut();
  setLoggedInState(null);
});

// Refresh files button
refreshFilesBtn.addEventListener('click', async () => {
  console.log('Refresh files button clicked!');
  await listFiles();
});

// Upload handling
uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if(!file) { uploadMsg.textContent = 'Pick a file first.'; return; }
  
  console.log('Upload button clicked!');
  console.log('Selected file:', file.name, file.size, 'bytes');
  
  uploadMsg.textContent = '';
  uploadProgress.classList.remove('hidden');
  uploadProgress.value = 0;

  try {
    // Get current user
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error('Error getting user:', userError);
      uploadMsg.textContent = 'Error: Not logged in properly';
      uploadProgress.classList.add('hidden');
      return;
    }
    
    const user = userData.user;
    if (!user) {
      uploadMsg.textContent = 'Error: Please login first';
      uploadProgress.classList.add('hidden');
      return;
    }
    
    console.log('Current user:', user.id, user.email);
    
    // Create file path with user ID
    const userId = user.id;
    const filePath = `${userId}/${file.name}`;
    console.log('Uploading to path:', filePath);
    
    uploadProgress.value = 30;
    
    // Upload file to Supabase storage
    const { data, error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, { 
        upsert: true,
        cacheControl: '3600'
      });
      
    if (error) {
      console.error('Upload error:', error);
      uploadMsg.textContent = `Upload failed: ${error.message}`;
      uploadProgress.classList.add('hidden');
      return;
    }
    
    console.log('Upload successful:', data);
    uploadMsg.textContent = 'Upload complete!';
    uploadProgress.value = 100;
    fileInput.value = '';
    
    // Refresh file list
    await listFiles();
    
    setTimeout(() => uploadProgress.classList.add('hidden'), 1000);
    
  } catch (err) {
    console.error('Upload exception:', err);
    uploadMsg.textContent = `Upload failed: ${err.message}`;
    uploadProgress.classList.add('hidden');
  }
});

// List files for current user
async function listFiles(){
  console.log('Listing files...');
  
  try {
    // Get current user
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error('Error getting user for file list:', userError);
      filesList.innerHTML = '<div class="muted">Error: Not logged in properly</div>';
      return;
    }
    
    const user = userData.user;
    if (!user) {
      console.log('No user, showing empty file list');
      filesList.innerHTML = '<div class="muted">Please login to see your files</div>';
      return;
    }
    
    console.log('Listing files for user:', user.id);
    console.log('User ID for filtering:', user.id);
    
    // List all files in the bucket
    const { data, error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .list('', { 
        limit: 1000, 
        offset: 0, 
        sortBy: { column: 'name', order: 'asc' } 
      });
      
    if (error) {
      console.error('Error listing files:', error);
      filesList.innerHTML = `<div class="muted">Error listing files: ${error.message}</div>`;
      return;
    }
    
    console.log('Raw file data from Supabase:', data);
    console.log('Total files found:', data.length);
    
    // Filter by user's prefix
    const prefix = `${user.id}/`;
    console.log('Looking for files with prefix:', prefix);
    
    const userFiles = data.filter(item => {
      console.log('Checking file:', item.name, 'starts with', prefix, '?', item.name.startsWith(prefix));
      return item.name.startsWith(prefix);
    });
    
    console.log('User files after filtering:', userFiles);
    console.log('Number of user files:', userFiles.length);
    
    // If no user-specific files, show all files for debugging
    if (userFiles.length === 0) {
      console.log('No user-specific files found. Showing all files for debugging:');
      filesList.innerHTML = `
        <div class="muted">No files found for user ${user.id}</div>
        <div class="muted">All files in bucket (for debugging):</div>
        <ul>
          ${data.map(item => `<li>${item.name}</li>`).join('')}
        </ul>
      `;
      return;
    }
    
    // Display files
    filesList.innerHTML = '';
    for (const file of userFiles) {
      const fileName = file.name.replace(prefix, '');
      console.log('Displaying file:', fileName, 'from path:', file.name);
      
      const row = document.createElement('div');
      row.className = 'file-row';
      
      const title = document.createElement('div');
      title.textContent = fileName;
      
      const actions = document.createElement('div');
      const viewBtn = document.createElement('a');
      viewBtn.href = '#';
      viewBtn.textContent = 'Download/View';
      viewBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('Creating download URL for:', file.name);
        
        try {
          const { data: urlData, error: urlErr } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.name, 60);
            
          if (urlErr) {
            console.error('Error creating download URL:', urlErr);
            alert('Error creating download URL: ' + urlErr.message);
            return;
          }
          
          console.log('Download URL created:', urlData.signedUrl);
          window.open(urlData.signedUrl, '_blank');
        } catch (err) {
          console.error('Exception creating download URL:', err);
          alert('Error: ' + err.message);
        }
      });
      
      actions.appendChild(viewBtn);
      row.appendChild(title);
      row.appendChild(actions);
      filesList.appendChild(row);
    }
    
  } catch (err) {
    console.error('Exception in listFiles:', err);
    filesList.innerHTML = `<div class="muted">Error: ${err.message}</div>`;
  }
}

// Keep UI updated based on auth state
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session);
  const user = session && session.user ? session.user : null;
  setLoggedInState(user);
});

// On load, check if logged in
window.addEventListener('load', async () => {
  console.log('Page loaded, checking auth state...');
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) {
      console.error('Error getting user:', error);
    }
    const user = data ? data.user : null;
    console.log('Current user:', user);
    setLoggedInState(user);
  } catch (err) {
    console.error('Error checking auth state:', err);
    setLoggedInState(null);
  }
});
