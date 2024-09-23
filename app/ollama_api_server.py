from flask import Flask, request, jsonify
import ollama
import logging

app = Flask(__name__)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@app.route('/generate', methods=['POST'])
def generate_text():
    data = request.json
    prompt = data.get('prompt', '')
    
    if not prompt:
        logging.warning("Received request with empty prompt")
        return jsonify({'error': 'Empty prompt'}), 400

    try:
        logging.info(f"Generating response for prompt: {prompt}")
        result = ollama.generate(model='llama3.1', prompt=prompt)
        logging.info("Successfully generated response")
        return jsonify({'response': result['response']})
    except Exception as e:
        logging.error(f"Error generating response: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logging.info("Starting Ollama API server")
    app.run(host='127.0.0.1', port=5080)