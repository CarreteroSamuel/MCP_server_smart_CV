#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPSetup {
  constructor() {
    this.configPaths = {
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
      linux: path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json')
    };
  }

  getConfigPath() {
    const platform = os.platform();
    return this.configPaths[platform] || this.configPaths.linux;
  }

  async checkClaudeDesktop() {
    const configPath = this.getConfigPath();
    const configDir = path.dirname(configPath);
    
    try {
      await fs.access(configDir);
      console.log('✅ Dossier Claude Desktop trouvé');
      return { configPath, exists: true };
    } catch {
      console.log('⚠️  Dossier Claude Desktop non trouvé');
      console.log(`📁 Chemin attendu: ${configDir}`);
      return { configPath, exists: false };
    }
  }

  async readExistingConfig(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  generateMCPConfig() {
    const projectPath = __dirname;
    const cvPath = path.join(projectPath, 'cv.pdf');
    const serverPath = path.join(projectPath, 'index.js');

    return {
      "mcp-cv-server": {
        command: "node",
        args: [serverPath],
        env: {
          CV_PDF_PATH: cvPath
        }
      }
    };
  }

  async updateClaudeConfig() {
    const { configPath, exists } = await this.checkClaudeDesktop();
    
    if (!exists) {
      console.log('\n🔧 Création du dossier de configuration...');
      await fs.mkdir(path.dirname(configPath), { recursive: true });
    }

    // Lire la config existante
    const existingConfig = await this.readExistingConfig(configPath);
    
    // Ajouter notre serveur MCP
    if (!existingConfig.mcpServers) {
      existingConfig.mcpServers = {};
    }
    
    const mcpConfig = this.generateMCPConfig();
    existingConfig.mcpServers = {
      ...existingConfig.mcpServers,
      ...mcpConfig
    };

    // Sauvegarder la configuration
    await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
    
    console.log('✅ Configuration Claude Desktop mise à jour');
    console.log(`📝 Fichier: ${configPath}`);
    
    return configPath;
  }

  async checkCVFile() {
    const cvPath = path.join(__dirname, 'cv.pdf');
    
    try {
      await fs.access(cvPath);
      console.log('✅ Fichier CV trouvé');
      return true;
    } catch {
      console.log('⚠️  Fichier CV non trouvé');
      console.log(`📄 Placez votre CV ici: ${cvPath}`);
      return false;
    }
  }

  async createExampleCV() {
    const cvPath = path.join(__dirname, 'cv-example.pdf');
    const message = `
ATTENTION: Fichier d'exemple
Remplacez ce fichier par votre vrai CV au format PDF.

Pour tester le serveur MCP, vous devez:
1. Remplacer cv-example.pdf par votre cv.pdf
2. Redémarrer Claude Desktop
3. Utiliser les prompts MCP dans Claude

Prompts disponibles:
- informations-personnelles
- competences-techniques  
- experience-professionnelle
- profil-complet
- lettre-motivation
- analyse-compatibilite
`;

    try {
      await fs.writeFile(cvPath, message);
      console.log('📄 Fichier d\'exemple créé: cv-example.pdf');
    } catch (error) {
      console.log('⚠️  Impossible de créer le fichier d\'exemple');
    }
  }

  async validateInstallation() {
    console.log('\n🔍 Validation de l\'installation...\n');
    
    const checks = [
      {
        name: 'Node.js version',
        check: () => {
          const version = process.version;
          const major = parseInt(version.slice(1));
          return { success: major >= 16, details: version };
        }
      },
      {
        name: 'Dépendances npm',
        check: async () => {
          try {
            await import('@modelcontextprotocol/sdk/server/index.js');
            return { success: true, details: 'MCP SDK installé' };
          } catch {
            return { success: false, details: 'Exécutez: npm install' };
          }
        }
      },
      {
        name: 'Structure du projet',
        check: async () => {
          try {
            await fs.access(path.join(__dirname, 'src', 'index.js'));
            return { success: true, details: 'Serveur MCP présent' };
          } catch {
            return { success: false, details: 'Fichier src/index.js manquant' };
          }
        }
      }
    ];

    for (const check of checks) {
      const result = await check.check();
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${result.details}`);
    }
  }

  async run() {
    console.log('🚀 Configuration du serveur MCP CV\n');

    // Validation de l'installation
    await this.validateInstallation();

    // Vérification du CV
    const cvExists = await this.checkCVFile();
    if (!cvExists) {
      await this.createExampleCV();
    }

    // Mise à jour de la config Claude Desktop
    try {
      const configPath = await this.updateClaudeConfig();
      
      console.log('\n🎉 Configuration terminée avec succès!\n');
      console.log('📋 Prochaines étapes:');
      console.log('1. Assurez-vous que votre CV est au format PDF dans le projet');
      console.log('2. Redémarrez complètement Claude Desktop');
      console.log('3. Testez avec: "Utilise le prompt informations-personnelles"');
      
      console.log('\n🧪 Pour tester localement:');
      console.log('   npm run client:test');
      
      console.log('\n🔧 Fichier de configuration:');
      console.log(`   ${configPath}`);
      
    } catch (error) {
      console.error('\n❌ Erreur lors de la configuration:', error.message);
      console.log('\n🔧 Configuration manuelle requise:');
      
      const manualConfig = {
        mcpServers: this.generateMCPConfig()
      };
      
      console.log('\nAjoutez ceci à votre claude_desktop_config.json:');
      console.log(JSON.stringify(manualConfig, null, 2));
    }
  }
}

// Exécution du script
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new MCPSetup();
  setup.run().catch(console.error);
}

export default MCPSetup;