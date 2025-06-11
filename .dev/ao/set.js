localStorage.l = `fetch('http://127.0.0.1:5500/.dev/ao/execute.js')
	.then((res) => res.text())
	.then((src) => eval(src));
`;

eval(localStorage.l);
