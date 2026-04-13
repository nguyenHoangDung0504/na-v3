import { simplifyNumber } from '../../../@descriptions/utils.js'
import { SwipeHandler } from '../../../@src/app.materials.mjs'
import { url, fullscreen, device } from '../../../@src/app.utils.mjs'
import { database as db } from '../../../@src/database/index.mjs'

/* ═══════════════════════════════════════════════════════
	MODULE: VTT Parser  (từ code gốc của bạn)
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

	// 🔥 FIXED: hỗ trợ dòng rỗng làm end
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

			// 🔥 ưu tiên dòng rỗng làm end
			while (j < cuesRaw.length) {
				const next = cuesRaw[j]

				if (!next.text) {
					end = parseTimestamp(next.time)
					j++
					continue
				}

				// fallback nếu không có dòng rỗng
				if (!end) end = parseTimestamp(next.time)
				break
			}

			// fallback cuối file
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

	// ─────────────────────────────────────────────

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

	// 🔥 ROBUST PARSER
	function parseCues(vttText) {
		vttText = vttText
			.replace(/^\uFEFF/, '')
			.replace(/\r/g, '')
			.replace(/\n{2,}/g, '\n') // fix broken spacing

		const lines = vttText.split('\n')
		const cues = []

		let i = 0
		while (i < lines.length) {
			let line = lines[i].trim()

			if (!line || line === 'WEBVTT') {
				i++
				continue
			}

			// skip index
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

				// detect index của cue tiếp theo
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

		// optional: sort nếu file lỗi
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
	// ImageDisplayer
	const bgA = document.getElementById('bg-a')
	const bgB = document.getElementById('bg-b')
	bgA.addEventListener('dblclick', toggleFS)
	bgB.addEventListener('dblclick', toggleFS)

	const dotsEl = document.getElementById('img-dots')
	let current = 0
	let front = bgA // front layer
	let back = bgB
	let setImageVersion = 0

	// Lấy hoặc tạo <img> bên trong một layer
	function getImg(layer) {
		let img = layer.querySelector('img')
		if (!img) {
			img = document.createElement('img')
			layer.appendChild(img)
		}
		return img
	}

	function init(images) {
		dotsEl.innerHTML = ''
		images.forEach((_, i) => {
			const d = document.createElement('div')
			d.className = 'dot' + (i === 0 ? ' active' : '')
			dotsEl.appendChild(d)
		})
		if (images.length) setImage(0, images)
		;[bgA, bgB].forEach((ele) =>
			new SwipeHandler(
				ele,
				() => ele.scale === 1 && prev(images),
				() => ele.scale === 1 && next(images),
			).registerEvents(),
		)
	}

	function setImage(idx, images) {
		if (!images.length) return
		current = ((idx % images.length) + images.length) % images.length
		++setImageVersion

		const img = getImg(back)
		img.src = images[current] // bắt đầu tải, không chờ

		// Swap layer ngay lập tức
		back.style.opacity = '1'
		back.style.pointerEvents = 'all'
		front.style.opacity = '0'
		front.style.pointerEvents = 'none'
		;[front, back] = [back, front]

		const dots = dotsEl.querySelectorAll('.dot')
		dots.forEach((d, i) => d.classList.toggle('active', i === current))
	}
	// function setImage(idx, images) {
	// 	if (!images.length) return
	// 	current = ((idx % images.length) + images.length) % images.length

	// 	const targetVersion = ++setImageVersion // ← thêm

	// 	const img = getImg(back)

	// 	// Bọc toàn bộ phần swap vào callback load
	// 	img.onload = img.onerror = () => {
	// 		if (targetVersion !== setImageVersion) return

	// 		back.style.opacity = '1'
	// 		back.style.pointerEvents = 'all'
	// 		front.style.opacity = '0'
	// 		front.style.pointerEvents = 'none'
	// 		;[front, back] = [back, front]

	// 		const dots = dotsEl.querySelectorAll('.dot')
	// 		dots.forEach((d, i) => d.classList.toggle('active', i === current))
	// 	}

	// 	img.src = images[current] // ← gán src ở cuối
	// }

	function prev(images) {
		setImage(current - 1, images)
	}
	function next(images) {
		setImage(current + 1, images)
	}
	function getCurrent() {
		return current
	}

	return { init, prev, next, getCurrent, setImage }
})()

/* ═══════════════════════════════════════════════════════
           MODULE: Subtitle – flow layout (không virtual scroll)
           ══════════════════════════════════════════════════════ */
