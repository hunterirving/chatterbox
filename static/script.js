function isScrolledToBottom(el) {
	return el.scrollHeight - el.clientHeight <= el.scrollTop + 1;
}

function submitForm(event) {
	event.preventDefault();
	const form = event.target;
	const formData = new FormData(form);
	const messages = document.getElementById('messages');
	const userMessage = formData.get('command').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const username = document.body.dataset.username;
	const model = formData.get('model');
	const aiName = model.includes('claude') ? 'Claude' : 'ChatGPT';
	messages.innerHTML += `<div class="message"><b>${username}:</b> ${userMessage}</div>`;
	messages.innerHTML += `<div class="message"><b>${aiName}:</b> <span class="ai-response"></span></div>`;
	const aiResponse = messages.lastElementChild.querySelector('.ai-response');

	document.getElementById('output').scrollTop = document.getElementById('output').scrollHeight;

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
					aiResponse.innerHTML = formatResponse(responseBuffer);
					return;
				}
				const text = decoder.decode(value);
				responseBuffer += text;
				aiResponse.innerHTML = formatResponse(responseBuffer);
				const outputDiv = document.getElementById('output');
				if (isScrolledToBottom(outputDiv)) {
					messages.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

	document.getElementById('model').value = formData.get('model');
}

function formatResponse(text) {
    // Ensure <pre><code> blocks are properly closed
    return text.replace(/<pre><code class="language-(\w+)">([\s\S]*?)(?:<\/code><\/pre>|$)/g, 
        (match, lang, code) => `<pre><code class="language-${lang}">${code}</code></pre>`
    );
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

// Ensure correct initial height
window.onload = function() {
	adjustTextareaHeight(document.getElementById('command'));
};

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