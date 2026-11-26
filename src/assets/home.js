/* Le Dress Club — página inicial: fotos da abertura e novidades vindas do catálogo */
(function () {
  'use strict';
  var L = window.LeDress;

  L.carregarDados().then(function (dados) {
    var pecas = dados.pecas || [];
    var comFoto = pecas.filter(function (p) { return p.fotos && p.fotos.length; });
    var vestidosComFoto = comFoto.filter(L.ehVestido);

    // Abertura: 4 peças da Seleção Premium (ou as mais recentes) com foto
    var abertura = vestidosComFoto.filter(function (p) { return p.premium; }).slice(0, 4);
    vestidosComFoto.forEach(function (p) { if (abertura.length < 4 && abertura.indexOf(p) < 0) abertura.push(p); });
    var caixaFotos = document.getElementById('abertura-fotos');
    if (caixaFotos && abertura.length === 4) {
      caixaFotos.innerHTML = abertura.map(function (p, i) {
        return '<a class="abertura__foto" href="catalogo.html#peca=' + encodeURIComponent(p.id) + '" aria-label="Ver ' + L.esc(p.nome) + '">' +
          L.imagem(p.fotos[0], p.nome, '(max-width: 640px) 50vw, 250px', i < 2) + '</a>';
      }).join('');
    }

    // Novidades: as 4 peças mais recentes (vestidos), preferindo as que têm foto
    var base = vestidosComFoto.length >= 4 ? vestidosComFoto : pecas.filter(L.ehVestido);
    var novidades = base.slice(0, 4);
    var grade = document.getElementById('novidades');
    if (grade) grade.innerHTML = novidades.map(function (p) { return L.cartao(p); }).join('');
  }).catch(function () {
    var grade = document.getElementById('novidades');
    if (grade) grade.innerHTML = '<p>Não foi possível carregar as novidades agora. <a href="catalogo.html">Ver o catálogo</a></p>';
  });
})();
