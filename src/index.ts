import { Ai } from "@cloudflare/ai";

export interface Env {
	AI: Ai;
	TEXT: KVNamespace;
	SECRET_KEY: string;
}

export default {
	async fetch(request: Request, env: Env) {
		try {
			const { pathname } = new URL(request.url);

			if (
				request.method.toUpperCase() === "GET" &&
				pathname === "/index.html"
			) {
				return new Response(html, { headers: { "Content-Type": "html" } });
			}

			const apiKey = request.headers.get("X-Api-Key");
			if (apiKey == null || apiKey !== env.SECRET_KEY) {
				return new Response(null, { status: 404 });
			}

			if (request.method.toUpperCase() === "POST") {
				if (request.body == null) {
					return new Response(null, { status: 400 });
				}
				const blob = await request.arrayBuffer();
				console.log(blob);
				const ai = new Ai(env.AI);
				const input = {
					audio: [...new Uint8Array(blob)],
				};
				const response = await ai.run<"@cf/openai/whisper">(
					"@cf/openai/whisper",
					input,
				);

				await env.TEXT.put(new Date().getTime().toString(), response.text, {
					expirationTtl: 604800, // one week
				});

				return Response.json(response);
			}

			if (request.method.toUpperCase() === "GET" && pathname === "/key") {
				const list = await env.TEXT.list();
				return Response.json({ keys: list.keys.map((key) => key.name) });
			}

			if (request.method.toUpperCase() === "GET") {
				const text = await env.TEXT.get(pathname.substring(1));
				return Response.json({ text }, { status: 200 });
			}

			return new Response(null, { status: 404 });
		} catch (error) {
			console.log(error);
			return new Response(error instanceof Error ? error.message : null, {
				status: 500,
			});
		}
	},
};

