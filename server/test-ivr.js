#!/usr/bin/env node

/**
 * Serveur de test local pour l'IVR
 * Lance un serveur Express qui simule les endpoints API Vercel
 * Permet de tester l'IVR en local sans déploiement
 *
 * Usage: npm run test-ivr
 * Puis ouvrir: http://localhost:3000/test-ivr
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import OpenAI from 'openai';

// Charger les variables d'environnement
config();

// ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Store en mémoire pour les tests
const conversationStore = new Map();

// Vérifier la présence de la clé OpenAI
if (!process.env.OPENAI_API_KEY) {
	console.error('❌ ERREUR: OPENAI_API_KEY manquante dans .env');
	console.error('💡 Ajoutez: OPENAI_API_KEY=sk-proj-...');
	process.exit(1);
}

console.log('🔧 Mode: RÉEL (avec OpenAI + Jambonz)');

// ============================================================================
// ENDPOINT 1: POST /api/ivr/start-call
// ============================================================================
app.post('/api/ivr/start-call', async (req, res) => {
	console.log('📞 [start-call] Nouvelle demande d\'appel');

	const { sdp, type } = req.body;

	if (!sdp || type !== 'offer') {
		return res.status(400).json({ error: 'Invalid SDP offer' });
	}

	// En mode test, on simule une connexion immédiate
	// Dans un vrai environnement, ceci passerait par Jambonz

	// Generate valid fingerprint
	const fingerprint = Array.from({ length: 32 }, () =>
		Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')
	).join(':');

	// Build SDP line by line to avoid formatting issues
	const sdpLines = [
		'v=0',
		`o=- ${Date.now()} 2 IN IP4 127.0.0.1`,
		's=Test IVR',
		't=0 0',
		'a=group:BUNDLE 0',
		'a=msid-semantic: WMS *',
		'm=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8',
		'c=IN IP4 127.0.0.1',
		'a=rtcp:9 IN IP4 127.0.0.1',
		`a=ice-ufrag:${Array.from({ length: 8 }, () => Math.random().toString(36).charAt(2)).join('')}`,
		`a=ice-pwd:${Array.from({ length: 24 }, () => Math.random().toString(36).charAt(2)).join('')}`,
		'a=ice-options:trickle',
		`a=fingerprint:sha-256 ${fingerprint}`,
		'a=setup:active',
		'a=mid:0',
		'a=sendrecv',
		'a=rtcp-mux',
		'a=rtpmap:111 opus/48000/2',
		'a=fmtp:111 minptime=10;useinbandfec=1',
		''
	];

	const mockAnswerSdp = sdpLines.join('\r\n');

	console.log('✅ [start-call] SDP answer généré (mode simulation)');

	res.json({
		sdp: mockAnswerSdp,
		type: 'answer'
	});
});

// ============================================================================
// ENDPOINT 2: POST /api/ivr/appointment-webhook
// ============================================================================
app.post('/api/ivr/appointment-webhook', async (req, res) => {
	const { call_sid, speech, from, to, call_status } = req.body;

	console.log('📨 [webhook] Reçu:', { call_sid, speech, call_status });

	// Initialiser la conversation
	if (!conversationStore.has(call_sid)) {
		conversationStore.set(call_sid, {
			messages: [],
			extractedData: {}
		});
	}

	const conversation = conversationStore.get(call_sid);

	// Premier appel - message d'accueil
	if (call_status === 'ringing' || !speech) {
		console.log('👋 [webhook] Message d\'accueil');
		return res.json([
			{
				verb: 'say',
				text: 'Bienvenue sur les services CLAUDIO. Comment puis-je vous aider ?',
				voice: 'Google.fr-FR-Standard-A'
			},
			{
				verb: 'listen',
				actionHook: '/api/ivr/appointment-webhook',
				timeout: 60,
				finishOnKey: '#'
			}
		]);
	}

	// Ajouter le message utilisateur
	conversation.messages.push({
		role: 'user',
		content: speech
	});

	// Vérifier si c'est une demande de RDV
	const wantsAppointment = /rendez[- ]?vous|rdv|appointment|consulter|voir|docteur|médecin/i.test(speech);

	if (!wantsAppointment && conversation.messages.length === 1) {
		console.log('❌ [webhook] Pas de demande de RDV détectée');
		return res.json([
			{
				verb: 'say',
				text: 'Je peux vous aider à prendre un rendez-vous. Dites "rendez-vous" pour commencer.',
				voice: 'Google.fr-FR-Standard-A'
			},
			{
				verb: 'listen',
				actionHook: '/api/ivr/appointment-webhook',
				timeout: 60
			}
		]);
	}

	// Générer la réponse avec GPT-4
	console.log('🧠 [webhook] Appel GPT-4 réel');

	const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

	const completion = await openai.chat.completions.create({
		model: 'gpt-4-turbo-preview',
		messages: [
			{
				role: 'system',
				content: `Tu es CLAUDIO, un assistant pour la prise de rendez-vous médical.
Collecte : nom complet, date, docteur (optionnel).
Sois chaleureux et pose UNE question à la fois.
IMPORTANT : Réponds UNIQUEMENT avec ce que tu vas dire à l'utilisateur, sans instructions ni métadonnées.`
			},
			...conversation.messages
		],
		temperature: 0.7,
		max_tokens: 150
	});

	const assistantResponse = completion.choices[0].message.content ||
		"Je n'ai pas bien compris. Pouvez-vous répéter ?";

	conversation.messages.push({
		role: 'assistant',
		content: assistantResponse
	});

	// Extraction des données avec GPT-4
	const extractionPrompt = `Analyse la conversation suivante et extrais les informations de rendez-vous au format JSON strict.

Conversation :
${conversation.messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Réponds UNIQUEMENT avec un JSON valide au format suivant (sans markdown, sans texte avant/après) :
{
  "person": "nom complet du patient ou null",
  "date": "date au format YYYY-MM-DD ou description comme '15 mars' ou null",
  "docteur": "nom du docteur ou null",
  "complete": true si toutes les infos (person et date) sont présentes, false sinon
}`;

	const extractionCompletion = await openai.chat.completions.create({
		model: 'gpt-4-turbo-preview',
		messages: [{ role: 'user', content: extractionPrompt }],
		temperature: 0,
		max_tokens: 200
	});

	let extracted = { person: null, date: null, docteur: null, complete: false };
	try {
		const jsonText = extractionCompletion.choices[0].message.content || '{}';
		// Nettoyer le markdown si présent
		const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
		extracted = JSON.parse(cleanJson);
	} catch (e) {
		console.error('[IVR] JSON parse error:', e);
	}

	console.log('📊 [webhook] Données extraites:', extracted);

	// Mettre à jour les données
	if (extracted.person) conversation.extractedData.person = extracted.person;
	if (extracted.date) conversation.extractedData.date = extracted.date;
	if (extracted.docteur) conversation.extractedData.docteur = extracted.docteur;
	conversation.extractedData.phone = from;

	// Si complet, terminer
	if (extracted.complete) {
		console.log('✅ [webhook] Rendez-vous complet, fin de l appel');

		// Sauvegarder pour récupération
		conversationStore.set('last-appointment', {
			messages: [],
			extractedData: {
				...conversation.extractedData,
				callSid: call_sid,
				createdAt: new Date().toISOString()
			}
		});

		return res.json([
			{
				verb: 'say',
				text: assistantResponse,
				voice: 'Google.fr-FR-Standard-A'
			},
			{
				verb: 'say',
				text: 'Merci, votre rendez-vous a été enregistré. Au revoir !',
				voice: 'Google.fr-FR-Standard-A'
			},
			{
				verb: 'hangup'
			}
		]);
	}

	// Continuer la conversation
	console.log('💬 [webhook] Conversation continue');
	return res.json([
		{
			verb: 'say',
			text: assistantResponse,
			voice: 'Google.fr-FR-Standard-A'
		},
		{
			verb: 'listen',
			actionHook: '/api/ivr/appointment-webhook',
			timeout: 60
		}
	]);
});

// ============================================================================
// ENDPOINT 3: GET /api/ivr/last-appointment
// ============================================================================
app.get('/api/ivr/last-appointment', (req, res) => {
	console.log('📥 [last-appointment] Demande du dernier RDV');

	const lastAppointment = conversationStore.get('last-appointment');

	if (!lastAppointment || !lastAppointment.extractedData) {
		console.log('❌ [last-appointment] Aucun RDV trouvé');
		return res.status(404).json({ error: 'No appointment found' });
	}

	console.log('✅ [last-appointment] RDV retourné:', lastAppointment.extractedData);
	res.json(lastAppointment.extractedData);
});

// ============================================================================
// ENDPOINT TEST: GET /test-ivr (page de test)
// ============================================================================
app.get('/test-ivr', (req, res) => {
	res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test IVR - CLAUDIO</title>
  <!-- JsSIP pour connexion SIP over WebSocket -->
  <script src="https://cdn.jsdelivr.net/npm/jssip@3.10.0/dist/jssip.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 700px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .test-section {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .test-section h2 {
      font-size: 18px;
      color: #333;
      margin-bottom: 15px;
    }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s;
      width: 100%;
      margin-bottom: 10px;
    }
    button:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }
    button.danger {
      background: #e53935;
    }
    button.danger:hover {
      background: #c62828;
    }
    .status {
      padding: 12px;
      border-radius: 8px;
      margin-top: 15px;
      font-size: 14px;
    }
    .status.info {
      background: #e3f2fd;
      color: #1976d2;
      border-left: 4px solid #1976d2;
    }
    .status.success {
      background: #e8f5e9;
      color: #388e3c;
      border-left: 4px solid #388e3c;
    }
    .status.error {
      background: #ffebee;
      color: #d32f2f;
      border-left: 4px solid #d32f2f;
    }
    .status.warning {
      background: #fff3e0;
      color: #e65100;
      border-left: 4px solid #e65100;
    }
    .log {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-height: 250px;
      overflow-y: auto;
      margin-top: 15px;
    }
    .log-line {
      margin-bottom: 5px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 10px;
    }
    .badge.simulation {
      background: #fff3cd;
      color: #856404;
    }
    .badge.real {
      background: #d4edda;
      color: #155724;
    }
    .config-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 15px;
    }
    .config-form label {
      font-size: 12px;
      color: #666;
      display: block;
      margin-bottom: 4px;
    }
    .config-form input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
    }
    .config-form input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .config-form .full-width {
      grid-column: 1 / -1;
    }
    .sip-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .sip-status .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ccc;
    }
    .sip-status .dot.connected {
      background: #4caf50;
      animation: pulse 2s infinite;
    }
    .sip-status .dot.connecting {
      background: #ff9800;
      animation: pulse 1s infinite;
    }
    .sip-status .dot.error {
      background: #f44336;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 Test IVR - CLAUDIO</h1>
    <p class="subtitle">
      Environnement de test local avec Jambonz + OpenAI GPT-4
      <span class="badge real">MODE RÉEL</span>
    </p>

    <!-- Test 1: Webhook simple -->
    <div class="test-section">
      <h2>1️⃣ Test du webhook (simulation conversation)</h2>
      <button onclick="testWebhook()">Tester le webhook</button>
      <div id="webhook-status"></div>
    </div>

    <!-- Test 2: Conversation complète -->
    <div class="test-section">
      <h2>2️⃣ Test conversation complète</h2>
      <button onclick="testFullConversation()">Simuler une conversation</button>
      <div id="conversation-status"></div>
    </div>

    <!-- Test 3: Récupération RDV -->
    <div class="test-section">
      <h2>3️⃣ Récupérer le dernier RDV</h2>
      <button onclick="testGetAppointment()">Récupérer le RDV</button>
      <div id="appointment-status"></div>
    </div>

    <!-- Test 4: WebRTC avec Jambonz via SIP over WSS -->
    <div class="test-section">
      <h2>4️⃣ Appel WebRTC via Jambonz (SIP over WSS)</h2>
      
      <!-- Configuration SIP -->
      <div class="config-form">
        <div class="full-width">
          <label>Serveur WebSocket (WSS)</label>
          <input type="text" id="sip-server" value="wss://31.97.178.44:8443" placeholder="wss://server:8443">
        </div>
        <div>
          <label>Utilisateur SIP</label>
          <input type="text" id="sip-user" value="webrtc-test" placeholder="username">
        </div>
        <div>
          <label>Mot de passe SIP</label>
          <input type="password" id="sip-password" value="" placeholder="password">
        </div>
        <div class="full-width">
          <label>Numéro à appeler (optionnel)</label>
          <input type="text" id="sip-target" value="*000" placeholder="*000 ou numéro">
        </div>
      </div>
      
      <!-- Status SIP -->
      <div class="sip-status">
        <span class="dot" id="sip-dot"></span>
        <span id="sip-status-text">Non connecté</span>
      </div>
      
      <button id="sip-connect-btn" onclick="connectSIP()">🔌 Connecter au serveur SIP</button>
      <button id="webrtc-btn" onclick="testWebRTC()" disabled>📞 Démarrer appel WebRTC</button>
      <button id="hangup-btn" onclick="hangupCall()" class="danger" style="display:none;">📴 Raccrocher</button>
      
      <div id="webrtc-status"></div>
      <audio id="remote-audio" autoplay></audio>
      <audio id="local-audio" muted></audio>
    </div>

    <!-- Logs -->
    <div class="test-section">
      <h2>📋 Logs</h2>
      <div id="logs" class="log"></div>
    </div>
  </div>

  <script>
    const logs = [];

    function addLog(message, type = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      logs.push('[' + timestamp + '] ' + message);
      updateLogs();
    }

    function updateLogs() {
      const logsEl = document.getElementById('logs');
      logsEl.innerHTML = logs.map(log => '<div class="log-line">' + log + '</div>').join('');
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    async function testWebhook() {
      const statusEl = document.getElementById('webhook-status');
      statusEl.innerHTML = '<div class="status info">⏳ Test en cours...</div>';
      addLog('🧪 Test webhook demarre');

      try {
        const response = await fetch('/api/ivr/appointment-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call_sid: 'test-' + Date.now(),
            speech: 'je veux un rendez-vous',
            call_status: 'in-progress',
            from: '+33612345678',
            to: '+33987654321'
          })
        });

        const data = await response.json();
        addLog('✅ Webhook repondu: ' + JSON.stringify(data[0]));

        statusEl.innerHTML = '<div class="status success">✅ Succes ! IVR a repondu : "' + data[0].text + '"</div>';
      } catch (error) {
        addLog('❌ Erreur: ' + error.message);
        statusEl.innerHTML = '<div class="status error">❌ Erreur: ' + error.message + '</div>';
      }
    }

    async function testFullConversation() {
      const statusEl = document.getElementById('conversation-status');
      statusEl.innerHTML = '<div class="status info">⏳ Simulation en cours...</div>';
      addLog('🎭 Simulation conversation complete');

      const callSid = 'test-conv-' + Date.now();
      const messages = [
        'je veux un rendez-vous',
        'Jean Dupont',
        'le 15 mars',
        'docteur Martin'
      ];

      try {
        for (let i = 0; i < messages.length; i++) {
          addLog('👤 User: "' + messages[i] + '"');

          const response = await fetch('/api/ivr/appointment-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              call_sid: callSid,
              speech: messages[i],
              call_status: 'in-progress',
              from: '+33612345678'
            })
          });

          const data = await response.json();
          addLog('🤖 IVR: "' + data[0].text + '"');

          await new Promise(r => setTimeout(r, 500));
        }

        addLog('✅ Conversation terminee');
        statusEl.innerHTML = '<div class="status success">✅ Conversation simulee avec succes !</div>';
      } catch (error) {
        addLog('❌ Erreur: ' + error.message);
        statusEl.innerHTML = '<div class="status error">❌ Erreur: ' + error.message + '</div>';
      }
    }

    async function testGetAppointment() {
      const statusEl = document.getElementById('appointment-status');
      statusEl.innerHTML = '<div class="status info">⏳ Recuperation...</div>';
      addLog('📥 Recuperation du dernier RDV');

      try {
        const response = await fetch('/api/ivr/last-appointment');

        if (response.status === 404) {
          addLog('⚠️ Aucun RDV trouve (effectuez test 2 avant)');
          statusEl.innerHTML = '<div class="status info">ℹ️ Aucun RDV trouve. Effectuez test de conversation complete avant.</div>';
          return;
        }

        const data = await response.json();
        addLog('✅ RDV recupere: ' + JSON.stringify(data));

        statusEl.innerHTML = '<div class="status success">✅ Rendez-vous recupere :<br>' +
          '<strong>Patient:</strong> ' + (data.person || 'N/A') + '<br>' +
          '<strong>Date:</strong> ' + (data.date || 'N/A') + '<br>' +
          '<strong>Docteur:</strong> ' + (data.docteur || 'N/A') + '<br>' +
          '<strong>Telephone:</strong> ' + (data.phone || 'N/A') +
          '</div>';
      } catch (error) {
        addLog('❌ Erreur: ' + error.message);
        statusEl.innerHTML = '<div class="status error">❌ Erreur: ' + error.message + '</div>';
      }
    }

    // ============================================================
    // JSSIP - Connexion SIP over WebSocket avec Jambonz
    // ============================================================
    
    let sipUA = null;           // JsSIP User Agent
    let currentSession = null;  // Session d'appel en cours
    let isRegistered = false;   // Etat d'enregistrement SIP
    
    // Configuration par défaut
    const defaultConfig = {
      server: 'wss://31.97.178.44:8443',
      user: 'webrtc-test',
      password: '',
      target: '*000'
    };
    
    // Chargement des valeurs sauvegardées
    function loadSavedConfig() {
      try {
        const saved = localStorage.getItem('jambonz-sip-config');
        if (saved) {
          const config = JSON.parse(saved);
          document.getElementById('sip-server').value = config.server || defaultConfig.server;
          document.getElementById('sip-user').value = config.user || defaultConfig.user;
          document.getElementById('sip-password').value = config.password || '';
          document.getElementById('sip-target').value = config.target || defaultConfig.target;
        }
      } catch (e) {
        addLog('⚠️ Impossible de charger la config sauvegardée');
      }
    }
    
    // Sauvegarde de la configuration
    function saveConfig() {
      const config = {
        server: document.getElementById('sip-server').value,
        user: document.getElementById('sip-user').value,
        password: document.getElementById('sip-password').value,
        target: document.getElementById('sip-target').value
      };
      localStorage.setItem('jambonz-sip-config', JSON.stringify(config));
    }
    
    // Mise à jour du statut SIP
    function updateSIPStatus(status, isConnected = false, isConnecting = false, isError = false) {
      const dot = document.getElementById('sip-dot');
      const text = document.getElementById('sip-status-text');
      const callBtn = document.getElementById('webrtc-btn');
      const connectBtn = document.getElementById('sip-connect-btn');
      
      dot.className = 'dot';
      if (isConnected) dot.classList.add('connected');
      else if (isConnecting) dot.classList.add('connecting');
      else if (isError) dot.classList.add('error');
      
      text.textContent = status;
      callBtn.disabled = !isConnected;
      
      if (isConnected) {
        connectBtn.textContent = '🔌 Deconnecter';
        connectBtn.classList.add('danger');
      } else {
        connectBtn.textContent = '🔌 Connecter au serveur SIP';
        connectBtn.classList.remove('danger');
      }
    }
    
    // Connexion au serveur SIP
    async function connectSIP() {
      const statusEl = document.getElementById('webrtc-status');
      
      // Si déjà connecté, déconnecter
      if (sipUA && isRegistered) {
        addLog('📴 Déconnexion du serveur SIP...');
        sipUA.stop();
        sipUA = null;
        isRegistered = false;
        updateSIPStatus('Non connecté');
        statusEl.innerHTML = '<div class="status info">ℹ️ Déconnecté du serveur SIP</div>';
        return;
      }
      
      // Récupérer la configuration
      const server = document.getElementById('sip-server').value;
      const user = document.getElementById('sip-user').value;
      const password = document.getElementById('sip-password').value;
      
      if (!server || !user) {
        statusEl.innerHTML = '<div class="status error">❌ Serveur et utilisateur requis</div>';
        return;
      }
      
      // Sauvegarder la config
      saveConfig();
      
      addLog('🔌 Connexion à ' + server + '...');
      updateSIPStatus('Connexion en cours...', false, true);
      statusEl.innerHTML = '<div class="status info">⏳ Connexion au serveur SIP...</div>';
      
      try {
        // Extraire le domaine du serveur WSS
        const serverUrl = new URL(server);
        const domain = serverUrl.hostname;
        
        // Configuration JsSIP
        const socket = new JsSIP.WebSocketInterface(server);
        
        const configuration = {
          sockets: [socket],
          uri: 'sip:' + user + '@' + domain,
          password: password,
          display_name: 'CLAUDIO WebRTC',
          register: true,
          register_expires: 300,
          session_timers: false,
          use_preloaded_route: false
        };
        
        addLog('📋 Config SIP: sip:' + user + '@' + domain);
        
        // Créer le User Agent
        sipUA = new JsSIP.UA(configuration);
        
        // Événements de connexion
        sipUA.on('connecting', () => {
          addLog('🔄 WebSocket en cours de connexion...');
          updateSIPStatus('Connexion WebSocket...', false, true);
        });
        
        sipUA.on('connected', () => {
          addLog('✅ WebSocket connecté');
          updateSIPStatus('Enregistrement SIP...', false, true);
        });
        
        sipUA.on('disconnected', () => {
          addLog('📴 WebSocket déconnecté');
          updateSIPStatus('Déconnecté', false, false, true);
          isRegistered = false;
          statusEl.innerHTML = '<div class="status warning">⚠️ Connexion WebSocket perdue</div>';
        });
        
        sipUA.on('registered', () => {
          addLog('✅ Enregistré sur le serveur SIP !');
          updateSIPStatus('Connecté et enregistré', true);
          isRegistered = true;
          statusEl.innerHTML = '<div class="status success">✅ Connecté à Jambonz ! Vous pouvez maintenant appeler.</div>';
        });
        
        sipUA.on('unregistered', () => {
          addLog('📴 Désenregistré du serveur SIP');
          updateSIPStatus('Non enregistré', false, false, true);
          isRegistered = false;
        });
        
        sipUA.on('registrationFailed', (e) => {
          addLog('❌ Échec enregistrement SIP: ' + (e.cause || 'inconnu'));
          updateSIPStatus('Échec enregistrement: ' + e.cause, false, false, true);
          isRegistered = false;
          statusEl.innerHTML = '<div class="status error">❌ Échec enregistrement: ' + e.cause + '</div>';
        });
        
        // Événements d'appel entrant
        sipUA.on('newRTCSession', (e) => {
          const session = e.session;
          
          if (session.direction === 'incoming') {
            addLog('📞 Appel entrant de ' + session.remote_identity.uri);
            // Auto-répondre pour les tests
            session.answer({
              mediaConstraints: { audio: true, video: false }
            });
          }
          
          setupSessionHandlers(session);
        });
        
        // Démarrer le User Agent
        sipUA.start();
        
      } catch (error) {
        addLog('❌ Erreur connexion SIP: ' + error.message);
        updateSIPStatus('Erreur: ' + error.message, false, false, true);
        statusEl.innerHTML = '<div class="status error">❌ Erreur: ' + error.message + '</div>';
      }
    }
    
    // Configuration des handlers de session
    function setupSessionHandlers(session) {
      currentSession = session;
      const statusEl = document.getElementById('webrtc-status');
      const hangupBtn = document.getElementById('hangup-btn');
      const callBtn = document.getElementById('webrtc-btn');
      
      session.on('progress', () => {
        addLog('📞 Appel en cours (sonnerie)...');
        statusEl.innerHTML = '<div class="status info">📞 Appel en cours... Sonnerie</div>';
      });
      
      session.on('accepted', () => {
        addLog('✅ Appel accepté !');
        statusEl.innerHTML = '<div class="status success">✅ Appel en cours ! Parlez maintenant.</div>';
      });
      
      session.on('confirmed', () => {
        addLog('🎉 Appel confirmé - Audio actif');
        hangupBtn.style.display = 'block';
        callBtn.style.display = 'none';
      });
      
      session.on('ended', () => {
        addLog('📴 Appel terminé');
        statusEl.innerHTML = '<div class="status info">ℹ️ Appel terminé</div>';
        hangupBtn.style.display = 'none';
        callBtn.style.display = 'block';
        currentSession = null;
      });
      
      session.on('failed', (e) => {
        addLog('❌ Appel échoué: ' + (e.cause || 'inconnu'));
        statusEl.innerHTML = '<div class="status error">❌ Appel échoué: ' + (e.cause || 'inconnu') + '</div>';
        hangupBtn.style.display = 'none';
        callBtn.style.display = 'block';
        currentSession = null;
      });
      
      // Gérer le flux audio distant
      session.on('peerconnection', (e) => {
        const pc = e.peerconnection;
        
        pc.ontrack = (event) => {
          addLog('📡 Flux audio distant reçu');
          const remoteAudio = document.getElementById('remote-audio');
          if (remoteAudio && event.streams[0]) {
            remoteAudio.srcObject = event.streams[0];
            addLog('🔊 Audio distant connecté');
          }
        };
      });
    }
    
    // Démarrer un appel WebRTC via SIP
    async function testWebRTC() {
      const statusEl = document.getElementById('webrtc-status');
      
      if (!sipUA || !isRegistered) {
        statusEl.innerHTML = '<div class="status error">❌ Connectez-vous d\'abord au serveur SIP</div>';
        return;
      }
      
      const target = document.getElementById('sip-target').value || '*000';
      const server = document.getElementById('sip-server').value;
      const serverUrl = new URL(server);
      const domain = serverUrl.hostname;
      
      addLog('📞 Appel vers ' + target + '...');
      statusEl.innerHTML = '<div class="status info">⏳ Initiation de l\'appel vers ' + target + '...</div>';
      
      try {
        // Options d'appel
        const options = {
          mediaConstraints: { audio: true, video: false },
          pcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          },
          rtcOfferConstraints: {
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
          }
        };
        
        // Passer l'appel
        const targetUri = 'sip:' + target + '@' + domain;
        addLog('🎯 URI cible: ' + targetUri);
        
        const session = sipUA.call(targetUri, options);
        setupSessionHandlers(session);
        
      } catch (error) {
        addLog('❌ Erreur appel: ' + error.message);
        statusEl.innerHTML = '<div class="status error">❌ Erreur: ' + error.message + '</div>';
      }
    }
    
    // Raccrocher l'appel
    function hangupCall() {
      if (currentSession) {
        addLog('📴 Raccrochage...');
        currentSession.terminate();
      }
    }
    
    // Initialisation
    loadSavedConfig();
    addLog('✨ Page de test IVR chargée');
    addLog('🔧 JsSIP version: ' + (typeof JsSIP !== 'undefined' ? JsSIP.version : 'non chargé'));
    addLog('📡 Mode: Connexion RÉELLE via SIP over WSS');
    addLog('💡 Configurez vos identifiants SIP et cliquez sur Connecter');
  </script>
</body>
</html>
  `);
});

// Servir l'app React pour tous les autres chemins
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
	console.log('\n╔══════════════════════════════════════════════════════════════╗');
	console.log('║                                                              ║');
	console.log('║           🧪 SERVEUR DE TEST IVR DÉMARRÉ                     ║');
	console.log('║                                                              ║');
	console.log('╚══════════════════════════════════════════════════════════════╝\n');
	console.log(`📍 URL de test:        http://localhost:${PORT}/test-ivr`);
	console.log(`📱 App principale:     http://localhost:${PORT}`);
	console.log(`🔧 Mode:               RÉEL (OpenAI GPT-4 + Jambonz)`);
	console.log(`\n💡 Endpoints disponibles:`);
	console.log(`   POST /api/ivr/start-call`);
	console.log(`   POST /api/ivr/appointment-webhook`);
	console.log(`   GET  /api/ivr/last-appointment`);
	console.log(`\n📖 Pour tester avec Jambonz:`);
	console.log(`   1. Lancer ngrok: ngrok http ${PORT}`);
	console.log(`   2. Copier l'URL ngrok (https://...)`);
	console.log(`   3. Configurer le webhook Jambonz avec cette URL`);
	console.log(`   4. Appeler depuis un téléphone ou tester via /test-ivr`);
	console.log(`\n🛑 Ctrl+C pour arrêter\n`);
});