const SubtitlePanel = (() => {
	const wrap = document.getElementById('sub-list-wrap')
	const inner = document.getElementById('sub-list-inner')
	const noSub = document.getElementById('no-sub')

	let userScrolling = false
	let scrollTimer = null
	const SCROLL_IDLE_DELAY = 3000 // 3s

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
		inner.style.height = '' // xóa height cố định nếu còn sót
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
		// Bỏ active cũ
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

		// FIX: đang scroll thì không auto
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
	const DELAY = 2000 // ms
	let timer = null
	let hidden = false
	let panelOpen = false
	let touchStartY = 0

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
		clearTimeout(timer)
		timer = setTimeout(hide, DELAY)
	}

	function setPanelOpen(open) {
		panelOpen = open
		if (!open) scheduleHide()
		else {
			clearTimeout(timer)
			show()
		}
	}

	// Mouse move / touch → show
	const stage = document.getElementById('stage')
	stage.addEventListener('pointermove', () => {
		if (hidden) show()
		else scheduleHide()
	})
	stage.addEventListener('pointerdown', () => {
		if (hidden) show()
	})

	// Vuốt xuống → ẩn
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

	// Bắt đầu: show rồi tự hide
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
		list.innerHTML = ''
		tracks.forEach((_, i) => {
			const item = document.createElement('div')
			item.className = 'pl-item'
			item.dataset.idx = i
			const name = names[i] || nameFromURL(tracks[i].audioURL, i)
			item.innerHTML = `
        <span class="pl-num">${i + 1}</span>
        <span class="pl-name">${escHtml(name)}</span>
      `
			item.addEventListener('click', () => onSelect && onSelect(i))
			list.appendChild(item)
		})
	}

	function setActive(idx) {
		list.querySelectorAll('.pl-item').forEach((el, i) => {
			el.classList.toggle('active', i === idx)
		})
		// Scroll active into view
		const active = list.querySelector('.pl-item.active')
		if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
		PlaylistUI.init(tracks, trackNames, loadTrack)

		if (!tracks.length) return
		loadTrack(0)

		// Image nav
		document.getElementById('img-prev').addEventListener('click', () => Slideshow.prev(images))
		document.getElementById('img-next').addEventListener('click', () => Slideshow.next(images))

		// Controls
		document.getElementById('btn-play').addEventListener('click', togglePlay)
		document.getElementById('btn-prev').addEventListener('click', () => loadTrack(currentIdx - 1))
		document.getElementById('btn-next').addEventListener('click', () => loadTrack(currentIdx + 1))
		document.getElementById('btn-back5').addEventListener('click', () => {
			audio.currentTime = Math.max(0, audio.currentTime - 5)
		})
		document.getElementById('btn-fwd5').addEventListener('click', () => {
			audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5)
		})
		document.getElementById('btn-reload').addEventListener('click', () => {
			audio.currentTime = 0
			audio.play()
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

		// Progress bar – drag/click
		progWrap.addEventListener('pointerdown', onSeekStart)

		// Top bar pills
		document.getElementById('btn-playlist').addEventListener('click', () => togglePanel('pl'))
		document.getElementById('btn-sub-list').addEventListener('click', () => togglePanel('sub'))
		document.getElementById('btn-float-sub').addEventListener('click', toggleFloatSub)
		document.getElementById('btn-close-pl').addEventListener('click', () => closeAllPanels())
		document.getElementById('btn-close-sub').addEventListener('click', () => closeAllPanels())
		dim.addEventListener('click', closeAllPanels)

		// Audio events
		audio.addEventListener('timeupdate', onTimeUpdate)
		audio.addEventListener('loadedmetadata', () => {
			timeEnd.textContent = fmtTime(audio.duration)
		})
		audio.addEventListener('ended', () => {
			if (currentIdx < tracks.length - 1) loadTrack(currentIdx + 1)
			else setPlayIcon(false)
		})
		audio.addEventListener('play', () => setPlayIcon(true))
		audio.addEventListener('pause', () => setPlayIcon(false))

		// Khởi tạo là 0 vì mới vào chưa hiện
		floatSub.style.opacity = '0'

		// Draggable floating subtitle
		const floatEl = document.getElementById('float-sub')
		let dragging = false,
			oy = 0

		// Chỉ drag theo trục Y, X luôn giữ center
		floatEl.addEventListener('pointerdown', (e) => {
			e.stopPropagation()
			dragging = true
			floatEl.setPointerCapture(e.pointerId)
			// Tính offset Y từ vị trí hiện tại
			const rect = floatEl.getBoundingClientRect()
			oy = e.clientY - rect.top
			// Ghi lại top hiện tại để drag tính từ đó
			const stageRect = document.getElementById('stage').getBoundingClientRect()
			floatEl.style.bottom = 'unset'
			floatEl.style.top = rect.top - stageRect.top + 'px'
			floatEl.style.transform = 'translateX(-50%)' // giữ X căn giữa
		})

		floatEl.addEventListener('pointermove', (e) => {
			if (!dragging) return
			const stage = document.getElementById('stage')
			const stageRect = stage.getBoundingClientRect()
			const maxY = stageRect.height - floatEl.offsetHeight
			const newTop = Math.max(0, Math.min(maxY, e.clientY - stageRect.top - oy))
			floatEl.style.top = newTop + 'px'
			// KHÔNG động vào left / transform → X vẫn căn giữa
		})

		floatEl.addEventListener('pointerup', () => {
			dragging = false
		})
	}

	// ── LOAD TRACK ─────────────────────────────────────
	async function loadTrack(idx) {
		if (!tracks.length) return
		idx = ((idx % tracks.length) + tracks.length) % tracks.length
		currentIdx = idx
		const track = tracks[idx]

		// Update UI
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

		// Load audio
		audio.src = track.audioURL
		audio.load()

		// Load VTT
		if (track.vttURL) {
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

			// Progress bar
			if (d > 0) progFill.style.width = (t / d) * 100 + '%'
			timeCur.textContent = fmtTime(t)

			// Subtitle
			updateSubtitle(t)
		})
	}

	function updateSubtitle(t) {
		if (!cues.length) {
			floatSubText.textContent = ''
			return
		}

		// Binary search cho cue hiện tại
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
			// Bật lại → cập nhật ngay theo cue hiện tại
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

	return { init }
})()

