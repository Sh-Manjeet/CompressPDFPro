/* ============================================================
   CompressPDF Pro - browser-only PDF and image tools
   ============================================================ */

let originalFile = null;
let originalSize = 0;
let compressedBytes = null;

const toolTitles = {
  compressor: 'PDF Compressor',
  converter: 'PDF Converter',
  editor: 'PDF Editor',
  image: 'Image Compressor',
};

const toolTitle = document.getElementById('tool-title');
const sidebarItems = document.querySelectorAll('.sidebar-item');
const panels = document.querySelectorAll('.tool-panel');

const fileInput = document.getElementById('file-input');
const uploadZone = document.getElementById('upload-zone');
const uploadIcon = document.getElementById('upload-icon');
const fileInfo = document.getElementById('file-info');
const fileNameEl = document.getElementById('file-name');
const fileSizeEl = document.getElementById('file-size');
const controlsEl = document.getElementById('controls');
const rangeSlider = document.getElementById('compression-range');
const targetSizeInput = document.getElementById('target-size-input');
const percentLabel = document.getElementById('percent-label');
const origSizeDisplay = document.getElementById('original-size-display');
const estimatedSizeEl = document.getElementById('estimated-size');
const savingPercentEl = document.getElementById('saving-percent');
const compressBtn = document.getElementById('compress-btn');
const downloadBtn = document.getElementById('download-btn');
const successMsg = document.getElementById('success-msg');
const successText = document.getElementById('success-text');
const progressWrap = document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

const converterMode = document.getElementById('converter-mode');
const converterFiles = document.getElementById('converter-files');
const convertBtn = document.getElementById('convert-btn');
const converterStatus = document.getElementById('converter-status');

const editorMode = document.getElementById('editor-mode');
const editorFiles = document.getElementById('editor-files');
const pageRangeWrap = document.getElementById('page-range-wrap');
const pageRangeInput = document.getElementById('page-range');
const rotationWrap = document.getElementById('rotation-wrap');
const rotationDegrees = document.getElementById('rotation-degrees');
const editBtn = document.getElementById('edit-btn');
const editorStatus = document.getElementById('editor-status');

const imageFiles = document.getElementById('image-files');
const imageQuality = document.getElementById('image-quality');
const imageQualityLabel = document.getElementById('image-quality-label');
const imageMaxWidth = document.getElementById('image-max-width');
const imageCompressBtn = document.getElementById('image-compress-btn');
const imageStatus = document.getElementById('image-status');

const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

sidebarItems.forEach((item) => {
  item.addEventListener('click', () => showTool(item.dataset.tool));
});

function showTool(tool) {
  sidebarItems.forEach((item) => {
    const isActive = item.dataset.tool === tool;
    item.classList.toggle('active', isActive);
    item.classList.toggle('text-slate-400', !isActive);
  });

  panels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `${tool}-panel`);
  });

  toolTitle.textContent = toolTitles[tool];
}

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file) {
  originalFile = file;
  originalSize = file.size;
  compressedBytes = null;

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatSize(originalSize);
  origSizeDisplay.textContent = formatSize(originalSize);

  uploadIcon.classList.add('hidden');
  fileInfo.classList.remove('hidden');
  controlsEl.classList.remove('hidden');
  successMsg.classList.add('hidden');
  downloadBtn.classList.add('hidden');
  progressWrap.classList.add('hidden');
  compressBtn.classList.remove('hidden');

  updateEstimate();
}

rangeSlider.addEventListener('input', () => {
  updateEstimate();
  resetCompressedResult();
});

targetSizeInput.addEventListener('input', () => {
  updateTargetDisplay(getTargetSize());
  resetCompressedResult();
});

function resetCompressedResult() {
  if (!compressedBytes) return;
  compressedBytes = null;
  downloadBtn.classList.add('hidden');
  successMsg.classList.add('hidden');
  compressBtn.classList.remove('hidden');
}

function sliderToQuality(pct) {
  return Math.max(0.10, 0.92 - (pct / 100) * 0.82);
}

function updateEstimate() {
  const pct = parseInt(rangeSlider.value, 10);
  const quality = sliderToQuality(pct);
  const factor = Math.min(1, Math.max(0.08, quality * 0.90));
  const est = Math.round(originalSize * factor);

  percentLabel.textContent = pct + '%';
  targetSizeInput.value = Math.max(1, Math.round(est / 1024));
  targetSizeInput.max = Math.max(1, Math.floor(originalSize / 1024));
  updateTargetDisplay(est);
}

