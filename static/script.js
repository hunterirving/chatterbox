function isScrolledToBottom(el) {
	const buffer = 20;
	return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= buffer;
}

function scrollToBottom(element, smooth = true) {
	element.scrollTo({
		top: element.scrollHeight,
		behavior: smooth ? 'smooth' : 'auto'
	});
}

function applyPrismStyling() {
	Prism.highlightAll();
}

function submitForm(event) {
	event.preventDefault();
	const form = event.target;
	const formData = new FormData(form);
	const messages = document.getElementById('messages');
	const outputDiv = document.getElementById('output');
	const userMessage = formData.get('command').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const username = document.body.dataset.username;
	const model = formData.get('model');
	const aiName = model.includes('claude') ? 'Claude' : 'ChatGPT';
	
	// First, scroll to bottom
	scrollToBottom(outputDiv);
	
	// Small delay to ensure scroll completes
	setTimeout(() => {
		// Store the initial scroll state only after we've scrolled to bottom
		const wasAtBottom = isScrolledToBottom(outputDiv);
		
		// Add messages
		messages.innerHTML += `<div class="message"><b>${username}:</b> ${userMessage}</div>`;
		messages.innerHTML += `<div class="message"><b>${aiName}:</b> <span class="ai-response"></span></div>`;
		const aiResponse = messages.lastElementChild.querySelector('.ai-response');

		// Only scroll if we were at bottom initially
		if (wasAtBottom) {
			requestAnimationFrame(() => scrollToBottom(outputDiv));
		}

		// Track user scrolling
		let userHasScrolled = false;
		let isScrolling = false;
		let scrollTimeout;

		const scrollHandler = () => {
			userHasScrolled = true;
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				isScrolling = false;
			}, 150);
		};

		outputDiv.addEventListener('scroll', scrollHandler);

		const updateScroll = () => {
			if (wasAtBottom && !userHasScrolled && !isScrolling) {
				requestAnimationFrame(() => scrollToBottom(outputDiv));
			}
		};

		let responseBuffer = '';
		let lastAnimationFrame;

		fetch('/stream', {
			method: 'POST',
			body: formData
		}).then(response => {
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			
			function read() {
				reader.read().then(({ done, value }) => {
					if (done) {
						outputDiv.removeEventListener('scroll', scrollHandler);
						if (wasAtBottom && !userHasScrolled) {
							requestAnimationFrame(() => scrollToBottom(outputDiv));
						}
						return;
					}
					
					const text = decoder.decode(value);
					responseBuffer += text;
					
					aiResponse.innerHTML = formatResponse(responseBuffer);
					
					// Highlight code blocks
					const codeBlocks = aiResponse.querySelectorAll('pre code');
					codeBlocks.forEach(block => {
						if (!block.classList.contains('prism-highlighted')) {
							// Ensure block has a language class
							if (!Array.from(block.classList).some(cls => cls.startsWith('language-'))) {
								block.classList.add('language-plaintext');
							}
							Prism.highlightElement(block);
							block.classList.add('prism-highlighted');
						}
					});
					
					updateScroll();
					read();
				});
			}
			read();
		});
	}, 50);  // 50ms delay to ensure scroll completes

	form.reset();
	const textarea = document.getElementById('command');
	adjustTextareaHeight(textarea);
	textarea.focus();
}

function formatResponse(text) {
	// First encode HTML characters
	text = text.replace(/&/g, '&amp;')
			   .replace(/</g, '&lt;')
			   .replace(/>/g, '&gt;');
	
	// Handle both HTML-style and markdown-style code blocks
	text = text
		// Handle HTML-style code blocks
		.replace(/&lt;pre&gt;&lt;code(?:\s+class="language-(\w+)")?\s*&gt;/g, 
			(match, lang) => {
				const langAttribute = lang ? ` class="language-${lang}"` : ' class="language-plaintext"';
				return `<pre data-prismjs-copy="Copy" data-prismjs-copy-success="Copied!" data-prismjs-copy-error="Press Ctrl+C to copy"><code${langAttribute}>`;
			}
		)
		.replace(/&lt;\/code&gt;&lt;\/pre&gt;/g, '</code></pre>')
		// Handle markdown-style code blocks with language detection
		.replace(/```(\w+)?\n([\s\S]*?)(?:```|$)/g, (match, lang, code) => {
			// Try to detect language from first line if not specified
			if (!lang && code.trim()) {
				const firstLine = code.trim().split('\n')[0].toLowerCase();
				// Common file extensions and language indicators
				const langMap = {
					'python': 'python',
					'.py': 'python',
					'javascript': 'javascript',
					'.js': 'javascript',
					'html': 'html',
					'.html': 'html',
					'css': 'css',
					'.css': 'css',
					'bash': 'bash',
					'shell': 'bash',
					'$': 'bash',
					'json': 'json',
					'.json': 'json',
				};
				for (const [key, value] of Object.entries(langMap)) {
					if (firstLine.includes(key)) {
						lang = value;
						break;
					}
				}
			}
			const langAttribute = lang ? ` class="language-${lang}"` : ' class="language-plaintext"';
			return `<pre data-prismjs-copy="Copy" data-prismjs-copy-success="Copied!" data-prismjs-copy-error="Press Ctrl+C to copy"><code${langAttribute}>${code}</code></pre>`;
		});
	
	return text;
}

function adjustTextareaHeight(textarea) {
	textarea.style.height = '38px';
	textarea.style.height = Math.max(38, Math.min(textarea.scrollHeight, 121)) + 'px';
}

function handleKeyDown(event) {
	if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
		event.preventDefault();
		document.getElementById('input-form').requestSubmit();
	}
}

function displayStoredMessages(messages) {
	const messagesContainer = document.getElementById('messages');
	messagesContainer.innerHTML = '';
	messages.forEach(message => {
		const encodedContent = formatResponse(message.content);
		messagesContainer.innerHTML += `<div class="message"><b>${message.sender}:</b> ${encodedContent}</div>`;
	});
}

function fetchAndDisplayStoredMessages() {
	return fetch('/get-stored-messages')
		.then(response => response.json())
		.then(messages => {
			displayStoredMessages(messages);
			applyPrismStyling();
		})
		.catch(error => {
			console.error('Error fetching stored messages:', error);
		});
}

document.addEventListener('DOMContentLoaded', function() {
	const textarea = document.getElementById('command');
	const outputDiv = document.getElementById('output');
	adjustTextareaHeight(textarea);
	textarea.focus();
	fetchAndDisplayStoredMessages().then(() => {
		scrollToBottom(outputDiv, false);  // false for instant scroll
		applyPrismStyling();
	});
});

document.addEventListener('keydown', function(event) {
	if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Q') {
		event.preventDefault();
		if (confirm('Shut down the server and close this tab?')) {
			// Send shutdown request
			fetch('/shutdown', { 
				method: 'POST',
				// Set a short timeout to prevent hanging
				signal: AbortSignal.timeout(2000)
			}).catch(error => {
				console.log('Server shutdown initiated or server already down');
			}).finally(() => {
				// Attempt to close the tab
				window.close();
				
				// If the window didn't close, show a message after a short delay
				setTimeout(() => {
					if (!window.closed) {
						document.body.innerHTML = '<h1>Server is shutting down. You can now close this tab.</h1>';
					}
				}, 500);
			});
		}
	}
});