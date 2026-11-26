/* Le Dress Club — funções compartilhadas entre as páginas */
(function () {
  'use strict';

  var WHATS = '5551991663294';

  var CORES = {
    'Amarelo / Dourado': '#D9A93B', 'Verde': '#3F7A5A', 'Azul': '#2F5DA8', 'Roxo': '#6B4C9A',
    'Rosa': '#E0679F', 'Vermelho': '#A8263A', 'Laranja / Terracota': '#C0623A',
    'Nude / Bege': '#D8BFA4', 'Marrom': '#6E4B33', 'Branco / Off-White': '#FFFFFF',
    'Cinza / Prata': '#A0A0A8', 'Preto': '#2B2B2B',
    'Estampado': 'conic-gradient(#E0679F 0 33%, #3F7A5A 0 66%, #D9A93B 0)'
  };
  var ORDEM_CORES = Object.keys(CORES);

  var SILHUETAS = {
    'Vestidos': 'M38 8 L42 8 L46 28 L54 28 L58 8 L62 8 L64 34 Q66 46 60 56 L86 150 Q50 160 14 150 L40 56 Q34 46 36 34 Z',
    'Bolsas/Clutches': 'M16 60 H84 Q90 60 90 66 V108 Q90 114 84 114 H16 Q10 114 10 108 V66 Q10 60 16 60 Z',
    'Brincos': 'M26 36 A4 4 0 1 1 34 36 A4 4 0 1 1 26 36 Z M30 46 Q16 76 30 98 Q44 76 30 46 Z M66 36 A4 4 0 1 1 74 36 A4 4 0 1 1 66 36 Z M70 46 Q56 76 70 98 Q84 76 70 46 Z',
    'Estolas': 'M8 52 Q50 30 92 52 L84 126 Q50 108 16 126 Z'
  };

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function semAcento(t) {
    return Array.from(String(t).normalize('NFC')).map(function (ch) { return ch.normalize('NFD')[0]; }).join('').toLowerCase();
  }

  /* Nome curto para o cartão: sem "Vestido " no começo e, nas peças premium, sem a marca repetida. */
  function nomeCartao(p) {
    var nome = p.nome.replace(/^Vestido\s+/i, '');
    if (p.premium && p.marca) {
      var base = p.marca.replace(/^Atelier\s+/i, '').replace(/\s+(Atelier|Estilista|Design)$/i, '');
      var variantes = [p.marca, 'Atelier ' + base, base + ' Atelier', base];
      for (var i = 0; i < variantes.length; i++) {
        var pos = semAcento(nome).indexOf(semAcento(variantes[i]));
        if (pos >= 0) {
          nome = (nome.slice(0, pos) + nome.slice(pos + variantes[i].length)).replace(/\s+/g, ' ').replace(/\s+[|·-]\s*$/, '').trim();
          break;
        }
      }
    }
    // Vestidos curtos: tira o "Curto" do começo do nome (o selo da foto já mostra o comprimento)
    if (ehVestido(p)) {
      var semCurto = nome.replace(/^Curto\s+(em\s+)?/i, '');
      if (semCurto) nome = semCurto.charAt(0).toUpperCase() + semCurto.slice(1);
    }
    return nome || p.nome;
  }

  function ehVestido(p) { return !p.tipo || p.tipo === 'Vestidos'; }

  function linkWhats(texto) {
    return 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(texto);
  }

  function linkPeca(p) {
    var artigo = ehVestido(p) ? 'o ' : 'a peça ';
    var cod = p.codigo ? ' (cód. ' + p.codigo + ')' : '';
    return linkWhats('Olá, Le Dress! Vi no site ' + artigo + p.nome + cod + ' e quero saber se está disponível para a minha data.');
  }

  function corPrincipal(p) {
    var c = (p.cores || [])[0];
    var hex = CORES[c] || '#C9B7C0';
    return hex.indexOf('gradient') >= 0 ? '#C9B7C0' : hex;
  }

  function silhueta(p, largura) {
    var path = SILHUETAS[p.tipo] || SILHUETAS['Vestidos'];
    var w = largura || 130, h = Math.round(w * 1.6);
    return '<svg viewBox="0 0 100 160" width="' + w + '" height="' + h + '" aria-hidden="true"><path d="' + path +
      '" fill="' + corPrincipal(p) + '" stroke="#474747" stroke-opacity="0.3" stroke-width="1"></path></svg>';
  }

  function imagem(foto, alt, tamanhos, eager) {
    if (!foto) return '';
    return '<img src="' + esc(foto.p) + '" srcset="' + esc(foto.p) + ' 640w, ' + esc(foto.g) + ' 1280w" sizes="' +
      (tamanhos || '(max-width: 640px) 50vw, 300px') + '" alt="' + esc(alt) + '"' + (eager ? '' : ' loading="lazy"') + ' decoding="async">';
  }

  function cartao(p, opcoes) {
    opcoes = opcoes || {};
    var nome = nomeCartao(p);
    var info = 'Cód. ' + esc(p.codigo || '—') + ' · ' + (ehVestido(p) ? 'Tam. ' + esc((p.tamanhos || []).join(', ') || '—') : 'Acessório');
    var selo = ehVestido(p) ? (p.comprimentos || []).join(' / ') : p.tipo;
    var foto = p.fotos && p.fotos[0] ? imagem(p.fotos[0], p.nome) : silhueta(p);
    var href = opcoes.hrefFoto || ('catalogo.html#peca=' + encodeURIComponent(p.id));
    return '<article class="cartao">' +
      '<a class="cartao__foto" href="' + href + '" data-peca="' + esc(p.id) + '" aria-label="Ver ' + esc(p.nome) + '">' + foto +
      (p.premium ? '<span class="selo-premium">Premium</span>' : '') +
      (selo ? '<span class="selo">' + esc(selo) + '</span>' : '') + '</a>' +
      '<div class="cartao__texto"><p class="cartao__nome">' + esc(nome) + '</p>' +
      (p.premium && p.marca ? '<p class="cartao__marca">' + esc(p.marca) + '</p>' : '') +
      '<p class="cartao__info">' + info + '</p></div>' +
      '<a class="botao-quero" href="' + linkPeca(p) + '" target="_blank" rel="noopener">Quero Esse</a>' +
      '</article>';
  }

  var cacheDados = null;
  function carregarDados() {
    if (!cacheDados) {
      cacheDados = fetch('data/catalogo.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('Falha ao carregar o catálogo');
        return r.json();
      });
    }
    return cacheDados;
  }

  window.LeDress = {
    CORES: CORES, ORDEM_CORES: ORDEM_CORES, esc: esc, nomeCartao: nomeCartao, ehVestido: ehVestido,
    linkWhats: linkWhats, linkPeca: linkPeca, silhueta: silhueta, imagem: imagem, cartao: cartao,
    carregarDados: carregarDados
  };
})();
