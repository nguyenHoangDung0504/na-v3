import { simplifyNumber } from '../../../@descriptions/utils.js'
import { SwipeHandler } from '../../../@src/app.materials.mjs'
import { url, fullscreen, device } from '../../../@src/app.utils.mjs'
import { database as db } from '../../../@src/database/index.mjs'

/* ═══════════════════════════════════════════════════════
	MODULE: VTT Parser
	══════════════════════════════════════════════════════ */
const VTT = (() => {
	function isBracketVTT(text, checkLines = 5) {
		const lines = text.split(/\r?\n/).filter((l) => l.trim())
		const re = /^\[\d{1,2}:\d{2}\.\d{2,3}\]/
		let n = 0
		for (let i = 0; i < Math.min(lines.length, checkLines); i++) {
			if (re.test(lines[i])) n++
		}
		return n >= 2
	}

	function parseTimestamp(ts) {
		const [mm, rest] = ts.split(':')
		const [ss, ms] = rest.split('.')
		return `00:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}.${ms.padEnd(3, '0')}`
	}

	function toWebVTT(text, lastDuration = 2) {
		const lines = text.split(/\r?\n/).filter((l) => l.trim())

		const cuesRaw = []

		for (const line of lines) {
			const m = line.match(/^\[(\d{1,2}:\d{2}\.\d{2,3})\]\s*(.*)$/)
			if (m) {
				cuesRaw.push({
					time: m[1],
					text: m[2].trim(),
				})
			}
		}

		let out = ['WEBVTT', '']

		for (let i = 0; i < cuesRaw.length; i++) {
			const cur = cuesRaw[i]
			if (!cur.text) continue

			const start = parseTimestamp(cur.time)
			let end = null

			let j = i + 1

			while (j < cuesRaw.length) {
				const next = cuesRaw[j]

				if (!next.text) {
					end = parseTimestamp(next.time)
					j++
					continue
				}

				if (!end) end = parseTimestamp(next.time)
				break
			}

			if (!end) {
				const [mm, rest] = cur.time.split(':')
				const [ss, ms] = rest.split('.')

				const total = (Number(mm) * 60 + Number(ss)) * 1000 + Number(ms.padEnd(3, '0')) + lastDuration * 1000

				const eMM = Math.floor(total / 60000)
				const eSS = Math.floor((total % 60000) / 1000)
				const eMS = total % 1000

				end = `00:${String(eMM).padStart(2, '0')}:${String(eSS).padStart(2, '0')}.${String(eMS).padStart(3, '0')}`
			}

			out.push(`${start} --> ${end}`, cur.text, '')
		}

		return out.join('\n')
	}

	function normalizeTS(ts) {
		ts = ts.trim().replace(/\.(\d{3})/, ',$1')

		if (/^\d{2}:\d{2}[.,]\d{3}$/.test(ts)) {
			ts = '00:' + ts
		}

		if (/^\d{2}:\d{2}:\d{2}$/.test(ts)) {
			ts += ',000'
		}

		return ts
	}

	function toSec(ts) {
		ts = normalizeTS(ts)

		const m = ts.match(/(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/)
		if (!m) return 0

		const h = +m[1] || 0
		const min = +m[2]
		const s = +m[3]
		const ms = +m[4]

		return h * 3600 + min * 60 + s + ms / 1000
	}

	function parseCues(vttText) {
		vttText = vttText
			.replace(/^\uFEFF/, '')
			.replace(/\r/g, '')
			.replace(/\n{2,}/g, '\n')

		const lines = vttText.split('\n')
		const cues = []

		let i = 0
		while (i < lines.length) {
			let line = lines[i].trim()

			if (!line || line === 'WEBVTT') {
				i++
				continue
			}

			if (/^\d+$/.test(line)) {
				i++
				line = lines[i]?.trim()
			}

			if (!line || !line.includes('-->')) {
				i++
				continue
			}

			const [startRaw, endRaw] = line.split('-->').map((s) => s.trim())
			const start = toSec(startRaw)
			const end = toSec(endRaw)

			i++

			let textLines = []
			while (i < lines.length) {
				const l = lines[i].trim()

				if (!l) break
				if (l.includes('-->')) break

				if (/^\d+$/.test(l) && lines[i + 1]?.includes('-->')) break

				textLines.push(l)
				i++
			}

			const text = textLines
				.join(' ')
				.replace(/<[^>]+>/g, '')
				.replace(/\s+/g, ' ')
				.trim()

			if (text && end > start) {
				cues.push({ start, end, text })
			}
		}

		cues.sort((a, b) => a.start - b.start)

		return cues
	}

	async function load(url) {
		let text = ''

		try {
			const res = await fetch(url)
			if (res.ok) text = await res.text()
		} catch (e) {
			console.warn('Fetch VTT failed:', e)
		}

		if (!text) return []

		const converted = isBracketVTT(text) ? toWebVTT(text) : text

		return parseCues(converted)
	}

	return { load }
})()

/* ═══════════════════════════════════════════════════════
	MODULE: Image Slideshow
	══════════════════════════════════════════════════════ */
const Slideshow = (() => {
	const bgA = document.getElementById('bg-a')
	const bgB = document.getElementById('bg-b')
	bgA.addEventListener('dblclick', toggleFS)
	bgB.addEventListener('dblclick', toggleFS)

	const dotsEl = document.getElementById('img-dots')
	let current = 0
	let front = bgA
	let back = bgB
	let setImageVersion = 0
	let images = []
	let swipeInited = false
	let currentIsVideo = false

	function createMedia(layer, item) {
		layer.innerHTML = ''

		if (item.type === 'video') {
			const v = document.createElement('video')
			v.src = item.src
			v.loop = true
			v.playsInline = true
			v.controls = true
			layer.appendChild(v)
			return v
		}

		const img = document.createElement('img')
		img.src = item.src
		img.referrerPolicy = 'no-referrer'
		layer.appendChild(img)
		return img
	}

	function init(newImages) {
		images = newImages

		dotsEl.innerHTML = ''
		images.forEach((_, i) => {
			const d = document.createElement('div')
			d.className = 'dot' + (i === 0 ? ' active' : '')
			dotsEl.appendChild(d)
		})

		if (images.length) setImage(0)
	}

	function initSwipe() {
		if (swipeInited) return
		swipeInited = true
		;[bgA, bgB].forEach((ele) =>
			new SwipeHandler(
				ele,
				() => ele.scale === 1 && prev(),
				() => ele.scale === 1 && next(),
			).registerEvents(),
		)
	}

	function prev() {
		setImage(current - 1)
	}

	function next() {
		setImage(current + 1)
	}

	function setImage(idx) {
		if (!images.length) return
		current = ((idx % images.length) + images.length) % images.length

		const item = images[current]
		currentIsVideo = item.type === 'video'

		createMedia(back, item)

		back.style.opacity = '1'
		back.style.pointerEvents = 'all'
		front.style.opacity = '0'
		front.style.pointerEvents = 'none'
		;[front, back] = [back, front]

		const dots = dotsEl.querySelectorAll('.dot')
		dots.forEach((d, i) => d.classList.toggle('active', i === current))
	}

	function getCurrent() {
		return current
	}

	return { init, prev, next, getCurrent, setImage, initSwipe, isVideo: () => currentIsVideo }
})()

/* ═══════════════════════════════════════════════════════
	MODULE: Subtitle – flow layout
	══════════════════════════════════════════════════════ */
const SubtitlePanel = (() => {
	const wrap = document.getElementById('sub-list-wrap')
	const inner = document.getElementById('sub-list-inner')
	const noSub = document.getElementById('no-sub')

	let userScrolling = false
	let scrollTimer = null
	const SCROLL_IDLE_DELAY = 3000

	wrap.addEventListener('scroll', () => {
		userScrolling = true

		clearTimeout(scrollTimer)
		scrollTimer = setTimeout(() => {
			userScrolling = false
		}, SCROLL_IDLE_DELAY)
	})

	let cues = []
	let activeCueIdx = -1
	let onClick = null

	function setCues(newCues, onClickCb) {
		cues = newCues
		onClick = onClickCb
		activeCueIdx = -1
		inner.innerHTML = ''
		inner.style.height = ''
		noSub.style.display = cues.length ? 'none' : 'flex'

		if (!cues.length) return

		const frag = document.createDocumentFragment()
		cues.forEach((c, i) => {
			const el = document.createElement('div')
			el.className = 'sub-item'
			el.dataset.idx = i
			el.innerHTML = `<span class="sub-ts">${fmtTime(c.start)}</span><span class="sub-txt">${escHtml(c.text)}</span>`
			el.addEventListener('click', () => {
				userScrolling = false
				onClick && onClick(c.start)
			})
			frag.appendChild(el)
		})
		inner.appendChild(frag)
	}

	function updateActive(idx) {
		if (idx === activeCueIdx) return
		const prev = inner.querySelector('.sub-item.active')
		if (prev) prev.classList.remove('active')
		activeCueIdx = idx
		if (idx >= 0) {
			const cur = inner.querySelector(`.sub-item[data-idx="${idx}"]`)
			if (cur) cur.classList.add('active')
		}
	}

	function scrollToActive(smooth = true) {
		if (activeCueIdx < 0) return

		if (userScrolling) return

		const cur = inner.querySelector(`.sub-item[data-idx="${activeCueIdx}"]`)
		if (!cur) return

		const itemTop = cur.offsetTop
		const itemH = cur.offsetHeight
		const wrapH = wrap.clientHeight
		const scrollTop = wrap.scrollTop

		if (itemTop < scrollTop || itemTop + itemH > scrollTop + wrapH) {
			wrap.scrollTo({
				top: itemTop - wrapH / 2 + itemH / 2,
				behavior: smooth ? 'smooth' : 'auto',
			})
		}
	}

	function fmtTime(s) {
		const m = Math.floor(s / 60),
			sec = Math.floor(s % 60)
		return `${m}:${String(sec).padStart(2, '0')}`
	}
	function escHtml(t) {
		return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	}

	return { setCues, updateActive, scrollToActive }
})()

/* ═══════════════════════════════════════════════════════
	MODULE: Auto-hide controls
	══════════════════════════════════════════════════════ */
const AutoHide = (() => {
	const el = document.getElementById('controls')
	const topBar = document.getElementById('top-bar')
	const imgPrev = document.getElementById('img-prev')
	const imgNext = document.getElementById('img-next')
	const imgDots = document.getElementById('img-dots')
	const DELAY = 2000
	let timer = null
	let hidden = false
	let panelOpen = false
	let touchStartY = 0

	let downTime = 0
	let downX = 0
	let downY = 0

	const TAP_TIME = 150
	const TAP_MOVE = 10

	const allUi = [el, topBar, imgPrev, imgNext, imgDots]

	function show() {
		hidden = false
		allUi.forEach((e) => e.classList.remove('hidden'))
		scheduleHide()
	}

	function hide() {
		if (panelOpen) return
		hidden = true
		allUi.forEach((e) => e.classList.add('hidden'))
	}

	function scheduleHide() {
		// clearTimeout(timer)
		// timer = setTimeout(hide, DELAY)
	}

	function setPanelOpen(open) {
		panelOpen = open
		if (!open) scheduleHide()
		else {
			clearTimeout(timer)
			show()
		}
	}

	const stage = document.getElementById('stage')

	stage.addEventListener('pointerdown', (e) => {
		downTime = Date.now()
		downX = e.clientX
		downY = e.clientY
	})

	stage.addEventListener('pointerup', (e) => {
		const dt = Date.now() - downTime
		const dx = Math.abs(e.clientX - downX)
		const dy = Math.abs(e.clientY - downY)

		const isTap = dt < TAP_TIME && dx < TAP_MOVE && dy < TAP_MOVE

		if (!isTap) return

		if (e.target.closest('#controls, #top-bar, .img-nav, #img-dots')) {
			return
		}

		if (e.target.closest('video')) {
			return
		}

		if (hidden) show()
		else hide()
	})

	stage.addEventListener('pointermove', () => {
		if (!hidden) scheduleHide()
	})

	stage.addEventListener(
		'touchstart',
		(e) => {
			touchStartY = e.touches[0].clientY
		},
		{ passive: true },
	)
	stage.addEventListener(
		'touchend',
		(e) => {
			const dy = e.changedTouches[0].clientY - touchStartY
			if (dy > 40) hide()
		},
		{ passive: true },
	)

	show()

	return { show, hide, setPanelOpen }
})()

/* ═══════════════════════════════════════════════════════
	MODULE: Playlist UI
	══════════════════════════════════════════════════════ */
const PlaylistUI = (() => {
	const list = document.getElementById('playlist-list')
	const title = document.getElementById('pl-title')
	let onSelect = null

	function init(tracks, names, cb) {
		onSelect = cb
		title.textContent = `Playlist · ${tracks.length} bài`

		let widget = null
		if (list.childElementCount === 1) {
			widget = list.childNodes[0]
			list.removeChild(widget)
		}

		tracks.forEach((_, i) => {
			const item = document.createElement('div')
			item.className = 'pl-item'
			item.dataset.idx = i
			const name = names[i] || nameFromURL(tracks[i].audioURL, i)
			const escapedName = escHtml(name)
			item.innerHTML = `
        <span class="pl-num">${i + 1}</span>
        <span class="pl-name" title="${escapedName}">${escapedName}</span>
      `
			item.addEventListener('click', () => onSelect && onSelect(i))
			list.appendChild(item)
		})

		widget && list.appendChild(widget)
	}

	function setActive(idx) {
		list.querySelectorAll('.pl-item').forEach((el, i) => {
			el.classList.toggle('active', i === idx)
		})
		const active = list.querySelector('.pl-item.active')
		if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
	}

	function nameFromURL(url, fallbackIdx) {
		try {
			const parts = new URL(url).pathname.split('/')
			const file = parts[parts.length - 1]
			return decodeURIComponent(file.replace(/\.[^.]+$/, '')) || `Track ${fallbackIdx + 1}`
		} catch {
			return `Track ${fallbackIdx + 1}`
		}
	}

	function escHtml(t) {
		return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	}

	return { init, setActive }
})()

/* ═══════════════════════════════════════════════════════
	MAIN PLAYER CONTROLLER
	══════════════════════════════════════════════════════ */
const Player = (() => {
	const audio = document.getElementById('audio')
	const playIcon = document.getElementById('play-icon')
	const trackTitleEl = document.getElementById('track-title')
	const trackIdxEl = document.getElementById('track-index')
	const timeCur = document.getElementById('time-cur')
	const timeEnd = document.getElementById('time-end')
	const progFill = document.getElementById('progress-fill')
	const progWrap = document.getElementById('progress-wrap')
	const floatSub = document.getElementById('float-sub')
	const floatSubText = document.getElementById('float-sub-text')
	const plPanel = document.getElementById('playlist-panel')
	const subPanel = document.getElementById('sub-panel')
	const dim = document.getElementById('dim')

	let currentIdx = 0
	let cues = []
	let activeCueIdx = -1
	let floatSubOn = true
	let plOpen = false
	let subOpen = false
	let images = []
	let tracks = []
	let trackNames = []
	let seeking = false

	// ── INIT ──────────────────────────────────────────
	function init(imgs, tks, names) {
		images = imgs
		tracks = tks
		trackNames = names

		Slideshow.init(images)
		Slideshow.initSwipe()
		PlaylistUI.init(tracks, trackNames, loadTrack)

		if (!tracks.length) return
		loadTrack(0, false, false)

		document.getElementById('img-prev').addEventListener('click', () => Slideshow.prev())
		document.getElementById('img-next').addEventListener('click', () => Slideshow.next())

		document.getElementById('btn-play').addEventListener('click', togglePlay)
		document.getElementById('btn-prev').addEventListener('click', () => loadTrack(currentIdx - 1, undefined, false))
		document.getElementById('btn-next').addEventListener('click', () => loadTrack(currentIdx + 1, undefined, false))
		document.getElementById('btn-back5').addEventListener('click', () => {
			audio.currentTime = Math.max(0, audio.currentTime - 5)
		})
		document.getElementById('btn-fwd5').addEventListener('click', () => {
			audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5)
		})
		document.getElementById('btn-rotate').addEventListener('click', () => {
			if (document.fullscreenElement) {
				if (isPortrait) {
					screen.orientation.unlock()
					screen.orientation.lock('landscape')
					isPortrait = false
					return
				}
				screen.orientation.unlock()
				screen.orientation.lock('portrait')
				isPortrait = true
			}
		})
		document.getElementById('btn-fullscreen').addEventListener('click', toggleFS)

		progWrap.addEventListener('pointerdown', onSeekStart)

		document.getElementById('btn-playlist').addEventListener('click', () => togglePanel('pl'))
		document.getElementById('btn-sub-list').addEventListener('click', () => togglePanel('sub'))
		document.getElementById('btn-float-sub').addEventListener('click', toggleFloatSub)
		document.getElementById('btn-close-pl').addEventListener('click', () => closeAllPanels())
		document.getElementById('btn-close-sub').addEventListener('click', () => closeAllPanels())
		dim.addEventListener('click', closeAllPanels)

		audio.addEventListener('timeupdate', onTimeUpdate)
		audio.addEventListener('loadedmetadata', () => {
			timeEnd.textContent = fmtTime(audio.duration)
		})
		audio.addEventListener('ended', () => {
			if (currentIdx < tracks.length - 1) loadTrack(currentIdx + 1, undefined, false)
			else setPlayIcon(false)
		})
		audio.addEventListener('play', () => setPlayIcon(true))
		audio.addEventListener('pause', () => setPlayIcon(false))

		floatSub.style.opacity = '0'

		const floatEl = document.getElementById('float-sub')
		let dragging = false,
			oy = 0

		floatEl.addEventListener('pointerdown', (e) => {
			e.stopPropagation()
			dragging = true
			floatEl.setPointerCapture(e.pointerId)
			const rect = floatEl.getBoundingClientRect()
			oy = e.clientY - rect.top
			const stageRect = document.getElementById('stage').getBoundingClientRect()
			floatEl.style.bottom = 'unset'
			floatEl.style.top = rect.top - stageRect.top + 'px'
			floatEl.style.transform = 'translateX(-50%)'
		})

		floatEl.addEventListener('pointermove', (e) => {
			if (!dragging) return
			const stage = document.getElementById('stage')
			const stageRect = stage.getBoundingClientRect()
			const maxY = stageRect.height - floatEl.offsetHeight
			const newTop = Math.max(0, Math.min(maxY, e.clientY - stageRect.top - oy))
			floatEl.style.top = newTop + 'px'
		})

		floatEl.addEventListener('pointerup', () => {
			dragging = false
		})
	}

	// ── LOAD TRACK ─────────────────────────────────────
	async function loadTrack(idx, immatePlay = true, _togglePanel = true) {
		if (!tracks.length) return
		idx = ((idx % tracks.length) + tracks.length) % tracks.length
		currentIdx = idx
		const track = tracks[idx]

		const name = trackNames[idx] || nameFromURL(track.audioURL, idx)
		trackTitleEl.textContent = name
		trackIdxEl.textContent = `${idx + 1} / ${tracks.length}`
		PlaylistUI.setActive(idx)
		progFill.style.width = '0'
		timeCur.textContent = '0:00'
		timeEnd.textContent = '0:00'
		floatSubText.textContent = ''
		cues = []
		activeCueIdx = -1
		SubtitlePanel.setCues([], null)
		_togglePanel && togglePanel('pl')

		audio.src = track.audioURL
		audio.load()
		immatePlay && audio.play().catch(() => {})

		// ── VTT: cơ chế thích nghi ──────────────────────
		if (_hasAllVtt && _allCues) {
			// Chờ duration của audio hiện tại
			const duration = await new Promise((resolve) => {
				if (isFinite(audio.duration) && audio.duration > 0) {
					resolve(audio.duration)
				} else {
					audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 0), { once: true })
					// timeout an toàn 4s
					setTimeout(() => resolve(_durationCache.get(track.audioURL) || 0), 4000)
				}
			})

			// Cache lại để computeOffset dùng, không phải probe lại
			_durationCache.set(track.audioURL, duration)

			const offset = await computeOffset(tracks, idx)
			cues = sliceCues(_allCues, offset, duration)
			SubtitlePanel.setCues(cues, seekTo)
		} else if (track.vttURL) {
			// Cơ chế cũ: file riêng từng track
			try {
				cues = await VTT.load(track.vttURL)
				SubtitlePanel.setCues(cues, seekTo)
			} catch (e) {
				console.warn('VTT load failed:', e)
			}
		}
	}

	// ── TIME UPDATE (throttled via rAF) ────────────────
	let rafScheduled = false
	function onTimeUpdate() {
		if (rafScheduled) return
		rafScheduled = true
		requestAnimationFrame(() => {
			rafScheduled = false
			if (seeking) return
			const t = audio.currentTime
			const d = audio.duration || 0

			if (d > 0) progFill.style.width = (t / d) * 100 + '%'
			timeCur.textContent = fmtTime(t)

			updateSubtitle(t)
		})
	}

	function updateSubtitle(t) {
		if (!cues.length) {
			floatSubText.textContent = ''
			return
		}

		let lo = 0,
			hi = cues.length - 1,
			found = -1
		while (lo <= hi) {
			const mid = (lo + hi) >> 1
			if (cues[mid].end <= t) lo = mid + 1
			else if (cues[mid].start > t) hi = mid - 1
			else {
				found = mid
				break
			}
		}

		const text = found >= 0 ? cues[found].text : ''
		if (floatSubOn) floatSubText.textContent = text
		floatSub.style.opacity = floatSubOn && text ? '1' : '0'

		if (found !== activeCueIdx) {
			activeCueIdx = found
			SubtitlePanel.updateActive(found)
			if (subOpen && found >= 0) SubtitlePanel.scrollToActive()
		}
	}

	// ── SEEK ───────────────────────────────────────────
	function seekTo(time) {
		audio.currentTime = time
		AutoHide.show()
	}

	function onSeekStart(e) {
		seeking = true
		doSeek(e)
		const onMove = (ev) => doSeek(ev)
		const onUp = () => {
			seeking = false
			document.removeEventListener('pointermove', onMove)
			document.removeEventListener('pointerup', onUp)
		}
		document.addEventListener('pointermove', onMove, { passive: true })
		document.addEventListener('pointerup', onUp)
	}

	function doSeek(e) {
		const rect = progWrap.getBoundingClientRect()
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
		const t = ratio * (audio.duration || 0)
		progFill.style.width = ratio * 100 + '%'
		timeCur.textContent = fmtTime(t)
		audio.currentTime = t
	}

	// ── PLAY / PAUSE ───────────────────────────────────
	function togglePlay() {
		if (audio.paused) audio.play().catch(() => {})
		else audio.pause()
	}

	function setPlayIcon(playing) {
		playIcon.innerHTML = playing
			? '<rect x="3" y="2" width="3.5" height="12"/><rect x="9.5" y="2" width="3.5" height="12"/>'
			: '<polygon points="4,2 14,8 4,14"/>'
	}

	// ── PANELS ─────────────────────────────────────────
	function togglePanel(which) {
		if (which === 'pl') {
			plOpen = !plOpen
			subOpen = false
		} else {
			subOpen = !subOpen
			plOpen = false
			if (subOpen) SubtitlePanel.scrollToActive(false)
		}
		applyPanels()
	}

	function closeAllPanels() {
		plOpen = false
		subOpen = false
		applyPanels()
	}

	function applyPanels() {
		plPanel.classList.toggle('open', plOpen)
		subPanel.classList.toggle('open', subOpen)
		dim.classList.toggle('show', plOpen || subOpen)
		document.getElementById('btn-playlist').classList.toggle('on', plOpen)
		document.getElementById('btn-sub-list').classList.toggle('on', subOpen)
		AutoHide.setPanelOpen(plOpen || subOpen)
	}

	// ── FLOAT SUBTITLE toggle ──────────────────────────
	function toggleFloatSub() {
		floatSubOn = !floatSubOn
		document.getElementById('btn-float-sub').classList.toggle('on', floatSubOn)
		if (!floatSubOn) {
			floatSub.style.opacity = '0'
		} else {
			const text = floatSubText.textContent
			floatSub.style.opacity = text ? '1' : '0'
		}
	}

	// ── UTILS ──────────────────────────────────────────
	function fmtTime(s) {
		if (!isFinite(s)) return '0:00'
		const m = Math.floor(s / 60),
			sec = Math.floor(s % 60)
		return `${m}:${String(sec).padStart(2, '0')}`
	}

	function nameFromURL(url, fallbackIdx) {
		try {
			const parts = new URL(url).pathname.split('/')
			const file = parts[parts.length - 1]
			return decodeURIComponent(file.replace(/\.[^.]+$/, '')) || `Bài ${fallbackIdx + 1}`
		} catch {
			return `Bài ${fallbackIdx + 1}`
		}
	}

	return { init, togglePanel }
})()

