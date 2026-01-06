# Documentation Jambonz - Production

## Informations VPS

**Serveur :** `31.97.178.44`  
**OS :** Debian 12  
**Accès SSH :** `ssh root@31.97.178.44`

---

## Architecture

**Stack déployée :**
- **Jambonz** : Plateforme CPaaS (Communications Platform as a Service)
- **FreeSWITCH** : Moteur média (intégré dans Jambonz)
- **Drachtio** : Serveur SIP
- **MySQL 8.0** : Base de données principale
- **Redis 7** : Cache et sessions
- **InfluxDB 1.8** : Métriques time-series
- **Nginx** : Reverse proxy

**Répertoire d'installation :** `/opt/jambonz/jambonz-install/`

---

## Services Docker

```bash
cd /opt/jambonz/jambonz-install
docker compose ps
```

**Services actifs :**
- `jambonz-mysql` (3306)
- `jambonz-redis` (6379)
- `jambonz-influxdb` (8086)
- `jambonz-freeswitch` (8021)
- `jambonz-drachtio` (5060-5061, 9022)
- `jambonz-api-server` (3001)
- `jambonz-webapp` (interne, via nginx)
- `jambonz-feature-server` (3002)
- `jambonz-nginx` (80, 3000)

---

## Accès Interface Web

**URL :** `http://31.97.178.44`

**Compte actuel :**
- Username : `Treeporteur`
- Password : `Treeporteursas2025#`

---

## Création d'Utilisateur

**Script :** `/opt/jambonz/jambonz-install/create-user-fixed.sh`

```bash
cd /opt/jambonz/jambonz-install
./create-user-fixed.sh
```

Le script :
1. Génère un hash argon2 du mot de passe
2. Crée l'utilisateur avec permissions ADMIN
3. Lie automatiquement au service provider et account
4. Teste la connexion immédiatement

