from flask import Flask, request, render_template, Response, stream_with_context, jsonify
import os
import signal
import psutil
import threading
import sys
import time
from openai import OpenAI
from anthropic import Anthropic
import config
import re

def check_api_keys():
	api_keys_present = {
		'OpenAI': hasattr(config, 'OPEN_AI_API_KEY') and config.OPEN_AI_API_KEY,
		'Anthropic': hasattr(config, 'ANTHROPIC_API_KEY') and config.ANTHROPIC_API_KEY
	}
	return api_keys_present

def initialize_clients():
	api_keys = check_api_keys()
	clients = {}
	available_models = []

	if api_keys['OpenAI']:
		clients['OpenAI'] = OpenAI(api_key=config.OPEN_AI_API_KEY)
		available_models.append("gpt-4o")
	if api_keys['Anthropic']:
		clients['Anthropic'] = Anthropic(api_key=config.ANTHROPIC_API_KEY)
		available_models.append("claude-3-5-sonnet-latest")

	return clients, available_models

def shutdown_server():
	current_pid = os.getpid()
	
	for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
		try:
			if 'python' in proc.name().lower() and any('chatterbox.py' in cmd.lower() for cmd in proc.cmdline()):
				if proc.pid != current_pid:
					print(f"Terminating process: {proc.pid}")
					os.kill(proc.pid, signal.SIGKILL)
		except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
			pass

	print(f"Exiting current process: {current_pid}")
	os.kill(current_pid, signal.SIGKILL)

clients, available_models = initialize_clients()
print(f"Clients: {clients}")
print(f"Available models: {available_models}")

app = Flask(__name__, template_folder='.')
messages = []
selected_model = "claude-3-5-sonnet-latest"
username = getattr(config, 'USERNAME', 'User')
system_prompts = getattr(config, 'SYSTEM_PROMPTS', [])

@app.route('/', methods=['GET', 'POST'])
def web_interface():
	global messages, selected_model
	output = ""

	for msg in messages:
		if msg['role'] == 'user':
			output += f'<div class="message"><b>{username}:</b> {msg["content"]}</div>'
		elif msg['role'] == 'assistant':
			ai_name = "Claude" if "claude" in msg.get('model', selected_model) else "ChatGPT"
			output += f'<div class="message"><b>{ai_name}:</b> {msg["content"]}</div>'

	if selected_model not in available_models and available_models:
		selected_model = available_models[0]

	return render_template('template.html', 
						   output=output, 
						   selected_model=selected_model, 
						   username=username, 
						   available_models=available_models,
						   pro_mode=getattr(config, 'PRO_MODE', False))

@app.route('/stream', methods=['POST'])
def stream():
	global messages, selected_model
	user_input = request.form['command']
	selected_model = request.form['model']

	if selected_model not in available_models:
		return Response("Error: Selected model is not available.", content_type='text/plain')

	messages.append({"role": "user", "content": user_input})

	system_content = " ".join([prompt["content"] for prompt in system_prompts])
	anthropic_messages = [
		{"role": msg["role"], "content": msg["content"]}
		for msg in messages[-10:]
		if msg["role"] != "system"
	]

	def generate():
		response_content = ""
		if 'gpt' in selected_model:
			if 'OpenAI' not in clients:
				yield "Error: OpenAI API key is not available."
				return
			response = clients['OpenAI'].chat.completions.create(
				model=selected_model,
				messages=system_prompts + messages[-10:],
				stream=True
			)
			for chunk in response:
				if chunk.choices[0].delta.content is not None:
					chunk_text = chunk.choices[0].delta.content
					yield chunk_text
					response_content += chunk_text
		else:
			if 'Anthropic' not in clients:
				yield "Error: Anthropic API key is not available."
				return
			response = clients['Anthropic'].messages.create(
				model=selected_model,
				messages=anthropic_messages,
				system=system_content,
				max_tokens=8192,
				stream=True
			)
			for chunk in response:
				if chunk.type == 'content_block_delta':
					chunk_text = chunk.delta.text
					yield chunk_text
					response_content += chunk_text

		messages.append({"role": "assistant", "content": response_content, "model": selected_model})

	return Response(stream_with_context(generate()), content_type='text/html')

@app.route('/get-stored-messages', methods=['GET'])
def get_stored_messages():
	global messages
	formatted_messages = []
	for msg in messages:
		if msg['role'] == 'user':
			formatted_messages.append({
				"sender": username,
				"content": msg["content"]
			})
		elif msg['role'] == 'assistant':
			ai_name = "Claude" if "claude" in msg.get('model', selected_model) else "ChatGPT"
			formatted_messages.append({
				"sender": ai_name,
				"content": msg["content"]
			})
	return jsonify(formatted_messages)

@app.route('/shutdown', methods=['POST'])
def shutdown():
	shutdown_server()
	return '', 204

def signal_handler(sig, frame):
	print('Caught signal, shutting down...')
	shutdown_server()

if __name__ == '__main__':
	signal.signal(signal.SIGINT, signal_handler)
	signal.signal(signal.SIGTERM, signal_handler)
	
	api_keys = check_api_keys()
	if not any(api_keys.values()):
		print("Error: No API keys found. Please provide at least one API key (OpenAI or Anthropic) in the config file.")
	else:
		available_apis = [api for api, present in api_keys.items() if present]
		print(f"Available APIs: {', '.join(available_apis)}")
		app.run(host='0.0.0.0', port=8080)