/* ═══════════════════════════════════════════════════════
	SETUP
	══════════════════════════════════════════════════════ */
const trackID = url.getParam('code') || url.getParam('rjcode') || '75923'
const track = await db.tracks.get(trackID.toLowerCase().includes('rj') ? trackID : +trackID)

if (!track) {
	alert('Code not found!')
}

document.title = 'Alt Player:' + track.info.code

const IMAGES = []
const TRACKS = []
const TRACK_NAMES = []

const images = [track.resource.thumbnail, ...track.resource.images]
let seen = ''
const imgPrefixes = await db.prefixies.getAll(images.map((img) => img.prefixID))
IMAGES.push(
	...images
		.map((iov, index) => {
			iov = `${imgPrefixes[index]}${iov.name}`
			if (seen.includes(iov)) return
			seen += iov

			return iov.includes('.mp4') ? { type: 'video', src: iov } : { type: 'img', src: iov }
		})
		.filter(Boolean),
)

const audios = track.resource.audios
const audPrefixes = await db.prefixies.getAll(audios.map((aud) => aud.prefixID))

audios.forEach(({ name }, index) => {
	const audioURL = `${audPrefixes[index]}${name}`
	const group = simplifyNumber(trackID)
	TRACK_NAMES.push(url.getFileNameFromUrl(audioURL))
	TRACKS.push({
		audioURL,
		vttURL: null, // sẽ được gán bên dưới nếu không có all.txt
		_vttBase: `/@descriptions/storage/${group}/${trackID}/vtt`,
		_idx: index,
	})
})

