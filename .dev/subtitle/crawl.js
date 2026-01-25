// ================= CONFIG =================
const SCROLLER_SELECTOR = '.vue-recycle-scroller'
const ITEM_SELECTOR = '.vue-recycle-scroller__item-view'
const STEP = 300
const INTERVAL = 120
const IDLE_LIMIT = 20

// ================= SCROLLER =================
const scroller = document.querySelector(SCROLLER_SELECTOR)
if (!scroller) throw new Error('Scroller not found')

scroller.style.outline = '3px solid red'

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
		width: 420px;
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
	`

const btnCopy = document.createElement('button')
btnCopy.textContent = 'COPY'
const btnClose = document.createElement('button')
btnClose.textContent = 'CLOSE'
;[btnCopy, btnClose].forEach((b) => {
	b.style.cssText = `
			flex: 1;
			cursor: pointer;
			font-weight: bold;
		`
})

const textarea = document.createElement('textarea')
textarea.style.cssText = `
		flex: 1;
		background: #000;
		color: #4ab0ff;
		border: none;
		outline: none;
		padding: 8px;
		resize: none;
	`

header.append(btnCopy, btnClose)
panel.append(header, textarea)
document.body.append(panel)

btnCopy.onclick = () => {
	textarea.focus()
	textarea.select()
	document.execCommand('copy')
	console.log('COPIED')
}

btnClose.onclick = () => panel.remove()

// ================= SCROLL LOOP =================
let lastScrollTop = -1
let idle = 0

const timer = setInterval(() => {
	collect()

	scroller.scrollTop += STEP
	scroller.dispatchEvent(
		new WheelEvent('wheel', {
			deltaY: STEP,
			bubbles: true,
			cancelable: true,
		}),
	)

	if (scroller.scrollTop === lastScrollTop) idle++
	else idle = 0

	if (idle > IDLE_LIMIT) {
		clearInterval(timer)

		console.log('DONE, unique items:', collected.length)

		const output =
			'WEBVTT\n\n' +
			collected
				.map((block) => {
					block = block.replaceAll('\n-\n', ' --> ')
					const lines = block.split('\n').filter(Boolean)
					if (lines.length !== 3) {
						console.warn('invalid line format:', lines)
						const [time, ...rest] = lines
						return `${time}\n${String(rest)}`
					}
					return `${lines[0]}\n${lines[2]}`
				})
				.sort()
				.join('\n\n')

		textarea.value = output
		textarea.scrollTop = 0
	}

	lastScrollTop = scroller.scrollTop
}, INTERVAL)
