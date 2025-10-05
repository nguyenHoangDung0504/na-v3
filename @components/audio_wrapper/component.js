const COMPONENT_NAME = 'audio-wrapper';

export const linkCSS = document.createElement('link');
linkCSS.rel = 'stylesheet';
linkCSS.href = import.meta.resolve('./component.css');

/**
 * Custom HTML element that provides an enhanced audio player with seeking capabilities,
 * skip controls, and settings panel. Supports multiple audio sources and drag-to-seek functionality.
 *
 * @example
 * ```html
 * <audio-wrapper
 *   src='["https://example.com/audio.mp3", "https://example.com/audio.ogg"]'
 *   name="My Audio Track">
 * </audio-wrapper>
 * ```
 *
 * @extends HTMLElement
 */
export default class AudioWrapper extends HTMLElement {
	/**
	 * Creates a new AudioWrapper instance.
	 * Initializes shadow DOM, creates UI elements, and sets up behaviors.
	 */
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		this._createElements();
		this._initBehaviors();
		this._bindEvents();
		this._initFromAttributes();
	}

	/**
	 * Creates and structures all DOM elements for the component.
	 * Sets up the shadow DOM structure with audio controls, settings panel, and tools.
	 *
	 * @private
	 */
	_createElements() {
		const container = document.createElement('div');
		container.classList.add('container');

		// Nhãn tên
		this.nameLabel = document.createElement('div');
		this.nameLabel.classList.add('name-label');

		// Phần chứa audio và settings
		const audioControls = document.createElement('div');
		audioControls.classList.add('audio-controls');

		this.audio = document.createElement('audio');
		this.audio.controls = true;

		this.settingsBtn = document.createElement('button');
		this.settingsBtn.className = 'icon';
		this.settingsBtn.id = 'settings';
		this.settingsBtn.title = 'settings';

		this.panel = document.createElement('div');
		this.panel.classList.add('panel');

		const tools = document.createElement('div');
		tools.classList.add('tools');

		this.slider = document.createElement('div');
		this.slider.className = 'slider';

		this.backBtn = document.createElement('button');
		this.backBtn.className = 'icon';
		this.backBtn.id = 'back';
		this.backBtn.title = 'Back 5s';

		this.forwardBtn = document.createElement('button');
		this.forwardBtn.className = 'icon';
		this.forwardBtn.id = 'forward';
		this.forwardBtn.title = 'Forward 5s';

		this.reloadBtn = document.createElement('button');
		this.reloadBtn.className = 'icon';
		this.reloadBtn.id = 'reload';
		this.reloadBtn.title = 'Reload audio';

		this.openBtn = document.createElement('button');
		this.openBtn.className = 'icon';
		this.openBtn.id = 'open';
		this.openBtn.title = 'Open in new tab';

		tools.append(this.backBtn, this.forwardBtn, this.reloadBtn, this.openBtn, this.slider);
		this.panel.append(tools);
		audioControls.append(this.settingsBtn, this.audio);
		container.append(this.nameLabel, audioControls);
		this.shadowRoot.append(linkCSS.cloneNode(), container, this.panel);
	}

	/**
	 * Initializes behavior classes (SeekBehavior and AudioControls).
	 * Creates instances that handle specific functionality.
	 *
	 * @private
	 */
	_initBehaviors() {
		// Initialize behavior instances
		/** @type {SeekBehavior} */
		this.seekBehavior = new SeekBehavior(this.audio, this.slider);
		/** @type {AudioControls} */
		this.audioControls = new AudioControls(this.audio);
	}

	/**
	 * Binds event listeners to control buttons.
	 * Handles settings panel toggle and audio control actions.
	 *
	 * @private
	 */
	_bindEvents() {
		this.settingsBtn.addEventListener('click', () => {
			this.panel.classList.toggle('open');
		});

		this.backBtn.addEventListener('click', () => {
			this.audioControls.skipBackward();
		});

		this.forwardBtn.addEventListener('click', () => {
			this.audioControls.skipForward();
		});

		this.reloadBtn.addEventListener('click', () => {
			this.audioControls.reload();
		});

		this.openBtn.addEventListener('click', () => {
			this.audioControls.openInNewTab();
		});
	}

	/**
	 * Initializes component state from HTML attributes.
	 * Processes 'src' and 'name' attributes if present.
	 *
	 * @private
	 */
	_initFromAttributes() {
		if (this.hasAttribute('src')) {
			this._updateSourcesFromAttr(this.getAttribute('src'));
		} else {
			/** @private @type {string[]} */
			this._sources = [];
		}
		this._updateNameLabel();
	}

	/**
	 * Called when the component is removed from the DOM.
	 * Cleans up event listeners to prevent memory leaks.
	 */
	disconnectedCallback() {
		this.seekBehavior?.destroy();
	}

	/**
	 * List of attributes to observe for changes.
	 * @returns {string[]} Array of attribute names
	 */
	static get observedAttributes() {
		return ['src', 'name'];
	}

	/**
	 * Called when an observed attribute changes.
	 *
	 * @param {string} name - The attribute name
	 * @param {string | null} oldValue - Previous attribute value
	 * @param {string | null} newValue - New attribute value
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'src') this._updateSourcesFromAttr(newValue);
		if (name === 'name') this._updateNameLabel();
	}

	/**
	 * Gets the underlying HTML audio element.
	 * @returns {HTMLAudioElement} The audio element
	 */
	get audioElement() {
		return this.audio;
	}

	/**
	 * Gets the current list of audio sources.
	 * @returns {string[]} Array of audio source URLs
	 */
	get sources() {
		return this._sources;
	}

	/**
	 * Sets the audio sources and updates the DOM.
	 *
	 * @param {string[]} arr - Array of audio source URLs
	 * @throws {TypeError} If the input is not an array
	 */
	set sources(arr) {
		if (!Array.isArray(arr)) {
			throw new TypeError('sources must be an array of URLs');
		}
		this._sources = [...arr];
		this._renderSources();
		this.setAttribute('src', JSON.stringify(this._sources));
	}

	/**
	 * Updates internal sources from the 'src' attribute.
	 * Expects a JSON array of URLs.
	 *
	 * @param {string | null} value - JSON string containing array of URLs
	 * @private
	 */
	_updateSourcesFromAttr(value) {
		if (!value) {
			this._sources = [];
			this._renderSources();
			return;
		}
		try {
			const arr = JSON.parse(value);
			if (Array.isArray(arr)) {
				this._sources = arr;
				this._renderSources();
			} else {
				console.warn('src attribute must be a JSON array, Invalid JSON:', this.getAttribute('src'));
			}
		} catch (e) {
			console.warn('Invalid JSON in src attribute', e);
		}
	}

	/**
	 * Updates the name label display based on the 'name' attribute.
	 * Shows the label if name is provided, hides it otherwise.
	 *
	 * @private
	 */
	_updateNameLabel() {
		const name = this.getAttribute('name');
		if (name && name.trim()) {
			this.nameLabel.textContent = name.trim();
			this.nameLabel.style.display = 'block';
		} else {
			this.nameLabel.style.display = 'none';
		}
	}

	/**
	 * Renders audio source elements into the audio tag.
	 * Creates <source> elements for each URL and reloads the audio.
	 *
	 * @private
	 */
	_renderSources() {
		this.audio.innerHTML = '';
		for (const url of this._sources) {
			const s = document.createElement('source');
			s.src = url;
			this.audio.appendChild(s);
		}
		this.audio.load();
	}
}