/* ═══════════════════════════════════════════════════════
	VTT ADAPTIVE: kiểm tra all.txt (1 lần)
	══════════════════════════════════════════════════════ */

const _vttBase = TRACKS[0]?._vttBase

/**
 * Cache duration đã probe, tránh load audio metadata nhiều lần.
 * Key: audioURL  →  Value: duration (giây)
 */
const _durationCache = new Map()

/** true nếu thư mục chứa all.txt thay vì các file 0.txt, 1.txt, ... */
let _hasAllVtt = false

/** Toàn bộ cues của all.txt sau khi parse (null nếu không dùng) */
let _allCues = null

if (_vttBase) {
	try {
		const res = await fetch(`${_vttBase}/all.txt`, { method: 'HEAD' })
		_hasAllVtt = res.ok
	} catch (_) {
		_hasAllVtt = false
	}
}

if (_hasAllVtt) {
	// Load và parse toàn bộ all.txt một lần duy nhất
	_allCues = await VTT.load(`${_vttBase}/all.txt`)
} else {
	// Fallback: gán vttURL riêng từng track như cơ chế cũ
	TRACKS.forEach((t) => {
		t.vttURL = `${t._vttBase}/${t._idx}.txt`
	})
}

/**
 * Probe duration của một audio URL.
 * Dùng HTMLAudioElement tạm, không ảnh hưởng player chính.
 */
