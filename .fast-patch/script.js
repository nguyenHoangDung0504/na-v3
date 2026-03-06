const grid = document.getElementById('grid')

const data = await fetch('http://127.0.0.1:5500/.data_compressor/storage/data.csv')
	.then((res) => res.text())
	.then((data) =>
		data
			.split('\n\n')
			.map((track) => track.split('\n').map((info, index) => (index === 0 ? parseInt(info) : info.trim()))),
	)
	.then((data) => data.filter((line) => line.some((part) => part.includes?.('glitch'))))

render(data)

function render(list) {
	const fragment = document.createDocumentFragment()
	console.log(`Display: ${list.length} Tracks`)

	for (const track of list) {
		const code = track[0]

		const box = document.createElement('div')
		box.className = 'box'
		box.textContent = code
		box.onclick = () => {
			main(track, () => box.remove())
		}

		fragment.appendChild(box)
	}

	grid.appendChild(fragment)
}

const STREAM_PATH = 'https://raw.kiko-play-niptan.one/media/stream/daily/'
const DOWNLOAD_PATH = STREAM_PATH.replace('stream', 'download')

async function main(item, clean) {
	const RJCode = item[1]
	const thumbnail = `https://api.asmr-200.com/api/cover/${RJCode.replace('RJ', '')}.jpg?type=main`
	const STORAGE = []

	const manifest = await getManifestJSON(RJCode, 2)
	if (manifest === null) return

	console.log('Debug manifest:', manifest)
	manifest.forEach((children) => {
		children['@folder'] = '@ROOT'
		if (isFolder(children)) return traversal(children, STORAGE)
		STORAGE.push(format(children))
	})

	STORAGE.sort((a, b) => {
		a['@folder'] = a['@folder'].replace('@ROOT ', '')
		b['@folder'] = b['@folder'].replace('@ROOT ', '')

		return a['@folder'].localeCompare(b['@folder'])
	})

	initView(STORAGE, item, thumbnail, clean)
}

// @HANDLERS

function format(children) {
	// Update for leak fast audio link
	if (children.type === 'audio' && children.streamLowQualityUrl.trim()) {
		children.mediaStreamUrl = children.streamLowQualityUrl
	}

	delete children.hash
	delete children.work
	// delete children.mediaDownloadUrl
	delete children.duration
	delete children.size
	delete children.workTitle
	// delete children.streamLowQualityUrl
	return children
}

function isFolder(json) {
	return json.type === 'folder' && json.children && json.children.length > 0
}

async function getManifestJSON(RJCode, version = 2) {
	const codePart = RJCode.replace('RJ', '')
	return await fetch(`http://127.0.0.1:5500/api/manifest?code=${codePart}&v=${version}`).then((r) => r.json())
}

function traversal(folder, storage) {
	if (isFolder(folder)) {
		folder.children.forEach((children) => {
			children['@folder'] = `${(folder['@folder'] ??= '')} / ${folder.title}`
			if (isFolder(children)) return traversal(children, storage)
			storage.push(format(children))
		})
	}
}

// @VIEWS

function initView(storage, item, thumbnail, clean) {
	const html = getHTML()
	const blob = new Blob([html], { type: 'text/html' })
	const url = URL.createObjectURL(blob)
	const width = screen.width * 0.9
	const height = screen.height * 0.9
	const top = screen.width * 0.05
	const left = screen.height * 0.05

	const popup = window.open(url, '_blank', `width=${width},height=${height},top=${top},left=${left}`)
	popup.addEventListener('load', () => {
		URL.revokeObjectURL(url)
		initAction(popup.window, popup.document, storage, item, thumbnail, clean)
	})
	popup.window.copyOutput = (id) => {
		const textarea = popup.document.getElementById(id)
		textarea.select()
		popup.document.execCommand('copy')
	}
}

