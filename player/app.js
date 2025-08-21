let mediaFiles = [];
let mediaCounter = 0;
let fabOpen = false;
let isDragging = false;
let dragStartX, dragStartY, initialX, initialY;

const fileInput = document.getElementById('fileInput');
const mediaList = document.getElementById('mediaList');
const floatingTools = document.getElementById('floatingTools');
const fabMain = document.getElementById('fabMain');
const fabMenu = document.getElementById('fabMenu');

// Drag & Drop
document.addEventListener('dragover', (e) => {
	e.preventDefault();
});

document.addEventListener('drop', (e) => {
	e.preventDefault();
	const files = Array.from(e.dataTransfer.files);
	handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
	const files = Array.from(e.target.files);
	handleFiles(files);
});

function handleFiles(files) {
	files.forEach((file) => {
		if (isValidFile(file)) {
			addMediaFile(file);
		}
	});
	updateMediaList();
}

function isValidFile(file) {
	return file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
}

function addMediaFile(file) {
	const mediaFile = {
		id: ++mediaCounter,
		file: file,
		name: file.name,
		size: formatFileSize(file.size),
		type: getFileType(file.type),
		url: URL.createObjectURL(file),
	};
	mediaFiles.push(mediaFile);
}

function getFileType(mimeType) {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType.startsWith('audio/')) return 'audio';
	return 'unknown';
}

