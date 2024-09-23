import os
from dotenv import load_dotenv
import whisper
from flask import Flask, request, jsonify
import tempfile

# Load environment variables from .env file in the parent directory
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

app = Flask(__name__)

# Get the Whisper models path
whisper_models_path = os.path.join(os.path.dirname(__file__), os.getenv('WHISPER_MODELS_PATH'))

# Load the Whisper model
model = whisper.load_model("small", download_root=whisper_models_path)

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    
    if audio_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if audio_file:
        # Create a temporary file
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, audio_file.filename)
        
        try:
            # Save the file temporarily
            audio_file.save(temp_path)
            
            # Transcribe the audio
            result = model.transcribe(temp_path)
            transcribed_text = result["text"]
            
            return jsonify({'transcription': transcribed_text})
        
        finally:
            # Clean up the temporary file
            os.remove(temp_path)
            os.rmdir(temp_dir)

    return jsonify({'error': 'Failed to process audio file'}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001)