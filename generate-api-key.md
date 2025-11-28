# Comment générer une clé API Odoo

## Étapes pour générer une clé API:

1. **Connecte-toi à Odoo** (ce que tu viens de faire):
   - Va sur https://www.greenschool.contact
   - Connecte-toi avec ton email et mot de passe

2. **Accède aux paramètres de sécurité**:
   - Clique sur ton avatar/profil (en haut à droite)
   - Sélectionne "Mes paramètres" ou "My Settings"

3. **Trouve la section des clés API**:
   - Cherche une section "Sécurité" ou "API Keys"
   - Ou va dans le menu "Outils de développement"

4. **Génère une nouvelle clé**:
   - Clique sur "Générer une clé API" ou "Generate API Key"
   - Copie la clé générée

5. **Mets à jour ton `.env`**:
   ```
   ODOO_URL=https://www.greenschool.contact/
   ODOO_DB=oalegal
   ODOO_LOGIN=smaniotto.gabriel@gmail.com
   ODOO_API_KEY=xxxxxxxxxxxxx (la clé générée)
   ```

   **Important**: Supprime ou commente `ODOO_PASSWORD`

6. **Teste avec le script**:
   ```bash
   node test-odoo-api-key.js
   ```

## Pourquoi une clé API?

- Odoo SaaS (en ligne) préfère les clés API pour l'accès XML-RPC
- Plus sécurisé que de stocker un mot de passe en clair
- Peut être révoquée facilement
