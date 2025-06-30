class SwipeHandler {
	/**
	 * leftToRight: function to call when the swipe/drag action is from left to right
	 * rightToLeft:                                                     right to left
	 * up         :                                                     bottom to top
	 * down       :                                                     top to bottom
	 */
	constructor(
		element,
		leftToRight = () => null,
		rightToLeft = () => null,
		up = () => null,
		down = () => null,
		thresholdRatio = 2
	) {
		Object.assign(this, { element, leftToRight, rightToLeft, up, down, thresholdRatio });
		this.startX = 0;
		this.startY = 0;
		this.endX = 0;
		this.endY = 0;
		this.isSelectingText = false;
		document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
	}
	
	registerEvents() {
		this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
		this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
		this.element.addEventListener('touchstart', this.handleTouchStart.bind(this));
		this.element.addEventListener('touchend', this.handleTouchEnd.bind(this));
	}

	handleMouseDown(event) {
		if (event.target.tagName === 'IMG') event.preventDefault();
		this.startX = event.clientX;
		this.startY = event.clientY;
		this.isSelectingText = false;
	}

	handleMouseUp(event) {
		const targetTagName = event.target.tagName;

		// Ignore if event start from select or option
		if (targetTagName === 'OPTION' || targetTagName === 'SELECT') return;

		this.endX = event.clientX;
		this.endY = event.clientY;
		if (!this.isSelectingText) {
			this.handleSwipe();
		}
	}

	handleTouchStart(event) {
		if (event.touches.length > 1) return;
		this.startX = event.touches[0].clientX;
		this.startY = event.touches[0].clientY;
		this.isSelectingText = false;
	}

	handleTouchEnd(event) {
		if (event.touches.length > 1) return;
		this.endX = event.changedTouches[0].clientX;
		this.endY = event.changedTouches[0].clientY;
		if (!this.isSelectingText) {
			this.handleSwipe();
		}
	}

	handleSwipe() {
		const deltaX = this.endX - this.startX;
		const deltaY = this.endY - this.startY;
		const absDeltaX = Math.abs(deltaX);
		const absDeltaY = Math.abs(deltaY);

		if (absDeltaX > absDeltaY && absDeltaX / absDeltaY > this.thresholdRatio) {
			if (deltaX > 0) {
				this.leftToRight();
				return;
			}
			this.rightToLeft();
		} else if (absDeltaY > absDeltaX && absDeltaY / absDeltaX > this.thresholdRatio) {
			if (deltaY > 0) {
				this.down();
				return;
			}
			this.up();
		}
	}

	handleSelectionChange() {
		this.isSelectingText = !!document.getSelection().toString(); // Cập nhật biến khi bôi đen văn bản
	}
}

class VideoPlayer {
	#isDragging = false;

	constructor(src) {
		this.currentTime = 0;
		this.touchStartX = 0;

		this.vidContainer = document.createElement('zoomable-content');
		this.vidContainer.classList.add('video-ctn');
		this.vidContainer.innerHTML = '<div class="time-indicator" style="display: none;"></div>';
		this.video = document.createElement('video');
		this.video.innerHTML = `<source src="${src}"></source>`;
		this.video.dataset.isPause = true;
		this.video.dataset.timeChange = 0;
		this.video.controls = true;
		this.video.preload = 'auto';
		this.timeIndicator = this.vidContainer.querySelector('.time-indicator');
		this.vidContainer.appendChild(this.video);

		this.video.addEventListener(
			'click',
			(e) => this.vidContainer.scale !== 1 && e.preventDefault()
		);
		this.video.addEventListener('dblclick', (e) => e.preventDefault());

		this.vidContainer.addEventListener('mousedown', () => {
			this.isDragging = true;
			this.pause();
			this.currentTime = this.video.currentTime;
			setTimeout(() => {
				if (this.isDragging == true) {
					this.timeIndicator.style.display = 'block';
					this.updateTimeIndicator();
				}
			}, 300);
		});
		this.vidContainer.addEventListener('mouseup', () => {
			this.isDragging = false;
			if (this.video.dataset.timeChange == 0) {
				this.video.dataset.timeChange = 0;
				this.timeIndicator.style.display = 'none';
				return;
			} else {
				this.video.dataset.isPause == 'true' ? this.play() : '';
				this.timeIndicator.style.display = 'none';
			}
			this.video.dataset.timeChange = 0;
		});
		this.vidContainer.addEventListener('mousemove', (event) => {
			if (this.isDragging) {
				const { movementX } = event;
				const pixelsPerSecond = 50;
				const timeToSeek = movementX / pixelsPerSecond;
				let currentTimeBefore = this.video.currentTime;
				let currentTimeAfter = this.video.currentTime;
				currentTimeAfter += timeToSeek;
				currentTimeAfter = Math.max(0, Math.min(currentTimeAfter, this.video.duration));
				this.video.dataset.timeChange = Math.abs(currentTimeAfter - currentTimeBefore);
				this.video.currentTime = currentTimeAfter;
				this.currentTime += timeToSeek;
				this.updateTimeIndicator();
			}
		});
		this.vidContainer.addEventListener('touchstart', (event) => {
			if (this.vidContainer.scale !== 1) {
				event.preventDefault();
				return;
			}
			this.isDragging = true;
			this.pause();
			this.touchStartX = event.touches[0].clientX;
		});
		this.vidContainer.addEventListener('touchend', () => {
			this.isDragging = false;
			this.touchStartX = 0;
			if (this.video.dataset.timeChange == 0) {
				this.video.dataset.timeChange = 0;
				return;
			} else {
				this.video.dataset.isPause == 'true' ? this.play() : '';
			}
			this.video.dataset.timeChange = 0;
		});
		this.vidContainer.addEventListener('touchmove', (event) => {
			if (this.isDragging) {
				const touchCurrentX = event.touches[0].clientX;
				const touchDistanceX = touchCurrentX - this.touchStartX;
				const pixelsPerSecond = 500;
				const timeToSeek = touchDistanceX / pixelsPerSecond;
				let currentTimeBefore = this.video.currentTime;
				let currentTimeAfter = this.video.currentTime;
				currentTimeAfter += timeToSeek;
				currentTimeAfter = Math.max(0, Math.min(currentTimeAfter, this.video.duration));
				this.video.dataset.timeChange = Math.abs(currentTimeAfter - currentTimeBefore);
				this.video.currentTime = currentTimeAfter;
			}
		});

		return this.vidContainer;
	}

