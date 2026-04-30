const B64_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_~'
export const B64_MAP = Object.fromEntries([...B64_CHARS].map((c, i) => [c, i]))

export function toB64(n) {
	let r = ''
	do {
		r = B64_CHARS[n % 64] + r
		n = Math.floor(n / 64)
	} while (n > 0)
	return r
}

export function fromB64(s) {
	let n = 0
	for (const c of s) n = n * 64 + B64_MAP[c]
	return n
}
