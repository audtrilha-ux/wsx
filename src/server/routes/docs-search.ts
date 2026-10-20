import { Router } from 'express';
import { requireAuth, validateBody } from '../middleware.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const docsSearchRouter = Router();

const docsSearchSchema = z.object({
  query: z.string().min(1, 'O termo de pesquisa "query" deve ser fornecido.')
});

const DOC_FILES = [
  { name: 'ARCHITECTURE.md', title: 'Arquitetura do Ecossistema (ARCHITECTURE.md)', desc: 'Blueprint arquitetural definindo a separação de autoridade do sistema, OS, HQ, SDK e contratos.' },
  { name: 'ARCHITECTURE_BASELINE.md', title: 'Linha de Base da Arquitetura (ARCHITECTURE_BASELINE.md)', desc: 'Documento de conformidade descrevendo o estado central SQLite, segurança, SemVer e observabilidade.' },
  { name: 'ARCHITECTURE_CENTRAL.md', title: 'Arquitetura Central (ARCHITECTURE_CENTRAL.md)', desc: 'Especificação do HQ, tenants, faturamento, licenciamento e distribuição de atualizações.' },
  { name: 'AGENTS.md', title: 'Instruções de Evolução e Agentes (AGENTS.md)', desc: 'Diretrizes de desenvolvimento do projeto, regras de ouro, histórico de evolução consolidado.' },
  { name: 'README.md', title: 'Guia Geral do Projeto e Setup (README.md)', desc: 'Manual do desenvolvedor contendo visão geral do ecossistema, instalação de dependências e execução.' },
  { name: 'AUDIT_CORRECTION_PLAN.md', title: 'Plano de Correção de Auditoria (AUDIT_CORRECTION_PLAN.md)', desc: 'Roteiro de 8 fases para correção arquitetural, desacoplamento e segurança do OS.' }
];

docsSearchRouter.post('/docs/search', requireAuth, validateBody(docsSearchSchema), async (req, res) => {
  const { query } = req.body;
  const cleanQuery = query.trim().toLowerCase();

  try {
    const results: string[] = [];
    const sources: { title: string; uri: string }[] = [];

    // Check if user wants a directory list or query is brief
    const isHelp = ['ajuda', 'help', 'docs', 'documentos', 'listar', 'list', 'quais', 'arquivos', 'documento'].some(term => cleanQuery.includes(term));

    if (isHelp || cleanQuery.length < 3) {
      results.push(`## Central de Documentação e Especificações Técnicas (Sem IA)

Bem-vindo ao navegador local de especificações do projeto. Encontramos os seguintes documentos do sistema disponíveis para consulta direta sem o uso de Inteligência Artificial:

${DOC_FILES.map(doc => `* **${doc.title}**: ${doc.desc}`).join('\n')}

*Para ler um documento específico ou pesquisar conceitos do projeto, digite termos como \`regras de ouro\`, \`sqlite\`, \`segurança\`, \`faturamento\`, \`sdk\` ou o nome de um arquivo na barra de busca.*`);

      DOC_FILES.forEach(doc => {
        sources.push({
          title: doc.title,
          uri: `file:///${doc.name}`
        });
      });
    } else {
      let matchCount = 0;

      for (const doc of DOC_FILES) {
        let filePath = join(process.cwd(), doc.name);
        if (!existsSync(filePath)) {
          filePath = join(process.cwd(), 'docs', doc.name);
        }
        if (!existsSync(filePath)) continue;

        const fileContent = readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        let currentSectionHeader = '';
        let currentSectionBody: string[] = [];
        const sections: { header: string; body: string }[] = [];

        for (const line of lines) {
          const isHeader = line.startsWith('#');
          if (isHeader) {
            if (currentSectionHeader || currentSectionBody.length > 0) {
              sections.push({
                header: currentSectionHeader || doc.title,
                body: currentSectionBody.join('\n')
              });
            }
            currentSectionHeader = line;
            currentSectionBody = [];
          } else {
            currentSectionBody.push(line);
          }
        }
        if (currentSectionHeader || currentSectionBody.length > 0) {
          sections.push({
            header: currentSectionHeader || doc.title,
            body: currentSectionBody.join('\n')
          });
        }

        const matchedSectionsInDoc: string[] = [];
        for (const sec of sections) {
          const headerLower = sec.header.toLowerCase();
          const bodyLower = sec.body.toLowerCase();

          if (headerLower.includes(cleanQuery) || bodyLower.includes(cleanQuery)) {
            // Include matching sections up to some reasonable limit
            matchedSectionsInDoc.push(`${sec.header}\n${sec.body}`);
            matchCount++;
          }
        }

        if (matchedSectionsInDoc.length > 0) {
          results.push(`### Documento: ${doc.title}\n\n${matchedSectionsInDoc.slice(0, 3).join('\n\n')}`);
          sources.push({
            title: doc.title,
            uri: `file:///${doc.name}`
          });
        }
      }

      if (matchCount === 0) {
        results.push(`## Nenhum trecho exato encontrado para: "${query}"

Nenhuma correspondência direta foi encontrada nos documentos locais com a palavra-chave informada. 

Experimente pesquisar por termos conhecidos da fundação técnica do projeto:
* **"regras de ouro"** ou **"sincronismo"** (Mapeia as diretrizes do ecossistema)
* **"sqlite"** ou **"central_store"** (Mapeia a arquitetura de persistência e banco de dados)
* **"billing"** ou **"dupla entrada"** (Mapeia o faturamento e conciliação de caixa)
* **"segurança"** ou **"anti-idor"** (Mapeia as travas de isolamento multi-tenant)
* **"semver"** ou **"ota"** (Mapeia as rotas de distribuição e integridade)`);
      } else {
        results.unshift(`## Resultados da Consulta Local de Documentos (Total: ${matchCount} seções correspondentes)

Sua pesquisa por \`"${query}"\` foi processada diretamente nos documentos do repositório local (sem Inteligência Artificial), garantindo total fidelidade e zero alucinações técnicas.`);
      }
    }

    res.json({
      success: true,
      query,
      answer: results.join('\n\n---\n\n'),
      sources
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('Local documents search error:', errorMsg);
    res.status(500).json({
      error: `Não foi possível ler os documentos locais: ${errorMsg}.`
    });
  }
});
