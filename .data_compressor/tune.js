/**
 * tune.js — Grid search hằng số nén prefix/atom
 * Chạy: node tune.js
 * Import data từ cùng cấu trúc project gốc
 */

import { data } from './storage/index.js'

const B64_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_~'
function toB64(n) {
	let r = ''
	do {
		r = B64_CHARS[n % 64] + r
		n = Math.floor(n / 64)
	} while (n > 0)
	return r
}

// ─── Thu thập URLs từ data thật ──────────────────────────────────────────────
const urlFrequency = new Map()
data.forEach((line) => {
	;[7, 8, 9].forEach((col) => {
		const cell = line[col]
		if (!cell) return
		cell
			.replace(/"/g, '')
			.split(',')
			.forEach((url) => {
				const clean = url.split('?')[0].trim()
				if (clean) urlFrequency.set(clean, (urlFrequency.get(clean) || 0) + 1)
			})
	})
})
const urls = Array.from(urlFrequency.keys())
console.log(`Dataset: ${urls.length} unique URLs, ${data.length} tracks\n`)

// ─── Tính baseline (không nén) ───────────────────────────────────────────────
const originalSize = urls.reduce((s, u) => s + u.length * (urlFrequency.get(u) || 1), 0)

// ─── Hàm nén với bộ hằng số cho trước ───────────────────────────────────────
function simulate(cfg) {
	const { domainMinFreq, pathMinFreq, pathMinLen, pathMaxDepth, atomMinSavings } = cfg

	// Level 1 prefixes
	const prefixCounts = new Map()
	urls.forEach((url) => {
		const i = url.lastIndexOf('/')
		if (i > 0) {
			const p = url.slice(0, i + 1)
			prefixCounts.set(p, (prefixCounts.get(p) || 0) + (urlFrequency.get(url) || 1))
		}
	})
	const level1 = Array.from(prefixCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([prefix, count], i) => ({ prefix, count, id: i + 1 }))

	// Phân tích atoms
	const prefixStrs = level1.map((p) => p.prefix)
	const atomCandidates = new Map()

	// Protocol
	for (const proto of ['https://', 'http://']) {
		const freq = prefixStrs.filter((p) => p.startsWith(proto)).length
		if (freq >= 2) atomCandidates.set(proto, freq)
	}

	// Domain
	prefixStrs.forEach((p) => {
		try {
			const host = new URL(p).hostname
			atomCandidates.set(host, (atomCandidates.get(host) || 0) + 1)
		} catch {}
	})

	// Path segments
	const pathCounts = new Map()
	prefixStrs.forEach((p) => {
		try {
			const segs = new URL(p).pathname.split('/').filter(Boolean)
			for (let d = 1; d <= Math.min(segs.length, pathMaxDepth); d++) {
				const pp = '/' + segs.slice(0, d).join('/') + '/'
				pathCounts.set(pp, (pathCounts.get(pp) || 0) + 1)
			}
		} catch {}
	})
	pathCounts.forEach((freq, pp) => {
		if (freq >= pathMinFreq && pp.length >= pathMinLen) atomCandidates.set(pp, (atomCandidates.get(pp) || 0) + freq)
	})

	// Lọc theo ngưỡng + tính savings thực tế
	// Savings = (freq * text.length) - text.length - overhead
	// overhead = dòng atom trong file + refs dùng b64 thay text
	// Mỗi atom ref trong expression: toB64(atomId).length + 1 (ký tự ">")
	// vs không có atom: text.length chars
	let atomId = 1
	const atoms = new Map()
	const atomList = []

	// Sắp xếp theo savings giảm dần để gán ID nhỏ trước (b64 ID ngắn hơn)
	const candidates = Array.from(atomCandidates.entries())
		.filter(([text, freq]) => {
			const idLen = toB64(atomId).length // ước lượng
			const refCost = idLen + 1 // "ID>"
			const savings = freq * text.length - refCost * freq - (text.length + 4) // 4 = "A,ID," overhead
			return savings > atomMinSavings
		})
		.sort((a, b) => {
			const savA = a[1] * a[0].length
			const savB = b[1] * b[0].length
			return savB - savA
		})

	for (const [text, freq] of candidates) {
		const id = atomId++
		const b64id = toB64(id)
		const refCost = b64id.length + 1 // "b64id>"
		const atomDefCost = 2 + b64id.length + 1 + text.length + 1 // "A,id,text\n"
		const savings = freq * text.length - freq * refCost - atomDefCost
		if (savings > atomMinSavings) {
			atoms.set(text, { id, b64id })
			atomList.push({ text, id, b64id })
		}
	}

	// Tính kích thước bảng atom
	let atomTableSize = '#TYPE:(A: Atom)(none: Prefix),#ID,#CONTENT\n'.length
	atomList.forEach(({ text, b64id }) => {
		atomTableSize += `A,${b64id},${text}\n`.length
	})

	// Decompose mỗi prefix thành expression
	const sortedAtoms = [...atomList].sort((a, b) => b.text.length - a.text.length)
	function decompose(prefix) {
		let rem = prefix,
			expr = ''
		while (rem.length > 0) {
			let matched = false
			for (const { text, b64id } of sortedAtoms) {
				if (rem.startsWith(text)) {
					expr += b64id + '>'
					rem = rem.slice(text.length)
					matched = true
					break
				}
			}
			if (!matched) {
				expr += rem[0]
				rem = rem.slice(1)
			}
		}
		return expr
	}

	// Tính kích thước bảng prefix
	let prefixTableSize = 0
	const prefixToB64 = new Map()
	level1.forEach(({ prefix, id }) => {
		const b64id = toB64(id)
		prefixToB64.set(prefix, b64id)
		const expr = decompose(prefix)
		prefixTableSize += `${b64id},${expr}\n`.length
	})

	// Tính kích thước data sau nén
	let compressedDataSize = 0
	urls.forEach((url) => {
		const freq = urlFrequency.get(url) || 1
		const i = url.lastIndexOf('/')
		if (i > 0) {
			const prefix = url.slice(0, i + 1)
			const name = decodeURIComponent(url.slice(i + 1))
			const b64id = prefixToB64.get(prefix)
			if (b64id) {
				compressedDataSize += `${b64id}->${name}`.length * freq
				return
			}
		}
		compressedDataSize += url.length * freq
	})

	const totalSize = atomTableSize + prefixTableSize + compressedDataSize
	const saved = originalSize - totalSize
	const pct = ((saved / originalSize) * 100).toFixed(1)

	return {
		totalSize,
		atomTableSize,
		prefixTableSize,
		compressedDataSize,
		numAtoms: atomList.length,
		numPrefixes: level1.length,
		saved,
		pct,
	}
}

// ─── Grid search ─────────────────────────────────────────────────────────────
const grid = {
	domainMinFreq: [2, 3, 5], // min lần xuất hiện để tạo domain atom
	pathMinFreq: [2, 3, 5, 10], // min lần để tạo path atom
	pathMinLen: [5, 8, 12], // min độ dài path atom
	pathMaxDepth: [2, 3, 5, 7], // độ sâu segment tối đa
	atomMinSavings: [0, 5, 20, 50], // min bytes tiết kiệm thực để giữ atom
}

const results = []

for (const domainMinFreq of grid.domainMinFreq)
	for (const pathMinFreq of grid.pathMinFreq)
		for (const pathMinLen of grid.pathMinLen)
			for (const pathMaxDepth of grid.pathMaxDepth)
				for (const atomMinSavings of grid.atomMinSavings) {
					const cfg = { domainMinFreq, pathMinFreq, pathMinLen, pathMaxDepth, atomMinSavings }
					try {
						const r = simulate(cfg)
						results.push({ cfg, ...r })
					} catch {}
				}

// Sort theo totalSize tăng dần
results.sort((a, b) => a.totalSize - b.totalSize)

// In baseline
const baselineKB = (originalSize / 1024).toFixed(1)
console.log(`Baseline (không nén):  ${baselineKB} KB\n`)

// In top 15
console.log('Top 15 tổ hợp tốt nhất:')
console.log('Rank │ Total KB │ Saved KB │   % │ Atoms │ Prefixes │ domFreq │ pathFreq │ pathLen │ depth │ minSav')
console.log('─────┼──────────┼──────────┼─────┼───────┼──────────┼─────────┼──────────┼─────────┼───────┼───────')

results.slice(0, 15).forEach((r, i) => {
	const { cfg, totalSize, saved, pct, numAtoms, numPrefixes } = r
	console.log(
		`${String(i + 1).padStart(4)} │` +
			` ${(totalSize / 1024).toFixed(1).padStart(8)} │` +
			` ${(saved / 1024).toFixed(1).padStart(8)} │` +
			` ${pct.padStart(3)}% │` +
			` ${String(numAtoms).padStart(5)} │` +
			` ${String(numPrefixes).padStart(8)} │` +
			` ${String(cfg.domainMinFreq).padStart(7)} │` +
			` ${String(cfg.pathMinFreq).padStart(8)} │` +
			` ${String(cfg.pathMinLen).padStart(7)} │` +
			` ${String(cfg.pathMaxDepth).padStart(5)} │` +
			` ${String(cfg.atomMinSavings).padStart(5)}`,
	)
})

// In worst 5 để so sánh
console.log('\nWorst 5 (để tham khảo):')
results
	.slice(-5)
	.reverse()
	.forEach((r, i) => {
		const { cfg, totalSize, pct, numAtoms } = r
		console.log(
			`  ${(totalSize / 1024).toFixed(1).padStart(8)} KB (${pct}%) │ atoms=${numAtoms} │` +
				` domFreq=${cfg.domainMinFreq} pathFreq=${cfg.pathMinFreq} pathLen=${cfg.pathMinLen} depth=${cfg.pathMaxDepth} minSav=${cfg.atomMinSavings}`,
		)
	})

// In config tốt nhất để copy vào code
const best = results[0]
console.log('\n── Config tốt nhất để paste vào optimize.js ──')
console.log(JSON.stringify(best.cfg, null, 2))
console.log(
	`\nTổng: ${(best.totalSize / 1024).toFixed(1)} KB — tiết kiệm ${(best.saved / 1024).toFixed(1)} KB (${best.pct}%) so với gốc`,
)
console.log(`Atoms: ${best.numAtoms} │ Prefixes: ${best.numPrefixes}`)
