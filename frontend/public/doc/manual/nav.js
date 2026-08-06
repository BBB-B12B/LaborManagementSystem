// Shared dropdown behavior for the role-switcher nav (.role-dd) — used across all manual pages.
document.addEventListener('DOMContentLoaded', function () {
  var dds = document.querySelectorAll('.role-dd');
  dds.forEach(function (dd) {
    var btn = dd.querySelector('.role-dd-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !dd.classList.contains('open');
      dds.forEach(function (o) { o.classList.remove('open'); o.querySelector('.role-dd-btn').setAttribute('aria-expanded', 'false'); });
      if (willOpen) { dd.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
  document.addEventListener('click', function () {
    dds.forEach(function (o) { o.classList.remove('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dds.forEach(function (o) { o.classList.remove('open'); });
  });
});
