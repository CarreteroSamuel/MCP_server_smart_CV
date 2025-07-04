#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";

class CVMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "mcp-cv-server",
        version: "1.0.0"
      },
      {
        capabilities: {
          prompts: {},
          resources: {}
        }
      }
    );

    this.cvData = null;
    this.cvPath = process.env.CV_PDF_PATH || "./files/cv.pdf";
    this.initialized = false;
    this.setupHandlers();
  }

  async extractCVData() {
    if (this.cvData) return; // Éviter les extractions multiples
    
    try {
      console.error(`[INFO] Tentative de lecture du CV: ${this.cvPath}`);
      const pdfBuffer = await fs.readFile(this.cvPath);
      console.error(`[INFO] CV lu avec succès, taille: ${pdfBuffer.length} bytes`);
      
      const pdfData = await pdfParse(pdfBuffer);
      console.error(`[INFO] PDF analysé, texte extrait: ${pdfData.text.length} caractères`);
      
      this.cvData = {
        rawText: pdfData.text,
        extractedAt: new Date().toISOString(),
        personalInfo: this.extractPersonalInfo(pdfData.text),
        technicalSkills: this.extractTechnicalSkills(pdfData.text),
        experience: this.extractExperience(pdfData.text),
        education: this.extractEducation(pdfData.text),
        projects: this.extractProjects(pdfData.text)
      };
      
      console.error(`[INFO] Données CV extraites avec succès`);
    } catch (error) {
      console.error(`[ERROR] Erreur lors de l'extraction du CV: ${error.message}`);
      // Créer des données par défaut en cas d'erreur
      this.cvData = {
        rawText: "CV non disponible - Erreur de lecture",
        extractedAt: new Date().toISOString(),
        personalInfo: { name: "Non disponible", email: "Non disponible", phone: "Non disponible", rawPersonalSection: "Erreur de lecture du CV" },
        technicalSkills: { identifiedSkills: [], technicalSections: [], skillsCount: 0 },
        experience: { experiencePeriods: [], experienceYears: 0 },
        education: { hasEducationSection: false, educationMentioned: [] },
        projects: { hasProjectsSection: false, projectKeywordsFound: [] }
      };
    }
  }

  extractPersonalInfo(text) {
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const phoneRegex = /[\+]?[0-9\s\-\(\)]{10,}/g;
    
    const emails = text.match(emailRegex) || [];
    const phones = text.match(phoneRegex) || [];
    
    // Extract name (généralement la première ligne en gras ou en grand)
    const lines = text.split('\n').filter(line => line.trim());
    const name = lines[0]?.trim() || "Non trouvé";
    
    return {
      name,
      email: emails[0] || "Non trouvé",
      phone: phones[0] || "Non trouvé",
      rawPersonalSection: lines.slice(0, 5).join('\n')
    };
  }

  extractTechnicalSkills(text) {
    const skillsKeywords = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust',
      'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask',
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git', 'Linux',
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API'
    ];
    
    const foundSkills = skillsKeywords.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );
    
    // Recherche de sections techniques
    const techSectionRegex = /(compétences|skills|technologies|techniques?)[:\s]*(.*?)(?=\n\n|\n[A-Z]|$)/gis;
    const techSections = [];
    let match;
    
    while ((match = techSectionRegex.exec(text)) !== null) {
      techSections.push(match[2]?.trim());
    }
    
    return {
      identifiedSkills: foundSkills,
      technicalSections: techSections,
      skillsCount: foundSkills.length
    };
  }

  extractExperience(text) {
    // Recherche de patterns d'expérience
    const expRegex = /(\d{4}[\s\-]*\d{4}|\d{4}[\s\-]*présent|present|\d{4}[\s\-]*aujourd'hui)/gi;
    const experiences = text.match(expRegex) || [];
    
    return {
      experiencePeriods: experiences,
      experienceYears: this.calculateExperienceYears(experiences)
    };
  }

  extractEducation(text) {
    const educationKeywords = [
      'université', 'école', 'master', 'licence', 'bac', 'diplôme',
      'university', 'college', 'degree', 'bachelor', 'formation'
    ];
    
    const foundEducation = educationKeywords.some(keyword =>
      text.toLowerCase().includes(keyword)
    );
    
    return {
      hasEducationSection: foundEducation,
      educationMentioned: educationKeywords.filter(keyword =>
        text.toLowerCase().includes(keyword)
      )
    };
  }

  extractProjects(text) {
    const projectKeywords = ['projet', 'project', 'réalisation', 'développement'];
    const hasProjects = projectKeywords.some(keyword =>
      text.toLowerCase().includes(keyword)
    );
    
    return {
      hasProjectsSection: hasProjects,
      projectKeywordsFound: projectKeywords.filter(keyword =>
        text.toLowerCase().includes(keyword)
      )
    };
  }

  calculateExperienceYears(periods) {
    // Logique simplifiée pour calculer les années d'expérience
    const currentYear = new Date().getFullYear();
    let totalYears = 0;
    
    periods.forEach(period => {
      const years = period.match(/\d{4}/g);
      if (years && years.length >= 1) {
        const startYear = parseInt(years[0]);
        const endYear = years[1] ? parseInt(years[1]) : currentYear;
        totalYears += Math.max(0, endYear - startYear);
      }
    });
    
    return totalYears;
  }

  setupHandlers() {
    // Gestionnaire d'erreur global
    this.server.onerror = (error) => {
      console.error(`[ERROR] Erreur serveur MCP: ${error.message}`);
    };

    // Handler pour lister les prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      console.error("[INFO] Demande de liste des prompts");
      
      // Initialiser les données CV si nécessaire
      if (!this.cvData) {
        await this.extractCVData();
      }
      
      return {
        prompts: [
          {
            name: "informations-personnelles",
            description: "Retourne les informations personnelles extraites du CV",
            arguments: []
          },
          {
            name: "competences-techniques",
            description: "Retourne les compétences techniques et technologies maîtrisées",
            arguments: []
          },
          {
            name: "experience-professionnelle",
            description: "Analyse l'expérience professionnelle et calcule les années d'expérience",
            arguments: []
          },
          {
            name: "profil-complet",
            description: "Génère un résumé complet du profil professionnel",
            arguments: []
          },
          {
            name: "lettre-motivation",
            description: "Génère une lettre de motivation personnalisée",
            arguments: [
              {
                name: "poste",
                description: "Le poste visé",
                required: true
              },
              {
                name: "entreprise",
                description: "Le nom de l'entreprise",
                required: true
              }
            ]
          },
          {
            name: "analyse-compatibilite",
            description: "Analyse la compatibilité avec une offre d'emploi",
            arguments: [
              {
                name: "offre",
                description: "Description de l'offre d'emploi",
                required: true
              }
            ]
          }
        ]
      };
    });

    // Handler pour récupérer un prompt spécifique
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      console.error(`[INFO] Demande de prompt: ${request.params.name}`);
      
      if (!this.cvData) {
        await this.extractCVData();
      }

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "informations-personnelles":
            return {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Voici les informations personnelles extraites du CV :

**Informations de contact :**
- Nom : ${this.cvData.personalInfo.name}
- Email : ${this.cvData.personalInfo.email}
- Téléphone : ${this.cvData.personalInfo.phone}

**Section personnelle du CV :**
${this.cvData.personalInfo.rawPersonalSection}

Peux-tu présenter ces informations de manière claire et professionnelle ?`
                  }
                }
              ]
            };

          case "competences-techniques":
            return {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Voici les compétences techniques identifiées dans le CV :

**Technologies identifiées automatiquement :**
${this.cvData.technicalSkills.identifiedSkills.join(', ')}

**Sections techniques extraites :**
${this.cvData.technicalSkills.technicalSections.join('\n\n')}

**Statistiques :**
- Nombre de technologies identifiées : ${this.cvData.technicalSkills.skillsCount}

Peux-tu organiser et présenter ces compétences par catégories (langages, frameworks, outils, etc.) ?`
                  }
                }
              ]
            };

          case "experience-professionnelle":
            return {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Voici l'analyse de l'expérience professionnelle :

**Périodes d'expérience détectées :**
${this.cvData.experience.experiencePeriods.join('\n')}

**Années d'expérience calculées :** ${this.cvData.experience.experienceYears} ans

Peux-tu analyser et présenter l'évolution de carrière de manière structurée ?`
                  }
                }
              ]
            };

          case "profil-complet":
            return {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Voici toutes les données extraites du CV pour générer un profil complet :

**INFORMATIONS PERSONNELLES :**
${JSON.stringify(this.cvData.personalInfo, null, 2)}

**COMPÉTENCES TECHNIQUES :**
${JSON.stringify(this.cvData.technicalSkills, null, 2)}

**EXPÉRIENCE :**
${JSON.stringify(this.cvData.experience, null, 2)}

**FORMATION :**
${JSON.stringify(this.cvData.education, null, 2)}

Peux-tu créer un résumé professionnel complet et attractif basé sur ces données ?`
                  }
                }
              ]
            };

          case "lettre-motivation":
            const { poste, entreprise } = args || {};
            return {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Génère une lettre de motivation personnalisée avec ces informations :

**Poste visé :** ${poste || 'Non spécifié'}
**Entreprise :** ${entreprise || 'Non spécifiée'}

**Profil du candidat :**
- Nom : ${this.cvData.personalInfo.name}
- Compétences : ${this.cvData.technicalSkills.identifiedSkills.join(', ')}
- Expérience : ${this.cvData.experience.experienceYears} ans

Crée une lettre de motivation convaincante et personnalisée.`
                  }
                }
              ]
            };

          case "analyse-compatibilite":
            const { offre } = args || {};
            return {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Analyse la compatibilité entre ce profil et cette offre d'emploi :

**OFFRE D'EMPLOI :**
${offre || 'Aucune offre fournie'}

**PROFIL CANDIDAT :**
- Compétences : ${this.cvData.technicalSkills.identifiedSkills.join(', ')}
- Expérience : ${this.cvData.experience.experienceYears} ans
- Formation : ${this.cvData.education.educationMentioned.join(', ')}

Fournis une analyse détaillée de compatibilité avec un score et des recommandations.`
                  }
                }
              ]
            };

          default:
            throw new Error(`Prompt inconnu: ${name}`);
        }
      } catch (error) {
        console.error(`[ERROR] Erreur dans le prompt ${name}: ${error.message}`);
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Erreur lors du traitement du prompt "${name}": ${error.message}`
              }
            }
          ]
        };
      }
    });

    // Handler pour lister les ressources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      console.error("[INFO] Demande de liste des ressources");
      
      if (!this.cvData) {
        await this.extractCVData();
      }
      
      return {
        resources: [
          {
            uri: "cv://raw-text",
            name: "Texte brut du CV",
            description: "Le contenu textuel complet extrait du PDF",
            mimeType: "text/plain"
          },
          {
            uri: "cv://structured-data",
            name: "Données structurées du CV",
            description: "Les données extraites et organisées du CV",
            mimeType: "application/json"
          }
        ]
      };
    });

    // Handler pour lire une ressource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      console.error(`[INFO] Lecture de la ressource: ${request.params.uri}`);
      
      if (!this.cvData) {
        await this.extractCVData();
      }

      const { uri } = request.params;

      try {
        switch (uri) {
          case "cv://raw-text":
            return {
              contents: [
                {
                  uri: uri,
                  mimeType: "text/plain",
                  text: this.cvData.rawText
                }
              ]
            };

          case "cv://structured-data":
            return {
              contents: [
                {
                  uri: uri,
                  mimeType: "application/json",
                  text: JSON.stringify(this.cvData, null, 2)
                }
              ]
            };

          default:
            throw new Error(`Ressource inconnue: ${uri}`);
        }
      } catch (error) {
        console.error(`[ERROR] Erreur lecture ressource ${uri}: ${error.message}`);
        return {
          contents: [
            {
              uri: uri,
              mimeType: "text/plain",
              text: `Erreur: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async run() {
    try {
      console.error("[INFO] Démarrage du serveur MCP CV...");
      console.error(`[INFO] Chemin du CV: ${this.cvPath}`);
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error("[INFO] Serveur MCP CV connecté et prêt");
      
      // Précharger les données CV au démarrage
      await this.extractCVData();
      console.error("[INFO] Données CV préchargées");
      
      // Gérer la fermeture propre
      process.on('SIGINT', () => {
        console.error("[INFO] Arrêt du serveur MCP CV...");
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.error("[INFO] Arrêt du serveur MCP CV...");
        process.exit(0);
      });
      
    } catch (error) {
      console.error(`[ERROR] Erreur fatale du serveur: ${error.message}`);
      console.error(`[ERROR] Stack: ${error.stack}`);
      process.exit(1);
    }
  }
}

// Démarrage du serveur
const server = new CVMCPServer();
server.run().catch(error => {
  console.error(`[FATAL] Erreur critique: ${error.message}`);
  console.error(`[FATAL] Stack: ${error.stack}`);
  process.exit(1);
});