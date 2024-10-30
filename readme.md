# chatterbox 🦜
a hackable HTML interface for interacting with AI models

## setup instructions

### prereqs

- python 3.x
- OpenAI API key and/or Anthropic API key

### installation

1. clone the repository:

   ```bash
   git clone https://github.com/hunterirving/chatterbox.git
   cd chatterbox
   ```

2. set up the virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. install the required packages:

   ```bash
   pip install -r requirements.txt
   ```

4. configure your OpenAI and/or Anthropic API key(s) and other details:

	- rename `config.py.example` to `config.py` :
	<br><br>
	```shell
	mv config.py.example config.py
	```

	- add your OpenAI and/or Anthropic API key(s) to `config.py`:
	<br><br>
	```python
	OPEN_AI_API_KEY = "your_openai_api_key"
	ANTHROPIC_API_KEY = "your_anthropic_api_key_here"
	```

	- optionally, set your preferred name or username by modifying the USERNAME string:
	<br><br>
	```python
	USERNAME = "your_name_or_username_here"
	```

5. run the flask application:

   ```bash
   python3 chatterbox.py
   ```

6. access the application:

	open a web browser and navigate to ```http://<ip_address_of_flask_server>:8080```.

## contributing

feel free to submit issues or pull requests for improvements and bug fixes.

## license

this project is licensed under the [GNU General Public License v3.0](LICENSE.txt).