const html =
	"<!DOCTYPE html><html lang=\"en\">	<head>		<meta charset=\"UTF-8\" />		<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />		<title>Audio Record</title>		<style>			body {				font-family: 'Arial', sans-serif;				background-color: #f5f5f5;				margin: 0;				padding: 20px;				display: flex;				flex-direction: column;				align-items: center;				justify-content: center;				height: 100vh;			}			h1 {				color: #333;				margin-bottom: 20px;			}			label {				margin-right: 5px;			}			input {				width: 100%;				padding: 5px;				margin-bottom: 10px;			}			button {				width: 100%;				box-sizing: border-box;				padding: 10px;				margin: 5px;				cursor: pointer;				background-color: #4caf50;				color: white;				border: none;				border-radius: 4px;			}			button:disabled {				background-color: #aaaaaa;				cursor: not-allowed;			}			#transcriptionResult {				margin-top: 10px;				color: #333;			}			#keyList {				display: flex;				flex-wrap: wrap;				justify-content: center;				margin-top: 20px;			}			#keyList button {				width: 100%;				box-sizing: border-box;				padding: 10px;				margin: 5px;				cursor: pointer;				background-color: #4caf50;				color: white;				border: none;			}			#textModal {				display: none;				position: fixed;				z-index: 1;				left: 0;				top: 0;				width: 100%;				height: 100%;				overflow: auto;				background-color: rgba(0, 0, 0, 0.5);			}			#textModal button {				width: 10%; /* Adjust the width as needed */				box-sizing: border-box;				padding: 0px;				margin: 0px;				cursor: pointer;				background-color: #4caf50;				color: white;				border: none;			}			.modal-content {				position: relative;				display: flex;				justify-content: space-between;				margin: 10% auto;				padding: 20px;				width: 80%;				background-color: #fefefe;				border-radius: 5px;				box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);			}			.close {				position: absolute;				top: 10px;				right: 10px;				font-size: 20px;				font-weight: bold;				cursor: pointer;				color: #333;			}		</style>	</head>	<body>		<h1>Audio Recorder</h1>		<label for=\"apiKey\">API Key:</label>		<input type=\"text\" id=\"apiKey\" placeholder=\"Enter your API key\" />		<button id=\"startRecord\">Start</button>		<button id=\"stopRecord\" disabled>Stop</button>		<button id=\"playRecord\" disabled>Play</button>		<button id=\"uploadRecord\" disabled>Upload</button>		<div id=\"transcriptionResult\"></div>		<div id=\"keyList\"></div>		<div id=\"textModal\" class=\"modal\">			<div class=\"modal-content\">				<div id=\"textModalContent\"></div>				<button id=\"modalClose\">&times;</button>			</div>		</div>		<script>			document.addEventListener('DOMContentLoaded', async (event) => {				let audioContext;				let mediaRecorder;				let recordedChunks = [];				let apiKeyInput = document.getElementById('apiKey');				let apiKey;				const apiUrl = window.location.origin;				const startRecordButton = document.getElementById('startRecord');				const stopRecordButton = document.getElementById('stopRecord');				const uploadRecordButton = document.getElementById('uploadRecord');				const playRecordButton = document.getElementById('playRecord');				const modalCloseButton = document.getElementById('modalClose');				const transcriptionResultDiv = document.getElementById('transcriptionResult');				const keyListDiv = document.getElementById('keyList');				startRecordButton.addEventListener('click', startRecording);				stopRecordButton.addEventListener('click', stopRecording);				uploadRecordButton.addEventListener('click', uploadRecording);				playRecordButton.addEventListener('click', playRecording);				modalCloseButton.addEventListener('click', closeModal);				async function getKeyList() {					try {						const response = await fetch(`${apiUrl}/key`, {							method: 'GET',							headers: {								'X-Api-Key': apiKey,							},						});						if (response.ok) {							const result = await response.json();							const keyList = result.keys || [];							keyListDiv.innerHTML = '';							keyList.forEach((timestamp) => {								const keyButton = document.createElement('button');								const date = new Date(Number(timestamp));								keyButton.innerText = date.toLocaleString({ timeZone: 'Asian/Tokyo' });								keyButton.addEventListener('click', () => {									openModal(timestamp);								});								keyListDiv.appendChild(keyButton);							});						} else {							console.error('Failed to get key list.');						}					} catch (error) {						console.error('Error during key list retrieval:', error);					}				}				async function startRecording() {					recordedChunks = [];					apiKey = apiKeyInput.value;					if (!apiKey) {						console.error('Please enter your API key.');						return;					}					audioContext = new (window.AudioContext || window.webkitAudioContext)();					const stream = await navigator.mediaDevices.getUserMedia({ audio: true });					mediaRecorder = new MediaRecorder(stream);					mediaRecorder.ondataavailable = (event) => {						if (event.data.size > 0) {							recordedChunks.push(event.data);						}					};					mediaRecorder.onstop = () => {						uploadRecordButton.disabled = false;						playRecordButton.disabled = false;					};					mediaRecorder.start();					startRecordButton.disabled = true;					stopRecordButton.disabled = false;				}				function stopRecording() {					mediaRecorder.stop();					startRecordButton.disabled = false;					stopRecordButton.disabled = true;				}				async function uploadRecording() {					const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });					try {						if (!apiKey) {							console.error('API key is not available. Please refresh the page.');							return;						}						const response = await fetch(apiUrl, {							method: 'POST',							headers: {								'Content-Type': 'audio/wav',								'X-Api-Key': apiKey,							},							body: audioBlob,						});						if (response.ok) {							const result = await response.json();							const transcription = result.text || 'No transcription available.';							transcriptionResultDiv.innerText = 'Transcription : ' + transcription;							getKeyList();						} else {							console.error('Upload failed.');						}					} catch (error) {						console.error('Error during upload:', error);					}				}				function playRecording() {					const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });					const audioUrl = URL.createObjectURL(audioBlob);					const audioElement = new Audio(audioUrl);					audioElement.play();				}				async function openModal(timestamp) {					const response = await fetch(`${window.location.origin}/${timestamp}`, {						method: 'GET',						headers: {							'X-Api-Key': apiKey,						},					});					if (response.ok) {						const result = await response.json();						const text = result.text || 'No text available.';						document.getElementById('textModalContent').innerText = text;						document.getElementById('textModal').style.display = 'block';					} else {						console.error('Failed to get transcription.');					}				}				function closeModal() {					document.getElementById('textModal').style.display = 'none';				}				getKeyList();			});		</script>	</body></html>";
