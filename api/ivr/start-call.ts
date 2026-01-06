import type { VercelRequest, VercelResponse } from '@vercel/node';

// Configuration Jambonz depuis la documentation
const JAMBONZ_API_URL = 'http://31.97.178.44:3001/v1';
const JAMBONZ_SIP_SERVER = '31.97.178.44';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sdp, type } = req.body;

    if (!sdp || type !== 'offer') {
      return res.status(400).json({ error: 'Invalid SDP offer' });
    }

    console.log('[Start Call] Received WebRTC offer');

    // Pour Jambonz avec WebRTC, on doit créer un appel via l'API
    // puis établir une session WebRTC

    // Option 1: Utiliser Jambonz WebRTC Gateway (si configuré)
    // Option 2: Utiliser un SIP URI avec WebRTC

    // Pour simplifier, on va créer une réponse SDP simulée
    // En production, il faut router via FreeSWITCH/Drachtio

    // Générer une réponse SDP basique
    // ATTENTION : Ceci est une version simplifiée pour démonstration
    // En production, il faut passer par le serveur Jambonz/FreeSWITCH

    const answerSdp = `v=0
o=- ${Date.now()} 2 IN IP4 ${JAMBONZ_SIP_SERVER}
s=Jambonz IVR
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS *
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 ${JAMBONZ_SIP_SERVER}
a=rtcp:9 IN IP4 ${JAMBONZ_SIP_SERVER}
a=ice-ufrag:${Math.random().toString(36).substr(2, 8)}
a=ice-pwd:${Math.random().toString(36).substr(2, 24)}
a=ice-options:trickle
a=fingerprint:sha-256 ${generateFingerprint()}
a=setup:active
a=mid:0
a=sendrecv
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
a=rtpmap:126 telephone-event/8000
a=ssrc:${Math.floor(Math.random() * 1000000000)} cname:jambonz
a=ssrc:${Math.floor(Math.random() * 1000000000)} msid:jambonz audio0
a=ssrc:${Math.floor(Math.random() * 1000000000)} mslabel:jambonz
a=ssrc:${Math.floor(Math.random() * 1000000000)} label:audio0`;

    // TODO: Dans une vraie implémentation, on devrait :
    // 1. Créer un appel Jambonz via l'API REST
    // 2. Router via le serveur WebRTC de Jambonz
    // 3. Utiliser le SDP answer de FreeSWITCH

    // Pour le moment, on retourne un SDP simulé
    // Vous devrez adapter ceci pour vous connecter réellement à Jambonz

    console.log('[Start Call] Sending SDP answer');

    return res.status(200).json({
      sdp: answerSdp,
      type: 'answer'
    });

  } catch (error) {
    console.error('[Start Call] Error:', error);
    return res.status(500).json({ error: 'Failed to start call' });
  }
}

function generateFingerprint(): string {
  // Générer un fingerprint SHA-256 fictif
  const chars = '0123456789ABCDEF';
  let fingerprint = '';
  for (let i = 0; i < 32; i++) {
    fingerprint += chars[Math.floor(Math.random() * 16)];
    if ((i + 1) % 2 === 0 && i < 31) fingerprint += ':';
  }
  return fingerprint;
}
