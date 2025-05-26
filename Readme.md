# Serveur MCP CV Intelligent

Un serveur MCP (Model Context Protocol) pour Claude Desktop qui transforme votre CV PDF en assistant intelligent.

## 🚀 Fonctionnalités

### Prompts disponibles :

1. **`informations-personnelles`** - Extrait et présente vos informations de contact
2. **`competences-techniques`** - Analyse et organise vos compétences techniques
3. **`experience-professionnelle`** - Calcule et présente votre expérience professionnelle
4. **`profil-complet`** - Génère un résumé professionnel complet
5. **`lettre-motivation`** - Crée des lettres de motivation personnalisées
6. **`analyse-compatibilite`** - Analyse la compatibilité avec des offres d'emploi

### Ressources disponibles :

- **`cv://raw-text`** - Accès au texte brut extrait du PDF
- **`cv://structured-data`** - Données structurées et analysées

## 📦 Installation

### 1. Cloner et installer les dépendances

```bash
git clone <votre-repo>
cd mcp-cv-server
npm install
```

### 2. Préparer votre CV

Placez votre CV au format PDF dans le dossier du projet :
```bash
cp /path/to/your/cv.pdf ./cv.pdf
```

### 3. Configurer Claude Desktop

Ajoutez cette configuration dans votre fichier `claude_desktop_config.json` :

**macOS :** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows :** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-cv-server": {
      "command": "node",
      "args": ["/chemin/absolu/vers/mcp-cv-server/src/index.js"],
      "env": {
        "CV_PDF_PATH": "/chemin/absolu/vers/votre/cv.pdf"
      }
    }
  }
}
```

### 4. Redémarrer Claude Desktop

Fermez complètement Claude Desktop et relancez-le.

## 🔧 Utilisation

Une fois configuré, vous pouvez utiliser ces prompts dans Claude Desktop :

### Exemples d'utilisation :

```
Utilise le prompt "informations-personnelles" pour me montrer mes infos de contact.
```

```
Génère une lettre de motivation avec le prompt "lettre-motivation" pour le poste de "Développeur Full Stack" chez "TechCorp".
```

```
Analyse ma compatibilité avec cette offre d'emploi : [coller l'offre]
```

## 🛠️ Personnalisation

### Ajouter de nouveaux prompts

Pour ajouter des prompts personnalisés, modifiez la méthode `setupHandlers()` dans `src/index.js` :

```javascript
// Dans ListPromptsRequestSchema
{
  name: "mon-nouveau-prompt",
  description: "Description de mon prompt",
  arguments: [
    {
      name: "parametre",
      description: "Description du paramètre",
      required: true
    }
  ]
}

// Dans GetPromptRequestSchema
case "mon-nouveau-prompt":
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Votre logique de prompt ici...`
        }
      }
    ]
  };
```

### Améliorer l'extraction de données

Modifiez les méthodes d'extraction dans la classe `CVMCPServer` :

- `extractPersonalInfo()` - Améliorer la détection des infos personnelles
- `extractTechnicalSkills()` - Ajouter de nouvelles technologies
- `extractExperience()` - Affiner le calcul d'expérience
- Et d'autres...

## 🚨 Dépannage

### Le serveur ne démarre pas
- Vérifiez que Node.js est installé (v16+)
- Vérifiez les chemins absolus dans la configuration
- Consultez les logs dans la console de Claude Desktop

### CV non reconnu
- Assurez-vous que le PDF n'est pas protégé/chiffré
- Vérifiez que le chemin vers le CV est correct
- Testez avec un PDF de bonne qualité (texte sélectionnable)

### Prompts non disponibles
- Redémarrez complètement Claude Desktop
- Vérifiez la syntaxe JSON de la configuration
- Consultez les logs d'erreur

## 📝 Développement

### Structure du projet

```
mcp-cv-server/
├── src/
│   └── index.js          # Serveur principal
├── package.json          # Dépendances
├── cv.pdf               # Votre CV (à ajouter)
└── README.md            # Ce fichier
```

### Tests locaux

```bash
# Test du serveur
npm start

# Mode développement avec rechargement
npm run dev
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir des issues ou des pull requests.

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.