export const linkCSS = document.createElement('link');
linkCSS.rel = 'stylesheet';
linkCSS.href = '/@components/audio_wrapper/component.css';

export default class AudioWrapper extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		const container = document.createElement('div');
		container.classList.add('container');

		// Nhãn tên
		this.nameLabel = document.createElement('div');
		this.nameLabel.classList.add('name-label');

		// Phần chứa audio và settings
		const audioControls = document.createElement('div');
		audioControls.classList.add('audio-controls');

		/** @type {HTMLAudioElement} */
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

		const backBtn = document.createElement('button');
		backBtn.className = 'icon';
		backBtn.id = 'back';
		backBtn.title = 'Back 5s';

		const forwardBtn = document.createElement('button');
		forwardBtn.className = 'icon';
		forwardBtn.id = 'forward';
		forwardBtn.title = 'Forward 5s';

		const reloadBtn = document.createElement('button');
		reloadBtn.className = 'icon';
		reloadBtn.id = 'reload';
		reloadBtn.title = 'Reload audio';

		const openBtn = document.createElement('button');
		openBtn.className = 'icon';
		openBtn.id = 'open';
		openBtn.title = 'Open in new tab';

		tools.append(this.slider, backBtn, forwardBtn, reloadBtn, openBtn);
		this.panel.append(tools);
		audioControls.append(this.audio, this.settingsBtn);
		container.append(this.nameLabel, audioControls);
		this.shadowRoot.append(linkCSS.cloneNode(), container, this.panel);

		// sự kiện control
		this.settingsBtn.addEventListener('click', () => {
			this.panel.classList.toggle('open');
		});
		backBtn.addEventListener('click', () => {
			this.audio.currentTime = Math.max(0, this.audio.currentTime - 5);
		});
		forwardBtn.addEventListener('click', () => {
			this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 5);
		});
		reloadBtn.addEventListener('click', () => {
			this.audio.pause();
			this.audio.currentTime = 0;
			this.audio.load();
			this.audio.play().catch(() => {
				// có thể bị chặn autoplay, thì thôi
			});
		});
		openBtn.addEventListener('click', () => {
			const firstSource = this.audio.querySelector('source');
			if (firstSource) window.open(firstSource.src, '_blank');
		});

		// init từ attribute
		if (this.hasAttribute('src')) {
			this._updateSourcesFromAttr(this.getAttribute('src'));
		} else {
			/**
			 * @private
			 * @type {string[]}
			 */
			this._sources = [];
		}

		// init name label
		this._updateNameLabel();
	}

	/**
	 * Các attribute được theo dõi thay đổi.
	 * @returns {string[]}
	 */
	static get observedAttributes() {
		return ['src', 'name'];
	}

	/**
	 * Gọi khi attribute thay đổi.
	 *
	 * @param {string} name
	 * @param {string | null} oldValue
	 * @param {string | null} newValue
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'src') this._updateSourcesFromAttr(newValue);
		if (name === 'name') this._updateNameLabel();
	}

	/**
	 * Lấy thẻ `<audio>` gốc để thao tác trực tiếp.
	 */
	get audioElement() {
		return this.audio;
	}

	/**
	 * Danh sách nguồn audio.
	 * Đồng bộ với attribute `src` (JSON.stringify).
	 */
	get sources() {
		return this._sources;
	}

	set sources(arr) {
		if (!Array.isArray(arr)) {
			throw new TypeError('sources must be an array of URLs');
		}
		this._sources = [...arr];
		this._renderSources();
		// đồng bộ attribute
		this.setAttribute('src', JSON.stringify(this._sources));
	}

	/**
	 * Parse attribute `src` (JSON) và cập nhật nguồn.
	 *
	 * @private
	 * @param {string | null} value
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
	 * Cập nhật nhãn tên từ attribute.
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
	 * Render lại danh sách nguồn vào trong thẻ `<audio>`.
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

customElements.define('audio-wrapper', AudioWrapper);