function formatFileSize(bytes) {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function updateMediaList() {
	if (mediaFiles.length === 0) {
		mediaList.innerHTML = `
                    <div class="empty-state">
                        <div>Chưa có file nào</div>
                        <small>Tải lên để bắt đầu</small>
                    </div>
                `;
		return;
	}

	mediaList.innerHTML = mediaFiles
		.map((media) => {
			let mediaElement = '';
			let itemClass = '';
			let overlayHtml = '';

			if (media.type === 'image') {
				mediaElement = `<img src="${media.url}" alt="${media.name}" loading="lazy" onclick="showImageOverlay(${media.id})">`;
				itemClass = 'image-type';
				overlayHtml = `
                        <div class="image-overlay" id="overlay-${media.id}">
                            <span class="file-name">${media.name} (${media.size})</span>
                            <button class="remove-btn" onclick="removeMedia(${media.id})">×</button>
                        </div>
                    `;
			} else if (media.type === 'video') {
				mediaElement = `<video src="${media.url}" controls preload="metadata"></video>`;
			} else if (media.type === 'audio') {
				mediaElement = `<audio src="${media.url}" controls preload="metadata"></audio>`;
			}

			return `
                    <div class="media-item ${itemClass}" data-id="${media.id}">
                        ${mediaElement}
                        ${overlayHtml}
                        ${
													media.type !== 'image'
														? `
                        <div class="media-info">
                            <span class="file-name">${media.name}</span>
                            <span>${media.size}</span>
                            <button class="remove-btn" onclick="removeMedia(${media.id})">×</button>
                        </div>
                        `
														: ''
												}
                    </div>
                `;
		})
		.join('');
}

function showImageOverlay(id) {
	const overlay = document.getElementById(`overlay-${id}`);
	if (overlay) {
		overlay.classList.add('show');
		setTimeout(() => {
			overlay.classList.add('fade-out');
			setTimeout(() => {
				overlay.classList.remove('show', 'fade-out');
			}, 500);
		}, 2000);
	}
}

function removeMedia(id) {
	const index = mediaFiles.findIndex((m) => m.id === id);
	if (index !== -1) {
		URL.revokeObjectURL(mediaFiles[index].url);
		mediaFiles.splice(index, 1);
		updateMediaList();
	}
}

function pauseAllMedia() {
	const videos = document.querySelectorAll('video');
	const audios = document.querySelectorAll('audio');

	videos.forEach((video) => video.pause());
	audios.forEach((audio) => audio.pause());
	closeFAB();
}

function playAllVideos() {
	const videos = document.querySelectorAll('video');
	videos.forEach((video) => {
		video.play().catch(() => {});
	});
	closeFAB();
}

function playAllAudio() {
	const audios = document.querySelectorAll('audio');
	audios.forEach((audio) => {
		audio.play().catch(() => {});
	});
	closeFAB();
}

function clearAll() {
	if (confirm('Xóa tất cả file?')) {
		mediaFiles.forEach((media) => {
			URL.revokeObjectURL(media.url);
		});
		mediaFiles = [];
		updateMediaList();
	}
	closeFAB();
}

// FAB Controls - Fixed mobile touch handling
let touchStartTime = 0;
let hasMoved = false;

// Mouse events for desktop
fabMain.addEventListener('click', (e) => {
	e.stopPropagation();
	if (!isDragging && !hasMoved) {
		toggleFAB();
	}
});

// Touch events for mobile
fabMain.addEventListener(
	'touchstart',
	(e) => {
		touchStartTime = Date.now();
		hasMoved = false;
		startDrag(e);
	},
	{ passive: false }
);

fabMain.addEventListener(
	'touchend',
	(e) => {
		e.preventDefault();
		e.stopPropagation();

		const touchDuration = Date.now() - touchStartTime;

		// If it was a quick tap and didn't move much, toggle FAB
		if (touchDuration < 300 && !hasMoved) {
			toggleFAB();
		}

		stopDrag();
	},
	{ passive: false }
);

function toggleFAB() {
	fabOpen = !fabOpen;
	fabMenu.classList.toggle('show', fabOpen);
	fabMain.innerHTML = fabOpen ? '×' : '⚙️';
}

function closeFAB() {
	fabOpen = false;
	fabMenu.classList.remove('show');
	fabMain.innerHTML = '⚙️';
}

// Close FAB when clicking/touching outside
document.addEventListener('click', (e) => {
	if (!floatingTools.contains(e.target)) {
		closeFAB();
	}
});

document.addEventListener(
	'touchstart',
	(e) => {
		if (!floatingTools.contains(e.target)) {
			closeFAB();
		}
	},
	{ passive: true }
);

// Draggable FAB - Improved touch handling
fabMain.addEventListener('mousedown', startDrag);

function startDrag(e) {
	const isTouch = e.type === 'touchstart';

	if (!isTouch) {
		e.preventDefault();
	}

	isDragging = false;
	hasMoved = false;

	const clientX = isTouch ? e.touches[0].clientX : e.clientX;
	const clientY = isTouch ? e.touches[0].clientY : e.touches[0].clientY;

	dragStartX = clientX;
	dragStartY = clientY;

	const rect = floatingTools.getBoundingClientRect();
	initialX = rect.left;
	initialY = rect.top;

	if (isTouch) {
		document.addEventListener('touchmove', drag, { passive: false });
		document.addEventListener('touchend', stopDrag, { passive: false });
	} else {
		document.addEventListener('mousemove', drag);
		document.addEventListener('mouseup', stopDrag);
	}
}

function drag(e) {
	const isTouch = e.type === 'touchmove';

	if (isTouch) {
		e.preventDefault();
	}

	const clientX = isTouch ? e.touches[0].clientX : e.clientX;
	const clientY = isTouch ? e.touches[0].clientY : e.touches[0].clientY;

	const deltaX = clientX - dragStartX;
	const deltaY = clientY - dragStartY;
	const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

	if (distance > 10) {
		hasMoved = true;
		isDragging = true;
		floatingTools.classList.add('dragging');
		closeFAB();
	}

	if (isDragging) {
		const newX = initialX + deltaX;
		const newY = initialY + deltaY;

		// Keep within viewport
		const maxX = window.innerWidth - floatingTools.offsetWidth;
		const maxY = window.innerHeight - floatingTools.offsetHeight;

		const clampedX = Math.max(0, Math.min(newX, maxX));
		const clampedY = Math.max(0, Math.min(newY, maxY));

		floatingTools.style.left = clampedX + 'px';
		floatingTools.style.top = clampedY + 'px';
		floatingTools.style.right = 'auto';
		floatingTools.style.bottom = 'auto';
	}
}

function stopDrag(e) {
	const isTouch = e && (e.type === 'touchend' || e.type === 'touchcancel');

	if (isTouch) {
		document.removeEventListener('touchmove', drag);
		document.removeEventListener('touchend', stopDrag);
	} else {
		document.removeEventListener('mousemove', drag);
		document.removeEventListener('mouseup', stopDrag);
	}

	floatingTools.classList.remove('dragging');

	setTimeout(() => {
		isDragging = false;
	}, 100);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
	mediaFiles.forEach((media) => {
		URL.revokeObjectURL(media.url);
	});
});
