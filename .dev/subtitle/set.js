localStorage.l = `fetch('http://127.0.0.1:5500/.dev/subtitle/crawl.js')
	.then((res) => res.text())
	.then((src) => {
		const script = document.createElement('script');
		script.type = 'module';
		script.textContent = src;
		document.documentElement.appendChild(script);
		script.remove(); // dọn dẹp sau khi chạy
	});
`

eval(localStorage.l)
