/**
 * @param {number} n
 */
export function simplifyNumber(n) {
	if (n < 10000) return 10000

	const str = String(n)
	const length = str.length

	// Quy tắc: giữ 1 chữ số đầu nếu < 100000
	// Giữ 2 chữ số đầu nếu < 1_000_000
	// Giữ 3 chữ số đầu nếu lớn hơn
	let keep
	if (length <= 5) keep = 1
	else if (length === 6) keep = 2
	else keep = 3 // phòng xa

	const head = str.slice(0, keep)
	const zeros = '0'.repeat(length - keep)
	return parseInt(head + zeros)
}