function probeAudioDuration(src) {
	return new Promise((resolve) => {
		const a = new Audio()
		a.preload = 'metadata'
		a.onloadedmetadata = () => resolve(a.duration || 0)
		a.onerror = () => resolve(0)
		a.src = src
	})
}

/**
 * Lấy duration của audioURL, ưu tiên cache trước.
 */
async function getAudioDuration(audioURL) {
	if (_durationCache.has(audioURL)) return _durationCache.get(audioURL)
	const dur = await probeAudioDuration(audioURL)
	_durationCache.set(audioURL, dur)
	return dur
}

/**
 * Tính tổng duration của các track [0, targetIdx - 1].
 * Dùng Promise.all để probe song song, nhanh hơn tuần tự.
 */
async function computeOffset(tracks, targetIdx) {
	if (targetIdx === 0) return 0
	const durations = await Promise.all(tracks.slice(0, targetIdx).map((t) => getAudioDuration(t.audioURL)))
	return durations.reduce((sum, d) => sum + d, 0)
}

/**
 * Lọc cues thuộc track [offset, offset + duration),
 * rồi dịch thời gian về 0 để player hiển thị đúng.
 *
 * Dùng dung sai 0.1s ở hai đầu để không bỏ sót cue
 * nằm sát ranh giới giữa hai track.
 */
