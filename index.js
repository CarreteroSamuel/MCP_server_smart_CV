#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPCVClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
  }

  async connect() {
    try {
      // Chemin vers le serveur MCP CV
      const serverPath = path.join(__dirname, 'src', 'index.js');
      const cvPath = process.env.CV_PDF_PATH || path.join(__dirname, 'cv.pdf');

      console.log('🚀 Démarrage du serveur MCP CV...');
      console.log(`📄 CV Path: ${cvPath}`);
      console.log(`🖥️  Server Path: ${serverPath}`);

      // Créer le processus du serveur MCP
      this.serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CV_PDF_PATH: cvPath
        }
      });

      // Gérer les erreurs du processus serveur
      this.serverProcess.on('error', (error) => {
        console.error('❌ Erreur du serveur MCP:', error);
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.log('📡 Serveur MCP:', data.toString());
      });

      // Créer le transport stdio
      this.transport = new StdioClientTransport({
        stdin: this.serverProcess.stdin,
        stdout: this.serverProcess.stdout
      });

      // Créer et connecter le client
      this.client = new Client(
        {
          name: "mcp-cv-client",
          version: "1.0.0"
        },
        {
          capabilities: {
            prompts: {},
            tools: {},
            resources: {}
          }
        }
      );

      await this.client.connect(this.transport);
      console.log('✅ Connexion établie avec le serveur MCP CV');

      // Initialiser les capacités
      await this.initializeCapabilities();

      return true;
    } catch (error) {
      console.error('❌ Erreur de connexion:', error);
      return false;
    }
  }

  async initializeCapabilities() {
    try {
      // Lister les prompts disponibles
      const prompts = await this.client.listPrompts();
      console.log('\n📋 Prompts disponibles:');
      prompts.prompts.forEach(prompt => {
        console.log(`  • ${prompt.name}: ${prompt.description}`);
        if (prompt.arguments && prompt.arguments.length > 0) {
          console.log(`    Arguments: ${prompt.arguments.map(arg => 
            `${arg.name}${arg.required ? '*' : ''}`
          ).join(', ')}`);
        }
      });

      // Lister les ressources disponibles
      const resources = await this.client.listResources();
      console.log('\n📦 Ressources disponibles:');
      resources.resources.forEach(resource => {
        console.log(`  • ${resource.name} (${resource.uri})`);
        console.log(`    ${resource.description}`);
      });

      console.log('\n🎯 Le serveur MCP CV est prêt pour Claude Desktop!');
      console.log('\n📖 Exemples d\'utilisation dans Claude:');
      console.log('  "Utilise le prompt informations-personnelles"');
      console.log('  "Montre-moi mes compétences techniques"');
      console.log('  "Génère une lettre de motivation pour le poste de Développeur chez TechCorp"');

    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
    }
  }

  async testPrompt(promptName, args = {}) {
    try {
      console.log(`\n🧪 Test du prompt: ${promptName}`);
      const result = await this.client.getPrompt({
        name: promptName,
        arguments: args
      });
      
      console.log('✅ Résultat du prompt:');
      console.log(result.messages[0].content.text.substring(0, 200) + '...');
      
      return result;
    } catch (error) {
      console.error(`❌ Erreur test prompt ${promptName}:`, error);
      return null;
    }
  }

  async testResource(uri) {
    try {
      console.log(`\n🧪 Test de la ressource: ${uri}`);
      const result = await this.client.readResource({ uri });
      
      console.log('✅ Ressource lue avec succès');
      console.log(`Type: ${result.contents[0].mimeType}`);
      
      if (result.contents[0].mimeType === 'application/json') {
        const data = JSON.parse(result.contents[0].text);
        console.log(`Données structurées extraites à: ${data.extractedAt}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Erreur test ressource ${uri}:`, error);
      return null;
    }
  }

  async runTests() {
    console.log('\n🔧 Exécution des tests du serveur MCP...');
    
    // Test des prompts de base
    await this.testPrompt('informations-personnelles');
    await this.testPrompt('competences-techniques');
    await this.testPrompt('experience-professionnelle');
    
    // Test avec paramètres
    await this.testPrompt('lettre-motivation', {
      poste: 'Développeur Full Stack',
      entreprise: 'TechCorp'
    });
    
    // Test des ressources
    await this.testResource('cv://structured-data');
    
    console.log('\n✅ Tests terminés');
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
      }
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
      console.log('👋 Déconnexion du serveur MCP CV');
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
    }
  }

  // Méthode pour maintenir la connexion active (pour Claude Desktop)
  async keepAlive() {
    console.log('🔄 Mode serveur actif - En attente des requêtes de Claude...');
    
    // Gérer l'arrêt propre
    process.on('SIGINT', async () => {
      console.log('\n🛑 Arrêt du serveur...');
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Arrêt du serveur...');
      await this.disconnect();
      process.exit(0);
    });

    // Maintenir le processus actif
    setInterval(() => {
      // Heartbeat silencieux
    }, 30000);
  }
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2);
  const client = new MCPCVClient();

  // Connexion au serveur
  const connected = await client.connect();
  if (!connected) {
    console.error('❌ Impossible de se connecter au serveur MCP');
    process.exit(1);
  }

  // Mode de fonctionnement selon les arguments
  if (args.includes('--test')) {
    // Mode test
    await client.runTests();
    await client.disconnect();
  } else if (args.includes('--daemon') || args.includes('--server')) {
    // Mode serveur (pour Claude Desktop)
    await client.keepAlive();
  } else {
    // Mode interactif par défaut
    console.log('\n🎮 Mode interactif - Serveur MCP CV prêt');
    console.log('💡 Utilisez Ctrl+C pour arrêter');
    console.log('🔗 Ajoutez cette configuration à Claude Desktop:');
    
    const config = {
      mcpServers: {
        "mcp-cv-server": {
          command: "node",
          args: [process.argv[1]],
          env: {
            CV_PDF_PATH: process.env.CV_PDF_PATH || "./cv.pdf"
          }
        }
      }
    };
    
    console.log('\n📋 Configuration pour claude_desktop_config.json:');
    console.log(JSON.stringify(config, null, 2));
    
    await client.keepAlive();
  }
}

// Point d'entrée
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
}

export default MCPCVClient;