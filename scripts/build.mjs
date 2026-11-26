// Le Dress Club — gera o site a partir do Notion.
//
// Uso:
//   NOTION_TOKEN=ntn_... node scripts/build.mjs          (lê o Notion de verdade)
//   node scripts/build.mjs --mock mock/catalogo.json      (teste local, sem Notion)
//
// O que faz:
//   1. Lê todas as peças do banco "Catálogo Le Dress Club" no Notion.
//   2. Baixa as fotos de cada peça (imagens dentro da página ou a capa) e gera versões leves (.webp).
//   3. Monta a pasta site/ com as páginas, as fotos e o arquivo data/catalogo.json.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(RAIZ, 'src');
const SAIDA = path.join(RAIZ, 'site');
const CACHE_FOTOS = path.join(RAIZ, '.cache', 'fotos');
const DOMINIO = process.env.SITE_DOMINIO || 'ledressclub.com.br';
const NOTION_DB = process.env.NOTION_DATABASE_ID || '1cad5f08dcd580588b48e49a08911a79';
const NOTION_VERSION = '2022-06-28';
const MAX_FOTOS = 6;

const args = process.argv.slice(2);
const mockIdx = args.indexOf('--mock');
const MOCK = mockIdx >= 0 ? args[mockIdx + 1] : null;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Notion ----------
let ultimaChamada = 0;
async function notion(caminho, { method = 'GET', body } = {}) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('Falta a variável NOTION_TOKEN (a chave da integração do Notion).');
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    const espera = 340 - (Date.now() - ultimaChamada); // ~3 chamadas por segundo (limite do Notion)
    if (espera > 0) await dormir(espera);
    ultimaChamada = Date.now();
    const r = await fetch('https://api.notion.com/v1/' + caminho, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 || r.status >= 500) {
      const s = Number(r.headers.get('retry-after')) || tentativa * 2;
      console.warn(`Notion ocupado (${r.status}), tentando de novo em ${s}s…`);
      await dormir(s * 1000);
      continue;
    }
    const json = await r.json();
    if (!r.ok) {
      const dica = r.status === 404 || r.status === 401
        ? ' Confira se a chave está certa e se o banco "Catálogo Le Dress Club" foi conectado à integração (… > Conexões).'
        : '';
      throw new Error(`Erro do Notion ${r.status}: ${json.message || ''}.${dica}`);
    }
    return json;
  }
  throw new Error('O Notion não respondeu depois de várias tentativas.');
}

const texto = (prop) => (prop?.title || prop?.rich_text || []).map((t) => t.plain_text).join('').trim();
const multi = (prop) => (prop?.multi_select || []).map((o) => o.name.trim()).filter(Boolean);

