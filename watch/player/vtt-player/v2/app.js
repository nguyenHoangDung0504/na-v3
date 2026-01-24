import { convertToWebVTT, isBracketTimestampVTT } from '../formatter.js'
import { sampleAudioURL, sampleImgURL } from '../samples.js'
import { device, fullscreen } from '../../../../@src/app.utils.mjs'

// ============================================================================
// DOM Cache - Type-safe with autocomplete
// ============================================================================
/**
 * @type {Record<string, HTMLElement | null>}
 */
const DOM = {
	audio: null,
	audioPlayer: null,
	subtitleOverlay: null,
	subtitleListOverlay: null,
	subtitleList: null,
	toggleBtn: null,
	imageContainer: null,
	imagePlaceholder: null,
	imageCounter: null,
	currentImageIndex: null,
	totalImages: null,
	prevImageBtn: null,
	nextImageBtn: null,
	audioControls: null,
	collapseBtn: null,
	toCurrentBtn: null,
	toggleVttView: null,
}

function initDOM() {
	for (const key in DOM) DOM[key] = document.getElementById(key)
	DOM.audio.shadowRoot.querySelector('#open')?.remove()
	DOM.audioPlayer = DOM.audio.audio
}

// ============================================================================
// State
// ============================================================================
const state = {
	subtitles: [],
	currentSubtitle: null,
	viewMode: 'overlay',
	showSubtitles: true,
	images: [],
	currentImageIndex: 0,
	controlsCollapsed: false,
	autoScrollEnabled: true,
	currentActiveItem: null,
	scrollDebounceTimer: null,
}

// ============================================================================
// Utils
// ============================================================================
function timeToSeconds(timeString) {
	const parts = timeString.split(':')
	const seconds = parseFloat(parts[parts.length - 1].replace(',', '.'))
	const minutes = parseInt(parts[parts.length - 2]) || 0
	const hours = parseInt(parts[parts.length - 3]) || 0
	return hours * 3600 + minutes * 60 + seconds
}

