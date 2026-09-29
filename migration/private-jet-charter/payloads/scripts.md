# Private Jet Charter: embed-uri (CSS + JS) în afara payload-urilor

Payload-urile HTML nu conțin `<script>` / `<style>`. Tot ce nu se poate exprima în Style panel stă în **două HtmlEmbed-uri** (fără clasă; invizibile). Alternativă echivalentă: Page Settings → Custom Code (Head = embed A-CSS, Before `</body>` = embed B). Se alege **una** dintre variante, nu ambele.

Valorile sunt hex (în embed-uri variabilele Webflow nu se leagă). Dacă tokenurile se schimbă, se actualizează și aici.

## A. `pjc-page-styles` — HtmlEmbed, ultimul copil al `section_pjc-search`

Stări care cer selectori pe care Designer-ul nu îi poate crea (`:checked + sibling`, `[open]`, `::placeholder`, `::-webkit-details-marker`).

```html
<style>
/* Quote search: tab activ = radio bifat (fără JS) */
.quote-search_radio:checked + .quote-search_tab-text{background-color:#061D38;color:#FFFFFF;}
.quote-search_tab:hover .quote-search_tab-text{background-color:rgba(6,29,56,0.08);}
.quote-search_radio:checked + .quote-search_tab-text:hover{background-color:#061D38;}
.quote-search_radio:focus-visible + .quote-search_tab-text{outline:2px solid #E76C1E;outline-offset:2px;}
.quote-search_input::placeholder{color:#6B7684;opacity:1;}
.quote-search_input:focus-visible,.quote-search_swap:focus-visible{outline:2px solid #E76C1E;outline-offset:2px;}
/* FAQ: marker nativ ascuns + rotirea iconului */
.faq_question::-webkit-details-marker{display:none;}
.faq_question::marker{content:"";}
.faq_item[open] .faq_icon{transform:rotate(180deg);}
.faq_question:focus-visible{outline:2px solid #E76C1E;outline-offset:4px;}
@media (prefers-reduced-motion: reduce){.faq_icon{transition:none;}}
</style>
```

## B. `pjc-quote-search-script` — HtmlEmbed, imediat după embed-ul A (opțional)

Butonul ⇄ inversează valorile From/To. Fără el formularul funcționează complet (GET spre `/en?requestFlight=1&trip=…&from=…&to=…&date=…&passengers=…`); doar butonul swap rămâne inert.

```html
<script>
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-quote-swap]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var form = btn.closest('form');
      if (!form) return;
      var from = form.querySelector('[name="from"]');
      var to = form.querySelector('[name="to"]');
      if (!from || !to) return;
      var tmp = from.value;
      from.value = to.value;
      to.value = tmp;
      (from.value ? to : from).focus();
    });
  });
});
</script>
```

## Note

- **Webflow Form Block:** dacă WHTML builder-ul transformă `<form>` în Form Block (`.w-form`), webflow.js interceptează submit-ul. Atunci: Form settings → Action `/en`, Method `GET`, se șterg/ascund mesajele success/error; dacă interceptarea persistă, formularul se reface ca **Custom Element** cu tag `form` (webflow.js leagă doar `.w-form form`). Verificare în staging: după submit, URL-ul trebuie să fie `/en?requestFlight=1&trip=one-way&from=…`.
- **Temporar:** tot formularul este un înlocuitor accesibil al code component-ului `RequestFlight` (autocomplete aeroporturi, date picker, flux de cerere). Când librăria `lunajets-library` e instalată pe site-ul nou, `quote-search_form` se înlocuiește cu componenta, păstrând `quote-search_component` (panoul) și secțiunea.
- Tracking (PostHog/GTM) pe submit: de adăugat odată cu integrarea reală (nu se inventează evenimente acum).
