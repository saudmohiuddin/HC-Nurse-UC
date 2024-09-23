from flask import Blueprint, jsonify, current_app, request, render_template, send_file
from .models import db, Nurse, Patient, VoiceNote
from bson import ObjectId
from bson import json_util
from datetime import datetime, timezone, time, date
from pymongo import MongoClient
from gridfs import GridFS
from io import BytesIO
import os
import json
import traceback
import random
import string
import requests
import pytz

main = Blueprint('main', __name__)

@main.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@main.route('/add_nurse', methods=['POST'])
def add_nurse():
    data = request.json
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    
    if not first_name or not last_name:
        return jsonify({'status': 'error', 'message': 'First name and last name are required'}), 400
    
    # Check if nurse with this name already exists
    existing_nurse = current_app.db.nurses.find_one({'first_name': first_name, 'last_name': last_name})
    if existing_nurse:
        return jsonify({'status': 'error', 'message': 'A nurse with this name already exists'}), 400
    
    # Generate a unique nurse ID
    def generate_nurse_id():
        initials = (first_name[0] + last_name[0]).upper()
        random_digits = ''.join(random.choices(string.digits, k=4))
        return f"{initials}{random_digits}"

    nurse_id = generate_nurse_id()

    # Ensure the generated ID is unique
    while current_app.db.nurses.find_one({'nurse_id': nurse_id}):
        nurse_id = generate_nurse_id()

    # Create the new nurse document
    new_nurse = {
        'first_name': first_name,
        'last_name': last_name,
        'nurse_id': nurse_id
    }

    # Insert the new nurse
    result = current_app.db.nurses.insert_one(new_nurse)
    
    if result.inserted_id:
        return jsonify({
            'status': 'success', 
            'message': 'Nurse added successfully',
            'nurse_id': nurse_id
        }), 201
    else:
        return jsonify({'status': 'error', 'message': 'Failed to add nurse'}), 500

@main.route('/get_nurses', methods=['GET'])
def get_nurses():
    nurses = list(db.nurses.find({}, {'_id': 0, 'first_name': 1, 'last_name': 1, 'nurse_id': 1}))
    return jsonify({'nurses': nurses})

@main.route('/add_patient', methods=['POST'])
def add_patient():
    data = request.json
    name = data.get('name')
    dob = data.get('dob')
    medical_history = data.get('medical_history')
    
    if not name or not dob:
        return jsonify({'status': 'error', 'message': 'Name and date of birth are required'}), 400
    
    new_patient = Patient(name, dob, medical_history)
    
    # Check if patient with this ID already exists
    while db.patients.find_one({'patient_id': new_patient.patient_id}):
        new_patient.patient_id = new_patient.generate_patient_id()
    
    result = db.patients.insert_one(new_patient.to_dict())
    
    if result.inserted_id:
        return jsonify({
            'status': 'success', 
            'message': 'Patient added successfully',
            'patient_id': new_patient.patient_id,
            'mrn': new_patient.mrn
        }), 201
    else:
        return jsonify({'status': 'error', 'message': 'Failed to add patient'}), 500

@main.route('/get_patients', methods=['GET'])
def get_patients():
    patients = list(db.patients.find({}, {'_id': 1, 'name': 1, 'mrn': 1}))
    for patient in patients:
        patient['_id'] = str(patient['_id'])
    return jsonify(patients)

