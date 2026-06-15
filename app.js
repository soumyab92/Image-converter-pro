/**
 * Image Converter Pro - Core Application Logic
 * 100% Client-Side Image Conversion & Processing
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let fileQueue = [];
  let conversionHistory = JSON.parse(localStorage.getItem('icp_history') || '[]');
  let activeComparingIndex = null;
  let isResizingInputsBound = false;

  // --- Supported Encoding Capabilities ---
  const formatCapabilities = {
    png: true,
    jpeg: true,
    webp: true,
    bmp: true, // Custom encoder
    ico: true, // Custom encoder
    svg: true, // Custom wrapper
    gif: true, // Native canvas fallback
    avif: false // Detected asynchronously
  };

  // --- DOM Elements ---
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileQueueContainer = document.getElementById('fileQueue');
  const queueStatus = document.getElementById('queueStatus');
  const queueCount = document.getElementById('queueCount');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const convertAllBtn = document.getElementById('convertAllBtn');
  
  // Settings Controls
  const globalFormat = document.getElementById('globalFormat');
  const globalQuality = document.getElementById('globalQuality');
  const qualityValue = document.getElementById('qualityValue');
  const qualityControlContainer = document.getElementById('qualityControlContainer');
  const resizeOriginal = document.getElementById('resizeOriginal');
  const resizeCustom = document.getElementById('resizeCustom');
  const customDimensionsInputs = document.getElementById('customDimensionsInputs');
  const customWidth = document.getElementById('customWidth');
  const customHeight = document.getElementById('customHeight');
  const maintainAspectRatio = document.getElementById('maintainAspectRatio');

  // History Elements
  const historyList = document.getElementById('historyList');
  const emptyHistoryRow = document.getElementById('emptyHistoryRow');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Toast Element
  const toastEl = document.getElementById('appToast');
  const toastBody = toastEl.querySelector('.toast-body');
  const bootstrapToast = new bootstrap.Toast(toastEl, { delay: 4000 });

  // Theme Toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Comparison Slider Elements
  const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
  const comparisonContainer = document.getElementById('comparisonContainer');
  const comparisonSlider = document.getElementById('comparisonSlider');
  const afterImageWrapper = document.getElementById('afterImageWrapper');
  const beforeImage = document.getElementById('beforeImage');
  const afterImage = document.getElementById('afterImage');
  const beforeFormat = document.getElementById('beforeFormat');
  const afterFormat = document.getElementById('afterFormat');
  const beforeSize = document.getElementById('beforeSize');
  const afterSize = document.getElementById('afterSize');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');

  // --- Initializing App ---
  initTheme();
  detectAvifSupport();
  renderHistory();
  setupEventListeners();

  // --- Detect AVIF Support ---
  function detectAvifSupport() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    tempCanvas.toBlob((blob) => {
      if (blob && blob.type === 'image/avif') {
        formatCapabilities.avif = true;
      } else {
        // Remove or disable AVIF option if not supported
        const avifOption = globalFormat.querySelector('option[value="avif"]');
        if (avifOption) {
          avifOption.disabled = true;
          avifOption.innerText += ' (Unsupported by Browser)';
        }
      }
    }, 'image/avif');
  }

  // --- Theme Controller (Light/Dark Mode) ---
  function initTheme() {
    const savedTheme = localStorage.getItem('icp_theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('icp_theme', newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
      icon.className = 'fa-solid fa-sun text-warning';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  }

  // --- Helper: Show Notifications ---
  function showToast(message, type = 'info') {
    toastBody.textContent = message;
    toastEl.className = 'toast align-items-center text-white border-0';
    if (type === 'success') toastEl.classList.add('bg-success');
    else if (type === 'error') toastEl.classList.add('bg-danger');
    else if (type === 'warning') toastEl.classList.add('bg-warning', 'text-dark');
    else toastEl.classList.add('bg-primary');
    bootstrapToast.show();
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Quality Slider
    globalQuality.addEventListener('input', (e) => {
      qualityValue.textContent = `${e.target.value}%`;
    });

    // Format Selector (Show/Hide quality control)
    globalFormat.addEventListener('change', (e) => {
      const format = e.target.value;
      if (format === 'jpeg' || format === 'webp' || format === 'avif') {
        qualityControlContainer.classList.remove('d-none');
      } else {
        qualityControlContainer.classList.add('d-none');
      }
    });

    // Resize Options
    resizeOriginal.addEventListener('change', () => {
      customDimensionsInputs.classList.add('d-none');
    });
    resizeCustom.addEventListener('change', () => {
      customDimensionsInputs.classList.remove('d-none');
      if (fileQueue.length > 0 && !customWidth.value && !customHeight.value) {
        // Populate default values from first file
        customWidth.value = fileQueue[0].width;
        customHeight.value = fileQueue[0].height;
      }
    });

    // Aspect Ratio lock inputs
    customWidth.addEventListener('input', () => {
      if (maintainAspectRatio.checked && fileQueue.length > 0 && customWidth.value) {
        const primaryFile = fileQueue[0];
        const ratio = primaryFile.aspectRatio || (primaryFile.width / primaryFile.height);
        customHeight.value = Math.round(customWidth.value / ratio);
      }
    });

    customHeight.addEventListener('input', () => {
      if (maintainAspectRatio.checked && fileQueue.length > 0 && customHeight.value) {
        const primaryFile = fileQueue[0];
        const ratio = primaryFile.aspectRatio || (primaryFile.width / primaryFile.height);
        customWidth.value = Math.round(customHeight.value * ratio);
      }
    });

    // Drag and Drop handlers
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      handleFiles(files);
    });

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    // Bulk buttons
    clearAllBtn.addEventListener('click', clearQueue);
    convertAllBtn.addEventListener('click', convertAllImages);

    // History Clean
    clearHistoryBtn.addEventListener('click', clearHistory);

    // Slider Drag Logic
    setupSliderDrag();
  }

  // --- File Upload Queue Handlers ---
  async function handleFiles(files) {
    if (files.length === 0) return;
    
    let addedCount = 0;
    const rawExtensions = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'pef', 'raf', 'rw2', 'raw'];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop().toLowerCase();
      
      // Basic check for image types
      const isTIFF = extension === 'tiff' || extension === 'tif';
      const isRAW = rawExtensions.includes(extension);
      if (!file.type.startsWith('image/') && !isTIFF && !isRAW) {
        showToast(`Skipped "${file.name}": Not an image or RAW file.`, 'warning');
        continue;
      }

      // Check max size 50MB
      if (file.size > 50 * 1024 * 1024) {
        showToast(`Skipped "${file.name}": Size exceeds 50MB.`, 'warning');
        continue;
      }

      // Duplicate check
      if (fileQueue.some(f => f.name === file.name && f.size === file.size)) {
        showToast(`Skipped "${file.name}": Already in queue.`, 'warning');
        continue;
      }

      const queueItem = {
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        file: file,
        name: file.name,
        size: file.size,
        extension: extension.toUpperCase(),
        width: 0,
        height: 0,
        aspectRatio: 1,
        thumbnail: '',
        status: 'pending',
        progress: 0,
        convertedBlob: null,
        convertedUrl: null,
        convertedSize: 0,
        error: ''
      };

      fileQueue.push(queueItem);
      addedCount++;
      
      // Load image metadata asynchronously
      loadImageMeta(queueItem);
    }

    if (addedCount > 0) {
      updateQueueUI();
      showToast(`Added ${addedCount} images to conversion queue.`, 'success');
    }
  }

  // --- Load Image Metadata & Generate Thumbnails ---
  async function loadImageMeta(item) {
    const isTIFF = item.extension === 'TIFF' || item.extension === 'TIF';
    const rawExtensions = ['CR2', 'CR3', 'NEF', 'ARW', 'DNG', 'ORF', 'PEF', 'RAF', 'RW2', 'RAW'];
    const isRAW = rawExtensions.includes(item.extension);
    
    if (isRAW) {
      try {
        const buffer = await item.file.arrayBuffer();
        const carvedBlob = extractLargestEmbeddedJPEG(buffer);
        
        if (carvedBlob) {
          item.carvedBlob = carvedBlob;
          const objectURL = URL.createObjectURL(carvedBlob);
          const img = new Image();
          
          img.onload = () => {
            item.width = img.naturalWidth;
            item.height = img.naturalHeight;
            item.aspectRatio = img.naturalWidth / img.naturalHeight;
            
            const thumbCanvas = document.createElement('canvas');
            const maxThumbDim = 100;
            let thumbW = img.naturalWidth;
            let thumbH = img.naturalHeight;
            if (img.naturalWidth > img.naturalHeight) {
              if (img.naturalWidth > maxThumbDim) {
                thumbW = maxThumbDim;
                thumbH = Math.round(img.naturalHeight * (maxThumbDim / img.naturalWidth));
              }
            } else {
              if (img.naturalHeight > maxThumbDim) {
                thumbH = maxThumbDim;
                thumbW = Math.round(img.naturalWidth * (maxThumbDim / img.naturalHeight));
              }
            }
            thumbCanvas.width = thumbW;
            thumbCanvas.height = thumbH;
            thumbCanvas.getContext('2d').drawImage(img, 0, 0, thumbW, thumbH);
            
            item.thumbnail = thumbCanvas.toDataURL('image/png');
            item.status = 'pending';
            URL.revokeObjectURL(objectURL);
            updateQueueUI();
          };
          
          img.onerror = () => {
            if (item.extension === 'DNG') {
              URL.revokeObjectURL(objectURL);
              tryTIFFFallback(item, buffer);
            } else {
              item.status = 'error';
              item.error = 'Failed to load extracted RAW preview.';
              item.thumbnail = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNlZjQ0NDQiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0xIDE1aC0ydi0yaDJ2MnptMC00aC0yVjdoMnY2eiIvPjwvc3ZnPg==';
              URL.revokeObjectURL(objectURL);
              updateQueueUI();
            }
          };
          
          img.src = objectURL;
        } else {
          if (item.extension === 'DNG') {
            tryTIFFFallback(item, buffer);
          } else {
            throw new Error("No embedded JPEG preview found in RAW file.");
          }
        }
      } catch (err) {
        item.status = 'error';
        item.error = err.message || 'RAW parsing failed.';
        item.thumbnail = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNlZjQ0NDQiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0xIDE1aC0ydi0yaDJ2MnptMC00aC0yVjdoMnY2eiIvPjwvc3ZnPg==';
        updateQueueUI();
      }
    } else if (isTIFF) {
      try {
        // Read file as ArrayBuffer for UTIF.js
        const buffer = await item.file.arrayBuffer();
        const ifds = UTIF.decode(buffer);
        if (!ifds || ifds.length === 0) throw new Error("Could not decode TIFF directories");
        UTIF.decodeImage(buffer, ifds[0]);
        
        const width = ifds[0].width;
        const height = ifds[0].height;
        const rgba = UTIF.toRGBA8(ifds[0]);
        
        item.width = width;
        item.height = height;
        item.aspectRatio = width / height;
        item.isTIFFParsed = true;
        item.tiffRGBA = rgba;
        
        // Generate a preview using an offscreen canvas
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = width;
        previewCanvas.height = height;
        const previewCtx = previewCanvas.getContext('2d');
        const imgData = previewCtx.createImageData(width, height);
        imgData.data.set(rgba);
        previewCtx.putImageData(imgData, 0, 0);
        
        // Downscale preview thumbnail for UI performance
        const thumbCanvas = document.createElement('canvas');
        const maxThumbDim = 100;
        let thumbW = width;
        let thumbH = height;
        if (width > height) {
          if (width > maxThumbDim) {
            thumbW = maxThumbDim;
            thumbH = Math.round(height * (maxThumbDim / width));
          }
        } else {
          if (height > maxThumbDim) {
            thumbH = maxThumbDim;
            thumbW = Math.round(width * (maxThumbDim / height));
          }
        }
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        thumbCanvas.getContext('2d').drawImage(previewCanvas, 0, 0, thumbW, thumbH);
        
        item.thumbnail = thumbCanvas.toDataURL('image/png');
        item.status = 'pending';
        updateQueueUI();
      } catch (err) {
        item.status = 'error';
        item.error = 'TIFF Decoding failed: ' + err.message;
        item.thumbnail = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNlZjQ0NDQiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0xIDE1aC0ydi0yaDJ2MnptMC00aC0yVjdoMnY2eiIvPjwvc3ZnPg==';
        updateQueueUI();
      }
    } else {
      // Normal images (PNG, JPEG, WEBP, BMP, SVG, GIF, AVIF)
      const objectURL = URL.createObjectURL(item.file);
      const img = new Image();
      
      img.onload = () => {
        item.width = img.naturalWidth;
        item.height = img.naturalHeight;
        item.aspectRatio = img.naturalWidth / img.naturalHeight;
        
        // Scale thumbnail
        const thumbCanvas = document.createElement('canvas');
        const maxThumbDim = 100;
        let thumbW = img.naturalWidth;
        let thumbH = img.naturalHeight;
        if (img.naturalWidth > img.naturalHeight) {
          if (img.naturalWidth > maxThumbDim) {
            thumbW = maxThumbDim;
            thumbH = Math.round(img.naturalHeight * (maxThumbDim / img.naturalWidth));
          }
        } else {
          if (img.naturalHeight > maxThumbDim) {
            thumbH = maxThumbDim;
            thumbW = Math.round(img.naturalWidth * (maxThumbDim / img.naturalHeight));
          }
        }
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        thumbCanvas.getContext('2d').drawImage(img, 0, 0, thumbW, thumbH);
        
        item.thumbnail = thumbCanvas.toDataURL('image/png');
        URL.revokeObjectURL(objectURL);
        updateQueueUI();
      };
      
      img.onerror = () => {
        item.status = 'error';
        item.error = 'Image loading failed.';
        item.thumbnail = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNlZjQ0NDQiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0xIDE1aC0ydi0yaDJ2MnptMC00aC0yVjdoMnY2eiIvPjwvc3ZnPg==';
        URL.revokeObjectURL(objectURL);
        updateQueueUI();
      };
      
      img.src = objectURL;
    }
  }

  // --- Render Queue UI ---
  function updateQueueUI() {
    if (fileQueue.length === 0) {
      fileQueueContainer.innerHTML = `
        <div class="text-center py-5 text-secondary">
          <i class="fa-solid fa-folder-open fs-1 mb-2 d-block text-muted"></i>
          Queue is empty. Select files to start.
        </div>
      `;
      queueStatus.classList.add('d-none');
      convertAllBtn.disabled = true;
      return;
    }

    queueStatus.classList.remove('d-none');
    queueCount.textContent = `${fileQueue.length} file${fileQueue.length > 1 ? 's' : ''} selected`;
    convertAllBtn.disabled = !fileQueue.some(item => item.status === 'pending');

    // Sync dimensions fields defaults if custom is checked and empty
    if (resizeCustom.checked && (!customWidth.value || !customHeight.value)) {
      const firstValid = fileQueue.find(f => f.width > 0);
      if (firstValid) {
        customWidth.value = firstValid.width;
        customHeight.value = firstValid.height;
      }
    }

    fileQueueContainer.innerHTML = '';
    
    fileQueue.forEach((item, index) => {
      const fileRow = document.createElement('div');
      fileRow.className = `file-item d-flex flex-column`;
      
      const readableSize = formatBytes(item.size);
      const dimensionsStr = item.width > 0 ? `${item.width} x ${item.height} px` : 'Loading...';
      
      let badgeClass = 'pending';
      let statusText = `<i class="fa-solid fa-clock me-1"></i>Pending`;
      if (item.status === 'processing') {
        badgeClass = 'converting';
        statusText = `<i class="fa-solid fa-arrows-rotate me-1 spin-icon"></i>Converting (${item.progress}%)`;
      } else if (item.status === 'success') {
        badgeClass = 'success';
        statusText = `<i class="fa-solid fa-circle-check me-1"></i>Completed`;
      } else if (item.status === 'error') {
        badgeClass = 'error';
        statusText = `<i class="fa-solid fa-circle-xmark me-1"></i>Error`;
      }

      fileRow.innerHTML = `
        <div class="d-flex align-items-center">
          <img src="${item.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNjY2MiPjxyZWN0IHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg=='}" class="file-item-thumbnail me-3" alt="thumbnail">
          <div class="file-item-info">
            <div class="file-item-name" title="${item.name}">${item.name}</div>
            <div class="file-item-meta">
              <span class="badge bg-secondary-subtle text-secondary me-1">${item.extension}</span>
              <span class="me-2">${readableSize}</span>
              <span class="text-muted"><i class="fa-solid fa-expand me-1"></i>${dimensionsStr}</span>
            </div>
          </div>
          <div class="file-item-actions">
            <span class="status-badge ${badgeClass}">${statusText}</span>
            
            ${item.status === 'success' ? `
              <button class="btn btn-sm btn-outline-success compare-btn" data-index="${index}" title="Compare original and converted">
                <i class="fa-solid fa-images"></i>
              </button>
              <a href="${item.convertedUrl}" download="${getNewFileName(item.name, globalFormat.value)}" class="btn btn-sm btn-primary" title="Download converted file">
                <i class="fa-solid fa-download"></i>
              </a>
            ` : ''}

            ${item.status === 'pending' ? `
              <button class="btn btn-sm btn-outline-primary convert-single-btn" data-index="${index}" title="Convert this image">
                <i class="fa-solid fa-circle-play"></i>
              </button>
            ` : ''}

            <button class="btn btn-sm btn-outline-danger delete-btn" data-index="${index}" title="Remove file">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        ${item.status === 'processing' ? `
          <div class="progress-bar-custom">
            <div class="progress-bar-inner" style="width: ${item.progress}%"></div>
          </div>
        ` : ''}
        ${item.status === 'error' ? `
          <div class="text-danger small mt-2"><i class="fa-solid fa-triangle-exclamation me-1"></i>${item.error}</div>
        ` : ''}
      `;

      // Bind dynamic actions
      fileRow.querySelector('.delete-btn').addEventListener('click', () => removeQueueItem(index));
      
      const singleConvertBtn = fileRow.querySelector('.convert-single-btn');
      if (singleConvertBtn) {
        singleConvertBtn.addEventListener('click', () => convertSingleImage(index));
      }

      const compareBtn = fileRow.querySelector('.compare-btn');
      if (compareBtn) {
        compareBtn.addEventListener('click', () => openComparison(index));
      }

      fileQueueContainer.appendChild(fileRow);
    });
  }

  // --- Remove queue item ---
  function removeQueueItem(index) {
    const item = fileQueue[index];
    if (item.convertedUrl) {
      URL.revokeObjectURL(item.convertedUrl);
    }
    fileQueue.splice(index, 1);
    updateQueueUI();
  }

  // --- Clear whole queue ---
  function clearQueue() {
    fileQueue.forEach(item => {
      if (item.convertedUrl) {
        URL.revokeObjectURL(item.convertedUrl);
      }
    });
    fileQueue = [];
    updateQueueUI();
    showToast('Queue cleared successfully.', 'info');
  }

  // --- Format output name helper ---
  function getNewFileName(originalName, targetExt) {
    const dotIndex = originalName.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
    return `${baseName}.${targetExt}`;
  }

  // --- Bulk Conversion trigger ---
  async function convertAllImages() {
    const pendingItems = fileQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) return;

    convertAllBtn.disabled = true;
    
    for (let i = 0; i < fileQueue.length; i++) {
      if (fileQueue[i].status === 'pending') {
        await convertSingleImage(i);
      }
    }
    
    convertAllBtn.disabled = !fileQueue.some(item => item.status === 'pending');
  }

  // --- Convert Single Image Process ---
  async function convertSingleImage(index) {
    const item = fileQueue[index];
    if (item.status === 'error' && !item.width) {
      showToast('Cannot convert image due to loaded file error.', 'error');
      return;
    }

    item.status = 'processing';
    item.progress = 10;
    updateQueueUI();

    try {
      const targetFormatVal = globalFormat.value;
      const targetQuality = parseFloat(globalQuality.value) / 100;
      
      // Compute Resize Dimensions
      let destWidth = item.width;
      let destHeight = item.height;

      if (resizeCustom.checked) {
        const customWVal = parseInt(customWidth.value);
        const customHVal = parseInt(customHeight.value);
        
        if (customWVal > 0 && customHVal > 0) {
          destWidth = customWVal;
          destHeight = customHVal;
        } else if (customWVal > 0) {
          destWidth = customWVal;
          destHeight = Math.round(customWVal / item.aspectRatio);
        } else if (customHVal > 0) {
          destHeight = customHVal;
          destWidth = Math.round(customHVal * item.aspectRatio);
        }
      }

      item.progress = 30;
      updateQueueUI();

      // Render onto canvas
      const canvas = document.createElement('canvas');
      canvas.width = destWidth;
      canvas.height = destHeight;
      const ctx = canvas.getContext('2d');

      // Check if RAW, TIFF, or normal image formats
      if (item.carvedBlob) {
        const img = await loadImagePromise(item.carvedBlob);
        ctx.drawImage(img, 0, 0, destWidth, destHeight);
      } else if (item.isTIFFParsed || item.extension === 'TIFF' || item.extension === 'TIF') {
        let rgba = item.tiffRGBA;
        if (!rgba) {
          const buffer = await item.file.arrayBuffer();
          const ifds = UTIF.decode(buffer);
          UTIF.decodeImage(buffer, ifds[0]);
          rgba = UTIF.toRGBA8(ifds[0]);
        }
        
        // Put onto temporary full-sized canvas, then draw onto destination canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = item.width;
        tempCanvas.height = item.height;
        const tempCtx = tempCanvas.getContext('2d');
        const imgData = tempCtx.createImageData(item.width, item.height);
        imgData.data.set(rgba);
        tempCtx.putImageData(imgData, 0, 0);

        ctx.drawImage(tempCanvas, 0, 0, destWidth, destHeight);
      } else {
        // SVG/PNG/JPG/WEBP loading helper
        const img = await loadImagePromise(item.file);
        ctx.drawImage(img, 0, 0, destWidth, destHeight);
      }

      item.progress = 60;
      updateQueueUI();

      // Core Exporters
      let convertedBlob;

      if (targetFormatVal === 'bmp') {
        convertedBlob = canvasToBMP(canvas);
      } else if (targetFormatVal === 'ico') {
        convertedBlob = await canvasToICO(canvas);
      } else if (targetFormatVal === 'svg') {
        convertedBlob = await canvasToSVG(canvas);
      } else {
        // Standard exports: jpeg, png, webp, gif, avif
        let mimeType = `image/${targetFormatVal}`;
        if (targetFormatVal === 'jpeg') mimeType = 'image/jpeg';
        
        convertedBlob = await new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error(`Could not export as ${targetFormatVal}`));
            }
          }, mimeType, targetQuality);
        });

        // Double check browser native fallback (e.g. falls back to PNG if not supported)
        if (convertedBlob.type !== mimeType) {
          if (targetFormatVal === 'avif' || targetFormatVal === 'gif') {
            throw new Error(`Your browser does not support exporting as ${targetFormatVal.toUpperCase()}.`);
          }
        }
      }

      item.progress = 90;
      updateQueueUI();

      // Revoke past converted URL if existing
      if (item.convertedUrl) {
        URL.revokeObjectURL(item.convertedUrl);
      }

      item.convertedBlob = convertedBlob;
      item.convertedUrl = URL.createObjectURL(convertedBlob);
      item.convertedSize = convertedBlob.size;
      item.status = 'success';
      item.progress = 100;
      
      // Save record in Conversion History
      addHistoryRecord(item, targetFormatVal.toUpperCase());
      updateQueueUI();
    } catch (err) {
      item.status = 'error';
      item.error = err.message || 'Conversion failed.';
      updateQueueUI();
    }
  }

  // --- Promisified Image Loader ---
  function loadImagePromise(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error("Image decoding failed"));
      };
      img.src = url;
    });
  }

  // ==========================================================================
  // CUSTOM FORMAT EXPORTERS (BMP, ICO, SVG)
  // ==========================================================================

  // --- Custom 24-bit uncompressed BMP Exporter ---
  function canvasToBMP(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const width = imgData.width;
    const height = imgData.height;
    const data = imgData.data;
    
    // Rows must be padded to a multiple of 4 bytes
    const padding = (4 - (width * 3) % 4) % 4;
    const rgbSize = (width * 3 + padding) * height;
    const headerSize = 54;
    const fileSize = headerSize + rgbSize;
    
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    
    // BMP File Header
    view.setUint16(0, 0x4D42, true); // "BM" magic signature
    view.setUint32(2, fileSize, true);
    view.setUint32(6, 0, true);      // Reserved 0
    view.setUint32(10, headerSize, true); // Data offset (54 bytes)
    
    // DIB Header (BITMAPINFOHEADER)
    view.setUint32(14, 40, true);    // DIB header size
    view.setInt32(18, width, true);
    view.setInt32(22, -height, true); // Negative height for top-down bitmap
    view.setUint16(26, 1, true);     // Color planes (1)
    view.setUint16(28, 24, true);    // Bits per pixel (24-bit RGB)
    view.setUint32(30, 0, true);     // No compression (0)
    view.setUint32(34, rgbSize, true); // Image data size
    view.setInt32(38, 2835, true);   // 72 DPI horizontal (2835 pixels/meter)
    view.setInt32(42, 2835, true);   // 72 DPI vertical
    view.setUint32(46, 0, true);     // Color palette count
    view.setUint32(50, 0, true);     // Important colors count
    
    // Pixel stream (BGR format)
    const u8 = new Uint8Array(buffer, headerSize);
    let pos = 0;
    let imgPos = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        u8[pos++] = data[imgPos + 2]; // Blue
        u8[pos++] = data[imgPos + 1]; // Green
        u8[pos++] = data[imgPos];     // Red
        imgPos += 4;                  // Skip Alpha in source
      }
      for (let p = 0; p < padding; p++) {
        u8[pos++] = 0;                // Row padding bytes
      }
    }
    
    return new Blob([buffer], { type: 'image/bmp' });
  }

  // --- Custom ICO Exporter ---
  function canvasToICO(canvas) {
    return new Promise((resolve) => {
      // Export canvas as PNG first, then encapsulate inside ICO container
      canvas.toBlob((pngBlob) => {
        pngBlob.arrayBuffer().then((pngBuffer) => {
          const pngSize = pngBuffer.byteLength;
          const fileSize = 22 + pngSize;
          const buffer = new ArrayBuffer(fileSize);
          const view = new DataView(buffer);
          
          // Icon File Header
          view.setUint16(0, 0, true); // Reserved
          view.setUint16(2, 1, true); // Resource Type: Icon (1)
          view.setUint16(4, 1, true); // Number of Images (1)
          
          // Directory Entry
          let w = canvas.width;
          let h = canvas.height;
          view.setUint8(6, w >= 256 ? 0 : w);
          view.setUint8(7, h >= 256 ? 0 : h);
          view.setUint8(8, 0); // Palette colors
          view.setUint8(9, 0); // Reserved
          view.setUint16(10, 1, true);  // Color planes (1)
          view.setUint16(12, 32, true); // Bits per pixel (32-bit color)
          view.setUint32(14, pngSize, true); // Image data size
          view.setUint32(18, 22, true);      // Image offset (header size = 22)
          
          // Copy PNG payload
          const destU8 = new Uint8Array(buffer, 22);
          const srcU8 = new Uint8Array(pngBuffer);
          destU8.set(srcU8);
          
          resolve(new Blob([buffer], { type: 'image/x-icon' }));
        });
      }, 'image/png');
    });
  }

  // --- Custom SVG Wrapper ---
  function canvasToSVG(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((pngBlob) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataURL = reader.result;
          const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
  <image width="${canvas.width}" height="${canvas.height}" href="${dataURL}"/>
</svg>`;
          const blob = new Blob([svgContent], { type: 'image/svg+xml' });
          resolve(blob);
        };
        reader.readAsDataURL(pngBlob);
      }, 'image/png');
    });
  }

  // ==========================================================================
  // COMPARISON SLIDER & PREVIEW MODAL
  // ==========================================================================

  function openComparison(index) {
    const item = fileQueue[index];
    if (!item.convertedUrl) return;

    activeComparingIndex = index;

    // Load original image preview URL
    const originalUrl = URL.createObjectURL(item.file);
    
    // Assign image URLs
    beforeImage.src = originalUrl;
    afterImage.src = item.convertedUrl;
    
    // Assign metadata
    beforeFormat.textContent = item.extension;
    beforeSize.textContent = formatBytes(item.size);
    afterFormat.textContent = globalFormat.value.toUpperCase();
    afterSize.textContent = formatBytes(item.convertedSize);

    // Setup download in modal
    modalDownloadBtn.href = item.convertedUrl;
    modalDownloadBtn.download = getNewFileName(item.name, globalFormat.value);

    // Cleanup object URL when modal hides
    const modalEl = document.getElementById('previewModal');
    const onModalHide = () => {
      URL.revokeObjectURL(originalUrl);
      modalEl.removeEventListener('hidden.bs.modal', onModalHide);
    };
    modalEl.addEventListener('hidden.bs.modal', onModalHide);

    // Reset slider divider to center (50%)
    afterImageWrapper.style.width = '50%';
    comparisonSlider.style.left = '50%';

    previewModal.show();
  }

  function setupSliderDrag() {
    let isDragging = false;

    function moveSlider(clientX) {
      const rect = comparisonContainer.getBoundingClientRect();
      let offsetX = clientX - rect.left;
      
      // Clamp bounds
      if (offsetX < 0) offsetX = 0;
      if (offsetX > rect.width) offsetX = rect.width;
      
      const percentage = (offsetX / rect.width) * 100;
      afterImageWrapper.style.width = `${percentage}%`;
      comparisonSlider.style.left = `${percentage}%`;
    }

    // Touch events for mobile support
    comparisonSlider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
    });

    comparisonContainer.addEventListener('mousedown', (e) => {
      if (e.target !== comparisonSlider && !comparisonSlider.contains(e.target)) {
        moveSlider(e.clientX);
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      moveSlider(e.clientX);
    });

    // Touch support
    comparisonSlider.addEventListener('touchstart', (e) => {
      isDragging = true;
    });

    window.addEventListener('touchend', () => {
      isDragging = false;
    });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging || !e.touches[0]) return;
      moveSlider(e.touches[0].clientX);
    });
  }

  // ==========================================================================
  // CONVERSION HISTORY (LOCAL STORAGE)
  // ==========================================================================

  function addHistoryRecord(item, targetFormat) {
    const originalSize = item.size;
    const finalSize = item.convertedSize;
    
    // Compute compression ratio
    let ratioStr = '0%';
    if (originalSize > 0) {
      const ratio = ((finalSize - originalSize) / originalSize) * 100;
      ratioStr = ratio < 0 ? `${ratio.toFixed(1)}%` : `+${ratio.toFixed(1)}%`;
    }

    const record = {
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: item.name,
      originalSize: formatBytes(originalSize),
      targetFormat: targetFormat,
      convertedSize: formatBytes(finalSize),
      ratio: ratioStr,
      downloadUrl: item.convertedUrl, // Transient URL, valid during session only
      downloadName: getNewFileName(item.name, targetFormat.toLowerCase()),
      timestamp: Date.now()
    };

    // Keep history maximum size of 20
    conversionHistory.unshift(record);
    if (conversionHistory.length > 20) {
      conversionHistory.pop();
    }

    // Save only serializable data in localStorage (omit URL since it expires)
    const localRecords = conversionHistory.map(r => ({
      id: r.id,
      name: r.name,
      originalSize: r.originalSize,
      targetFormat: r.targetFormat,
      convertedSize: r.convertedSize,
      ratio: r.ratio,
      downloadName: r.downloadName,
      timestamp: r.timestamp
    }));
    localStorage.setItem('icp_history', JSON.stringify(localRecords));
    renderHistory();
  }

  function renderHistory() {
    // Empty row visibility toggle
    if (conversionHistory.length === 0) {
      emptyHistoryRow.classList.remove('d-none');
      // Hide other rows
      const rows = historyList.querySelectorAll('tr:not(#emptyHistoryRow)');
      rows.forEach(r => r.remove());
      return;
    }

    emptyHistoryRow.classList.add('d-none');
    
    // Remove existing rows
    const oldRows = historyList.querySelectorAll('tr:not(#emptyHistoryRow)');
    oldRows.forEach(r => r.remove());

    conversionHistory.forEach(record => {
      const row = document.createElement('tr');
      row.className = 'history-item';
      
      const ratioBadgeClass = record.ratio.startsWith('-') ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary';
      
      // Look up if active transient download URL is still available in queue
      let downloadBtnHtml = '';
      const activeQueueItem = fileQueue.find(f => getNewFileName(f.name, globalFormat.value) === record.downloadName);
      
      if (activeQueueItem && activeQueueItem.convertedUrl) {
        downloadBtnHtml = `
          <a href="${activeQueueItem.convertedUrl}" download="${record.downloadName}" class="btn btn-sm btn-outline-success">
            <i class="fa-solid fa-download"></i>
          </a>
        `;
      } else {
        // Fallback for reloaded/historical ones where blob url is expired
        downloadBtnHtml = `
          <span class="text-muted small" title="Expired. Re-upload file to download again.">
            <i class="fa-solid fa-clock-rotate-left"></i> Session Only
          </span>
        `;
      }

      row.innerHTML = `
        <td class="text-truncate fw-semibold" style="max-width: 250px;" title="${record.name}">${record.name}</td>
        <td>${record.originalSize}</td>
        <td><span class="badge bg-primary-subtle text-primary">${record.targetFormat}</span></td>
        <td>${record.convertedSize}</td>
        <td><span class="badge ${ratioBadgeClass}">${record.ratio}</span></td>
        <td class="text-end">
          <div class="d-inline-flex gap-2">
            ${downloadBtnHtml}
            <button class="btn btn-sm btn-outline-danger hist-delete-btn" data-id="${record.id}">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      // Bind delete handler
      row.querySelector('.hist-delete-btn').addEventListener('click', () => deleteHistoryItem(record.id));

      historyList.appendChild(row);
    });
  }

  function deleteHistoryItem(id) {
    conversionHistory = conversionHistory.filter(r => r.id !== id);
    const localRecords = conversionHistory.map(r => ({
      id: r.id,
      name: r.name,
      originalSize: r.originalSize,
      targetFormat: r.targetFormat,
      convertedSize: r.convertedSize,
      ratio: r.ratio,
      downloadName: r.downloadName,
      timestamp: r.timestamp
    }));
    localStorage.setItem('icp_history', JSON.stringify(localRecords));
    renderHistory();
    showToast('Record removed from history.', 'info');
  }

  function clearHistory() {
    conversionHistory = [];
    localStorage.removeItem('icp_history');
    renderHistory();
    showToast('History cleared.', 'info');
  }

  // --- Fallback DNG TIFF Decoder ---
  function tryTIFFFallback(item, buffer) {
    try {
      const ifds = UTIF.decode(buffer);
      if (!ifds || ifds.length === 0) throw new Error("Could not decode DNG directories");
      UTIF.decodeImage(buffer, ifds[0]);
      
      const width = ifds[0].width;
      const height = ifds[0].height;
      const rgba = UTIF.toRGBA8(ifds[0]);
      
      item.width = width;
      item.height = height;
      item.aspectRatio = width / height;
      item.isTIFFParsed = true;
      item.tiffRGBA = rgba;
      
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = width;
      previewCanvas.height = height;
      const previewCtx = previewCanvas.getContext('2d');
      const imgData = previewCtx.createImageData(width, height);
      imgData.data.set(rgba);
      previewCtx.putImageData(imgData, 0, 0);
      
      const thumbCanvas = document.createElement('canvas');
      const maxThumbDim = 100;
      let thumbW = width;
      let thumbH = height;
      if (width > height) {
        if (width > maxThumbDim) {
          thumbW = maxThumbDim;
          thumbH = Math.round(height * (maxThumbDim / width));
        }
      } else {
        if (height > maxThumbDim) {
          thumbH = maxThumbDim;
          thumbW = Math.round(width * (maxThumbDim / height));
        }
      }
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      thumbCanvas.getContext('2d').drawImage(previewCanvas, 0, 0, thumbW, thumbH);
      
      item.thumbnail = thumbCanvas.toDataURL('image/png');
      item.status = 'pending';
      updateQueueUI();
    } catch (err) {
      item.status = 'error';
      item.error = 'DNG TIFF decoding failed: ' + err.message;
      item.thumbnail = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNlZjQ0NDQiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0xIDE1aC0ydi0yaDJ2MnptMC00aC0yVjdoMnY2eiIvPjwvc3ZnPg==';
      updateQueueUI();
    }
  }

  // --- Fast Client-Side RAW Embedded JPEG Carver ---
  function extractLargestEmbeddedJPEG(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer);
    const len = u8.length;
    let largestStart = -1;
    let largestEnd = -1;
    let largestSize = 0;
    
    let i = 0;
    while (i < len - 4) {
      if (u8[i] === 0xFF) {
        if (u8[i+1] === 0xD8 && u8[i+2] === 0xFF) {
          let eoi = -1;
          for (let j = i + 2; j < len - 1; j++) {
            if (u8[j] === 0xFF && u8[j+1] === 0xD9) {
              eoi = j + 2;
              break;
            }
          }
          if (eoi !== -1) {
            const size = eoi - i;
            if (size > largestSize) {
              largestStart = i;
              largestEnd = eoi;
              largestSize = size;
            }
            i = eoi;
            continue;
          }
        }
      }
      i++;
    }
    
    if (largestSize > 100) { // Must be at least 100 bytes
      return new Blob([u8.subarray(largestStart, largestEnd)], { type: 'image/jpeg' });
    }
    return null;
  }

  // --- Utility: Format File Size ---
  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
});
