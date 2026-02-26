// ================= CONFIG =================
const SCROLLER_SELECTOR = '.vue-recycle-scroller'
const ITEM_SELECTOR = '.vue-recycle-scroller__item-view'
const INTERVAL = 150
const IDLE_LIMIT = 25

// ================= SCROLLER =================
const scroller = document.querySelector(SCROLLER_SELECTOR)
if (!scroller) throw new Error('Scroller not found')

scroller.style.outline = '3px solid red'

const firstItem = document.querySelector(ITEM_SELECTOR)
const STEP = firstItem ? Math.floor(firstItem.offsetHeight * 0.8) : 150
console.log('Auto STEP:', STEP)

const seen = new Set()
const collected = []

const collect = () => {
	document.querySelectorAll(ITEM_SELECTOR).forEach((el) => {
		const text = el.innerText.trim()
		if (!text) return
		if (seen.has(text)) return
		seen.add(text)
		collected.push(text)
	})
}

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
header.style.cssText = `
	padding: 6px;
	background: #000;
	display: flex;
	gap: 6px;
	align-items: center;
`

const makeBtn = (label) => {
	const b = document.createElement('button')
	b.textContent = label
	b.style.cssText = `flex: 1; cursor: pointer; font-weight: bold; padding: 4px;`
	return b
}

const btnCopy1 = makeBtn('COPY lines[0]+lines[2]')
const btnCopy2 = makeBtn('COPY lines[0]+lines[1]')
const btnClose = makeBtn('CLOSE')
const statusLabel = document.createElement('span')
statusLabel.style.cssText = `font-size: 11px; margin-left: 4px; color: #aaa; white-space: nowrap;`
statusLabel.textContent = 'Scanning...'

header.append(btnCopy1, btnCopy2, btnClose, statusLabel)

// Two-column body
const body = document.createElement('div')
body.style.cssText = `
	flex: 1;
	display: flex;
	gap: 0;
	overflow: hidden;
`

const makePane = (color) => {
	const wrap = document.createElement('div')
	wrap.style.cssText = `flex: 1; display: flex; flex-direction: column; border-left: 1px solid #333;`
	const label = document.createElement('div')
	label.style.cssText = `font-size: 10px; padding: 2px 6px; background: #000; color: ${color}; border-bottom: 1px solid #333;`
	const ta = document.createElement('textarea')
	ta.style.cssText = `flex: 1; background: #000; color: ${color}; border: none; outline: none; padding: 8px; resize: none; font-family: monospace; font-size: 12px;`
	wrap.append(label, ta)
	return { wrap, label, ta }
}

const pane1 = makePane('#4ab0ff')
pane1.label.textContent = 'lines[0] + lines[2]  (timestamp + text)'
const pane2 = makePane('#b0ffb0')
pane2.label.textContent = 'lines[0] + lines[1]  (timestamp + ???)'

body.append(pane1.wrap, pane2.wrap)
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

btnCopy1.onclick = makeCopyHandler(btnCopy1, pane1.ta)
btnCopy2.onclick = makeCopyHandler(btnCopy2, pane2.ta)
btnClose.onclick = () => panel.remove()

// ================= SCROLL LOOP =================
let lastScrollTop = -1
let idle = 0

const timer = setInterval(() => {
	scroller.scrollTop += STEP
	scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: STEP, bubbles: true, cancelable: true }))

	setTimeout(() => {
		collect()
		statusLabel.textContent = `${collected.length} items...`
	}, 80)

	if (Math.abs(scroller.scrollTop - lastScrollTop) < 1) idle++
	else idle = 0

	lastScrollTop = scroller.scrollTop

	if (idle > IDLE_LIMIT) {
		clearInterval(timer)

		setTimeout(() => {
			collect()
			console.log('DONE, unique items:', collected.length)
			statusLabel.textContent = `✅ Done: ${collected.length} items`

			const buildOutput = (lineIndexes) =>
				'WEBVTT\n\n' +
				collected
					.map((block) => {
						block = block.replaceAll('\n-\n', ' --> ')
						const lines = block.split('\n').filter(Boolean)
						if (lines.length < Math.max(...lineIndexes) + 1) {
							console.warn('invalid line format:', lines)
							const [time, ...rest] = lines
							return `${time}\n${String(rest)}`
						}
						return lineIndexes.map((i) => lines[i]).join('\n')
					})
					.sort()
					.map((line, index) => index + 1 + '\n' + line)
					.join('\n\n')

			pane1.ta.value = buildOutput([0, 2])
			pane2.ta.value = buildOutput([0, 1])
			pane1.ta.scrollTop = 0
			pane2.ta.scrollTop = 0
		}, 200)
	}
}, INTERVAL)