function updateTargetDisplay(targetSize) {
  const saving = originalSize ? Math.round((1 - targetSize / originalSize) * 100) : 0;
  estimatedSizeEl.textContent = formatSize(targetSize);
  savingPercentEl.textContent = '~' + Math.max(0, saving) + '% saved';
}

function getTargetSize() {
  const targetKb = parseFloat(targetSizeInput.value);
  if (!Number.isFinite(targetKb) || targetKb <= 0) {
    return Math.max(1, Math.round(originalSize * 0.5));
  }
  return Math.max(1, Math.min(originalSize, Math.round(targetKb * 1024)));
}

compressBtn.addEventListener('click', async () => {
  if (!originalFile) return;

  const targetSize = getTargetSize();

  compressBtn.disabled = true;
  compressBtn.innerHTML = '<i class="bi bi-hourglass-split" style="font-size:16px"></i> Compressing...';
  progressBar.style.background = '';
  progressWrap.classList.remove('hidden');
  successMsg.classList.add('hidden');
  downloadBtn.classList.add('hidden');
  setProgress(5, 'Loading PDF...');

  try {
    const pdfDoc = await loadPdfJsDocument(originalFile);
    compressedBytes = await compressPdfToTarget(pdfDoc, pdfDoc.numPages, targetSize);

    setProgress(100, 'Done!');
    const realSize = compressedBytes.byteLength;
    const realSaving = Math.round((1 - realSize / originalSize) * 100);

    estimatedSizeEl.textContent = formatSize(realSize);
    savingPercentEl.textContent = (realSaving > 0 ? realSaving : 0) + '% saved';

    setTimeout(() => {
      progressWrap.classList.add('hidden');
      successText.textContent =
        `Done: ${formatSize(originalSize)} -> ${formatSize(realSize)} (${realSaving > 0 ? realSaving : 0}% smaller)`;
      successMsg.classList.remove('hidden');
      downloadBtn.classList.remove('hidden');
      compressBtn.classList.add('hidden');
      compressBtn.disabled = false;
      compressBtn.innerHTML = '<i class="bi bi-file-earmark-zip" style="font-size:18px"></i> Compress PDF';
    }, 300);
  } catch (err) {
    showCompressionError(err);
  }
});

async function compressPdfToTarget(pdfDoc, totalPages, targetSize) {
  const pct = parseInt(rangeSlider.value, 10);
  let quality = sliderToQuality(pct);
  let scale = 1.5;
  let bestUnderTarget = null;
  let closest = null;

  for (let attempt = 1; attempt <= 7; attempt++) {
    setProgress(12, `Matching target size ${attempt} of 7...`);
    const bytes = await buildRasterPdf(pdfDoc, totalPages, quality, scale, attempt);
    const size = bytes.byteLength;
    const candidate = { bytes, size };

    if (!closest || Math.abs(size - targetSize) < Math.abs(closest.size - targetSize)) {
      closest = candidate;
    }

    if (size <= targetSize && (!bestUnderTarget || size > bestUnderTarget.size)) {
      bestUnderTarget = candidate;
    }

    if (size <= targetSize && size >= targetSize * 0.94) return bytes;

    const ratio = targetSize / size;
    if (size > targetSize) {
      if (quality > 0.12) {
        quality = clamp(quality * Math.max(0.35, ratio * 0.92), 0.10, 0.95);
      } else {
        scale = clamp(scale * Math.sqrt(ratio) * 0.96, 0.45, 4);
      }
    } else if (quality < 0.94) {
      quality = clamp(quality + (0.95 - quality) * 0.65, 0.10, 0.95);
    } else {
      scale = clamp(scale * Math.sqrt(ratio) * 0.98, 0.45, 4);
    }
  }

  return (bestUnderTarget || closest).bytes;
}

async function buildRasterPdf(pdfDoc, totalPages, quality, renderScale, attempt) {
  const { PDFDocument } = PDFLib;
  const newPdfDoc = await PDFDocument.create();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  for (let i = 1; i <= totalPages; i++) {
    const pageProgress = 15 + Math.round((((attempt - 1) + i / totalPages) / 7) * 80);
    setProgress(pageProgress, `Compressing page ${i} of ${totalPages}...`);
    const { jpegBytes, width, height } = await renderPdfPageToJpeg(pdfDoc, i, renderScale, quality, canvas, ctx);

    const jpegImage = await newPdfDoc.embedJpg(jpegBytes);
    const newPage = newPdfDoc.addPage([width, height]);
    newPage.drawImage(jpegImage, { x: 0, y: 0, width, height });
  }

  setProgress(95, 'Writing PDF...');
  return newPdfDoc.save({ useObjectStreams: true });
}

