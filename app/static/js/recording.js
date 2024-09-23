document.addEventListener('DOMContentLoaded', function() {
    const recordEventNoteButton = document.getElementById('record_event_note');
    const recordFlowSheetButton = document.getElementById('record_flow_sheet');
    const recordingModal = document.getElementById('recordingModal');
    const recordingTitle = document.getElementById('recordingTitle');
    const startStopButton = document.getElementById('startStop');
    const canvas = document.getElementById('waveform');
    const canvasCtx = canvas.getContext('2d');
    //const recordingsTableBody = document.getElementById('recordingsTable').querySelector('tbody');

    // Check if all elements are found
    if (!recordEventNoteButton || !recordFlowSheetButton || !recordingModal || !recordingTitle || !startStopButton || !canvas) {
        console.error('One or more required DOM elements are missing');
        return; // Exit if any element is missing
    }

    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];
    let audioContext;
    let analyser;
    let dataArray;

    recordEventNoteButton.addEventListener('click', function() {
        openRecordingModal('Event Note');
    });

    recordFlowSheetButton.addEventListener('click', function() {
        openRecordingModal('Flow Sheet');
    });

    startStopButton.addEventListener('click', function() {
        toggleRecording();
    });

    function openRecordingModal(recordType) {
        const selectedPatientId = $('#patientSelect').val();
        const selectedNurseId = $('#nurseSelect').val();

        if (!selectedPatientId || selectedPatientId === 'add_new' || !selectedNurseId || selectedNurseId === 'add_new') {
            alert('Please select both a patient and a nurse before recording.');
            return;
        }

        if (recordingTitle) {
            recordingTitle.textContent = `${recordType} Recording`;
        } else {
            console.error('recordingTitle element not found');
        }

        if (recordingModal) {
            recordingModal.style.display = 'block';
        } else {
            console.error('recordingModal element not found');
        }

        if (startStopButton) {
            startStopButton.textContent = 'Start Recording';
            startStopButton.classList.remove('stop');
            startStopButton.classList.add('start');
        } else {
            console.error('startStopButton element not found');
        }
    }

    function closeRecordingModal() {
        recordingModal.style.display = 'none';
        if (isRecording) {
            stopRecording();
        }
    }

    function resetRecordingState() {
        isRecording = false;
        audioChunks = [];
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    function startRecording() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.fftSize = 2048;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);

                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };
                mediaRecorder.start();
                isRecording = true;
                startStopButton.textContent = 'Stop Recording';
                startStopButton.classList.remove('start');
                startStopButton.classList.add('stop');

                drawWaveform();
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                alert('Error accessing microphone. Please ensure you have granted microphone permissions.');
            });
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;
            startStopButton.textContent = 'Start Recording';
            startStopButton.classList.remove('stop');
            startStopButton.classList.add('start');

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                audioChunks = [];
                
                // Get the current timestamp
                const timestamp = new Date().toISOString();
                
                // Get the NurseID and PatientID
                const nurseId = document.getElementById('nurseSelect').value;
                const patientId = document.getElementById('patientSelect').value;

                // Get the recording title (you may want to implement a way to set this)
                const title = `${nurseId}-${patientId}-${timestamp}`;

                // Call window.uploadAudio to send the audio to the server
                if (typeof window.uploadAudio === 'function') {
                    window.uploadAudio(audioBlob, title, timestamp);
                } else {
                    console.error('uploadAudio function not found. Make sure main.js is loaded properly.');
                }
            };
        }
    }

    function drawWaveform() {
        if (!isRecording) return;

        requestAnimationFrame(drawWaveform);
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = '#e6f3ff';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#007bff';
        canvasCtx.beginPath();
        const sliceWidth = canvas.width * 1.0 / analyser.frequencyBinCount;
        let x = 0;
        for (let i = 0; i < analyser.frequencyBinCount; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    function uploadAudio(audioBlob, title, timestamp) {
        const selectedPatientId = $('#patientSelect').val();
        const selectedNurseId = $('#nurseSelect').val();
    
        if (!selectedPatientId || !selectedNurseId) {
            console.error('Patient ID or Nurse ID is missing');
            alert('Error: Patient or Nurse information is missing. Please try again.');
            return;
        }
    
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        formData.append('title', title);
        formData.append('timestamp', timestamp);
        formData.append('patient_id', selectedPatientId);
        formData.append('nurse_id', selectedNurseId);
    
        fetch('/upload_audio', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                console.log('Audio uploaded and transcribed successfully');
                closeRecordingModal();
                fetchPatientRecordings(selectedPatientId, selectedNurseId);
            } else {
                console.error('Error uploading audio:', data.message);
                alert('Error uploading audio. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error uploading audio:', error);
            alert('Error uploading audio. Please try again.');
        });
    }    

    function fetchPatientRecordings(patientId, nurseId) {
        fetch(`/get_patient_recordings/${patientId}/${nurseId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Received data:", data);
            if (data.status === 'success') {
                displayRecordings(data.recordings);
            } else {
                console.error('Error fetching recordings:', data.message);
                document.getElementById('audio-transcriptions').innerHTML = '<h2>Audio Transcriptions and Summaries for Today</h2><p>Error fetching recordings. Please try again.</p>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('audio-transcriptions').innerHTML = '<h2>Audio Transcriptions and Summaries for Today</h2><p>No new recordings for today..</p>';
        });
    }    

    function displayRecordings(recordings) {
        const audioTranscriptionsSection = document.getElementById('audio-transcriptions');
        audioTranscriptionsSection.innerHTML = '<h2>Audio Transcriptions and Summaries for Today</h2>';
    
        if (recordings.length === 0) {
            audioTranscriptionsSection.innerHTML += '<p>No recordings available for today.</p>';
            return;
        }
    
        recordings.forEach((recording, index) => {
            const transcriptionContainer = document.createElement('div');
            transcriptionContainer.className = 'transcription-container';
    
            const recordingInfo = document.createElement('div');
            recordingInfo.className = 'recording-info';

            const recordingDate = new Date(recording.timestamp);
            const options = { 
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true,
                timeZone: 'America/New_York',
                timeZoneName: 'short'
            };
            const formattedTime = recordingDate.toLocaleString('en-US', options);
            recordingInfo.innerHTML = `<h3>Recording #${index + 1} - ${formattedTime}</h3>`;
    
            const audioElement = document.createElement('audio');
            audioElement.controls = true;
            audioElement.src = `/get_audio/${recording._id}`;
    
            const transcriptionDiv = document.createElement('div');
            transcriptionDiv.className = 'transcription';
            transcriptionDiv.innerHTML = `
                <h4>Verbatim Transcription:</h4>
                <p>${recording.transcription || 'Transcription not available'}</p>
            `;
    
            transcriptionContainer.appendChild(recordingInfo);
            transcriptionContainer.appendChild(audioElement);
            transcriptionContainer.appendChild(transcriptionDiv);
    
            audioTranscriptionsSection.appendChild(transcriptionContainer);
        });
    
        // Add the summary section at the end
        const summarySection = document.createElement('div');
        summarySection.className = 'summary-section';
        summarySection.innerHTML = `
            <h3>End of Day Summary:</h3>
            <p id="summaryContent">Summary not available</p>
            <p id="summaryDate"></p>
        `;
        audioTranscriptionsSection.appendChild(summarySection);
    
        // Call the function from main.js to check and show/hide the Generate Summary button
        if (typeof window.checkAndShowGenerateButton === 'function') {
            window.checkAndShowGenerateButton();
        }
    
        // Fetch and display the latest summary
        if (typeof window.fetchLatestSummary === 'function') {
            window.fetchLatestSummary();
        } else {
            console.error('fetchLatestSummary function not found');
        }
    }
    
    // Update patient recordings when a patient is selected
    $('#patientSelect, #nurseSelect').change(function() {
        const selectedPatientId = $('#patientSelect').val();
        const selectedNurseId = $('#nurseSelect').val();
        if (selectedPatientId && selectedPatientId !== 'add_new' && 
            selectedNurseId && selectedNurseId !== 'add_new') {
            fetchPatientRecordings(selectedPatientId, selectedNurseId);
        } else {
            document.getElementById('audio-transcriptions').innerHTML = '';
        }
    });

    // Close the modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target === recordingModal) {
            closeRecordingModal();
        }
    }

    window.uploadAudio = uploadAudio;
    window.fetchPatientRecordings = fetchPatientRecordings;
    window.displayRecordings = displayRecordings;
    // Make sure fetchPatientRecordings is exposed to the global scope
    window.fetchPatientRecordings = fetchPatientRecordings;

});