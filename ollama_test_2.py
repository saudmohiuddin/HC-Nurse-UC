from flask import Flask, request, jsonify
import ollama

app = Flask(__name__)

@app.route('/generate', methods=['POST'])
def generate_text():
    data = request.json
    prompt = data.get('prompt', '')
    
    # Assuming Ollama provides a Python API
    result = ollama.generate(model='llama3.1', prompt=prompt)
    
    return jsonify({'response': result})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5080)