async function lerPecasNotion() {
  const paginas = [];
  let cursor;
  do {
    const r = await notion(`databases/${NOTION_DB}/query`, {
      method: 'POST',
      body: { page_size: 100, start_cursor: cursor, sorts: [{ timestamp: 'created_time', direction: 'descending' }] },
    });
    paginas.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  console.log(`Notion: ${paginas.length} peças encontradas.`);

  const pecas = [];
  for (const pg of paginas) {
    if (pg.archived || pg.in_trash) continue;
    const pr = pg.properties || {};
    const nome = texto(pr['Nome']);
    if (!nome) continue;
    const imagens = await lerImagensDaPagina(pg);
    pecas.push({
      id: pg.id.replace(/-/g, ''),
      nome,
      codigo: texto(pr['Código']),
      marca: texto(pr['Marca']),
      descricao: texto(pr['Descrição']),
      cores: multi(pr['Cor']),
      tamanhos: multi(pr['Tamanho']),
      comprimentos: multi(pr['Comprimento']),
      tipo: pr['Tipo']?.select?.name || 'Vestidos',
      premium: !!pr['Seleção Premium']?.checkbox,
      criado: pg.created_time,
      imagens, // [{ chave, url }]
    });
  }
  return pecas;
}

async function blocosFilhos(id) {
  const todos = [];
  let cursor;
  do {
    const r = await notion(`blocks/${id}/children?page_size=100${cursor ? '&start_cursor=' + cursor : ''}`);
    todos.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return todos;
}

async function lerImagensDaPagina(pg) {
  const imagens = [];
  const visitar = async (id, nivel) => {
    for (const b of await blocosFilhos(id)) {
      if (imagens.length >= MAX_FOTOS) return;
      if (b.type === 'image') {
        const url = b.image?.type === 'file' ? b.image.file.url : b.image?.external?.url;
        if (url) imagens.push({ chave: b.id.replace(/-/g, ''), url });
      } else if (b.has_children && nivel < 2 && ['column_list', 'column', 'toggle', 'callout'].includes(b.type)) {
        await visitar(b.id, nivel + 1);
      }
    }
  };
  await visitar(pg.id, 0);
  if (!imagens.length && pg.cover) {
    const url = pg.cover.type === 'file' ? pg.cover.file.url : pg.cover.external?.url;
    if (url) imagens.push({ chave: 'capa' + crypto.createHash('md5').update(url.split('?')[0]).digest('hex').slice(0, 16), url });
  }
  return imagens;
}

// ---------- Fotos ----------
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('Aviso: "sharp" não instalado — as fotos serão copiadas sem otimizar.'); }

async function prepararFoto(img) {
  const p = path.join(CACHE_FOTOS, img.chave + '-640.webp');
  const g = path.join(CACHE_FOTOS, img.chave + '-1280.webp');
  if (!existsSync(p) || !existsSync(g)) {
    let buf;
    if (img.arquivoLocal) buf = await fs.readFile(img.arquivoLocal);
    else {
      const r = await fetch(img.url);
      if (!r.ok) throw new Error(`não consegui baixar a foto (${r.status})`);
      buf = Buffer.from(await r.arrayBuffer());
    }
    if (sharp) {
      try { await sharp(buf).metadata(); await sharp(buf).rotate().toBuffer(); }
      catch { buf = await converterHeic(buf); } // fotos do iPhone (HEIC)
      await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toFile(p);
      await sharp(buf).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toFile(g);
    } else {
      await fs.writeFile(p, buf);
      await fs.writeFile(g, buf);
    }
  }
  return { p: 'fotos/' + path.basename(p), g: 'fotos/' + path.basename(g) };
}

// Converte HEIC/HEIF (formato das fotos do iPhone) para JPEG usando o heif-convert do sistema.
async function converterHeic(buf) {
  const base = path.join(os.tmpdir(), 'ld-' + crypto.randomBytes(6).toString('hex'));
  await fs.writeFile(base + '.heic', buf);
  let ultimoErro;
  for (const cmd of ['heif-dec', 'heif-convert']) {
    try {
      await exec(cmd, ['-q', '92', base + '.heic', base + '.jpg']);
      const jpg = await fs.readFile(base + '.jpg');
      await fs.rm(base + '.heic', { force: true }); await fs.rm(base + '.jpg', { force: true });
      return jpg;
    } catch (e) { ultimoErro = e; }
  }
  await fs.rm(base + '.heic', { force: true });
  throw new Error('formato de foto não suportado (HEIC sem conversor): ' + (ultimoErro?.message || ''));
}

async function emParalelo(itens, limite, fn) {
  const resultado = new Array(itens.length);
  let i = 0;
  await Promise.all(Array.from({ length: limite }, async () => {
    while (i < itens.length) { const k = i++; resultado[k] = await fn(itens[k], k); }
  }));
  return resultado;
}

// ---------- Montagem do site ----------
async function listarArquivos(pasta) {
  const lista = [];
  for (const e of await fs.readdir(pasta, { withFileTypes: true })) {
    const a = path.join(pasta, e.name);
    if (e.isDirectory()) lista.push(...await listarArquivos(a));
    else lista.push(a);
  }
  return lista;
}

async function copiarPasta(de, para) {
  await fs.mkdir(para, { recursive: true });
  for (const e of await fs.readdir(de, { withFileTypes: true })) {
    if (e.name === 'partials') continue;
    const a = path.join(de, e.name), b = path.join(para, e.name);
    if (e.isDirectory()) await copiarPasta(a, b);
    else await fs.copyFile(a, b);
  }
}

async function main() {
  const inicio = Date.now();
  await fs.mkdir(CACHE_FOTOS, { recursive: true });

  let pecas;
  if (MOCK) {
    pecas = JSON.parse(await fs.readFile(path.resolve(MOCK), 'utf8'));
    console.log(`Modo teste: ${pecas.length} peças de ${MOCK}`);
  } else {
    pecas = await lerPecasNotion();
  }

  // Fotos
  let falhas = 0;
  const tarefas = pecas.flatMap((p) => (p.imagens || []).map((img) => ({ p, img })));
  const prontas = await emParalelo(tarefas, 4, async ({ p, img }) => {
    try { return { p, foto: await prepararFoto(img) }; }
    catch (e) { falhas++; console.warn(`Foto ignorada (${p.codigo || p.nome}): ${e.message}`); return null; }
  });
  for (const p of pecas) p.fotos = [];
  for (const r of prontas) if (r) r.p.fotos.push(r.foto);
  console.log(`Fotos: ${prontas.filter(Boolean).length} prontas${falhas ? `, ${falhas} com problema` : ''}.`);

  // Pasta final
  await fs.rm(SAIDA, { recursive: true, force: true });
  await copiarPasta(SRC, SAIDA);
  const usadas = new Set(pecas.flatMap((p) => p.fotos.flatMap((f) => [f.p, f.g])));
  await fs.mkdir(path.join(SAIDA, 'fotos'), { recursive: true });
  for (const f of usadas) await fs.copyFile(path.join(CACHE_FOTOS, path.basename(f)), path.join(SAIDA, f));

  // Dados do catálogo
  const dados = {
    atualizado: new Date().toISOString(),
    pecas: pecas.map(({ imagens, criado, ...resto }) => resto),
  };
  await fs.mkdir(path.join(SAIDA, 'data'), { recursive: true });
  await fs.writeFile(path.join(SAIDA, 'data', 'catalogo.json'), JSON.stringify(dados));

  // Páginas: cabeçalho, rodapé e <head> compartilhados
  const parte = (n) => fs.readFile(path.join(SRC, 'partials', n), 'utf8');
  const [head, cabecalho, rodape] = await Promise.all([parte('head.html'), parte('cabecalho.html'), parte('rodape.html')]);
  // "Impressão digital" do site: só muda quando muda alguma peça, foto ou arquivo do site.
  // Serve para atualizar o cache dos navegadores e para pular publicações sem novidade.
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(dados.pecas));
  for (const arq of (await listarArquivos(SRC)).sort()) hash.update(path.relative(SRC, arq)).update(await fs.readFile(arq));
  const versao = hash.digest('hex').slice(0, 12);
  for (const pagina of ['index.html', 'catalogo.html']) {
    const arq = path.join(SAIDA, pagina);
    let html = await fs.readFile(arq, 'utf8');
    html = html
      .replace('<!--HEAD-->', head)
      .replace('<!--CABECALHO-->', cabecalho.replace('{{ATUAL_CATALOGO}}', pagina === 'catalogo.html' ? ' aria-current="page"' : ''))
      .replace('<!--RODAPE-->', rodape)
      .replaceAll('{{VERSAO}}', versao);
    await fs.writeFile(arq, html);
  }
  await fs.writeFile(path.join(SAIDA, 'versao.txt'), versao + '\n');
  await fs.writeFile(path.join(SAIDA, 'CNAME'), DOMINIO + '\n');
  await fs.writeFile(path.join(SAIDA, '.nojekyll'), '');
  await fs.writeFile(path.join(SAIDA, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: https://${DOMINIO}/sitemap.xml\n`);
  await fs.writeFile(path.join(SAIDA, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `<url><loc>https://${DOMINIO}/</loc></url>\n<url><loc>https://${DOMINIO}/catalogo.html</loc></url>\n</urlset>\n`);

  // Limpa do cache fotos que não são mais usadas (peças removidas)
  for (const f of await fs.readdir(CACHE_FOTOS)) {
    if (!usadas.has('fotos/' + f)) await fs.rm(path.join(CACHE_FOTOS, f));
  }

  const semFoto = pecas.filter((p) => !p.fotos.length).length;
  console.log(`Site pronto em site/ — ${pecas.length} peças (${semFoto} sem foto) em ${((Date.now() - inicio) / 1000).toFixed(0)}s.`);
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
