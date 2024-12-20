function isScrolledToBottom(el) {
	const buffer = 2;
	return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= buffer;
}

function scrollToBottom(el) {
	el.scrollTop = el.scrollHeight;
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
	
	// Store the initial scroll state
	const wasAtBottom = isScrolledToBottom(outputDiv);
	
	// Add messages
	messages.innerHTML += `<div class="message"><b>${username}:</b> ${userMessage}</div>`;
	messages.innerHTML += `<div class="message"><b>${aiName}:</b> <span class="ai-response"></span></div>`;
	const aiResponse = messages.lastElementChild.querySelector('.ai-response');

	// Create a scroll observer
	let lastKnownScrollPosition = outputDiv.scrollTop;
	let userHasScrolled = false;

	outputDiv.addEventListener('scroll', () => {
		if (Math.abs(outputDiv.scrollTop - lastKnownScrollPosition) > 50) {
			userHasScrolled = true;
		}
	});

	// Initial scroll if at bottom
	if (wasAtBottom) {
		requestAnimationFrame(() => scrollToBottom(outputDiv));
	}

	let responseBuffer = '';
	fetch('/stream', {
		method: 'POST',
		body: formData
	}).then(response => {
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		
		function read() {
			reader.read().then(({ done, value }) => {
				if (done) {
					if (wasAtBottom && !userHasScrolled) {
						requestAnimationFrame(() => scrollToBottom(outputDiv));
					}
					return;
				}
				
				const text = decoder.decode(value);
				responseBuffer += text;
				
				aiResponse.innerHTML = formatResponse(responseBuffer);
				
				// Highlight all code blocks, including incomplete ones
				const codeBlocks = aiResponse.querySelectorAll('pre code');
				codeBlocks.forEach(block => {
					// Only highlight if not already highlighted
					if (!block.classList.contains('language-none') && 
						!block.classList.contains('prism-highlighted')) {
						Prism.highlightElement(block);
						block.classList.add('prism-highlighted');
					}
				});
				
				if (wasAtBottom && !userHasScrolled) {
					requestAnimationFrame(() => scrollToBottom(outputDiv));
				}
				
				read();
			});
		}
		read();
	});

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
				const langAttribute = lang ? ` class="language-${lang}"` : '';
				return `<pre><code${langAttribute}>`;
			}
		)
		.replace(/&lt;\/code&gt;&lt;\/pre&gt;/g, '</code></pre>')
		// Handle markdown-style code blocks
		.replace(/```(\w+)?\n([\s\S]*?)(?:```|$)/g, (match, lang, code) => {
			const langAttribute = lang ? ` class="language-${lang}"` : '';
			return `<pre><code${langAttribute}>${code}</code></pre>`;
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
	fetch('/get-stored-messages')
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
	adjustTextareaHeight(textarea);
	textarea.focus(); // Add this line to focus the textarea
	fetchAndDisplayStoredMessages();
	applyPrismStyling();
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