downloadBtn.addEventListener('click', () => {
  if (!compressedBytes) return;
  downloadBlob(
    new Blob([compressedBytes], { type: 'application/pdf' }),
    originalFile.name.replace(/\.pdf$/i, '') + '_compressed.pdf'
  );
});

converterMode.addEventListener('change', () => {
  const isImages = converterMode.value === 'image-to-pdf';
  converterFiles.value = '';
  converterFiles.multiple = isImages;
  converterFiles.accept = isImages ? 'image/*' : '.pdf,application/pdf';
  converterStatus.textContent = '';
});

convertBtn.addEventListener('click', async () => {
  const files = Array.from(converterFiles.files);
  if (!files.length) {
    converterStatus.textContent = 'Choose a file first.';
    return;
  }

  setBusy(convertBtn, true, 'Converting...');
  converterStatus.textContent = '';

  try {
    if (converterMode.value === 'pdf-to-jpg') {
      await convertPdfToJpg(files[0]);
    } else {
      await convertImagesToPdf(files);
    }
  } catch (err) {
    converterStatus.textContent = 'Failed: ' + err.message;
  } finally {
    setBusy(convertBtn, false, 'Convert');
  }
});

async function convertPdfToJpg(file) {
  const pdfDoc = await loadPdfJsDocument(file);
  const zip = new JSZip();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
    converterStatus.textContent = `Converting page ${pageNumber} of ${pdfDoc.numPages}...`;
    const { jpegBytes } = await renderPdfPageToJpeg(pdfDoc, pageNumber, 2, 0.9, canvas, ctx);
    zip.file(`${baseName(file.name)}_page_${pageNumber}.jpg`, jpegBytes);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${baseName(file.name)}_jpg_pages.zip`);
  converterStatus.textContent = `Converted ${pdfDoc.numPages} page${pdfDoc.numPages === 1 ? '' : 's'}.`;
}

async function convertImagesToPdf(files) {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    converterStatus.textContent = `Adding image ${i + 1} of ${files.length}...`;
    await addImageFileToPdf(pdfDoc, files[i]);
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'converted_images.pdf');
  converterStatus.textContent = `Created PDF from ${files.length} image${files.length === 1 ? '' : 's'}.`;
}

editorMode.addEventListener('change', () => {
  const mode = editorMode.value;
  editorFiles.value = '';
  editorFiles.multiple = mode === 'merge';
  pageRangeWrap.classList.toggle('hidden', mode !== 'extract');
  rotationWrap.classList.toggle('hidden', mode !== 'rotate');
  editorStatus.textContent = '';
});

editBtn.addEventListener('click', async () => {
  const files = Array.from(editorFiles.files);
  if (!files.length) {
    editorStatus.textContent = 'Choose a PDF first.';
    return;
  }

  setBusy(editBtn, true, 'Working...');
  editorStatus.textContent = '';

  try {
    if (editorMode.value === 'extract') {
      await extractPdfPages(files[0]);
    } else if (editorMode.value === 'merge') {
      await mergePdfs(files);
    } else {
      await rotatePdf(files[0]);
    }
  } catch (err) {
    editorStatus.textContent = 'Failed: ' + err.message;
  } finally {
    setBusy(editBtn, false, 'Apply');
  }
});

async function extractPdfPages(file) {
  const { PDFDocument } = PDFLib;
  const sourceDoc = await PDFDocument.load(await file.arrayBuffer());
  const indexes = parsePageRanges(pageRangeInput.value, sourceDoc.getPageCount());
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(sourceDoc, indexes);
  copiedPages.forEach((page) => newDoc.addPage(page));

  const bytes = await newDoc.save({ useObjectStreams: true });
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}_pages.pdf`);
  editorStatus.textContent = `Extracted ${indexes.length} page${indexes.length === 1 ? '' : 's'}.`;
}

async function mergePdfs(files) {
  const { PDFDocument } = PDFLib;
  const mergedDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    editorStatus.textContent = `Merging PDF ${i + 1} of ${files.length}...`;
    const sourceDoc = await PDFDocument.load(await files[i].arrayBuffer());
    const pages = await mergedDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
    pages.forEach((page) => mergedDoc.addPage(page));
  }

  const bytes = await mergedDoc.save({ useObjectStreams: true });
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
  editorStatus.textContent = `Merged ${files.length} PDF${files.length === 1 ? '' : 's'}.`;
}

