// import { SwipeHandler } from '../../../@src/app.materials.mjs';
import { convertToWebVTT, isBracketTimestampVTT } from './formatter.js';
import { sampleAudioURL, sampleImgURL } from './samples.js';
import { device, fullscreen } from '../../../@src/app.utils.mjs';

window.addEventListener('load', () => {
	/**
	 * @type {import('../../../@components/audio_wrapper/component.js').default}
	 */
	const audioWrp = document.getElementById('audio');
	audioWrp.shadowRoot.querySelector('#open')?.remove();
	const audio = audioWrp.audio;
	const playBtn = document.getElementById('playBtn');
	const volumeBtn = document.getElementById('volumeBtn');
	const subtitleOverlay = document.getElementById('subtitleOverlay');
	const subtitleListOverlay = document.getElementById('subtitleListOverlay');
	const subtitleList = document.getElementById('subtitleList');
	const toggleBtn = document.getElementById('toggleBtn');
	const imageContainer = document.getElementById('imageContainer');
	const imagePlaceholder = document.getElementById('imagePlaceholder');
	const imageCounter = document.getElementById('imageCounter');
	const currentImageIndexEl = document.getElementById('currentImageIndex');
	const totalImagesEl = document.getElementById('totalImages');
	const prevImageBtn = document.getElementById('prevImageBtn');
	const nextImageBtn = document.getElementById('nextImageBtn');
	const audioControls = document.getElementById('audioControls');
	const collapseBtn = document.getElementById('collapseBtn');
	const toCurrentBtn = document.getElementById('to-current');

	// State
	let subtitles = [];
	let currentSubtitle = null;
	let viewMode = 'overlay';
	let showSubtitles = true;
	let images = [];
	let currentImageIndex = 0;
	let controlsCollapsed = false;

	// Parse URL parameters
	function getUrlParams() {
		const params = new URLSearchParams(window.location.search);
		return {
			audio: params.get('audio'),
			vtt: params.get('vtt') ?? './test.vtt',
			images: params.get('images') ? params.get('images').split(',') : [sampleImgURL],
		};
	}

	// Parse VTT
	function parseVTT(vttText) {
		if (isBracketTimestampVTT(vttText)) vttText = convertToWebVTT(vttText);

		const lines = vttText.split('\n');
		const subs = [];
		let i = 0;

		while (i < lines.length) {
			if (lines[i].includes('-->')) {
				const [start, end] = lines[i].split('-->').map((t) => t.trim());
				const text = [];
				i++;
				while (i < lines.length && lines[i].trim() !== '') {
					text.push(lines[i]);
					i++;
				}
				subs.push({
					start: timeToSeconds(start),
					end: timeToSeconds(end),
					text: text.join('\n'),
				});
			}
			i++;
		}
		return subs;
	}

	function timeToSeconds(timeString) {
		const parts = timeString.split(':');
		const seconds = parseFloat(parts[parts.length - 1].replace(',', '.'));
		const minutes = parseInt(parts[parts.length - 2]) || 0;
		const hours = parseInt(parts[parts.length - 3]) || 0;
		return hours * 3600 + minutes * 60 + seconds;
	}

	function formatTime(time) {
		const mins = Math.floor(time / 60);
		const secs = Math.floor(time % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Load VTT from URL
	async function loadVTT(url) {
		try {
			const response = await fetch(url);
			const text = await response.text();
			subtitles = parseVTT(text);
			renderSubtitleList();
		} catch (error) {
			console.error('Error loading VTT:', error);
		}
	}

	// Initialize
	async function init() {
		const params = getUrlParams();

		// Load audio
		audio.src = params.audio || sampleAudioURL;

		// Load VTT
		await loadVTT(params.vtt);

		// Load images
		if (params.images && params.images.length > 0) {
			images = params.images;
			loadImages();
			// new SwipeHandler(imageContainer, previousImage, nextImage).registerEvents();
		}
	}

	function loadImages() {
		// Remove placeholder
		imagePlaceholder.style.display = 'none';

		// Create image elements
		images.forEach((src, index) => {
			const img = document.createElement('img');
			img.draggable = false;
			img.src = src;
			img.className = 'image-display';
			if (index === 0) img.classList.add('active');
			imageContainer.appendChild(img);
		});

		// Show navigation
		if (images.length > 1) {
			prevImageBtn.style.display = 'block';
			nextImageBtn.style.display = 'block';
			imageCounter.style.display = 'block';
			totalImagesEl.textContent = images.length;
			updateImageCounter();
		}
	}

	function updateImageCounter() {
		currentImageIndexEl.textContent = currentImageIndex + 1;
	}

	window.previousImage = previousImage;
	function previousImage() {
		const imageElements = document.querySelectorAll('.image-display');
		if (imageElements.length === 0) return;

		imageElements[currentImageIndex].classList.remove('active');
		currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
		imageElements[currentImageIndex].classList.add('active');
		updateImageCounter();
	}

	window.nextImage = nextImage;
	function nextImage() {
		const imageElements = document.querySelectorAll('.image-display');
		if (imageElements.length === 0) return;

		imageElements[currentImageIndex].classList.remove('active');
		currentImageIndex = (currentImageIndex + 1) % images.length;
		imageElements[currentImageIndex].classList.add('active');
		updateImageCounter();
	}

	function renderSubtitleList() {
		subtitleList.innerHTML = subtitles
			.map(
				(sub, index) => `
                <div class="subtitle-item" data-index="${index}" onclick="jumpToTime(${sub.start})">
                    <div class="subtitle-time">${formatTime(sub.start)} → ${formatTime(sub.end)}</div>
                    <div class="subtitle-text">${sub.text}</div>
                </div>
            `
			)
			.join('');
	}

	// Playback controls
	function togglePlay() {
		if (audio.paused) {
			audio.play();
			playBtn.textContent = '⏸';
		} else {
			audio.pause();
			playBtn.textContent = '▶';
		}
	}

	window.jumpToTime = jumpToTime;
	function jumpToTime(time) {
		audio.currentTime = time;
		if (audio.paused) audio.play();
	}

	window.toggleMute = toggleMute;
	function toggleMute() {
		audio.muted = !audio.muted;
		volumeBtn.textContent = audio.muted ? '🔇' : '🔊';
	}

	window.toggleControlsCollapse = toggleControlsCollapse;
	function toggleControlsCollapse() {
		controlsCollapsed = !controlsCollapsed;
		audioControls.classList.toggle('collapsed');
		subtitleOverlay.classList.toggle('collapsed');
		collapseBtn.textContent = controlsCollapsed ? '▲' : '▼';
	}

	const tgBtn = document.getElementById('toggle-vtt-view');

	window.toggleViewMode = toggleViewMode;
	function toggleViewMode() {
		if (subtitleListOverlay.classList.contains('hidden')) {
			setViewMode('list');
			tgBtn.textContent = 'Ẩn list phụ đề';
			toCurrentBtn.style.display = null;
		} else {
			setViewMode('overlay');
			tgBtn.textContent = 'List phụ đề';
			toCurrentBtn.style.display = 'none';
		}
	}

	window.setViewMode = setViewMode;
	function setViewMode(mode) {
		viewMode = mode;
		document.querySelectorAll('.view-btn').forEach((btn) => btn.classList.remove('active'));
		event.target.classList.add('active');

		if (mode === 'overlay') {
			subtitleListOverlay.classList.add('hidden');
			subtitleOverlay.classList.remove('hidden');
			toggleBtn.style.display = 'block';
		} else if (mode === 'list') {
			subtitleListOverlay.classList.remove('hidden');
			subtitleOverlay.classList.add('hidden');
			toggleBtn.style.display = 'none';
		}
	}

	window.toggleSubtitles = toggleSubtitles;
	function toggleSubtitles() {
		showSubtitles = !showSubtitles;
		if (viewMode === 'overlay') {
			if (showSubtitles) {
				subtitleOverlay.classList.remove('hidden');
				toggleBtn.textContent = 'Ẩn phụ đề';
			} else {
				subtitleOverlay.classList.add('hidden');
				toggleBtn.textContent = 'Hiện phụ đề';
			}
		}
	}

	// Audio events
	let currentActiveItem = null;
	window.toCurrent = () => currentActiveItem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	audio.addEventListener('timeupdate', () => {
		const currentTime = audio.currentTime;
		const duration = audio.duration;

		// currentTimeEl.textContent = formatTime(currentTime);
		// progressFill.style.width = `${(currentTime / duration) * 100}%`;

		// Update current subtitle
		const newSubtitle = subtitles.find((sub) => currentTime >= sub.start && currentTime < sub.end);

		if (newSubtitle !== currentSubtitle) {
			currentSubtitle = newSubtitle;

			// Update overlay
			if (currentSubtitle) {
				subtitleOverlay.textContent = currentSubtitle.text;
			} else {
				subtitleOverlay.textContent = '';
			}

			// Update list items
			document.querySelectorAll('.subtitle-item').forEach((item, index) => {
				if (subtitles[index] === currentSubtitle) {
					item.classList.add('active');
					// Auto-scroll
					// item.scrollIntoView({ behavior: 'smooth', block: 'center' });
					currentActiveItem = item;
				} else {
					item.classList.remove('active');
				}
			});
		}
	});

	audio.addEventListener('loadedmetadata', () => {
		// durationEl.textContent = formatTime(audio.duration);
	});

	audio.addEventListener('ended', () => {
		playBtn.textContent = '▶';
	});

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		if (e.key === ' ' && e.target.tagName !== 'INPUT') {
			e.preventDefault();
			togglePlay();
		} else if (e.key === 'ArrowLeft') {
			audio.currentTime = Math.max(0, audio.currentTime - 5);
		} else if (e.key === 'ArrowRight') {
			audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
		} else if (e.key === 'ArrowUp' && images.length > 1) {
			e.preventDefault();
			previousImage();
		} else if (e.key === 'ArrowDown' && images.length > 1) {
			e.preventDefault();
			nextImage();
		}
	});

	// Initialize on load
	init();
	makeDraggable(document.querySelector('.subtitle-overlay'));

	window.toggleFullscreen = () => {
		if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
			fullscreen.deactivate();
			screen.orientation.unlock();
		} else {
			fullscreen.activate();
			if (device.isMobile()) screen.orientation.lock('landscape');
		}
	};
});

