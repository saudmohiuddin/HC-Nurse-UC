from pymongo import MongoClient
from bson import ObjectId
import os
import random
import string
from datetime import datetime

# Get the MongoDB URI from the environment variable
mongo_uri = os.getenv('MONGO_URI')
client = MongoClient(mongo_uri)

# Connect to the specific database
db = client.get_database('Sandbox-Cluster')

# Define the Nurse class for storing nurse details
class Nurse:
    def __init__(self, first_name, last_name, nurse_id):
        self.first_name = first_name
        self.last_name = last_name
        self.nurse_id = nurse_id

    def to_dict(self):
        return {
            'first_name': self.first_name,
            'last_name': self.last_name,
            'nurse_id': self.nurse_id
        }

# Ensure the `nurses` collection exists
if 'nurses' not in db.list_collection_names():
    db.create_collection('nurses')

# Define the Patient class for storing patient details

class Patient:
    def __init__(self, name, dob, medical_history, patient_id=None):
        self.name = name
        self.dob = dob
        self.medical_history = medical_history
        self.patient_id = patient_id if patient_id else self.generate_patient_id(name)
        self.mrn = self.patient_id  # MRN is the same as patient_id

    @staticmethod
    def generate_patient_id(name):
        first_part = ''.join(random.choices(string.digits, k=3))
        name_parts = name.split()
        initials = ''.join([part[0].upper() for part in name_parts if part])
        last_part = ''.join(random.choices(string.digits, k=3))
        return f"{first_part}{initials}{last_part}"

    def to_dict(self):
        return {
            'patient_id': self.patient_id,
            'mrn': self.mrn,
            'name': self.name,
            'dob': self.dob,
            'medical_history': self.medical_history
        }

    @property
    def age(self):
        born = datetime.strptime(self.dob, "%Y-%m-%d")
        today = datetime.today()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    # Ensure the `patients` collection exists
    if 'patients' not in db.list_collection_names():
        db.create_collection('patients')

# Define the Response class for storing patient responses
class Response:
    def __init__(self, patient_id, question, answer, timestamp):
        self.patient_id = patient_id
        self.question = question
        self.answer = answer
        self.timestamp = timestamp

    def to_dict(self):
        return {
            'patient_id': self.patient_id,
            'question': self.question,
            'answer': self.answer,
            'timestamp': self.timestamp
        }

# Ensure the `responses` collection exists
if 'responses' not in db.list_collection_names():
    db.create_collection('responses')

# Define the Medication class for storing medication details
class Medication:
    def __init__(self, patient_id, medication_name, administered, timestamp):
        self.patient_id = patient_id
        self.medication_name = medication_name
        self.administered = administered
        self.timestamp = timestamp

    def to_dict(self):
        return {
            'patient_id': self.patient_id,
            'medication_name': self.medication_name,
            'administered': self.administered,
            'timestamp': self.timestamp
        }

# Ensure the `medications` collection exists
if 'medications' not in db.list_collection_names():
    db.create_collection('medications')

# Define the VoiceNote class for storing voice note details
class VoiceNote:
    def __init__(self, patient_id, nurse_id, file_id, title, timestamp, transcription=None):
        self.patient_id = patient_id
        self.nurse_id = nurse_id
        self.file_id = file_id
        self.title = title
        self.timestamp = timestamp
        self.transcription = transcription

    def to_dict(self):
        return {
            'patient_id': self.patient_id,
            'nurse_id': self.nurse_id,
            'file_id': self.file_id,
            'title': self.title,
            'timestamp': self.timestamp,
            'transcription': self.transcription
        }
    
# Ensure the `voicenotes` collection exists
if 'voicenotes' not in db.list_collection_names():
    db.create_collection('voicenotes')
    
# Define the Summary class for storing end of day summaries
class Summary:
    def __init__(self, patient_id, nurse_id, date, summary):
        self.patient_id = patient_id
        self.nurse_id = nurse_id
        self.date = date
        self.summary = summary

    def to_dict(self):
        return {
            'patient_id': self.patient_id,
            'nurse_id': self.nurse_id,
            'date': self.date,
            'summary': self.summary
        }

# Ensure the `summaries` collection exists
if 'summaries' not in db.list_collection_names():
    db.create_collection('summaries')
