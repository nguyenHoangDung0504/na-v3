copy(
	'WEBVTT\n\n' +
		[
            // Đống kết quả crawl được:
            '00:00:37,190\n-\n00:00:40,209\nPhần cần bỏ\n\nPhần sub'
        ]
			.map((line) => {
				line = line.replaceAll('\n-\n', ' --> ')
				const [time, _, sub] = line.split('\n').filter(Boolean)
				return `${time}\n${sub}`
			})
			.sort()
			.join('\n\n'),
)