function initAction(windowContext, documentContext, data, item, thumbnail, clean) {
	const container = documentContext.getElementById('container')
	const rsOutput = documentContext.getElementById('rsOutput')
	const imageOutput = documentContext.getElementById('imageOutput')
	const audioOutput = documentContext.getElementById('audioOutput')
	const textOutput = documentContext.getElementById('textOutput')

	const outputPanel = documentContext.getElementById('outputPanel')
	const patchBtn = documentContext.createElement('button')
	patchBtn.textContent = 'Patch CSV'
	patchBtn.id = 'patch-btn'
	patchBtn.style.cursor = 'pointer'
	patchBtn.onclick = async () => {
		const data = JSON.stringify({ code: item[0], thumbnail, images: imageOutput.value, audios: audioOutput.value })
		console.log(data)

		const res = await fetch('http://127.0.0.1:5500/api/patch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: data,
		})

		if (!res.ok) windowContext.alert('Path failed')
		else {
			windowContext.close()
			clean()
			console.log('Patch success:', item[0])
		}
	}
	outputPanel.prepend(patchBtn)

	const selected = {
		image: new Set(),
		audio: new Set(),
		text: new Set(),
	}

	function updateOutput() {
		imageOutput.value = [...selected.image].join(',')
		audioOutput.value = [...selected.audio].join(',')
		textOutput.value = [...selected.text].join('\n')
		rsOutput.value = `\t${thumbnail}\n\t${imageOutput.value}\n\t${audioOutput.value}\n`
		autoResize(rsOutput)
		autoResize(imageOutput)
		autoResize(audioOutput)
		autoResize(textOutput)
	}

	function autoResize(textarea) {
		textarea.style.height = 'auto'
		textarea.style.height = textarea.scrollHeight + 'px'
	}

	const groups = {}
	for (const item of data) {
		const folder = item['@folder'] || 'Uncategorized'
		if (!groups[folder]) groups[folder] = []
		groups[folder].push(item)
	}

	for (const [folder, items] of Object.entries(groups)) {
		const details = documentContext.createElement('details')
		const summary = documentContext.createElement('summary')
		summary.textContent = folder
		details.appendChild(summary)

		for (const [index, item] of items.entries()) {
			const wrapper = documentContext.createElement('div')
			wrapper.className = 'item'

			const id = `${folder}-${index}-${item.type}`
			const input = documentContext.createElement('input')
			input.type = 'checkbox'
			input.id = id

			const label = documentContext.createElement('label')
			label.setAttribute('for', id)

			const urlText = documentContext.createElement('div')
			urlText.textContent = item.title
			urlText.style.wordBreak = 'break-word'
			urlText.style.marginBottom = '10px'
			label.appendChild(urlText)

			if (item.type === 'audio') {
				const audio = documentContext.createElement('audio')
				audio.controls = true
				audio.preload = 'none'
				audio.src = item.mediaStreamUrl
				label.appendChild(audio)

				input.addEventListener('change', () => {
					wrapper.classList.toggle('checked', input.checked)
					if (input.checked) selected.audio.add(item.mediaStreamUrl)
					else selected.audio.delete(item.mediaStreamUrl)
					updateOutput()
				})
			} else if (item.type === 'image') {
				const imgWrapper = documentContext.createElement('div')
				imgWrapper.style.position = 'relative'

				const img = documentContext.createElement('img')
				img.loading = 'lazy'
				img.src = item.mediaStreamUrl

				const overlay = documentContext.createElement('div')
				overlay.className = 'url-overlay'
				overlay.textContent = item.mediaStreamUrl

				imgWrapper.appendChild(img)
				imgWrapper.appendChild(overlay)
				label.appendChild(imgWrapper)

				input.addEventListener('change', () => {
					wrapper.classList.toggle('checked', input.checked)
					if (input.checked) selected.image.add(item.mediaStreamUrl)
					else selected.image.delete(item.mediaStreamUrl)
					updateOutput()
				})
			} else if (item.type === 'text') {
				input.addEventListener('change', () => {
					wrapper.classList.toggle('checked', input.checked)
					if (input.checked) selected.text.add(item.mediaStreamUrl)
					else selected.text.delete(item.mediaStreamUrl)
					updateOutput()
				})
			}

			wrapper.appendChild(input)
			wrapper.appendChild(label)
			details.appendChild(wrapper)
		}

		container.appendChild(details)
	}

	documentContext.querySelectorAll('details > summary').forEach((summary) => {
		summary.addEventListener('click', function (e) {
			const currentDetails = this.parentElement
			const allDetails = documentContext.querySelectorAll('details')

			// Nếu đang đóng => chuẩn bị mở => đóng tất cả cái khác
			if (!currentDetails.open) {
				allDetails.forEach((d) => {
					if (d !== currentDetails) d.removeAttribute('open')
				})
			}
		})
	})
}

