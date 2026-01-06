#!/usr/bin/env node

/**
 * Script de configuration Jambonz pour l'IVR de prise de rendez-vous
 *
 * Ce script :
 * 1. Se connecte à l'API Jambonz
 * 2. Crée une application IVR pour les rendez-vous
 * 3. Configure le webhook vers notre backend
 */

import http from 'http';

// Configuration depuis JAMBONZ_DOCUMENTATION.md
const JAMBONZ_API_URL = '31.97.178.44:3001';
const JAMBONZ_USERNAME = 'Treeporteur';
const JAMBONZ_PASSWORD = 'Treeporteursas2025#';

// URL du webhook (à adapter selon votre déploiement)
const WEBHOOK_BASE_URL = process.env.WEBHOOK_URL || 'https://deandre-apiaceous-ireland.ngrok-free.dev';
const WEBHOOK_URL = `${WEBHOOK_BASE_URL}/api/ivr/appointment-webhook`;

async function makeRequest(path, method = 'GET', body = null, token = null) {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: '31.97.178.44',
			port: 3001,
			path: `/v1${path}`,
			method,
			headers: {
				'Content-Type': 'application/json',
			}
		};

		if (token) {
			options.headers['Authorization'] = `Bearer ${token}`;
		}

		const req = http.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
					const parsed = JSON.parse(data);
					resolve({ status: res.statusCode, data: parsed });
				} catch (e) {
					resolve({ status: res.statusCode, data: data });
				}
			});
		});

		req.on('error', (error) => {
			reject(error);
		});

		if (body) {
			req.write(JSON.stringify(body));
		}

		req.end();
	});
}

async function login() {
	console.log('🔐 Connexion à Jambonz...');

	try {
		const response = await makeRequest('/login', 'POST', {
			username: JAMBONZ_USERNAME,
			password: JAMBONZ_PASSWORD
		});

		if (response.status === 200 && response.data.token) {
			console.log('✅ Connexion réussie');
			return response.data.token;
		} else {
			throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
		}
	} catch (error) {
		console.error('❌ Erreur de connexion:', error.message);
		throw error;
	}
}

async function getAccountSid(token) {
	console.log('📋 Récupération des comptes...');

	try {
		const response = await makeRequest('/Accounts', 'GET', null, token);

		if (response.status === 200 && Array.isArray(response.data) && response.data.length > 0) {
			const accountSid = response.data[0].account_sid;
			console.log(`✅ Account SID: ${accountSid}`);
			return accountSid;
		} else {
			throw new Error('No accounts found');
		}
	} catch (error) {
		console.error('❌ Erreur récupération compte:', error.message);
		throw error;
	}
}

async function createApplication(token, accountSid) {
	console.log('📱 Création de l\'application IVR...');

	const applicationData = {
		name: 'CLAUDIO - Prise de RDV',
		account_sid: accountSid,
		call_hook: {
			url: WEBHOOK_URL,
			method: 'POST'
		},
		call_status_hook: {
			url: `${WEBHOOK_BASE_URL}/api/ivr/status`,
			method: 'POST'
		},
		speech_synthesis_vendor: 'google',
		speech_synthesis_language: 'fr-FR',
		speech_synthesis_voice: 'fr-FR-Standard-A',
		speech_recognizer_vendor: 'google',
		speech_recognizer_language: 'fr-FR'
	};

	try {
		const response = await makeRequest('/Applications', 'POST', applicationData, token);

		if (response.status === 201 || response.status === 200) {
			console.log('✅ Application créée avec succès!');
			console.log('Application SID:', response.data.sid || response.data.application_sid);
			console.log('Webhook URL:', WEBHOOK_URL);
			return response.data;
		} else {
			throw new Error(`Failed to create application: ${JSON.stringify(response.data)}`);
		}
	} catch (error) {
		console.error('❌ Erreur création application:', error.message);
		throw error;
	}
}

async function listApplications(token) {
	console.log('📋 Liste des applications existantes...');

	try {
		const response = await makeRequest('/Applications', 'GET', null, token);

		if (response.status === 200) {
			console.log(`✅ ${response.data.length} application(s) trouvée(s):`);
			response.data.forEach(app => {
				console.log(`  - ${app.name} (SID: ${app.application_sid})`);
				console.log(`    Webhook: ${app.call_hook?.url || 'Non configuré'}`);
			});
			return response.data;
		}
	} catch (error) {
		console.error('❌ Erreur liste applications:', error.message);
	}
}

async function updateApplication(token, appSid) {
	console.log('🔄 Mise à jour de l\'application existante...');

	const applicationData = {
		call_hook: {
			url: WEBHOOK_URL,
			method: 'POST'
		},
		call_status_hook: {
			url: `${WEBHOOK_BASE_URL}/api/ivr/status`,
			method: 'POST'
		},
		speech_synthesis_vendor: 'google',
		speech_synthesis_language: 'fr-FR',
		speech_synthesis_voice: 'fr-FR-Standard-A',
		speech_recognizer_vendor: 'google',
		speech_recognizer_language: 'fr-FR'
	};

	try {
		const response = await makeRequest(`/Applications/${appSid}`, 'PUT', applicationData, token);

		if (response.status === 204 || response.status === 200) {
			console.log('✅ Application mise à jour avec succès!');
			console.log('Webhook URL:', WEBHOOK_URL);
			return true;
		} else {
			throw new Error(`Failed to update application: ${JSON.stringify(response.data)}`);
		}
	} catch (error) {
		console.error('❌ Erreur mise à jour application:', error.message);
		throw error;
	}
}

async function main() {
	console.log('🚀 Configuration de l\'IVR Jambonz pour la prise de rendez-vous\n');

	try {
		// 1. Login
		const token = await login();

		// 2. Récupérer l'account SID
		const accountSid = await getAccountSid(token);

		// 3. Lister les applications existantes
		const apps = await listApplications(token);

		// 4. Vérifier si l'application existe déjà
		console.log('\n');
		const existingApp = apps.find(app => app.name === 'CLAUDIO - Prise de RDV');

		if (existingApp) {
			console.log(`📝 Application existante trouvée (SID: ${existingApp.application_sid})`);
			await updateApplication(token, existingApp.application_sid);
		} else {
			console.log('📱 Aucune application existante, création...');
			const app = await createApplication(token, accountSid);
		}

		console.log('\n✨ Configuration terminée!\n');
		console.log('📝 Prochaines étapes:');
		console.log('1. Associer un numéro de téléphone à cette application');
		console.log('2. Ou utiliser cette application pour les appels WebRTC');
		console.log('3. Vérifier que le webhook est accessible:', WEBHOOK_URL);
		console.log('\n💡 Pour tester:');
		console.log('   - Connectez-vous à http://31.97.178.44');
		console.log('   - Allez dans Phone Numbers > Add Number');
		console.log(`   - Assignez l'application: CLAUDIO - Prise de RDV`);

	} catch (error) {
		console.error('\n❌ Erreur fatale:', error.message);
		process.exit(1);
	}
}

// Exécuter le script
main();
