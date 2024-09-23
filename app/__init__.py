from flask import Flask
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from gridfs import GridFS

# Load environment variables from .env file
load_dotenv('.env')

def create_app():
    app = Flask(__name__, static_url_path='/static', static_folder='static')

    # Load configuration from .env file
    app.config['MONGO_URI'] = os.getenv('MONGO_URI')
    app.config['WHISPER_SERVICE_URL'] = os.getenv('WHISPER_SERVICE_URL')

    # Load configuration from .env file
    app.config['MONGO_URI'] = os.getenv('MONGO_URI')

    # Initialize MongoDB client
    client = MongoClient(app.config['MONGO_URI'])
    db = client.get_database('Sandbox-Cluster')

    # Initialize GridFS
    fs = GridFS(db)

    # Register Blueprints
    from .routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    # Expose db and fs instances to be used in models and routes
    app.db = db
    app.fs = fs

    return app