const trackID = url.getParam('code') || url.getParam('rjcode') || '75923'
const track = await db.tracks.get(trackID.toLowerCase().includes('rj') ? trackID : +trackID)

if (!track) {
	alert('Code not found!')
}

document.title = 'Alt Player:' + track.info.code

/* ═══════════════════════════════════════════════════════
TODO
1. IMAGES – mảng URL ảnh minh họa (dùng chung cho tất cả bài)
2. TRACKS – mảng { audioURL, vttURL } theo thứ tự playlist
══════════════════════════════════════════════════════ */

const IMAGES = [
	// TODO: thêm link ảnh vào đây
	// Ví dụ:
	// 'https://example.com/img1.jpg',
	// 'https://example.com/img2.jpg',
]

const TRACKS = [
	// TODO: thêm các track vào đây
	// Ví dụ:
	// { audioURL: 'https://example.com/audio1.mp3', vttURL: 'https://example.com/audio1.vtt' },
	// { audioURL: 'https://example.com/audio2.mp3', vttURL: null },
]

// TODO (tuỳ chọn): tên hiển thị cho từng track – nếu để rỗng sẽ dùng tên file
const TRACK_NAMES = [
	// 'Bài 1 · Chào hỏi',
	// 'Bài 2 · Số đếm',
]

const images = [track.resource.thumbnail, ...track.resource.images]
let seen = ''
const imgPrefixes = await db.prefixies.getAll(images.map((img) => img.prefixID))
IMAGES.push(
	...images
		.map((iov, index) => {
			iov = `${imgPrefixes[index]}${iov.name}`
			if (seen.includes(iov)) return
			seen += iov
			return iov.includes('.mp4') ? undefined : iov
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
		vttURL: `/@descriptions/storage/${group}/${trackID}/vtt/${index}.txt`,
	})
})

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

/* ═══════════════════════════════════════════════════════
	BOOT
	══════════════════════════════════════════════════════ */
Player.init(IMAGES, TRACKS, TRACK_NAMES)
