// ================= CONFIG =================
const MS_TO_WEBVTT = (ms) => {
	const h = Math.floor(ms / 3600000)
	const m = Math.floor((ms % 3600000) / 60000)
	const s = Math.floor((ms % 60000) / 1000)
	const ms2 = ms % 1000
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms2).padStart(3, '0')}`
}

const taskId = new URLSearchParams(location.search).get('task-id')
if (!taskId) throw new Error('Không tìm thấy task-id trong URL')

// ================= UI =================
const panel = document.createElement('div')
panel.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  width: 860px;
  height: 60vh;
  background: #111;
  color: #4ab0ff;
  z-index: 999999;
  border: 2px solid #4ab0ff;
  font-family: monospace;
  display: flex;
  flex-direction: column;
`

const header = document.createElement('div')
header.style.cssText = `padding: 6px; background: #000; display: flex; gap: 6px; align-items: center;`

const makeBtn = (label) => {
	const b = document.createElement('button')
	b.textContent = label
	b.style.cssText = `flex: 1; cursor: pointer; font-weight: bold; padding: 4px;`
	return b
}

const btnCopyOrigin = makeBtn('COPY Origin')
const btnCopyTranslation = makeBtn('COPY Translation')
const btnClose = makeBtn('CLOSE')
const statusLabel = document.createElement('span')
statusLabel.style.cssText = `font-size: 11px; margin-left: 4px; color: #aaa; white-space: nowrap;`
statusLabel.textContent = `Fetching task ${taskId}...`

header.append(btnCopyOrigin, btnCopyTranslation, btnClose, statusLabel)

const body = document.createElement('div')
body.style.cssText = `flex: 1; display: flex; overflow: hidden;`

const makePane = (color, labelText) => {
	const wrap = document.createElement('div')
	wrap.style.cssText = `flex: 1; display: flex; flex-direction: column; border-left: 1px solid #333;`
	const lbl = document.createElement('div')
	lbl.style.cssText = `font-size: 10px; padding: 2px 6px; background: #000; color: ${color}; border-bottom: 1px solid #333;`
	lbl.textContent = labelText
	const ta = document.createElement('textarea')
	ta.style.cssText = `flex: 1; background: #000; color: ${color}; border: none; outline: none; padding: 8px; resize: none; font-family: monospace; font-size: 12px;`
	wrap.append(lbl, ta)
	return { wrap, ta }
}

const paneOrigin = makePane('#4ab0ff', 'Origin subtitles')
const paneTranslation = makePane('#b0ffb0', 'Translation subtitles')

body.append(paneOrigin.wrap, paneTranslation.wrap)
panel.append(header, body)
document.body.append(panel)

const makeCopyHandler = (btn, ta) => () => {
	ta.focus()
	ta.select()
	document.execCommand('copy')
	const orig = btn.textContent
	btn.textContent = 'COPIED!'
	setTimeout(() => (btn.textContent = orig), 1500)
}

btnCopyOrigin.onclick = makeCopyHandler(btnCopyOrigin, paneOrigin.ta)
btnCopyTranslation.onclick = makeCopyHandler(btnCopyTranslation, paneTranslation.ta)
btnClose.onclick = () => panel.remove()

// ================= FETCH + FORMAT =================
const toWebVTT = (items) =>
	'WEBVTT\n\n' +
	items
		.map((item, i) => `${i + 1}\n${MS_TO_WEBVTT(item.start)} --> ${MS_TO_WEBVTT(item.end)}\n${item.text.trim()}`)
		.join('\n\n')

fetch(`https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/translations/${taskId}`)
	.then((res) => res.json())
	.then((data) => {
		const origin = data?.data?.origin_subtitles || data?.origin_subtitles
		const translation = data?.data?.translation_subtitles || data?.translation_subtitles

		if (!origin) {
			statusLabel.textContent = '❌ Không tìm thấy origin_subtitles'
			console.error('Response:', data)
			return
		}

		paneOrigin.ta.value = toWebVTT(origin)
		paneTranslation.ta.value = translation ? toWebVTT(translation) : '(Không có translation)'
		paneOrigin.ta.scrollTop = 0
		paneTranslation.ta.scrollTop = 0

		statusLabel.textContent = `✅ Done: ${origin.length} items — task ${taskId}`
		console.log('Raw data:', data)
	})
	.catch((err) => {
		statusLabel.textContent = `❌ Fetch failed: ${err.message}`
		console.error(err)
	})