function formatTime(time) {
	const mins = Math.floor(time / 60)
	const secs = Math.floor(time % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getRawQueryParam(name) {
	const query = window.location.search.slice(1)
	if (!query) return null

	for (const part of query.split('&')) {
		const idx = part.indexOf('=')
		if (idx === -1) continue
		if (part.slice(0, idx) === name) return part.slice(idx + 1)
	}
	return null
}

function getUrlParams() {
	const params = new URLSearchParams(window.location.search)
	return {
		audio: getRawQueryParam('audio'),
		vtt: params.get('vtt') ?? './test.vtt',
		images: params.get('images') ? params.get('images').split(',') : [sampleImgURL],
	}
}

// ============================================================================
// VTT
// ============================================================================
function parseVTT(vttText) {
	if (isBracketTimestampVTT(vttText)) vttText = convertToWebVTT(vttText)

	const lines = vttText.split('\n')
	const subs = []
	let i = 0

	while (i < lines.length) {
		if (lines[i].includes('-->')) {
			const [start, end] = lines[i].split('-->').map((t) => t.trim())
			const text = []
			i++
			while (i < lines.length && lines[i].trim() !== '') {
				text.push(lines[i])
				i++
			}
			subs.push({
				start: timeToSeconds(start),
				end: timeToSeconds(end),
				text: text.join('\n'),
			})
		}
		i++
	}
	return subs
}

async function loadVTT(url) {
	try {
		const response = await fetch(url)
		const text = await response.text()
		state.subtitles = parseVTT(text)
		renderSubtitleList()
	} catch (error) {
		console.error('Error loading VTT:', error)
	}
}

function renderSubtitleList() {
	DOM.subtitleList.innerHTML = state.subtitles
		.map(
			(sub, index) => `
			<div class="subtitle-item" data-index="${index}" onclick="jumpToTime(${sub.start})">
				<div class="subtitle-time">${formatTime(sub.start)} → ${formatTime(sub.end)}</div>
				<div class="subtitle-text">${sub.text}</div>
			</div>
		`,
		)
		.join('')
}

function updateSubtitle(currentTime) {
	const newSubtitle = state.subtitles.find((sub) => currentTime >= sub.start && currentTime < sub.end)
	if (newSubtitle === state.currentSubtitle) return

	state.currentSubtitle = newSubtitle
	DOM.subtitleOverlay.textContent = newSubtitle ? newSubtitle.text : ''

	document.querySelectorAll('.subtitle-item').forEach((item, index) => {
		if (state.subtitles[index] === newSubtitle) {
			item.classList.add('active')
			if (state.autoScrollEnabled) {
				item.scrollIntoView({ behavior: 'smooth', block: 'center' })
			}
			state.currentActiveItem = item
		} else {
			item.classList.remove('active')
		}
	})
}

// ============================================================================
// Images
// ============================================================================
function loadImages() {
	if (!state.images.length) return

	DOM.imagePlaceholder.style.display = 'none'

	state.images.forEach((src, index) => {
		const img = document.createElement('img')
		img.draggable = false
		img.src = src
		img.className = 'image-display'
		if (index === 0) img.classList.add('active')
		DOM.imageContainer.appendChild(img)
	})

	if (state.images.length > 1) {
		DOM.prevImageBtn.style.display = 'block'
		DOM.nextImageBtn.style.display = 'block'
		DOM.imageCounter.style.display = 'block'
		DOM.totalImages.textContent = state.images.length
		updateImageCounter()
	}
}

function updateImageCounter() {
	DOM.currentImageIndex.textContent = state.currentImageIndex + 1
}

function navigateImage(direction) {
	const imageElements = document.querySelectorAll('.image-display')
	if (!imageElements.length) return

	imageElements[state.currentImageIndex].classList.remove('active')

	if (direction === 'prev') {
		state.currentImageIndex = (state.currentImageIndex - 1 + state.images.length) % state.images.length
	} else {
		state.currentImageIndex = (state.currentImageIndex + 1) % state.images.length
	}

	imageElements[state.currentImageIndex].classList.add('active')
	updateImageCounter()
}

// ============================================================================
// View
// ============================================================================
function setViewMode(mode) {
	state.viewMode = mode

	if (mode === 'overlay') {
		DOM.subtitleListOverlay.classList.add('hidden')
		DOM.subtitleOverlay.classList.remove('hidden')
		DOM.toggleBtn.style.display = 'block'
		DOM.toggleVttView.textContent = '☰✓'
		DOM.toCurrentBtn.style.display = 'none'
	} else if (mode === 'list') {
		DOM.subtitleListOverlay.classList.remove('hidden')
		DOM.subtitleOverlay.classList.add('hidden')
		DOM.toggleBtn.style.display = 'none'
		DOM.toggleVttView.textContent = '☰✕'
		DOM.toCurrentBtn.style.display = null
	}
}

function toggleViewMode() {
	const isListHidden = DOM.subtitleListOverlay.classList.contains('hidden')
	setViewMode(isListHidden ? 'list' : 'overlay')
}

function toggleSubtitles() {
	state.showSubtitles = !state.showSubtitles

	if (state.viewMode === 'overlay') {
		if (state.showSubtitles) {
			DOM.subtitleOverlay.classList.remove('hidden')
			DOM.toggleBtn.textContent = '👁✕'
		} else {
			DOM.subtitleOverlay.classList.add('hidden')
			DOM.toggleBtn.textContent = '👁✓'
		}
	}
}

function toggleControlsCollapse() {
	state.controlsCollapsed = !state.controlsCollapsed
	DOM.audioControls.classList.toggle('collapsed')
	DOM.subtitleOverlay.classList.toggle('collapsed')
	DOM.collapseBtn.textContent = state.controlsCollapsed ? '▲' : '▼'
}

// ============================================================================
// Audio
// ============================================================================
function jumpToTime(time) {
	DOM.audioPlayer.currentTime = time
	if (DOM.audioPlayer.paused) DOM.audioPlayer.play()
}

function seekAudio(delta) {
	DOM.audioPlayer.currentTime = Math.max(0, Math.min(DOM.audioPlayer.duration, DOM.audioPlayer.currentTime + delta))
}

function toCurrent() {
	state.currentActiveItem?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ============================================================================
// Events
// ============================================================================
function setupEventListeners() {
	// Audio events
	DOM.audioPlayer.addEventListener('timeupdate', () => {
		updateSubtitle(DOM.audioPlayer.currentTime)
	})

	// Subtitle list scroll
	DOM.subtitleListOverlay.addEventListener('scroll', () => {
		state.autoScrollEnabled = false
		clearTimeout(state.scrollDebounceTimer)
		state.scrollDebounceTimer = setTimeout(() => {
			state.autoScrollEnabled = true
		}, 2000)
	})

	// Click outside to close list
	DOM.subtitleListOverlay.addEventListener('click', (ev) => {
		if (!ev.target.closest('.subtitle-item, .subtitle-list')) {
			setViewMode('overlay')
		}
	})

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		if (e.key === ' ' && e.target.tagName !== 'INPUT') {
			e.preventDefault()
			DOM.audioPlayer.paused ? DOM.audioPlayer.play() : DOM.audioPlayer.pause()
		} else if (e.key === 'ArrowLeft') {
			seekAudio(-5)
		} else if (e.key === 'ArrowRight') {
			seekAudio(5)
		} else if (e.key === 'ArrowUp' && state.images.length > 1) {
			e.preventDefault()
			navigateImage('prev')
		} else if (e.key === 'ArrowDown' && state.images.length > 1) {
			e.preventDefault()
			navigateImage('next')
		}
	})
}

// ============================================================================
// Draggable
// ============================================================================
function makeDraggableY(el) {
	let startY = 0,
		baseY = 0,
		dragging = false

	el.style.touchAction = 'none'

	const down = (e) => {
		dragging = true
		startY = e.clientY
		baseY = parseFloat(getComputedStyle(el).getPropertyValue('--drag-y')) || 0
		el.setPointerCapture(e.pointerId)
		el.style.transition = 'opacity 0.3s, transform 0s'
	}

	const move = (e) => {
		if (!dragging) return
		el.style.setProperty('--drag-y', `${baseY + (e.clientY - startY)}px`)
	}

	const up = () => {
		dragging = false
		el.style.transition = null
	}

	el.addEventListener('pointerdown', down, { passive: false })
	el.addEventListener('pointermove', move, { passive: false })
	el.addEventListener('pointerup', up)
	el.addEventListener('pointercancel', up)
}

// ============================================================================
// Init
// ============================================================================
async function init() {
	initDOM()

	const params = getUrlParams()

	DOM.audioPlayer.src = params.audio || sampleAudioURL
	await loadVTT(params.vtt)

	if (params.images?.length) {
		state.images = params.images
		loadImages()
	}

	setupEventListeners()
	makeDraggableY(DOM.subtitleOverlay)
}

// ============================================================================
// Global Exports
// ============================================================================
window.addEventListener('load', init)

window.toggleFullscreen = () => {
	if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
		fullscreen.deactivate()
		screen.orientation.unlock()
	} else {
		fullscreen.activate()
		if (device.isMobile()) screen.orientation.lock('landscape')
	}
}

window.previousImage = () => navigateImage('prev')
window.nextImage = () => navigateImage('next')
window.toggleViewMode = toggleViewMode
window.toggleSubtitles = toggleSubtitles
window.toggleControlsCollapse = toggleControlsCollapse
window.jumpToTime = jumpToTime
window.toCurrent = toCurrent