function sliceCues(allCues, offset, duration) {
	const trackEnd = offset + duration
	return allCues
		.filter((c) => c.start >= offset - 0.1 && c.start < trackEnd + 0.1)
		.map((c) => ({
			start: Math.max(0, c.start - offset),
			end: Math.max(0, c.end - offset),
			text: c.text,
		}))
		.filter((c) => c.end > c.start)
}

/* ═══════════════════════════════════════════════════════
	FULLSCREEN & FILE UPLOAD
	══════════════════════════════════════════════════════ */
let isPortrait = false
function toggleFS() {
	if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
		fullscreen.deactivate()
		screen.orientation.unlock()
		isPortrait = true
	} else {
		fullscreen.activate()
		if (device.isMobile()) screen.orientation.lock('landscape')
		isPortrait = false
	}
}

const fileInput = document.getElementById('file-input')
const btnUpload = document.getElementById('btn-upload')

btnUpload.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', () => {
	const files = [...fileInput.files]

	files.forEach((file) => {
		const url = URL.createObjectURL(file)

		if (file.type.startsWith('video')) {
			IMAGES.push({ type: 'video', src: url })
		} else {
			IMAGES.push({ type: 'img', src: url })
		}
	})

	Slideshow.init(IMAGES)
})

/* ═══════════════════════════════════════════════════════
	BOOT
	══════════════════════════════════════════════════════ */
Player.init(IMAGES, TRACKS, TRACK_NAMES)
