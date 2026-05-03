import { simplifyNumber } from '../../../@descriptions/utils.js'
import { SwipeHandler } from '../../../@src/app.materials.mjs'
import { url, fullscreen, device } from '../../../@src/app.utils.mjs'
import { database as db } from '../../../@src/database/index.mjs'

/* ═══════════════════════════════════════════════════════
	MODULE: VTT Parser
	Chuyển đổi và parse file phụ đề định dạng VTT / bracket
	══════════════════════════════════════════════════════ */
const VTT = (() => {
	/* ── Phát hiện định dạng [mm:ss.ms] ── */
	function isBracketVTT(text, checkLines = 5) {
		const re = /^\[\d{1,2}:\d{2}\.\d{2,3}\]/
		const lines = text.split(/\r?\n/).filter((l) => l.trim())
		let matches = 0
		for (let i = 0; i < Math.min(lines.length, checkLines); i++) {
			if (re.test(lines[i])) matches++
		}
		return matches >= 2
	}

	/* ── Chuyển [mm:ss.ms] → 00:mm:ss.mmm ── */
	function bracketTsToWebVTT(ts) {
		const [mm, rest] = ts.split(':')
		const [ss, ms] = rest.split('.')
		return `00:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}.${ms.padEnd(3, '0')}`
	}

	/* ── Chuyển toàn bộ bracket format → WebVTT text ── */
	function toWebVTT(text, lastDuration = 2) {
		const lines = text.split(/\r?\n/).filter((l) => l.trim())
		const raw = []

		for (const line of lines) {
			const m = line.match(/^\[(\d{1,2}:\d{2}\.\d{2,3})\]\s*(.*)$/)
			if (m) raw.push({ time: m[1], text: m[2].trim() })
		}

		const out = ['WEBVTT', '']

		for (let i = 0; i < raw.length; i++) {
			const cur = raw[i]
			if (!cur.text) continue

			const start = bracketTsToWebVTT(cur.time)
			let end = null
			let j = i + 1

			while (j < raw.length) {
				const next = raw[j]
				if (!next.text) {
					end = bracketTsToWebVTT(next.time)
					j++
					continue
				}
				if (!end) end = bracketTsToWebVTT(next.time)
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

	/* ── Chuẩn hóa timestamp về dạng HH:MM:SS,mmm ── */
	function normalizeTS(ts) {
		ts = ts.trim().replace(/\.(\d{3})/, ',$1')
		if (/^\d{2}:\d{2}[.,]\d{3}$/.test(ts)) ts = '00:' + ts
		if (/^\d{2}:\d{2}:\d{2}$/.test(ts)) ts += ',000'
		return ts
	}

	/* ── Timestamp → giây ── */
	function tsToSec(ts) {
		const m = normalizeTS(ts).match(/(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/)
		if (!m) return 0
		return (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000
	}

	/* ── Parse WebVTT text → mảng cues [{start, end, text}] ── */
	function parseCues(vttText) {
		const lines = vttText
			.replace(/^\uFEFF/, '')
			.replace(/\r/g, '')
			.replace(/\n{2,}/g, '\n')
			.split('\n')

		const cues = []
		let i = 0

		while (i < lines.length) {
			const line = lines[i].trim()

			if (!line || line === 'WEBVTT') { i++; continue }
			if (/^\d+$/.test(line))         { i++; continue }
			if (!line.includes('-->'))       { i++; continue }

			const [startRaw, endRaw] = line.split('-->').map((s) => s.trim())
			const start = tsToSec(startRaw)
			const end   = tsToSec(endRaw)
			i++

			const textLines = []
			while (i < lines.length) {
				const l = lines[i].trim()
				if (!l || l.includes('-->')) break
				if (/^\d+$/.test(l) && lines[i + 1]?.includes('-->')) break
				textLines.push(l)
				i++
			}

			const text = textLines.join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
			if (text && end > start) cues.push({ start, end, text })
		}

		return cues.sort((a, b) => a.start - b.start)
	}

	/* ── Public: fetch + parse VTT từ URL ── */
	async function load(srcUrl) {
		try {
			const res = await fetch(srcUrl)
			if (!res.ok) return []
			const text = await res.text()
			const converted = isBracketVTT(text) ? toWebVTT(text) : text
			return parseCues(converted)
		} catch (e) {
			console.warn('[VTT] load failed:', e)
			return []
		}
	}

	return { load }
})()

/* ═══════════════════════════════════════════════════════
	MODULE: Image Slideshow
	Quản lý ảnh / video nền với swipe và crossfade
	══════════════════════════════════════════════════════ */
const Slideshow = (() => {
	const bgA    = document.getElementById('bg-a')
	const bgB    = document.getElementById('bg-b')
	const dotsEl = document.getElementById('img-dots')

	bgA.addEventListener('dblclick', toggleFS)
	bgB.addEventListener('dblclick', toggleFS)

	let images      = []
	let current     = 0
	let front       = bgA
	let back        = bgB
	let swipeInited = false
	let dotEls      = []   // ref trực tiếp các dot, tránh querySelectorAll mỗi lần chuyển ảnh

	/* ── Tạo img hoặc video trong layer ── */
	function createMedia(layer, item) {
		layer.innerHTML = ''

		if (item.type === 'video') {
			const v = document.createElement('video')
			v.src         = item.src
			v.loop        = true
			v.playsInline = true
			v.controls    = true
			layer.appendChild(v)
			return v
		}

		const img = document.createElement('img')
		img.src            = item.src
		img.referrerPolicy = 'no-referrer'
		layer.appendChild(img)
		return img
	}

	/* ── Khởi tạo danh sách ảnh và render dots ── */
	function init(newImages) {
		images = newImages
		dotEls = []
		dotsEl.innerHTML = ''

		images.forEach((_, i) => {
			const d = document.createElement('div')
			d.className = 'dot' + (i === 0 ? ' active' : '')
			dotEls.push(d)
			dotsEl.appendChild(d)
		})

		if (images.length) setImage(0)
	}

	/* ── Đăng ký swipe (gọi sau init) ── */
	function initSwipe() {
		if (swipeInited) return
		swipeInited = true
		;[bgA, bgB].forEach((el) =>
			new SwipeHandler(
				el,
				() => el.scale === 1 && prev(),
				() => el.scale === 1 && next(),
			).registerEvents(),
		)
	}

	/* ── Chuyển ảnh với crossfade ── */
	function setImage(idx) {
		if (!images.length) return
		current = ((idx % images.length) + images.length) % images.length

		createMedia(back, images[current])

		back.style.opacity       = '1'
		back.style.pointerEvents = 'all'
		front.style.opacity      = '0'
		front.style.pointerEvents = 'none'
		;[front, back] = [back, front]

		// dùng ref array, không querySelectorAll
		dotEls.forEach((d, i) => d.classList.toggle('active', i === current))
	}

	const prev = () => setImage(current - 1)
	const next = () => setImage(current + 1)

	return {
		init,
		initSwipe,
		prev,
		next,
		setImage,
		getCurrent: () => current,
		isVideo:    () => images[current]?.type === 'video',
	}
})()

/* ═══════════════════════════════════════════════════════
	MODULE: SubtitlePanel
	Hiển thị danh sách phụ đề, highlight cue đang active
	══════════════════════════════════════════════════════ */
const SubtitlePanel = (() => {
	const wrap  = document.getElementById('sub-list-wrap')
	const inner = document.getElementById('sub-list-inner')
	const noSub = document.getElementById('no-sub')

	const SCROLL_IDLE_DELAY = 3000
	let userScrolling = false
	let scrollTimer   = null

	let itemEls      = []    // ref trực tiếp từng DOM element
	let activeEl     = null  // ref element đang active
	let activeCueIdx = -1
	let onClickCb    = null

	wrap.addEventListener('scroll', () => {
		userScrolling = true
		clearTimeout(scrollTimer)
		scrollTimer = setTimeout(() => { userScrolling = false }, SCROLL_IDLE_DELAY)
	})

	/* ── Build DOM từ mảng cues ── */
	function setCues(cues, onClickFn) {
		onClickCb    = onClickFn
		activeCueIdx = -1
		activeEl     = null
		itemEls      = []
		inner.innerHTML = ''
		noSub.style.display = cues.length ? 'none' : 'flex'

		if (!cues.length) return

		const frag = document.createDocumentFragment()

		cues.forEach((c) => {
			const el = document.createElement('div')
			el.className = 'sub-item'
			el.innerHTML = `<span class="sub-ts">${fmtTime(c.start)}</span><span class="sub-txt">${escHtml(c.text)}</span>`
			el.addEventListener('click', () => {
				userScrolling = false
				onClickCb?.(c.start)
			})
			itemEls.push(el)
			frag.appendChild(el)
		})

		inner.appendChild(frag)
	}

	/* ── Cập nhật cue active — O(1), không querySelector ── */
	function updateActive(idx) {
		if (idx === activeCueIdx) return
		activeEl?.classList.remove('active')
		activeCueIdx = idx
		activeEl     = idx >= 0 ? (itemEls[idx] ?? null) : null
		activeEl?.classList.add('active')
	}

	/* ── Scroll đến cue active bên trong wrap
		 deferred=true : double-rAF để đợi CSS transition panel xong
		 deferred=false : scroll ngay (panel đang mở, hoặc scroll ngầm) ── */
	function scrollToActive(smooth = true, deferred = false) {
		if (!activeEl || userScrolling) return
		const doScroll = () => {
			if (!activeEl) return
			const itemTop   = activeEl.offsetTop
			const itemH     = activeEl.offsetHeight
			const wrapH     = wrap.clientHeight
			const scrollTop = wrap.scrollTop
			if (itemTop < scrollTop || itemTop + itemH > scrollTop + wrapH) {
				wrap.scrollTo({ top: itemTop - wrapH / 2 + itemH / 2, behavior: smooth ? 'smooth' : 'auto' })
			}
		}
		deferred
			? requestAnimationFrame(() => requestAnimationFrame(doScroll))
			: doScroll()
	}

	function fmtTime(s) {
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
	}
	function escHtml(t) {
		return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	}

	return { setCues, updateActive, scrollToActive }
})()

/* ═══════════════════════════════════════════════════════
	MODULE: AutoHide
	Tự ẩn/hiện thanh điều khiển khi tap / swipe
	══════════════════════════════════════════════════════ */
const AutoHide = (() => {
	const stage  = document.getElementById('stage')
	const allUi  = [
		document.getElementById('controls'),
		document.getElementById('top-bar'),
		document.getElementById('img-prev'),
		document.getElementById('img-next'),
		document.getElementById('img-dots'),
	]

	const TAP_TIME = 150
	const TAP_MOVE = 10

	let hidden      = false
	let panelOpen   = false
	let downTime    = 0
	let downX       = 0
	let downY       = 0
	let touchStartY = 0

	function show() {
		hidden = false
		allUi.forEach((e) => e.classList.remove('hidden'))
	}

	function hide() {
		if (panelOpen) return
		hidden = true
		allUi.forEach((e) => e.classList.add('hidden'))
	}

	function setPanelOpen(open) {
		panelOpen = open
		if (open) show()
	}

	stage.addEventListener('pointerdown', (e) => {
		downTime = Date.now()
		downX    = e.clientX
		downY    = e.clientY
	})

	stage.addEventListener('pointerup', (e) => {
		const isTap =
			Date.now() - downTime < TAP_TIME &&
			Math.abs(e.clientX - downX) < TAP_MOVE &&
			Math.abs(e.clientY - downY) < TAP_MOVE

		if (!isTap) return
		if (e.target.closest('#controls, #top-bar, .img-nav, #img-dots')) return
		if (e.target.closest('video')) return

		hidden ? show() : hide()
	})

	stage.addEventListener('touchstart', (e) => {
		touchStartY = e.touches[0].clientY
	}, { passive: true })

	stage.addEventListener('touchend', (e) => {
		if (e.changedTouches[0].clientY - touchStartY > 40) hide()
	}, { passive: true })

	show()

	return { show, hide, setPanelOpen }
})()

/* ═══════════════════════════════════════════════════════
	MODULE: PlaylistUI
	Render danh sách track, highlight track đang phát
	══════════════════════════════════════════════════════ */
const PlaylistUI = (() => {
	const list    = document.getElementById('playlist-list')
	const titleEl = document.getElementById('pl-title')

	let onSelectCb = null
	let plItemEls  = []   // ref trực tiếp các item, tránh querySelectorAll mỗi lần setActive
	let activePlEl = null

	function init(tracks, names, onSelectFn) {
		onSelectCb = onSelectFn
		plItemEls  = []
		activePlEl = null
		titleEl.textContent = `Playlist · ${tracks.length} bài`

		// Giữ lại widget nếu có (phần tử đầu tiên duy nhất)
		let widget = null
		if (list.childElementCount === 1) {
			widget = list.firstChild
			list.removeChild(widget)
		}

		tracks.forEach((track, i) => {
			const name = names[i] || nameFromURL(track.audioURL, i)
			const item = document.createElement('div')
			item.className   = 'pl-item'
			item.dataset.idx = i
			item.innerHTML   = `
				<span class="pl-num">${i + 1}</span>
				<span class="pl-name" title="${escHtml(name)}">${escHtml(name)}</span>
			`
			item.addEventListener('click', () => onSelectCb?.(i))
			plItemEls.push(item)
			list.appendChild(item)
		})

		if (widget) list.appendChild(widget)
	}

	/* ── O(1): ref trực tiếp, không querySelectorAll ── */
	function setActive(idx) {
		activePlEl?.classList.remove('active')
		activePlEl = plItemEls[idx] ?? null
		activePlEl?.classList.add('active')
		activePlEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
	}

	function nameFromURL(audioUrl, fallbackIdx) {
		try {
			const parts = new URL(audioUrl).pathname.split('/')
			const file  = parts[parts.length - 1]
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
	MODULE: VTT Adaptive
	Quản lý logic probe duration + slice cues cho all.txt
	══════════════════════════════════════════════════════ */
const VTTAdaptive = (() => {
	const durationCache = new Map()

	let hasAllVtt = false
	let allCues   = null

	/* ── Probe 1 audio element, giải phóng ngay sau khi xong ── */
	function probeDuration(src) {
		return new Promise((resolve) => {
			const a = new Audio()
			a.preload          = 'metadata'
			a.onloadedmetadata = () => { resolve(a.duration || 0); a.src = '' }
			a.onerror          = () => { resolve(0);               a.src = '' }
			a.src = src
		})
	}

	/* ── Lấy duration, ưu tiên cache ── */
	async function getDuration(audioURL) {
		if (durationCache.has(audioURL)) return durationCache.get(audioURL)
		const dur = await probeDuration(audioURL)
		durationCache.set(audioURL, dur)
		return dur
	}

	/* ── Probe tuần tự — chỉ 1 Audio element trong RAM tại 1 thời điểm ── */
	async function computeOffset(tracks, targetIdx) {
		let offset = 0
		for (let i = 0; i < targetIdx; i++) {
			offset += await getDuration(tracks[i].audioURL)
		}
		return offset
	}

	/* ── Lọc và shift cues về offset 0 cho từng track ── */
	function sliceCues(offset, duration) {
		if (!allCues) return []
		const trackEnd = offset + duration
		return allCues
			.filter((c) => c.start >= offset - 0.1 && c.start < trackEnd + 0.1)
			.map((c) => ({
				start: Math.max(0, c.start - offset),
				end:   Math.max(0, c.end   - offset),
				text:  c.text,
			}))
			.filter((c) => c.end > c.start)
	}

	/* ── Khởi tạo: thử load all.txt ── */
	async function init(vttBase) {
		if (!vttBase) return
		allCues   = await VTT.load(`${vttBase}/all.txt`)
		hasAllVtt = allCues.length > 0
	}

	/* ── Load cues cho một track cụ thể ── */
	async function loadForTrack(track, tracks, idx) {
		if (hasAllVtt) {
			// getDuration đã tự cache nội bộ, không cần set lại
			const duration = await getDuration(track.audioURL)
			const offset   = await computeOffset(tracks, idx)
			return sliceCues(offset, duration)
		}

		if (track.vttURL) return VTT.load(track.vttURL)

		return []
	}

	/* ── Cache duration từ audio element chính khi loadedmetadata ── */
	function cacheDuration(audioURL, duration) {
		durationCache.set(audioURL, duration)
	}

	return { init, loadForTrack, cacheDuration, isAllVtt: () => hasAllVtt }
})()

/* ═══════════════════════════════════════════════════════
	MAIN PLAYER CONTROLLER
	══════════════════════════════════════════════════════ */
const Player = (() => {
	/* ── DOM refs ── */
	const audio        = document.getElementById('audio')
	const playIcon     = document.getElementById('play-icon')
	const trackTitleEl = document.getElementById('track-title')
	const trackIdxEl   = document.getElementById('track-index')
	const timeCur      = document.getElementById('time-cur')
	const timeEnd      = document.getElementById('time-end')
	const progFill     = document.getElementById('progress-fill')
	const progWrap     = document.getElementById('progress-wrap')
	const floatSub     = document.getElementById('float-sub')
	const floatSubText = document.getElementById('float-sub-text')
	const plPanel      = document.getElementById('playlist-panel')
	const subPanel     = document.getElementById('sub-panel')
	const dim          = document.getElementById('dim')
	const stage        = document.getElementById('stage')

	/* ── State ── */
	let tracks       = []
	let trackNames   = []
	let currentIdx   = 0
	let cues         = []
	let activeCueIdx = -1
	let floatSubOn   = true
	let plOpen       = false
	let subOpen      = false
	let seeking      = false
	let rafScheduled = false
	let isPortrait   = false

	/* ── Init ── */
	function init(images, tks, names) {
		tracks     = tks
		trackNames = names

		Slideshow.init(images)
		Slideshow.initSwipe()
		PlaylistUI.init(tracks, trackNames, loadTrack)

		if (!tracks.length) return

		_bindButtons()
		loadTrack(0, false, false)
	}

	function _bindButtons() {
		document.getElementById('img-prev').addEventListener('click', () => Slideshow.prev())
		document.getElementById('img-next').addEventListener('click', () => Slideshow.next())

		document.getElementById('btn-play') .addEventListener('click', togglePlay)
		document.getElementById('btn-prev') .addEventListener('click', () => loadTrack(currentIdx - 1, undefined, false))
		document.getElementById('btn-next') .addEventListener('click', () => loadTrack(currentIdx + 1, undefined, false))
		document.getElementById('btn-back5').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 5) })
		document.getElementById('btn-fwd5') .addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5) })

		document.getElementById('btn-rotate')    .addEventListener('click', rotateOrientation)
		document.getElementById('btn-fullscreen').addEventListener('click', toggleFS)

		progWrap.addEventListener('pointerdown', onSeekStart)

		document.getElementById('btn-playlist') .addEventListener('click', () => togglePanel('pl'))
		document.getElementById('btn-sub-list') .addEventListener('click', () => togglePanel('sub'))
		document.getElementById('btn-float-sub').addEventListener('click', toggleFloatSub)
		document.getElementById('btn-close-pl') .addEventListener('click', closeAllPanels)
		document.getElementById('btn-close-sub').addEventListener('click', closeAllPanels)
		dim.addEventListener('click', closeAllPanels)

		audio.addEventListener('timeupdate',     onTimeUpdate)
		audio.addEventListener('loadedmetadata', onMetadataLoaded)
		audio.addEventListener('ended',          onTrackEnded)
		audio.addEventListener('play',           () => setPlayIcon(true))
		audio.addEventListener('pause',          () => setPlayIcon(false))

		_bindFloatSubDrag()
	}

	/* ── Float subtitle — draggable ── */
	function _bindFloatSubDrag() {
		let dragging  = false
		let offsetY   = 0
		let stageH    = 0   // cache tại pointerdown, không đọc lại trong pointermove
		let stageTop  = 0   // cache tại pointerdown — đúng kể cả trong iframe / sau xoay màn hình
		let subH      = 0

		floatSub.style.opacity = '0'

		floatSub.addEventListener('pointerdown', (e) => {
			e.stopPropagation()
			dragging = true
			floatSub.setPointerCapture(e.pointerId)

			const rect      = floatSub.getBoundingClientRect()
			const stageRect = stage.getBoundingClientRect()

			stageH   = stageRect.height      // cache
			stageTop = stageRect.top         // cache
			subH     = floatSub.offsetHeight // cache
			offsetY  = e.clientY - rect.top

			floatSub.style.bottom    = 'unset'
			floatSub.style.top       = (rect.top - stageTop) + 'px'
			floatSub.style.transform = 'translateX(-50%)'
		})

		floatSub.addEventListener('pointermove', (e) => {
			if (!dragging) return
			const newTop = Math.max(0, Math.min(stageH - subH, e.clientY - stageTop - offsetY))
			floatSub.style.top = newTop + 'px'
		})

		floatSub.addEventListener('pointerup', () => { dragging = false })
	}

	/* ── Load track ── */
	async function loadTrack(idx, autoPlay = true, closePl = true) {
		if (!tracks.length) return
		idx = ((idx % tracks.length) + tracks.length) % tracks.length
		currentIdx = idx

		const track = tracks[idx]
		const name  = trackNames[idx] || _nameFromURL(track.audioURL, idx)

		trackTitleEl.textContent = name
		trackIdxEl.textContent   = `${idx + 1} / ${tracks.length}`
		progFill.style.width     = '0'
		timeCur.textContent      = '0:00'
		timeEnd.textContent      = '0:00'
		floatSubText.textContent = ''
		cues                     = []
		activeCueIdx             = -1
		SubtitlePanel.setCues([], null)

		PlaylistUI.setActive(idx)
		if (closePl) togglePanel('pl')

		audio.src = track.audioURL
		audio.load()
		if (autoPlay) audio.play().catch(() => {})

		cues = await VTTAdaptive.loadForTrack(track, tracks, idx)
		SubtitlePanel.setCues(cues, seekTo)
	}

	/* ── Audio events ── */
	function onMetadataLoaded() {
		timeEnd.textContent = fmtTime(audio.duration)
		VTTAdaptive.cacheDuration(tracks[currentIdx].audioURL, audio.duration)
	}

	function onTrackEnded() {
		if (currentIdx < tracks.length - 1) loadTrack(currentIdx + 1, undefined, false)
		else setPlayIcon(false)
	}

	/* ── Time update throttled qua rAF ── */
	function onTimeUpdate() {
		if (rafScheduled) return
		rafScheduled = true
		requestAnimationFrame(_onRaf)
	}

	function _onRaf() {
		rafScheduled = false
		if (seeking) return

		const t = audio.currentTime
		const d = audio.duration || 0

		if (d > 0) progFill.style.width = (t / d) * 100 + '%'
		timeCur.textContent = fmtTime(t)

		_updateSubtitle(t)
	}

	/* ── Cập nhật phụ đề ── */
	function _updateSubtitle(t) {
		if (!cues.length) {
			if (floatSubText.textContent) floatSubText.textContent = ''
			floatSub.style.opacity = '0'
			return
		}

		let lo = 0, hi = cues.length - 1, found = -1
		while (lo <= hi) {
			const mid = (lo + hi) >> 1
			if      (cues[mid].end   <= t) lo = mid + 1
			else if (cues[mid].start >  t) hi = mid - 1
			else { found = mid; break }
		}

		const text = found >= 0 ? cues[found].text : ''

		if (floatSubOn && floatSubText.textContent !== text) floatSubText.textContent = text
		floatSub.style.opacity = floatSubOn && text ? '1' : '0'

		if (found !== activeCueIdx) {
			activeCueIdx = found
			SubtitlePanel.updateActive(found)
			if (found >= 0) SubtitlePanel.scrollToActive()  // scroll dù panel đóng hay mở
		}
	}

	/* ── Seek ── */
	function seekTo(time) {
		audio.currentTime = time
		AutoHide.show()
	}

	function onSeekStart(e) {
		seeking = true
		_doSeek(e)
		const onMove = (ev) => _doSeek(ev)
		const onUp   = () => {
			seeking = false
			document.removeEventListener('pointermove', onMove)
			document.removeEventListener('pointerup',   onUp)
		}
		document.addEventListener('pointermove', onMove, { passive: true })
		document.addEventListener('pointerup',   onUp)
	}

	function _doSeek(e) {
		const rect  = progWrap.getBoundingClientRect()
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
		const t     = ratio * (audio.duration || 0)
		progFill.style.width = ratio * 100 + '%'
		timeCur.textContent  = fmtTime(t)
		audio.currentTime    = t
	}

	/* ── Play / Pause ── */
	function togglePlay() {
		audio.paused ? audio.play().catch(() => {}) : audio.pause()
	}

	function setPlayIcon(playing) {
		playIcon.innerHTML = playing
			? '<rect x="3" y="2" width="3.5" height="12"/><rect x="9.5" y="2" width="3.5" height="12"/>'
			: '<polygon points="4,2 14,8 4,14"/>'
	}

	/* ── Panels ── */
	function togglePanel(which) {
		if (which === 'pl') { plOpen = !plOpen; subOpen = false  }
		else                { subOpen = !subOpen; plOpen = false }
		_applyPanels()
		if (subOpen) SubtitlePanel.scrollToActive(false, true)
	}

	function closeAllPanels() {
		plOpen  = false
		subOpen = false
		_applyPanels()
	}

	function _applyPanels() {
		plPanel .classList.toggle('open', plOpen)
		subPanel.classList.toggle('open', subOpen)
		dim     .classList.toggle('show', plOpen || subOpen)
		document.getElementById('btn-playlist').classList.toggle('on', plOpen)
		document.getElementById('btn-sub-list').classList.toggle('on', subOpen)
		AutoHide.setPanelOpen(plOpen || subOpen)
	}

	/* ── Float subtitle toggle ── */
	function toggleFloatSub() {
		floatSubOn = !floatSubOn
		document.getElementById('btn-float-sub').classList.toggle('on', floatSubOn)
		floatSub.style.opacity = floatSubOn && floatSubText.textContent ? '1' : '0'
	}

	/* ── Orientation khi fullscreen ── */
	function rotateOrientation() {
		if (!document.fullscreenElement) return
		if (isPortrait) {
			screen.orientation.unlock()
			screen.orientation.lock('landscape')
			isPortrait = false
		} else {
			screen.orientation.unlock()
			screen.orientation.lock('portrait')
			isPortrait = true
		}
	}

	/* ── Utils ── */
	function fmtTime(s) {
		if (!isFinite(s)) return '0:00'
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
	}

	function _nameFromURL(audioUrl, fallbackIdx) {
		try {
			const parts = new URL(audioUrl).pathname.split('/')
			const file  = parts[parts.length - 1]
			return decodeURIComponent(file.replace(/\.[^.]+$/, '')) || `Bài ${fallbackIdx + 1}`
		} catch {
			return `Bài ${fallbackIdx + 1}`
		}
	}

	return { init }
})()

/* ═══════════════════════════════════════════════════════
	SETUP: Load dữ liệu track từ database
	══════════════════════════════════════════════════════ */
const trackID = url.getParam('code') || url.getParam('rjcode') || '75923'
const track   = await db.tracks.get(trackID.toLowerCase().includes('rj') ? trackID : +trackID)

if (!track) alert('Code not found!')

document.title = 'Alt Player:' + track.info.code

/* ── Build IMAGES ── */
const IMAGES      = []
const rawImages   = [track.resource.thumbnail, ...track.resource.images]
const imgPrefixes = await db.prefixies.getAll(rawImages.map((img) => img.prefixID))

const seen = new Set()
rawImages.forEach((iov, i) => {
	const src = `${imgPrefixes[i]}${iov.name}`
	if (seen.has(src)) return
	seen.add(src)
	IMAGES.push(src.includes('.mp4') ? { type: 'video', src } : { type: 'img', src })
})

/* ── Build TRACKS ── */
const TRACKS      = []
const TRACK_NAMES = []
const audios      = track.resource.audios
const audPrefixes = await db.prefixies.getAll(audios.map((aud) => aud.prefixID))

audios.forEach(({ name }, i) => {
	const audioURL = `${audPrefixes[i]}${name}`
	const group    = simplifyNumber(trackID)
	TRACKS.push({
		audioURL,
		vttURL:   null,
		_vttBase: `/@descriptions/storage/${group}/${trackID}/vtt`,
		_idx:     i,
	})
	TRACK_NAMES.push(url.getFileNameFromUrl(audioURL))
})

/* ── VTT Adaptive: thử load all.txt, fallback về file riêng ── */
await VTTAdaptive.init(TRACKS[0]?._vttBase)

if (!VTTAdaptive.isAllVtt()) {
	TRACKS.forEach((t) => { t.vttURL = `${t._vttBase}/${t._idx}.txt` })
}

/* ═══════════════════════════════════════════════════════
	FULLSCREEN
	══════════════════════════════════════════════════════ */
function toggleFS() {
	const inFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement
	if (inFS) {
		fullscreen.deactivate()
		screen.orientation.unlock()
	} else {
		fullscreen.activate()
		if (device.isMobile()) screen.orientation.lock('landscape')
	}
}

/* ═══════════════════════════════════════════════════════
	FILE UPLOAD
	══════════════════════════════════════════════════════ */
document.getElementById('btn-upload').addEventListener('click', () => {
	document.getElementById('file-input').click()
})

document.getElementById('file-input').addEventListener('change', (e) => {
	const objectUrls = []

	;[...e.target.files].forEach((file) => {
		const objectUrl = URL.createObjectURL(file)
		objectUrls.push(objectUrl)
		IMAGES.push(file.type.startsWith('video') ? { type: 'video', src: objectUrl } : { type: 'img', src: objectUrl })
	})

	Slideshow.init(IMAGES)

	// revoke sau 1 tick để browser kịp gán src vào img/video element
	setTimeout(() => objectUrls.forEach((u) => URL.revokeObjectURL(u)), 100)
})

/* ═══════════════════════════════════════════════════════
	BOOT
	══════════════════════════════════════════════════════ */
Player.init(IMAGES, TRACKS, TRACK_NAMES)