function getHTML() {
	return /*html*/ `
		<!DOCTYPE html>
		<html lang="en">

		<head>
			<meta charset="UTF-8">
			<title>Crawler</title>
			<style>${getCSS()}</style>
		</head>

		<body>

			<div id="outputPanel">
				<div class="outputGroup">
					<h3>Result</h3>
					<textarea id="rsOutput" readonly></textarea>
					<button onclick="copyOutput('rsOutput')">Copy</button>
				</div>

				<div class="outputGroup">
					<h3>Selected Image URLs</h3>
					<textarea id="imageOutput" readonly></textarea>
					<button onclick="copyOutput('imageOutput')">Copy</button>
				</div>

				<div class="outputGroup">
					<h3>Selected Audio URLs</h3>
					<textarea id="audioOutput" readonly></textarea>
					<button onclick="copyOutput('audioOutput')">Copy</button>
				</div>

				<div class="outputGroup">
					<h3>Selected Subtitle URLs</h3>
					<textarea id="textOutput" readonly></textarea>
					<button onclick="copyOutput('textOutput')">Copy</button>
				</div>
			</div>

			<div id="container"></div>

			<script src="script.js"></script>
		</body>

		</html>
  `
}

function getCSS() {
	return /*css*/ `
		:root {
			--bg-color: #121212;
			--fg-color: #e0e0e0;
			--accent: #bb86fc;
			--item-bg: #1e1e1e;
			--highlight: #333;
		}

		* {
			box-sizing: border-box;
		}

		summary {
			padding: 5px;
		}

		audio {
			display: block;
			width: 100%;
			height: 40px;
		}

		body {
			margin: 0;
			background: var(--bg-color);
			color: var(--fg-color);
			font-family: sans-serif;
			display: flex;
		}

        #patch-btn {
            margin-top: 0.5em;
            background: var(--accent);
            color: black;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
            display: block;
            margin-left: auto;
        }

		#outputPanel {
			position: fixed;
			top: 0;
			left: 0;
			width: 32%;
			height: 100vh;
			padding: 1em;
			box-sizing: border-box;
			border-right: 1px solid #333;
			background: #1a1a1a;
			overflow-y: auto;
		}

		#outputPanel h3 {
			margin-top: 1em;
			font-size: 1em;
			color: var(--accent);
		}

		#outputPanel textarea {
			display: block;
			width: 100%;
			max-height: 150px;
			background: #222;
			color: var(--fg-color);
			border: 1px solid #444;
			padding: 0.5em;
			margin-bottom: 1em;
			font-family: monospace;
			resize: vertical;
		}

		.outputGroup button {
			margin-top: 0.3em;
			background: var(--accent);
			color: black;
			border: none;
			padding: 4px 8px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.9em;
			display: block;
			margin-left: auto;
		}

		#container {
			margin-left: 34%;
			padding: 1em;
			box-sizing: border-box;
			width: 70%;
			overflow-y: auto;
			height: 100vh;
		}

		details {
			background: #181818;
			border: 1px solid #333;
			margin-bottom: 1em;
			border-radius: 6px;
			padding: 0.5em;
		}

		summary {
			font-weight: bold;
			font-size: 1.1em;
			cursor: pointer;
			color: var(--accent);
		}

		.item {
			position: relative;
			background: var(--item-bg);
			margin: 0.5em 0;
			padding: 0.5em 1em;
			border-radius: 4px;
		}

		.item.checked {
			background: var(--highlight);
			border: 1px solid var(--accent);
		}

		.item input[type="checkbox"] {
			position: absolute;
			top: 6px;
			right: 6px;
			z-index: 2;
			transform: scale(1.2);
		}

		.item label {
			display: block;
			cursor: pointer;
		}

		.url-overlay {
			position: absolute;
			top: 4px;
			left: 4px;
			background: rgba(0, 0, 0, 0.7);
			color: white;
			padding: 2px 4px;
			font-size: 0.8em;
			max-width: 95%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		img {
			max-width: 50%;
			margin-left: 50%;
			transform: translateX(-50%);
			border-radius: 4px;
			display: block;
		}

		textarea[type="content"] {
			max-height: 80px;
			width: 100%;
			background: #222;
			color: #ccc;
			border: 1px solid #444;
			padding: 0.5em;
			font-family: monospace;
		}
  `
}