**Note :** Le username (pas l'email) est utilisé pour la connexion.

---

## Gestion des Services

```bash
cd /opt/jambonz/jambonz-install

# Démarrer tous les services
docker compose up -d

# Arrêter tous les services
docker compose down

# Redémarrer un service spécifique
docker compose restart jambonz-api-server

# Voir les logs
docker compose logs -f [service]
docker compose logs -f jambonz-api-server

# État des services
docker compose ps

# Ressources utilisées
docker stats
```

---

## Base de Données

**Connexion :**

```bash
source .env
docker compose exec mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD jambonz
```

**Credentials :**
- Host : `mysql` (depuis conteneurs) / `localhost:3306` (depuis host)
- User : `jambonz`
- Password : Défini dans `.env` (`MYSQL_PASSWORD`)
- Database : `jambonz`

**Tables principales :**
- `users` : Utilisateurs de l'interface
- `accounts` : Comptes clients
- `service_providers` : Fournisseurs de services
- `applications` : Applications de routage d'appels
- `phone_numbers` : Numéros de téléphone
- `voip_carriers` : Trunk SIP
- `webhooks` : Callbacks HTTP

---

## Configuration

**Fichiers importants :**
- `/opt/jambonz/jambonz-install/docker-compose.yml` : Configuration des services
- `/opt/jambonz/jambonz-install/.env` : Variables d'environnement
- `/opt/jambonz/jambonz-install/nginx.conf` : Configuration Nginx

**Variables clés dans .env :**
```bash
MYSQL_ROOT_PASSWORD=...
MYSQL_PASSWORD=...
JWT_SECRET=...
ENCRYPTION_SECRET=...
PUBLIC_IP=31.97.178.44
```

---

## Pare-feu

**Ports ouverts :**
- 22/tcp : SSH
- 80/tcp : HTTP (Interface web)
- 3000/tcp : API secondaire
- 3001/tcp : API REST
- 5060/udp, 5060/tcp : SIP
- 5061/tcp : SIP TLS
- 40000:60000/udp : RTP (média)

```bash
# Voir les règles
ufw status

# Ouvrir un port
ufw allow [port]/[protocol]
ufw reload
```

---

## API REST

**Base URL :** `http://31.97.178.44:3001/v1/`

**Authentification :** Bearer token (JWT)

**Obtenir un token :**

```bash
curl -X POST http://31.97.178.44:3001/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"USERNAME","password":"PASSWORD"}'
```

**Exemple d'utilisation :**

```bash
TOKEN="votre_token_jwt"

# Lister les applications
curl http://31.97.178.44:3001/v1/Applications \
  -H "Authorization: Bearer $TOKEN"

# Créer une application
curl -X POST http://31.97.178.44:3001/v1/Applications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Application",
    "account_sid": "account_sid_here"
  }'
```

**Documentation API :** https://api.jambonz.org/

---

## Logs et Monitoring

**Logs en temps réel :**

```bash
# Tous les services
docker compose logs -f

# Service spécifique
docker compose logs -f jambonz-api-server
docker compose logs -f jambonz-feature-server
docker compose logs -f jambonz-freeswitch

# Logs MySQL
docker compose logs mysql | grep ERROR

# Dernières 100 lignes
docker compose logs --tail=100 jambonz-api-server
```

**Métriques :**
- InfluxDB accessible sur `http://localhost:8086`
- Base de données : `jambonz`

---

## Troubleshooting

### Service ne démarre pas

```bash
# Voir les logs d'erreur
docker compose logs [service]

# Redémarrer
docker compose restart [service]

# Recréer complètement
docker compose stop [service]
docker compose rm -f [service]
docker compose up -d [service]
```

### Connexion refuse sur l'interface

```bash
# Vérifier Nginx
docker compose ps nginx
docker compose logs nginx

# Vérifier l'API
curl http://localhost:3001/health

# Redémarrer le stack web
docker compose restart nginx jambonz-webapp jambonz-api-server
```

### Erreurs base de données

```bash
# Se connecter à MySQL
source .env
docker compose exec mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD jambonz

# Vérifier les tables
SHOW TABLES;

# Vérifier un utilisateur
SELECT name, email, provider FROM users;
```

### Utilisateur ne peut pas se connecter

**Vérifier :**
1. Le hash du mot de passe est en argon2 (commence par `$argon2`)
2. La colonne `provider` = `local`
3. L'utilisateur a un `service_provider_sid` et `account_sid`
4. L'utilisateur a des permissions dans `user_permissions`

```sql
SELECT u.name, u.email, u.provider, 
       LENGTH(u.hashed_password) as hash_len,
       u.service_provider_sid, u.account_sid,
       p.name as permission
FROM users u
LEFT JOIN user_permissions up ON u.user_sid = up.user_sid
LEFT JOIN permissions p ON up.permission_sid = p.permission_sid
WHERE u.email = 'email@example.com';
```

---

## Commandes Utiles

```bash
# Voir l'utilisation disque
df -h
docker system df

# Nettoyer Docker (attention)
docker system prune -a

# Sauvegarder la base de données
docker compose exec mysql mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jambonz > backup-$(date +%Y%m%d).sql

# Restaurer la base de données
docker compose exec -T mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD jambonz < backup.sql

# Voir les processus qui écoutent
ss -tulpn | grep -E '(3000|3001|5060)'

# Tester la connectivité SIP
nc -vz 31.97.178.44 5060

# Voir les connexions actives
docker compose exec mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD -e "SHOW PROCESSLIST;"
```

---

## Workflow de Développement

### 1. Créer une Application

Via l'interface web : **Applications > Add Application**

Ou via API :

```bash
curl -X POST http://31.97.178.44:3001/v1/Applications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ma Super App",
    "account_sid": "votre_account_sid",
    "call_hook": {
      "url": "https://votre-webhook.com/call",
      "method": "POST"
    }
  }'
```

### 2. Ajouter un Trunk SIP

**Interface :** Carriers > Add Carrier

**Paramètres typiques :**
- Nom du carrier
- SIP Gateway (IP:port ou domaine)
- Credentials (user/password si requis)
- Codecs supportés

### 3. Configurer un Numéro

**Interface :** Phone Numbers > Add Number

Associer :
- Le numéro
- Le carrier (trunk)
- L'application de routage

### 4. Tester

Les webhooks de votre application seront appelés lors d'un appel entrant sur le numéro.

**Format du webhook :**

```json
{
  "call_sid": "...",
  "from": "+33123456789",
  "to": "+33987654321",
  "call_status": "ringing",
  ...
}
```

**Réponse attendue (JSON) :**

```json
[
  {
    "verb": "dial",
    "target": "+33123456789",
    "timeout": 30
  }
]
```

---

## Webhooks - Verbs Principaux

**dial** : Appeler un numéro
**say** : Text-to-speech
**play** : Jouer un fichier audio
**gather** : Collecter des DTMF
**hangup** : Raccrocher
**listen** : Speech-to-text
**record** : Enregistrer l'appel

**Documentation complète :** https://docs.jambonz.org/webhooks/overview/

---

## Ressources

**Documentation officielle :**
- Docs : https://docs.jambonz.org/
- API : https://api.jambonz.org/
- GitHub : https://github.com/jambonz

**Communauté :**
- Slack : https://joinslack.jambonz.org/
- Support : support@jambonz.org

**Outils de test :**
- SIPp : Tests de charge SIP
- Postman : Tests API REST
- ngrok : Exposer des webhooks locaux

---

## Notes Importantes

1. **Authentification :** Les mots de passe sont hashés avec **argon2**, pas bcrypt
2. **Login :** Utiliser le **username** (champ `name`), pas l'email
3. **UUIDs :** Les IDs doivent être de vrais UUIDs, pas des séquences répétitives
4. **Pare-feu :** Ne pas oublier d'ouvrir les ports RTP (40000-60000) pour le média
5. **Sécurité :** Changer les mots de passe par défaut en production

---

## Support

Pour toute question ou problème :

1. Vérifier les logs : `docker compose logs -f`
2. Consulter la documentation : https://docs.jambonz.org/
3. Contacter le support Jambonz ou rejoindre le Slack

---

*Documentation générée le 2026-01-04*
*Installation : Jambonz latest (Docker)*