/**
 * Làm cho element có thể kéo để di chuyển (mobile + desktop)
 * @param {HTMLElement} el
 * @param {{
 *   onStart?: (pos: {x:number,y:number}) => void,
 *   onMove?: (pos: {x:number,y:number}) => void,
 *   onEnd?: (pos: {x:number,y:number}) => void,
 * }} [opts]
 * @returns {() => void} cleanup
 */
function makeDraggable(el) {
	let startY = 0;
	let baseY = 0;
	let dragging = false;

	el.style.touchAction = 'none';

	function down(e) {
		dragging = true;
		startY = e.clientY;
		baseY = parseFloat(getComputedStyle(el).getPropertyValue('--drag-y')) || 0;
		el.setPointerCapture(e.pointerId);
	}

	function move(e) {
		if (!dragging) return;
		const y = baseY + (e.clientY - startY);
		el.style.setProperty('--drag-y', `${y}px`);
	}

	function up() {
		dragging = false;
	}

	el.addEventListener('pointerdown', down);
	el.addEventListener('pointermove', move);
	el.addEventListener('pointerup', up);
	el.addEventListener('pointercancel', up);

	return () => {
		el.removeEventListener('pointerdown', down);
		el.removeEventListener('pointermove', move);
		el.removeEventListener('pointerup', up);
		el.removeEventListener('pointercancel', up);
	};
}