@main.route('/get_patient/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    try:
        patient = db.patients.find_one({'_id': ObjectId(patient_id)})
        if patient:
            # Calculate age
            dob = datetime.strptime(patient['dob'], "%Y-%m-%d")
            today = datetime.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            return jsonify({
                'mrn': patient['patient_id'],  # Assuming patient_id is used as MRN
                'age': age,
                'medical_history': patient['medical_history']
            })
        else:
            return jsonify({'error': 'Patient not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main.route('/submit_form', methods=['POST'])
def submit_form():
    data = request.json
    patient_id = data.get('patient_id')
    nurse_id = data.get('nurse_id')
    shift = data.get('shift')  # New field for AM/PM
    responses = data.get('responses', [])
    medications = data.get('medications', [])
    
    if not patient_id or not nurse_id:
        return jsonify({'status': 'error', 'message': 'Missing patient or nurse ID'}), 400
    
    try:
        patient_id = ObjectId(patient_id)
    except InvalidId:
        return jsonify({'status': 'error', 'message': 'Invalid patient ID'}), 400
    
    timestamp = datetime.utcnow()
    
    try:
        # Insert only non-empty responses
        for response in responses:
            if response['answer']:  # Only insert if there's an answer
                response['patient_id'] = patient_id
                response['nurse_id'] = nurse_id
                response['shift'] = shift
                response['timestamp'] = timestamp
                db.responses.insert_one(response)
        
        # Insert only administered medications
        for medication in medications:
            if medication['administered']:  # Only insert if administered is True
                medication['patient_id'] = patient_id
                medication['nurse_id'] = nurse_id
                medication['shift'] = shift
                medication['timestamp'] = timestamp
                db.medications.insert_one(medication)
        
        return jsonify({'status': 'success', 'message': 'Form submitted successfully'}), 200
    except Exception as e:
        print(f"Error submitting form: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Server error while processing form'}), 500
    
    console.log('Form data being sent:', formData);

@main.route('/upload_audio', methods=['POST'])
def upload_audio():
    try:
        if 'audio' not in request.files:
            return jsonify({'status': 'error', 'message': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        title = request.form.get('title')
        timestamp = datetime.now(pytz.UTC)
        patient_id = request.form.get('patient_id')
        nurse_id = request.form.get('nurse_id')
        
        if not all([audio_file, title, timestamp, patient_id, nurse_id]):
            return jsonify({'status': 'error', 'message': 'Missing required information'}), 400
        
        # Get GridFS instance
        fs = GridFS(db)
        
        # Read the audio file into memory
        audio_data = audio_file.read()
        
        # Store the file in GridFS
        file_id = fs.put(audio_data, filename=f"{patient_id}_{nurse_id}_{timestamp}.wav",
                         content_type='audio/wav')
        
        # Send audio to Whisper for transcription
        files = {'audio': ('audio.wav', audio_data, 'audio/wav')}
        try:
            whisper_service_url = current_app.config['WHISPER_SERVICE_URL']
            response = requests.post(f'{whisper_service_url}/transcribe', files=files, timeout=30)
            response.raise_for_status()  # Raises an HTTPError if the HTTP request returned an unsuccessful status code
            transcription_result = response.json()
            transcription = transcription_result.get('transcription', "Transcription not available")
        except requests.RequestException as e:
            current_app.logger.error(f"Error connecting to Whisper service: {str(e)}")
            transcription = "Transcription failed due to service error"
        except ValueError as e:
            current_app.logger.error(f"Error parsing Whisper service response: {str(e)}")
            transcription = "Transcription failed due to invalid response"
        
        # Create a VoiceNote document
        voice_note = {
            'patient_id': patient_id,
            'nurse_id': nurse_id,
            'file_id': file_id,
            'title': title,
            'timestamp': timestamp,
            'transcription': transcription
        }
        
        # Insert the voice note document
        #db.voicenotes.insert_one(voice_note)
        result = current_app.db.voicenotes.insert_one(voice_note)
        
        current_app.logger.info(f"Uploaded audio file: {title}, Timestamp: {timestamp}, ID: {result.inserted_id}")
        
        return jsonify({'status': 'success', 'message': 'Audio uploaded and transcribed successfully'}), 200
    
    except Exception as e:
        # Log the full error traceback for debugging
        current_app.logger.error(f"Error in upload_audio: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'status': 'error', 'message': 'An internal server error occurred'}), 500
    
@main.route('/get_patient_recordings/<patient_id>/<nurse_id>', methods=['GET'])
def get_patient_recordings(patient_id, nurse_id):
    try:
        # Get the current date in EST
        today = datetime.now(pytz.UTC).date()
        start_of_day = datetime.combine(today, datetime.min.time()).replace(tzinfo=pytz.UTC)
        end_of_day = datetime.combine(today, datetime.max.time()).replace(tzinfo=pytz.UTC)
        
        # Convert start and end of day to UTC for MongoDB query
        start_of_day_utc = start_of_day.astimezone(pytz.UTC)
        end_of_day_utc = end_of_day.astimezone(pytz.UTC)
        
        # Query for recordings from the current date
        recordings = list(current_app.db.voicenotes.find({
            'patient_id': patient_id,
            'nurse_id': nurse_id,
            'timestamp': {
                '$gte': start_of_day,
                '$lt': end_of_day
            }
        }, {'_id': 1, 'title': 1, 'timestamp': 1, 'transcription': 1}))
        
        # Convert ObjectId to string and UTC timestamp to EST for each recording
        for recording in recordings:
            recording['_id'] = str(recording['_id'])
            recording['timestamp'] = recording['timestamp'].isoformat()
        
        current_app.logger.info(f"Retrieved {len(recordings)} recordings for patient {patient_id} and nurse {nurse_id}")
        
        return json.dumps({'status': 'success', 'recordings': recordings}, default=json_util.default), 200, {'ContentType':'application/json'}
    except Exception as e:
        current_app.logger.error(f"Error in get_patient_recordings: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'status': 'error', 'message': 'An internal server error occurred'}), 500

@main.route('/get_audio/<recording_id>', methods=['GET'])
def get_audio(recording_id):
    try:
        fs = GridFS(db)
        voice_note = db.voicenotes.find_one({'_id': ObjectId(recording_id)})
        if voice_note and fs.exists(voice_note['file_id']):
            audio_file = fs.get(voice_note['file_id'])
            return send_file(
                BytesIO(audio_file.read()),
                mimetype='audio/wav',
                as_attachment=True,
                download_name=f"{voice_note['title']}.wav"
            )
        return jsonify({'status': 'error', 'message': 'Recording not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error in get_audio: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'status': 'error', 'message': 'An internal server error occurred'}), 500

@main.route('/generate_summary', methods=['POST'])
def generate_summary():
    data = request.json
    patient_id = data.get('patient_id')
    nurse_id = data.get('nurse_id')

    if not patient_id or not nurse_id:
        return jsonify({'status': 'error', 'message': 'Missing patient or nurse ID'}), 400

    # Fetch all transcriptions for the day
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    transcriptions = db.voicenotes.find({
        'patient_id': patient_id,
        'nurse_id': nurse_id,
        'timestamp': {'$gte': today}
    })

    # Prepare the prompt for the LLM
    prompt = "Please summarize the following transcriptions:\n\n"
    for t in transcriptions:
        prompt += f"Timestamp: {t['timestamp']}\nTranscription: {t['transcription']}\n\n"

    # Send request to the Ollama API
    try:
        response = requests.post('http://127.0.0.1:5080/generate', json={'prompt': prompt})
        response.raise_for_status()
        summary = response.json()['response']

        # Store the summary in the database
        db.summaries.insert_one({
            'patient_id': patient_id,
            'nurse_id': nurse_id,
            'date': today,
            'summary': summary
        })

        return jsonify({'status': 'success', 'summary': summary})
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Error calling Ollama API: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error generating summary'}), 500
    
@main.route('/get_latest_summary', methods=['GET'])
def get_latest_summary():
    try:
        patient_id = request.args.get('patient_id')
        nurse_id = request.args.get('nurse_id')

        if not patient_id or not nurse_id:
            return jsonify({'status': 'error', 'message': 'Missing patient or nurse ID'}), 400

        # Get the latest summary for the patient and nurse
        latest_summary = db.summaries.find_one(
            {'patient_id': patient_id, 'nurse_id': nurse_id},
            sort=[('date', -1)]
        )

        if latest_summary:
            return jsonify({
                'status': 'success',
                'summary': latest_summary['summary'],
                'date': latest_summary['date'].isoformat()
            })
        else:
            return jsonify({'status': 'error', 'message': 'No summary found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error in get_latest_summary: {str(e)}")
        return jsonify({'status': 'error', 'message': f'An error occurred: {str(e)}'}), 500
    
@main.route('/get_transcription_count', methods=['GET'])
def get_transcription_count():
    patient_id = request.args.get('patient_id')
    nurse_id = request.args.get('nurse_id')

    if not patient_id or not nurse_id:
        return jsonify({'status': 'error', 'message': 'Missing patient or nurse ID'}), 400

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.voicenotes.count_documents({
        'patient_id': patient_id,
        'nurse_id': nurse_id,
        'timestamp': {'$gte': today}
    })

    return jsonify({'status': 'success', 'count': count})