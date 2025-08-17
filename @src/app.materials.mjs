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
		this.touchStartX = 0;
		this.initialTime = 0; // Thời gian khi bắt đầu touch
		this.startSeekTime = 0; // Thời gian khi bắt đầu seek (cho delta)
		this.wasPlayingBeforeDrag = false;
		// Đơn vị: px/s
		this.mousePixelsPerSecond = 15; // Tăng độ nhạy mouse (ít pixel hơn = tua nhanh hơn)
		this.touchPixelsPerSecond = 15; // Tăng độ nhạy touch đáng kể
		this.timeIndicatorTimeout = null;

		this.createElements(src);
		this.bindEvents();

		return this.vidContainer;
	}

	createElements(src) {
		this.vidContainer = document.createElement('zoomable-content');
		this.vidContainer.classList.add('video-ctn');

		// Create time indicator
		this.timeIndicator = document.createElement('div');
		this.timeIndicator.className = 'time-indicator';
		this.timeIndicator.style.display = 'none';

		// Create video element
		this.video = document.createElement('video');
		this.video.innerHTML = `<source src="${src}">`;
		this.video.dataset.isPause = 'true';
		this.video.dataset.timeChange = '0';
		this.video.controls = true;
		this.video.preload = 'none';

		// Append elements
		this.vidContainer.appendChild(this.timeIndicator);
		this.vidContainer.appendChild(this.video);
	}

	bindEvents() {
		// Video events - disable default behaviors
		this.video.addEventListener('click', (e) => {
			if (this.vidContainer.scale !== 1) {
				e.preventDefault();
				e.stopPropagation();
			}
		});

		this.video.addEventListener('dblclick', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});

		// Disable fullscreen on double click for the entire container
		this.vidContainer.addEventListener('dblclick', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});

		// Video state events
		this.video.addEventListener('pause', () => {
			this.video.dataset.isPause = 'true';
		});

		this.video.addEventListener('play', () => {
			this.video.dataset.isPause = 'false';
		});

		// Mouse events
		this.vidContainer.addEventListener('mousedown', this.handleSeekStart.bind(this));
		this.vidContainer.addEventListener('mouseup', this.handleSeekEnd.bind(this));
		this.vidContainer.addEventListener('mousemove', this.handleMouseSeek.bind(this));

		// Touch events
		this.vidContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
		this.vidContainer.addEventListener('touchend', this.handleTouchEnd.bind(this));
		this.vidContainer.addEventListener('touchmove', this.handleTouchSeek.bind(this), { passive: false });

		// Prevent context menu
		this.vidContainer.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	handleSeekStart() {
		if (!this.isSeekable) return;

		this.#isDragging = true;
		this.wasPlayingBeforeDrag = !this.video.paused;
		this.startSeekTime = this.video.currentTime; // Lưu thời gian bắt đầu seek
		this.pause();

		// Show time indicator after delay
		this.timeIndicatorTimeout = setTimeout(() => {
			if (this.#isDragging) {
				this.showTimeIndicator();
			}
		}, 100);
	}

	handleSeekEnd() {
		if (!this.isDragging) return;

		this.#isDragging = false;
		this.clearTimeIndicatorTimeout();

		const hasTimeChange = parseFloat(this.video.dataset.timeChange) > 0;

		this.hideTimeIndicator();
		this.video.dataset.timeChange = '0';
		this.startSeekTime = 0; // Reset

		// Delay play để tránh interrupt
		if (hasTimeChange && this.wasPlayingBeforeDrag) {
			setTimeout(() => {
				this.play();
			}, 50);
		}
	}

	handleMouseSeek(event) {
		if (!this.isDragging || !this.video.duration) return;

		const timeToSeek = event.movementX / this.mousePixelsPerSecond;
		this.seekVideo(timeToSeek);
		this.updateTimeIndicator();
	}

	handleTouchStart(event) {
		if (!this.isSeekable) {
			event.preventDefault();
			return;
		}

		event.preventDefault();
		this.#isDragging = true;
		this.wasPlayingBeforeDrag = !this.video.paused;
		this.touchStartX = event.touches[0].clientX;
		this.initialTime = this.video.currentTime; // Lưu thời gian ban đầu
		this.startSeekTime = this.video.currentTime; // Lưu thời gian bắt đầu seek
		this.pause();

		// Hiện time indicator ngay lập tức trên mobile
		this.showTimeIndicator();
	}

	handleTouchEnd() {
		if (!this.isDragging) return;

		this.#isDragging = false;
		this.touchStartX = 0;
		this.initialTime = 0;

		const hasTimeChange = parseFloat(this.video.dataset.timeChange) > 0;

		this.hideTimeIndicator();
		this.video.dataset.timeChange = '0';
		this.startSeekTime = 0; // Reset

		// Delay play để tránh interrupt
		if (hasTimeChange && this.wasPlayingBeforeDrag) {
			setTimeout(() => {
				this.play();
			}, 50);
		}
	}

	handleTouchSeek(event) {
		if (!this.isDragging || !this.video.duration) return;

		event.preventDefault();

		const touchCurrentX = event.touches[0].clientX;
		const touchDistanceX = touchCurrentX - this.touchStartX;

		// Sử dụng tổng distance từ lúc bắt đầu để tua mượt hơn
		const timeToSeek = touchDistanceX / this.touchPixelsPerSecond;
		const newTime = Math.max(0, Math.min(this.initialTime + timeToSeek, this.video.duration));
		const timeChange = Math.abs(newTime - this.video.currentTime);

		this.video.currentTime = newTime;
		this.video.dataset.timeChange = timeChange.toString();
		this.updateTimeIndicator(); // Cập nhật indicator khi tua
	}

	seekVideo(timeToSeek) {
		const currentTime = this.video.currentTime;
		const newTime = Math.max(0, Math.min(currentTime + timeToSeek, this.video.duration));
		const timeChange = Math.abs(newTime - currentTime);

		this.video.currentTime = newTime;
		this.video.dataset.timeChange = timeChange.toString();
	}

	showTimeIndicator() {
		this.timeIndicator.style.display = 'block';
		this.updateTimeIndicator();
	}

	hideTimeIndicator() {
		this.timeIndicator.style.display = 'none';
	}

	clearTimeIndicatorTimeout() {
		if (this.timeIndicatorTimeout) {
			clearTimeout(this.timeIndicatorTimeout);
			this.timeIndicatorTimeout = null;
		}
	}

	updateTimeIndicator() {
		const currentTime = this.video.currentTime;
		const totalTime = this.video.duration;
		const formattedTime = this.formatTime(currentTime);
		const formattedTotal = this.formatTime(totalTime);

		// Tính delta time
		let deltaText = '';
		if (this.startSeekTime > 0) {
			const deltaTime = currentTime - this.startSeekTime;
			const absDelta = Math.abs(deltaTime);

			if (absDelta >= 1) {
				// Chỉ hiện nếu delta >= 1 giây
				const sign = deltaTime >= 0 ? '+' : '-';
				deltaText = ` (${sign}${Math.floor(absDelta)}s)`;
			}
		}

		this.timeIndicator.textContent = `${formattedTime} / ${formattedTotal}${deltaText}`;
	}

	formatTime(time) {
		if (!time || isNaN(time)) return '00:00';

		const hours = Math.floor(time / 3600);
		const minutes = Math.floor((time % 3600) / 60);
		const seconds = Math.floor(time % 60);

		if (hours > 0) {
			return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(seconds)}`;
		} else {
			return `${this.padZero(minutes)}:${this.padZero(seconds)}`;
		}
	}

	padZero(time) {
		return time < 10 ? '0' + time : time;
	}

	async play() {
		try {
			// Don't play if zoomed
			if (this.vidContainer.scale !== 1) return;
			if (this.video.dataset.isPause === 'false') return;

			this.video.dataset.isPause = 'false';
			await this.video.play();
		} catch (error) {
			console.error('Failed to play video:', error);
			this.video.dataset.isPause = 'true';
		}
	}

	pause() {
		if (this.video.dataset.isPause === 'true') return;

		this.video.dataset.isPause = 'true';
		this.video.pause();
	}

	// Getters and setters
	set isDragging(value) {
		this.#isDragging = value;
	}

	get isDragging() {
		return this.#isDragging && this.vidContainer.scale === 1;
	}

	get isSeekable() {
		return this.vidContainer.scale === 1;
	}

	// Utility methods
	getCurrentTime() {
		return this.video.currentTime;
	}

	getDuration() {
		return this.video.duration;
	}

	setCurrentTime(time) {
		if (time >= 0 && time <= this.video.duration) {
			this.video.currentTime = time;
		}
	}

	// Cleanup method
	destroy() {
		this.clearTimeIndicatorTimeout();
		this.pause();
		this.vidContainer.remove();
	}
}

class ImageDisplayer {
	constructor(src, toggleScreen) {
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
		this.filename = filename;
		this.isDragging = false;
		this.wasPlayingBeforeDrag = false;
		this.touchStartX = 0;
		this.pixelsPerSecond = 15;

		this.createElements(src);
		this.bindEvents();

		return this.audContainer;
	}

	createElements(src) {
		this.audContainer = document.createElement('div');
		this.audio = document.createElement('audio');
		this.seekBar = document.createElement('div');

		// Setup container
		this.audContainer.classList.add('aud-ctn', 'playing');
		this.audContainer.setAttribute('before', this.filename);

		// Setup audio
		this.audio.controls = true;
		this.audio.preload = 'none';
		this.audio.crossOrigin = 'anonymous';
		this.audio.setAttribute('referrerpolicy', 'no-referrer');
		this.audio.innerHTML = `<source src="${src}">`;
		this.audio.dataset.isPause = 'false';
		this.audio.dataset.timeChange = '0';

		// Setup seek bar
		this.seekBar.classList.add('seek-bar');

		// Append elements
		this.audContainer.appendChild(this.audio);
		this.audContainer.appendChild(this.seekBar);
	}

	bindEvents() {
		// Audio events
		this.audio.addEventListener('pause', () => {
			this.audio.dataset.isPause = 'true';
		});

		this.audio.addEventListener('play', () => {
			this.audio.dataset.isPause = 'false';
		});

		// Mouse events
		this.seekBar.addEventListener('mousedown', this.handleSeekStart.bind(this));
		this.seekBar.addEventListener('mouseup', this.handleSeekEnd.bind(this));
		this.seekBar.addEventListener('mousemove', this.handleMouseSeek.bind(this));

		// Touch events
		this.seekBar.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
		this.seekBar.addEventListener('touchend', this.handleTouchEnd.bind(this));
		this.seekBar.addEventListener('touchmove', this.handleTouchSeek.bind(this), { passive: false });

		// Prevent context menu on seek bar
		this.seekBar.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	handleSeekStart() {
		this.isDragging = true;
		this.wasPlayingBeforeDrag = !this.audio.paused;
		this.pause();
	}

	handleSeekEnd() {
		if (!this.isDragging) return;

		this.isDragging = false;

		// Resume playing if was playing before drag
		if (this.wasPlayingBeforeDrag) {
			this.play();
		}

		this.audio.dataset.timeChange = '0';
	}

	handleMouseSeek(event) {
		if (!this.isDragging || !this.audio.duration) return;

		const timeToSeek = event.movementX / this.pixelsPerSecond;
		this.seekAudio(timeToSeek);
	}

	handleTouchStart(event) {
		event.preventDefault(); // Prevent scrolling
		this.isDragging = true;
		this.wasPlayingBeforeDrag = !this.audio.paused;
		this.touchStartX = event.touches[0].clientX;
		this.pause();
	}

	handleTouchEnd() {
		if (!this.isDragging) return;

		this.isDragging = false;
		this.touchStartX = 0;

		// Resume playing if was playing before drag
		if (this.wasPlayingBeforeDrag) {
			this.play();
		}

		this.audio.dataset.timeChange = '0';
	}

	handleTouchSeek(event) {
		if (!this.isDragging || !this.audio.duration) return;

		event.preventDefault(); // Prevent scrolling

		const touchCurrentX = event.touches[0].clientX;
		const touchDistanceX = touchCurrentX - this.touchStartX;
		const timeToSeek = touchDistanceX / this.pixelsPerSecond;

		this.seekAudio(timeToSeek);
		this.touchStartX = touchCurrentX; // Update for next movement
	}

	seekAudio(timeToSeek) {
		const currentTime = this.audio.currentTime;
		const newTime = Math.max(0, Math.min(currentTime + timeToSeek, this.audio.duration));
		const timeChange = Math.abs(newTime - currentTime);

		this.audio.currentTime = newTime;
		this.audio.dataset.timeChange = timeChange.toString();
	}

	async play() {
		try {
			this.audContainer.setAttribute('before', this.filename);

			if (this.audio.dataset.isPause === 'false') return;

			this.audio.dataset.isPause = 'false';
			await this.audio.play();
		} catch (error) {
			console.error('Failed to play audio:', error);
			this.audio.dataset.isPause = 'true';
		}
	}

	pause() {
		if (this.audio.dataset.isPause === 'true') return;

		this.audio.dataset.isPause = 'true';
		this.audio.pause();
	}

	// Utility methods
	getCurrentTime() {
		return this.audio.currentTime;
	}

	getDuration() {
		return this.audio.duration;
	}

	setCurrentTime(time) {
		if (time >= 0 && time <= this.audio.duration) {
			this.audio.currentTime = time;
		}
	}

	// Cleanup method
	destroy() {
		this.pause();
		this.audContainer.remove();
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
		this.isPlaying = false;
		this.setupAutoNext();
	}

	setupAutoNext(stopWhenDone = true) {
		this.audioElements.forEach((audio, index) => {
			audio.addEventListener('ended', () => {
				if (index === this.currentAudioIndex) {
					const isLast = this.currentAudioIndex === this.audioElements.length - 1;
					if (isLast && stopWhenDone) {
						this.isPlaying = false;
						console.log('--> [App.materials.AudioPlayer] All tracks played.');
					} else {
						this.playNextTrack();
					}
				}
			});

			// Thêm error handler
			audio.addEventListener('error', (e) => {
				console.error('--> [App.materials.AudioPlayer] Audio error:', e);
				this.isPlaying = false;
			});

			// Thêm loading/waiting handler
			audio.addEventListener('waiting', () => {
				console.log('--> [App.materials.AudioPlayer] Audio buffering...');
			});
		});
	}

	async playCurrentTrack() {
		const currentAudio = this.audioElements[this.currentAudioIndex];

		try {
			// Với preload="none", gọi play() sẽ tự động load và play
			await currentAudio.play();
			this.isPlaying = true;

			// Cập nhật Media Session state
			if ('mediaSession' in navigator) {
				navigator.mediaSession.playbackState = 'playing';
			}
		} catch (error) {
			console.error('--> [App.materials.AudioPlayer] Failed to play audio:', error);
			this.isPlaying = false;

			if ('mediaSession' in navigator) {
				navigator.mediaSession.playbackState = 'paused';
			}
		}
	}

	pauseCurrentTrack() {
		const currentAudio = this.audioElements[this.currentAudioIndex];
		currentAudio.pause();
		this.isPlaying = false;

		if ('mediaSession' in navigator) {
			navigator.mediaSession.playbackState = 'paused';
		}
	}

	async playNextTrack() {
		this.pauseCurrentTrack();
		this.currentAudioIndex++;
		if (this.currentAudioIndex >= this.audioElements.length) {
			this.currentAudioIndex = 0;
		}
		await this.playCurrentTrack();
	}

	async playPreviousTrack() {
		this.pauseCurrentTrack();
		this.currentAudioIndex--;
		if (this.currentAudioIndex < 0) {
			this.currentAudioIndex = this.audioElements.length - 1;
		}
		await this.playCurrentTrack();
	}

	setupMediaSession() {
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: `~${this.code}`,
				artist: `${this.CVnames.join(', ')}`,
				album: `${this.seriesNames.join(', ')}`,
				artwork: [{ src: this.thumbnail, sizes: '512x512', type: 'image/jpeg' }],
			});

			// Thêm kiểm tra trạng thái trước khi thực hiện action
			navigator.mediaSession.setActionHandler('play', async () => {
				if (!this.isPlaying) {
					await this.playCurrentTrack();
				}
			});

			navigator.mediaSession.setActionHandler('pause', () => {
				if (this.isPlaying) {
					this.pauseCurrentTrack();
				}
			});

			navigator.mediaSession.setActionHandler('nexttrack', async () => {
				await this.playNextTrack();
			});

			navigator.mediaSession.setActionHandler('previoustrack', async () => {
				await this.playPreviousTrack();
			});

			// Thêm seek handler nếu cần
			navigator.mediaSession.setActionHandler('seekto', (details) => {
				const currentAudio = this.audioElements[this.currentAudioIndex];
				if (details.seekTime && currentAudio.duration) {
					currentAudio.currentTime = details.seekTime;
				}
			});

			// Set initial state
			navigator.mediaSession.playbackState = 'none';
		}
	}

	// Phương thức để cleanup
	destroy() {
		this.pauseCurrentTrack();

		if ('mediaSession' in navigator) {
			navigator.mediaSession.setActionHandler('play', null);
			navigator.mediaSession.setActionHandler('pause', null);
			navigator.mediaSession.setActionHandler('nexttrack', null);
			navigator.mediaSession.setActionHandler('previoustrack', null);
			navigator.mediaSession.setActionHandler('seekto', null);
		}
	}
}

export { AudioController, AudioPlayer, ImageDisplayer, SwipeHandler, VideoPlayer };
