// recorder.js
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let isRecording = false;

const startStopButton = document.getElementById('startStop');
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d');

startStopButton.addEventListener('click', toggleRecording);

function toggleRecording() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
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
            startStopButton.textContent = 'Stop';
            startStopButton.classList.remove('start');
            startStopButton.classList.add('stop');

            drawWaveform();
        });
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;
    startStopButton.textContent = 'Start';
    startStopButton.classList.remove('stop');
    startStopButton.classList.add('start');

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        audioChunks = [];
        // Here you can implement the logic to send the audioBlob to your server
        console.log('Recording stopped. Audio blob created.');
    };
}

function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    analyser.getByteTimeDomainData(dataArray);
    canvasCtx.fillStyle = 'black';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'red';
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