async function rotatePdf(file) {
  const { PDFDocument, degrees } = PDFLib;
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
  const rotation = parseInt(rotationDegrees.value, 10);

  pdfDoc.getPages().forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + rotation) % 360));
  });

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName(file.name)}_rotated.pdf`);
  editorStatus.textContent = `Rotated ${pdfDoc.getPageCount()} page${pdfDoc.getPageCount() === 1 ? '' : 's'}.`;
}

imageQuality.addEventListener('input', () => {
  imageQualityLabel.textContent = imageQuality.value + '%';
});

imageCompressBtn.addEventListener('click', async () => {
  const files = Array.from(imageFiles.files);
  if (!files.length) {
    imageStatus.textContent = 'Choose images first.';
    return;
  }

  setBusy(imageCompressBtn, true, 'Compressing...');
  imageStatus.textContent = '';

  try {
    const quality = parseInt(imageQuality.value, 10) / 100;
    const maxWidth = parseInt(imageMaxWidth.value, 10);
    const outputs = [];
    let originalTotal = 0;
    let compressedTotal = 0;

    for (let i = 0; i < files.length; i++) {
      imageStatus.textContent = `Compressing image ${i + 1} of ${files.length}...`;
      originalTotal += files[i].size;
      const blob = await compressImageFile(files[i], quality, maxWidth);
      compressedTotal += blob.size;
      outputs.push({ name: `${baseName(files[i].name)}_compressed.jpg`, blob });
    }

    if (outputs.length === 1) {
      downloadBlob(outputs[0].blob, outputs[0].name);
    } else {
      const zip = new JSZip();
      outputs.forEach((output) => zip.file(output.name, output.blob));
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'compressed_images.zip');
    }

    const saved = Math.max(0, Math.round((1 - compressedTotal / originalTotal) * 100));
    imageStatus.textContent = `${formatSize(originalTotal)} -> ${formatSize(compressedTotal)} (${saved}% smaller).`;
  } catch (err) {
    imageStatus.textContent = 'Failed: ' + err.message;
  } finally {
    setBusy(imageCompressBtn, false, 'Compress Images');
  }
});

async function loadPdfJsDocument(file) {
  const uint8 = new Uint8Array(await file.arrayBuffer());
  return pdfjsLib.getDocument({ data: uint8 }).promise;
}

async function renderPdfPageToJpeg(pdfDoc, pageNumber, scale, quality, canvas, ctx) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
  const jpegBase64 = jpegDataUrl.split(',')[1];
  const jpegBytes = Uint8Array.from(atob(jpegBase64), (char) => char.charCodeAt(0));

  return { jpegBytes, width: viewport.width, height: viewport.height };
}

async function addImageFileToPdf(pdfDoc, file) {
  let imageBytes = await file.arrayBuffer();
  let image;

  if (file.type === 'image/png') {
    image = await pdfDoc.embedPng(imageBytes);
  } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    image = await pdfDoc.embedJpg(imageBytes);
  } else {
    imageBytes = await imageFileToJpegBytes(file, 0.92);
    image = await pdfDoc.embedJpg(imageBytes);
  }

  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
}

function parsePageRanges(value, pageCount) {
  const pages = new Set();
  const chunks = value.split(',').map((chunk) => chunk.trim()).filter(Boolean);

  chunks.forEach((chunk) => {
    const match = chunk.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('Use page numbers like 1,3-5.');

    const start = parseInt(match[1], 10);
    const end = parseInt(match[2] || match[1], 10);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Pages must be between 1 and ${pageCount}.`);
    }

    for (let page = start; page <= end; page++) {
      pages.add(page - 1);
    }
  });

  if (!pages.size) throw new Error('Enter at least one page.');
  return Array.from(pages).sort((a, b) => a - b);
}

async function compressImageFile(file, quality, maxWidth) {
  const image = await loadImage(file);
  const safeMaxWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : image.naturalWidth;
  const ratio = Math.min(1, safeMaxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not compress image.'));
    }, 'image/jpeg', quality);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image.'));
    };
    img.src = url;
  });
}

async function imageFileToJpegBytes(file, quality) {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1];
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function showCompressionError(err) {
  console.error(err);
  progressBar.style.background = '#ef4444';
  progressText.textContent = 'Failed: ' + err.message;
  compressBtn.disabled = false;
  compressBtn.innerHTML = '<i class="bi bi-file-earmark-zip" style="font-size:18px"></i> Compress PDF';
}

function setProgress(pct, message) {
  progressBar.style.width = pct + '%';
  progressText.textContent = message;
}

function setBusy(button, busy, text) {
  button.disabled = busy;
  const icon = button.querySelector('i');
  button.innerHTML = icon
    ? `${icon.outerHTML} ${text}`
    : text;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseName(filename) {
  return filename.replace(/\.[^.]+$/, '');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}