	set isDragging(value) {
		this.#isDragging = value;
	}

	get isDragging() {
		return this.#isDragging && this.vidContainer.scale === 1;
	}

	play() {
		setTimeout(() => {
			if (this.vidContainer.scale === 1) return;
			if (this.video.dataset.isPause == 'false') return;
			this.video.dataset.isPause = false;
			this.video.play();
		}, 10);
	}

	pause() {
		setTimeout(() => {
			if (this.video.dataset.isPause == 'true') return;
			this.video.dataset.isPause = true;
			this.video.pause();
		}, 10);
	}

	updateTimeIndicator() {
		const formatTime = (time) => {
			let minutes = Math.floor(time / 60);
			let seconds = Math.floor(time - minutes * 60);

			let hours = Math.floor(minutes / 60);
			minutes = minutes % 60;

			if (hours > 0) {
				return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
			} else {
				return `${padZero(minutes)}:${padZero(seconds)}`;
			}
		};
		const padZero = (time) => (time < 10 ? '0' + time : time);
		const formattedTime = formatTime(this.video.currentTime);
		this.timeIndicator.textContent = `${formattedTime}`;
	}
}

class ImageDisplayer {
	constructor(src, toggleScreen) {
		this.startX = 0;
		this.currentX = 0;
		this.startY = 0;
		this.currentY = 0;
		this.diffX = 0;
		this.diffY = 0;

		this.mouseDown = false;
		this.startMouseX = 0;
		this.currentMouseX = 0;
		this.diffMouseX = 0;
		this.startMouseY = 0;
		this.currentMouseY = 0;
		this.diffMouseY = 0;

		const ctn = document.createElement('zoomable-content');
		ctn.classList.add('img-ctn');
		this.div = document.createElement('div');
		this.div.classList.add('get-evt');
		const img = document.createElement('img');
		img.decoding = 'async';
		img.loading = 'lazy';
		img.referrerPolicy = 'no-referrer';
		img.classList.add('img');
		img.src = src;
		ctn.appendChild(img);
		this.div.addEventListener('dblclick', toggleScreen);

		new SwipeHandler(
			this.div,
			() => ctn.scale === 1 && document.querySelector('#prev-btn').click(),
			() => ctn.scale === 1 && document.querySelector('#next-btn').click(),
			() => ctn.scale === 1 && document.body.classList.add('open-menu-mp3'),
			() => ctn.scale === 1 && document.body.classList.remove('open-menu-mp3')
		).registerEvents();

		ctn.appendChild(this.div);
		return ctn;
	}
}