!customElements.get(COMPONENT_NAME) && customElements.define(COMPONENT_NAME, AudioWrapper);

/**
 * Handles audio seeking behavior through mouse and touch interactions on a slider element.
 * Provides drag-to-seek functionality with play/pause state management.
 */
class SeekBehavior {
	/**
	 * Creates a new SeekBehavior instance.
	 *
	 * @param {HTMLAudioElement} audioElement - The audio element to control
	 * @param {HTMLElement} sliderElement - The slider element to listen for drag events
	 * @param {number} [pixelsPerSecond=15] - Conversion rate between pixels dragged and seconds to seek
	 */
	constructor(audioElement, sliderElement, pixelsPerSecond = 15) {
		/** @type {HTMLAudioElement} */
		this.audio = audioElement;
		/** @type {HTMLElement} */
		this.slider = sliderElement;
		/** @type {boolean} */
		this.isDragging = false;
		/** @type {boolean} */
		this.wasPlayingBeforeDrag = false;
		/** @type {number} */
		this.touchStartX = 0;
		/** @type {number} */
		this.pixelsPerSecond = pixelsPerSecond;

		this.bindEvents();
	}

	/**
	 * Binds all necessary event listeners to the slider element.
	 * @private
	 */
	bindEvents() {
		// Bind all methods to maintain correct context
		this.handleSeekStart = this.handleSeekStart.bind(this);
		this.handleSeekEnd = this.handleSeekEnd.bind(this);
		this.handleMouseSeek = this.handleMouseSeek.bind(this);
		this.handleTouchStart = this.handleTouchStart.bind(this);
		this.handleTouchEnd = this.handleTouchEnd.bind(this);
		this.handleTouchSeek = this.handleTouchSeek.bind(this);

		// Mouse events
		this.slider.addEventListener('mousedown', this.handleSeekStart);
		this.slider.addEventListener('mouseup', this.handleSeekEnd);
		this.slider.addEventListener('mousemove', this.handleMouseSeek);

		// Touch events
		this.slider.addEventListener('touchstart', this.handleTouchStart, { passive: false });
		this.slider.addEventListener('touchend', this.handleTouchEnd);
		this.slider.addEventListener('touchmove', this.handleTouchSeek, { passive: false });

		// Prevent context menu
		this.slider.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	/**
	 * Handles the start of a seek operation (mouse down or touch start).
	 * Pauses audio and remembers if it was playing.
	 *
	 * @private
	 */
	handleSeekStart() {
		this.isDragging = true;
		this.wasPlayingBeforeDrag = !this.audio.paused;
		this.audio.pause();
	}

	/**
	 * Handles the end of a seek operation (mouse up or touch end).
	 * Resumes playback if audio was playing before seeking.
	 *
	 * @private
	 */
	handleSeekEnd() {
		if (!this.isDragging) return;
		this.isDragging = false;
		if (this.wasPlayingBeforeDrag) this.audio.play();
	}

	/**
	 * Handles mouse movement during seek operation.
	 * Uses movement delta to calculate seek distance.
	 *
	 * @param {MouseEvent} event - The mouse move event
	 * @private
	 */
	handleMouseSeek(event) {
		if (!this.isDragging || !this.audio.duration) return;
		this.seekAudio(event.movementX / this.pixelsPerSecond);
	}

	/**
	 * Handles the start of a touch seek operation.
	 *
	 * @param {TouchEvent} event - The touch start event
	 * @private
	 */
	handleTouchStart(event) {
		event.preventDefault();
		this.isDragging = true;
		this.wasPlayingBeforeDrag = !this.audio.paused;
		this.touchStartX = event.touches[0].clientX;
		this.audio.pause();
	}

	/**
	 * Handles the end of a touch seek operation.
	 * @private
	 */
	handleTouchEnd() {
		if (!this.isDragging) return;
		this.isDragging = false;
		this.touchStartX = 0;
		if (this.wasPlayingBeforeDrag) this.audio.play();
	}

	/**
	 * Handles touch movement during seek operation.
	 * Calculates distance from initial touch position.
	 *
	 * @param {TouchEvent} event - The touch move event
	 * @private
	 */
	handleTouchSeek(event) {
		if (!this.isDragging || !this.audio.duration) return;
		event.preventDefault();
		const touchCurrentX = event.touches[0].clientX;
		const touchDistanceX = touchCurrentX - this.touchStartX;
		this.seekAudio(touchDistanceX / this.pixelsPerSecond);
		this.touchStartX = touchCurrentX;
	}

	/**
	 * Seeks the audio by a relative time amount.
	 * Clamps the result between 0 and audio duration.
	 *
	 * @param {number} timeToSeek - Relative time in seconds (can be positive or negative)
	 * @private
	 */
	seekAudio(timeToSeek) {
		const newTime = Math.max(0, Math.min(this.audio.currentTime + timeToSeek, this.audio.duration));
		this.audio.currentTime = newTime;
	}

	/**
	 * Cleans up event listeners to prevent memory leaks.
	 * Should be called when the seek behavior is no longer needed.
	 */
	destroy() {
		// Clean up event listeners
		this.slider.removeEventListener('mousedown', this.handleSeekStart);
		this.slider.removeEventListener('mouseup', this.handleSeekEnd);
		this.slider.removeEventListener('mousemove', this.handleMouseSeek);
		this.slider.removeEventListener('touchstart', this.handleTouchStart);
		this.slider.removeEventListener('touchend', this.handleTouchEnd);
		this.slider.removeEventListener('touchmove', this.handleTouchSeek);
	}
}

/**
 * Provides common audio control operations like skip, reload, and opening in new tab.
 */
class AudioControls {
	/**
	 * Creates a new AudioControls instance.
	 * @param {HTMLAudioElement} audioElement - The audio element to control
	 */
	constructor(audioElement) {
		/** @type {HTMLAudioElement} */
		this.audio = audioElement;
	}

	/**
	 * Skips backward by the specified number of seconds.
	 * @param {number} [seconds=5] - Number of seconds to skip backward
	 */
	skipBackward(seconds = 5) {
		this.audio.currentTime = Math.max(0, this.audio.currentTime - seconds);
	}

	/**
	 * Skips forward by the specified number of seconds.
	 * @param {number} [seconds=5] - Number of seconds to skip forward
	 */
	skipForward(seconds = 5) {
		this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + seconds);
	}

	/**
	 * Reloads the audio from the beginning and attempts to play.
	 * @returns {Promise<void>} Promise that resolves when play starts or rejects if blocked
	 */
	reload() {
		this.audio.pause();
		this.audio.currentTime = 0;
		this.audio.load();
		return this.audio.play().catch(() => {});
	}

	/**
	 * Opens the first audio source in a new browser tab.
	 */
	openInNewTab() {
		const firstSource = this.audio.querySelector('source');
		if (firstSource) window.open(firstSource.src, '_blank');
	}
}
