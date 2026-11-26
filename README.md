# Site da Le Dress Club

Site oficial da Le Dress Club — **ledressclub.com.br**.

## Como funciona

- O catálogo vem do banco **Catálogo Le Dress Club** no Notion.
- De hora em hora o GitHub roda o robô "Publicar site": lê o Notion, baixa as fotos, gera o site e publica.
- Para atualizar na hora: aba **Actions** → **Publicar site** → **Run workflow**.

## O que o site lê do Notion

| Coluna no Notion | Uso no site |
|---|---|
| Nome | Título da peça |
| Código | Aparece no cartão e vai na mensagem do WhatsApp |
| Marca | Mostrada na página da peça (e no cartão, se for Premium) |
| Descrição | Texto da página da peça |
| Cor, Tamanho, Comprimento, Tipo | Filtros do catálogo |
| Seleção Premium | Filtro "Premium · Grifes & Estilistas" |
| Fotos dentro da página | Galeria (a primeira é a foto do cartão). Sem foto, usa a capa. |

## Arquivos

- `src/` — páginas, estilos e scripts do site
- `scripts/build.mjs` — robô que lê o Notion e monta o site
- `.github/workflows/publicar.yml` — agendamento e publicação no GitHub Pages
- Segredo necessário no repositório: `NOTION_TOKEN` (chave da integração "Site Le Dress" do Notion)
