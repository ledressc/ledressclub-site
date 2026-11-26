/* Le Dress Club — catálogo com filtros e página de cada peça */
(function () {
  'use strict';
  var L = window.LeDress;
  var esc = L.esc;

  var TIPOS = ['Vestidos', 'Bolsas/Clutches', 'Brincos', 'Estolas'];
  var TAMANHOS = ['PP', 'P', 'M', 'G'];
  var COMPRIMENTOS = ['Longo', 'Midi', 'Curto'];

  var estado = { premium: false, tipo: [], tamanho: [], comprimento: [], cor: [] };
  var pecas = [];
  var porId = {};
  var rolagemLista = 0;
  var veioDaLista = false;

  var el = function (id) { return document.getElementById(id); };

  function alternar(lista, valor) {
    var i = lista.indexOf(valor);
    if (i >= 0) lista.splice(i, 1); else lista.push(valor);
  }

  function criarChips(caixaId, valores, chave, comCor) {
    var caixa = el(caixaId);
    caixa.innerHTML = valores.map(function (v) {
      if (comCor) {
        return '<button type="button" class="chip chip--cor" data-valor="' + esc(v) + '" aria-pressed="false">' +
          '<span class="chip__bolinha" style="background: ' + L.CORES[v] + '"></span>' + esc(v) + '</button>';
      }
      return '<button type="button" class="chip" data-valor="' + esc(v) + '" aria-pressed="false">' + esc(v) + '</button>';
    }).join('');
    caixa.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-valor]');
      if (!b) return;
      alternar(estado[chave], b.getAttribute('data-valor'));
      b.setAttribute('aria-pressed', estado[chave].indexOf(b.getAttribute('data-valor')) >= 0 ? 'true' : 'false');
      renderizarLista();
    });
  }

  function passa(p) {
    var vestido = L.ehVestido(p);
    if (estado.premium && !p.premium) return false;
    if (estado.tipo.length && estado.tipo.indexOf(p.tipo || 'Vestidos') < 0) return false;
    if (estado.tamanho.length && vestido && !(p.tamanhos || []).some(function (t) { return estado.tamanho.indexOf(t) >= 0; })) return false;
    if (estado.comprimento.length && vestido && !(p.comprimentos || []).some(function (c) { return estado.comprimento.indexOf(c) >= 0; })) return false;
    if (estado.cor.length && !(p.cores || []).some(function (c) { return estado.cor.indexOf(c) >= 0; })) return false;
    return true;
  }

  function renderizarLista() {
    var mostraMedidas = !estado.tipo.length || estado.tipo.indexOf('Vestidos') >= 0;
    el('filtros-medidas').style.display = mostraMedidas ? 'flex' : 'none';
    var lista = pecas.filter(passa);
    el('total').textContent = lista.length;
    el('total-rotulo').textContent = lista.length === 1 ? 'peça encontrada' : 'peças encontradas';
    el('vazio').hidden = lista.length > 0;
    el('grade').innerHTML = lista.map(function (p) { return L.cartao(p); }).join('');
  }

  function dado(rotulo, valor) {
    return '<div class="peca__dado"><p>' + esc(rotulo) + '</p><p>' + esc(valor || '—') + '</p></div>';
  }

  function renderizarDetalhe(p) {
    var vestido = L.ehVestido(p);
    var fotos = p.fotos || [];
    var principal = fotos.length ? L.imagem(fotos[0], p.nome, '(max-width: 900px) 100vw, 520px', true) : L.silhueta(p, 240);
    var miniaturas = fotos.length > 1 ? '<div class="peca__miniaturas">' + fotos.map(function (f, i) {
      return '<button type="button" data-foto="' + i + '" aria-label="Foto ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '>' +
        '<img src="' + esc(f.p) + '" alt="" loading="lazy"></button>';
    }).join('') + '</div>' : '';
    var descricao = p.descricao ? esc(p.descricao) :
      'Peça do acervo da Le Dress Club, especialmente selecionada e pronta para a sua festa.<br>Fale com a gente para conferir medidas e disponibilidade.';

    el('detalhe').innerHTML =
      '<a class="peca__voltar" href="catalogo.html" id="voltar">← Voltar ao catálogo</a>' +
      '<div class="peca__corpo">' +
        '<div class="peca__galeria"><div class="peca__foto" id="foto-principal">' + principal + '</div>' + miniaturas + '</div>' +
        '<div class="peca__info">' +
          (p.premium && p.marca ? '<p class="peca__premium">Seleção Premium · ' + esc(p.marca) + '</p>' : '') +
          (p.codigo ? '<p class="peca__codigo">Cód. ' + esc(p.codigo) + '</p>' : '') +
          '<h1>' + esc(p.nome) + '</h1>' +
          (p.marca ? '<p>Marca: <strong>' + esc(p.marca) + '</strong></p>' : '') +
          '<p>' + descricao + '</p>' +
          '<div class="peca__dados">' +
            (vestido ? dado('Tamanhos', (p.tamanhos || []).join(', ')) + dado('Comprimento', (p.comprimentos || []).join(', ')) : '') +
            dado('Tipo', p.tipo || 'Vestidos') + dado('Cor', (p.cores || []).join(', ')) +
          '</div>' +
          '<a class="peca__quero" href="' + L.linkPeca(p) + '" target="_blank" rel="noopener">Quero esse: ver disponibilidade no WhatsApp</a>' +
          '<div class="peca__nota"><strong>Prova com hora marcada</strong> no nosso espaço em Porto Alegre, ou <strong>envio à distância para outras cidades</strong> a partir das suas medidas. Todos os ajustes são feitos pela nossa equipe de costura.</div>' +
        '</div>' +
      '</div>';

    var mini = el('detalhe').querySelector('.peca__miniaturas');
    if (mini) mini.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-foto]');
      if (!b) return;
      var i = +b.getAttribute('data-foto');
      el('foto-principal').innerHTML = L.imagem(fotos[i], p.nome, '(max-width: 900px) 100vw, 520px', true);
      mini.querySelectorAll('button').forEach(function (x) { x.removeAttribute('aria-current'); });
      b.setAttribute('aria-current', 'true');
    });
    el('voltar').addEventListener('click', function (e) {
      e.preventDefault();
      if (veioDaLista) history.back();
      else location.href = 'catalogo.html';
    });
    document.title = p.nome + ' · Le Dress Club';
  }

  function rota(primeira) {
    var m = location.hash.match(/^#peca=(.+)$/);
    var p = m ? porId[decodeURIComponent(m[1])] : null;
    if (p) {
      if (!el('lista').hidden && primeira !== true) { rolagemLista = window.scrollY; veioDaLista = true; }
      renderizarDetalhe(p);
      el('lista').hidden = true;
      el('detalhe').hidden = false;
      window.scrollTo(0, 0);
    } else {
      veioDaLista = false;
      el('detalhe').hidden = true;
      el('lista').hidden = false;
      document.title = 'Catálogo · Le Dress Club';
      window.scrollTo(0, rolagemLista);
    }
  }

  L.carregarDados().then(function (dados) {
    pecas = dados.pecas || [];
    pecas.forEach(function (p) { porId[p.id] = p; });
    var coresUsadas = L.ORDEM_CORES.filter(function (c) { return pecas.some(function (p) { return (p.cores || []).indexOf(c) >= 0; }); });
    criarChips('filtro-tipo', TIPOS, 'tipo');
    criarChips('filtro-tamanho', TAMANHOS, 'tamanho');
    criarChips('filtro-comprimento', COMPRIMENTOS, 'comprimento');
    criarChips('filtro-cor', coresUsadas, 'cor', true);
    el('filtro-premium').addEventListener('click', function () {
      estado.premium = !estado.premium;
      this.setAttribute('aria-pressed', estado.premium ? 'true' : 'false');
      renderizarLista();
    });
    el('limpar').addEventListener('click', function () {
      estado = { premium: false, tipo: [], tamanho: [], comprimento: [], cor: [] };
      document.querySelectorAll('.filtros [aria-pressed]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      renderizarLista();
    });
    renderizarLista();
    window.addEventListener('hashchange', function () { rota(false); });
    rota(true);
  }).catch(function () {
    el('grade').innerHTML = '<p>Não foi possível carregar o catálogo agora. Tente de novo em instantes ou <a href="' +
      L.linkWhats('Olá, Le Dress! Quero ver o catálogo de vestidos.') + '">fale com a gente no WhatsApp</a>.</p>';
  });
})();