class AudioController {
	constructor(src, filename) {
		this.isDragging = false;
		this.currentTime = 0;
		this.touchStartX = 0;
		this.time = 3;
		this.filename = filename;

		this.audContainer = document.createElement('div');
		this.audio = document.createElement('audio');
		this.seekBar = document.createElement('div');

		this.audContainer.classList.add('aud-ctn');
		this.audio.controls = true;
		this.audio.preload = 'metadata';
		this.audio.setAttribute('referrerpolicy', 'no-referrer');
		this.audio.innerHTML = `<source src="${src}"></source>`;
		this.audio.dataset.isPause = true;
		this.audio.dataset.timeChange = 0;
		this.audContainer.classList.add('playing');
		this.audContainer.setAttribute('before', this.filename);
		this.audio.dataset.isPause = false;
		this.seekBar.classList.add('seek-bar');

		this.audio.addEventListener('pause', () => (this.audio.dataset.isPause = true));
		this.seekBar.addEventListener('mousedown', () => {
			this.isDragging = true;
			this.pause();
			this.currentTime = this.audio.currentTime;
		});
		this.seekBar.addEventListener('mouseup', () => {
			this.isDragging = false;
			this.audio.dataset.isPause == 'true' ? this.play() : '';
			this.audio.dataset.timeChange = 0;
		});
		this.seekBar.addEventListener('mousemove', (event) => {
			if (this.isDragging) {
				const { movementX } = event;
				const pixelsPerSecond = 30;
				const timeToSeek = movementX / pixelsPerSecond;
				let currentTimeBefore = this.audio.currentTime;
				let currentTimeAfter = this.audio.currentTime;
				currentTimeAfter += timeToSeek;
				currentTimeAfter = Math.max(0, Math.min(currentTimeAfter, this.audio.duration));
				this.audio.dataset.timeChange = Math.abs(currentTimeAfter - currentTimeBefore);
				this.audio.currentTime = currentTimeAfter;
				this.currentTime += timeToSeek;
			}
		});
		this.seekBar.addEventListener('touchstart', (event) => {
			this.isDragging = true;
			this.pause();
			this.touchStartX = event.touches[0].clientX;
		});
		this.seekBar.addEventListener('touchend', () => {
			this.isDragging = false;
			this.touchStartX = 0;
			if (this.audio.dataset.timeChange == 0) {
				this.audio.dataset.timeChange = 0;
				return;
			} else {
				this.audio.dataset.isPause == 'true' ? this.play() : '';
			}
			this.audio.dataset.timeChange = 0;
		});
		this.seekBar.addEventListener('touchmove', (event) => {
			if (this.isDragging) {
				const touchCurrentX = event.touches[0].clientX;
				const touchDistanceX = touchCurrentX - this.touchStartX;
				const pixelsPerSecond = 30;
				const timeToSeek = touchDistanceX / pixelsPerSecond;
				let currentTimeBefore = this.audio.currentTime;
				let currentTimeAfter = this.audio.currentTime;
				currentTimeAfter += timeToSeek;
				currentTimeAfter = Math.max(0, Math.min(currentTimeAfter, this.audio.duration));
				this.audio.dataset.timeChange = Math.abs(currentTimeAfter - currentTimeBefore);
				this.audio.currentTime = currentTimeAfter;
			}
		});

		this.audContainer.appendChild(this.audio);
		this.audContainer.appendChild(this.seekBar);
		return this.audContainer;
	}

	play() {
		this.audContainer.setAttribute('before', this.filename);
		setTimeout(() => {
			if (this.audio.dataset.isPause == 'false') return;
			this.audio.dataset.isPause = false;
			this.audio.play();
		}, 10);
	}

	pause() {
		setTimeout(() => {
			if (this.audio.dataset.isPause == 'true') return;
			this.audio.dataset.isPause = true;
			this.audio.pause();
		}, 10);
	}
}

class AudioPlayer {
	constructor(audioElements, code, CVnames, seriesNames, thumbnail) {
		this.audioElements = audioElements;
		this.code = code;
		this.CVnames = CVnames;
		this.seriesNames = seriesNames;
		this.thumbnail = thumbnail;
		this.currentAudioIndex = 0;
		this.setupAutoNext();
	}

	setupAutoNext(stopWhenDone = true) {
		this.audioElements.forEach((audio, index) => {
			audio.addEventListener('ended', () => {
				if (index === this.currentAudioIndex) {
					const isLast = this.currentAudioIndex === this.audioElements.length - 1;
					if (isLast && stopWhenDone) {
						// Dừng không phát nữa
						console.log('All tracks played.');
					} else {
						this.playNextTrack();
					}
				}
			});
		});
	}

	playCurrentTrack() {
		this.audioElements[this.currentAudioIndex].play();
	}

	pauseCurrentTrack() {
		this.audioElements[this.currentAudioIndex].pause();
	}

	playNextTrack() {
		this.pauseCurrentTrack();
		this.currentAudioIndex++;
		if (this.currentAudioIndex >= this.audioElements.length) {
			this.currentAudioIndex = 0;
		}
		this.playCurrentTrack();
	}

	playPreviousTrack() {
		this.pauseCurrentTrack();
		this.currentAudioIndex--;
		if (this.currentAudioIndex < 0) {
			this.currentAudioIndex = this.audioElements.length - 1;
		}
		this.playCurrentTrack();
	}

	setupMediaSession() {
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: `~${this.code}`,
				artist: `${this.CVnames.join(', ')}`,
				album: `${this.seriesNames.join(', ')}`,
				artwork: [{ src: this.thumbnail, sizes: '512x512', type: 'image/jpeg' }],
			});

			navigator.mediaSession.setActionHandler('play', () => {
				this.playCurrentTrack();
			});
			navigator.mediaSession.setActionHandler('pause', () => {
				this.pauseCurrentTrack();
			});
			navigator.mediaSession.setActionHandler('nexttrack', () => {
				this.playNextTrack();
			});
			navigator.mediaSession.setActionHandler('previoustrack', () => {
				this.playPreviousTrack();
			});
		}
	}
}

export { AudioController, AudioPlayer, ImageDisplayer, SwipeHandler, VideoPlayer };
