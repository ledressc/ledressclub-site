/* Le Dress Club — métricas do site (Microsoft Clarity + Google Analytics 4) e aviso de cookies
 *
 * COMO ATIVAR: preencha os dois códigos abaixo e publique.
 * Enquanto estiverem vazios, este arquivo não faz nada (o site funciona normalmente).
 *
 *   CLARITY_ID → clarity.microsoft.com → seu projeto → Settings → Setup (ex.: 'abc123xyz9')
 *   GA_ID      → analytics.google.com → Administrador → Fluxos de dados → seu site (ex.: 'G-AB12CD34EF')
 *
 * Privacidade: antes da escolha da visitante, as ferramentas rodam sem cookies (dados anônimos).
 * Se ela aceitar, passam a usar cookies. Se recusar, nada é carregado.
 */
(function () {
  'use strict';

  var CLARITY_ID = 'zjw1xhcnp0';
  var GA_ID = 'G-WK69SWN9HN';

  if (!CLARITY_ID && !GA_ID) return;

  var CHAVE = 'ledress-cookies'; // 'aceito' | 'recusado'

  function lerEscolha() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function salvarEscolha(v) { try { localStorage.setItem(CHAVE, v); } catch (e) { /* navegador sem armazenamento */ } }

  var escolha = lerEscolha();
  window.LeDressCookies = {
    mudarEscolha: function () { try { localStorage.removeItem(CHAVE); } catch (e) {} location.reload(); }
  };
  if (escolha === 'recusado') return;

  var aceito = escolha === 'aceito';
  var estado = aceito ? 'granted' : 'denied';

  /* ---------- Google Analytics 4 (com modo de consentimento) ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (GA_ID) {
    gtag('consent', 'default', {
      analytics_storage: estado, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', GA_ID);
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(g);
  }

  /* ---------- Microsoft Clarity (mapa de calor e gravações) ---------- */
  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
  if (CLARITY_ID) {
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: estado });
    var c = document.createElement('script');
    c.async = true;
    c.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(CLARITY_ID);
    document.head.appendChild(c);
  }

  function evento(nome, params) {
    if (GA_ID) gtag('event', nome, params || {});
    if (CLARITY_ID) window.clarity('event', NOMES_CLARITY[nome] || nome);
  }
  // Nomes mais claros para filtrar gravações no Clarity
  var NOMES_CLARITY = { view_item: 'abriu_peca', select_item: 'clicou_na_foto', add_to_cart: 'quero_esse', clique_whatsapp: 'whatsapp' };

  /* ---------- Aviso de cookies ---------- */
  function conceder() {
    if (GA_ID) gtag('consent', 'update', { analytics_storage: 'granted' });
    if (CLARITY_ID) window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
  }

  function mostrarAviso() {
    if (escolha || document.querySelector('.aviso-cookies')) return;
    var aviso = document.createElement('div');
    aviso.className = 'aviso-cookies';
    aviso.setAttribute('role', 'region');
    aviso.setAttribute('aria-label', 'Aviso de cookies');
    aviso.innerHTML =
      '<p>Usamos cookies para entender como o site é usado e deixar o catálogo cada vez melhor. ' +
      '<a href="privacidade.html">Saiba mais</a></p>' +
      '<div class="aviso-cookies__botoes">' +
        '<button type="button" class="aviso-cookies__recusar">Recusar</button>' +
        '<button type="button" class="aviso-cookies__aceitar">Aceitar</button>' +
      '</div>';
    aviso.querySelector('.aviso-cookies__aceitar').addEventListener('click', function () {
      salvarEscolha('aceito'); conceder(); aviso.remove();
    });
    aviso.querySelector('.aviso-cookies__recusar').addEventListener('click', function () {
      salvarEscolha('recusado'); aviso.remove(); location.reload(); // recarrega sem as ferramentas
    });
    document.body.appendChild(aviso);
  }

  /* ---------- Dados das peças (para saber qual peça foi clicada) ---------- */
  var porId = {};
  var prontos = window.LeDress && window.LeDress.carregarDados
    ? window.LeDress.carregarDados().then(function (d) { (d.pecas || []).forEach(function (p) { porId[p.id] = p; }); })
    : Promise.resolve();

  function item(p, extra) {
    var it = {
      item_id: p.codigo || p.id,
      item_name: p.nome,
      item_brand: p.marca || undefined,
      item_category: p.tipo || 'Vestidos',
      item_category2: p.premium ? 'Seleção Premium' : 'Acervo',
      item_category3: (p.tamanhos || []).join(', ') || undefined,
      item_category4: (p.comprimentos || []).join(', ') || undefined,
      item_variant: (p.cores || []).join(', ') || undefined
    };
    for (var k in extra) it[k] = extra[k];
    return it;
  }

  function idDoHash() {
    var m = location.hash.match(/^#peca=(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function ondeEsta(elemento) {
    if (elemento.closest('#abertura-fotos')) return 'home_abertura';
    if (elemento.closest('#novidades')) return 'home_novidades';
    if (elemento.closest('#grade')) return 'catalogo';
    return 'outro';
  }

  // Peça aberta (página da peça)
  var ultimaVista = null;
  function registrarVisualizacao() {
    var id = idDoHash();
    if (!id || id === ultimaVista) { if (!id) ultimaVista = null; return; }
    ultimaVista = id;
    prontos.then(function () {
      var p = porId[id];
      if (!p) return;
      evento('view_item', { items: [item(p)] });
      if (CLARITY_ID) window.clarity('set', 'peca', p.codigo || p.nome);
    });
  }

  /* ---------- Cliques ---------- */
  document.addEventListener('click', function (e) {
    var alvo = e.target.closest('a, button');
    if (!alvo) return;

    // Clique na foto de uma peça (vitrine)
    if (alvo.matches('a[data-peca]')) {
      var p1 = porId[alvo.getAttribute('data-peca')];
      if (p1) evento('select_item', { item_list_name: ondeEsta(alvo), items: [item(p1)] });
      return;
    }

    // Qualquer botão de WhatsApp
    var href = alvo.getAttribute('href') || '';
    if (href.indexOf('wa.me/') >= 0) {
      var local = 'outro', peca = null;
      if (alvo.classList.contains('botao-quero')) {
        var foto = alvo.closest('.cartao') && alvo.closest('.cartao').querySelector('[data-peca]');
        peca = foto ? porId[foto.getAttribute('data-peca')] : null;
        local = 'cartao_' + ondeEsta(alvo);
      } else if (alvo.classList.contains('peca__quero')) {
        peca = porId[idDoHash()] || null;
        local = 'pagina_peca';
      } else if (alvo.closest('.cabecalho')) local = 'cabecalho';
      else if (alvo.closest('.rodape')) local = 'rodape';
      else if (alvo.closest('#atelier')) local = 'atelier_sob_medida';
      else if (alvo.closest('#club')) local = 'club_consignacao';
      else if (alvo.closest('#vazio')) local = 'sem_resultado';

      var params = { local: local };
      if (peca) {
        params.peca_codigo = peca.codigo || peca.id;
        params.peca_nome = peca.nome;
        // "Quero esse" aparece no Analytics como "adicionar ao carrinho", com a peça
        evento('add_to_cart', { items: [item(peca)] });
      }
      evento('clique_whatsapp', params);
      return;
    }

    // Filtros do catálogo (o estado do botão já foi atualizado quando este código roda)
    if (alvo.closest('.filtros')) {
      var grupo = alvo.id === 'filtro-premium' ? 'selecao'
        : alvo.id === 'limpar' ? 'limpar'
        : ((alvo.closest('.filtro__opcoes') || {}).id || '').replace('filtro-', '');
      if (!grupo) return;
      if (grupo === 'limpar') { evento('filtro_limpar'); return; }
      var ativo = alvo.getAttribute('aria-pressed') === 'true';
      evento('filtro', {
        filtro_tipo: grupo,
        filtro_valor: grupo === 'selecao' ? 'Premium' : alvo.getAttribute('data-valor'),
        filtro_acao: ativo ? 'ligou' : 'desligou'
      });
      var vazio = document.getElementById('vazio');
      if (ativo && vazio && !vazio.hidden) {
        var combinacao = Array.prototype.map.call(
          document.querySelectorAll('.filtros [aria-pressed="true"]'),
          function (b) { return b.getAttribute('data-valor') || 'Premium'; }
        ).join(' + ');
        evento('filtro_sem_resultado', { filtro_combinacao: combinacao });
      }
    }
  });

  function iniciar() {
    mostrarAviso();
    registrarVisualizacao();
    window.addEventListener('hashchange', registrarVisualizacao);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
