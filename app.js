(function () {
  "use strict";
  var C = window.INVITACION || {};
  var DEMO = !C.API_URL;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Código del invitado (de /abcd o ?i=abcd) ----------
  var codigo = (location.pathname.replace(/^\/+|\/+$/g, "") || new URLSearchParams(location.search).get("i") || "").toLowerCase();
  if (codigo === "index" || codigo === "index.html") codigo = "";

  var invitado = null;
  var personas = 1;

  // ---------- Datos fijos ----------
  $("lugarNombre").textContent = C.LUGAR_NOMBRE;
  $("lugarDir").textContent = C.LUGAR_DIRECCION;
  var q = encodeURIComponent(C.LUGAR_BUSQUEDA);
  $("btnMaps").href = "https://www.google.com/maps/search/?api=1&query=" + q;
  $("btnWaze").href = "https://waze.com/ul?q=" + q + "&navigate=yes";

  var inicio = new Date(C.FECHA_EVENTO);
  var fin = new Date(inicio.getTime() + 4 * 3600 * 1000);
  var limite = new Date(C.FECHA_LIMITE);
  function utc(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  var titulo = "Graduación de Carlos Illescas";
  var detalle = "Cena de graduación · Ingeniería en Electrónica · Vestimenta formal";
  $("btnGcal").href = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(titulo) +
    "&dates=" + utc(inicio) + "/" + utc(fin) +
    "&details=" + encodeURIComponent(detalle) +
    "&location=" + q;
  $("btnIcs").addEventListener("click", function (e) {
    e.preventDefault();
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//graduacion//ES", "BEGIN:VEVENT",
      "UID:graduacion-carlos-illescas-2026", "DTSTAMP:" + utc(new Date()),
      "DTSTART:" + utc(inicio), "DTEND:" + utc(fin),
      "SUMMARY:" + titulo, "DESCRIPTION:" + detalle,
      "LOCATION:" + C.LUGAR_BUSQUEDA.replace(/,/g, "\\,"),
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + titulo, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url; a.download = "graduacion-carlos.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });

  // ---------- Cuenta regresiva ----------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function tic() {
    var ms = Math.max(0, inicio - new Date());
    var s = Math.floor(ms / 1000);
    $("cDias").textContent = Math.floor(s / 86400);
    $("cHoras").textContent = pad(Math.floor(s % 86400 / 3600));
    $("cMin").textContent = pad(Math.floor(s % 3600 / 60));
    $("cSeg").textContent = pad(s % 60);
  }
  tic(); setInterval(tic, 1000);

  // ---------- API ----------
  var demoDB = {
    demo: { nombre: "Chopo", lugares: 1, version: "amigos", respuesta: "" },
    demo2: { nombre: "Hugo", lugares: 2, version: "amigos", respuesta: "" },
    demopapas: { nombre: "Familia Pérez", lugares: 3, version: "papas", respuesta: "" }
  };
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function obtener(cod) {
    if (DEMO) {
      return espera(300).then(function () {
        var g = demoDB[cod];
        return g ? { ok: true, invitado: Object.assign({}, g) } : { ok: false, error: "no_encontrado" };
      });
    }
    return fetch(C.API_URL + "?codigo=" + encodeURIComponent(cod), { redirect: "follow" })
      .then(function (r) { return r.json(); });
  }

  function enviar(datos) {
    if (DEMO) {
      return espera(600).then(function () {
        Object.assign(demoDB[datos.codigo], { respuesta: datos.asiste, personas: datos.personas, acompanantes: datos.acompanantes, comentario: datos.comentario });
        return { ok: true };
      });
    }
    return fetch(C.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS con Apps Script
      body: JSON.stringify(datos),
      redirect: "follow"
    }).then(function (r) { return r.json(); });
  }

  // ---------- Paneles ----------
  var paneles = ["pSinCodigo", "pCerrado", "pError", "form", "pGracias"];
  function mostrar(id) { paneles.forEach(function (p) { $(p).hidden = p !== id; }); }
  function plural(n, a, b) { return n === 1 ? a : b; }

  var fmtLimite = "martes 17 de noviembre";
  $("limiteTxt").textContent = "Por favor confirma antes del " + fmtLimite + ".";

  function aplicarVersion(v) {
    document.documentElement.classList.toggle("papas", v === "papas");
  }

  function pintarInvitado() {
    var g = invitado;
    var varios = /^(familia|fam\.|los |las )|\s(y|&)\s/i.test(g.nombre);
    $("saludo").textContent = g.nombre + (varios ? ", tienen una invitación" : ", tienes una invitación");
    if (varios) {
      $("msgTexto").textContent = "Me encantaría que me acompañen en la cena de mi graduación.";
      $("limiteTxt").textContent = "Por favor confirmen antes del " + fmtLimite + ".";
    }
    var n = g.lugares;
    $("lugaresTxt").innerHTML = (varios ? "Tienen <b>" : "Tienes <b>") + n + "</b> " + plural(n, "lugar reservado", "lugares reservados");
    $("campoPersonas").hidden = n <= 1;
    personas = Math.min(Math.max(1, g.personas || n), n);
    actualizarContador();
    if (g.acompanantes) $("acompanantes").value = g.acompanantes;
    if (g.comentario) $("comentario").value = g.comentario;
    if (g.respuesta) {
      var r = document.querySelector('input[name="asiste"][value="' + g.respuesta + '"]');
      if (r) r.checked = true;
    }
    cambiarAsiste();
  }

  function actualizarContador() {
    var n = invitado ? invitado.lugares : 1;
    $("personas").textContent = personas;
    $("menos").disabled = personas <= 1;
    $("mas").disabled = personas >= n;
    $("campoAcomp").hidden = personas <= 1;
  }

  function asisteValor() {
    var r = document.querySelector('input[name="asiste"]:checked');
    return r ? r.value : "";
  }
  function cambiarAsiste() {
    $("bloqueSi").hidden = asisteValor() !== "si";
    $("aviso").textContent = "";
  }

  function mostrarGracias() {
    var g = invitado;
    if (g.respuesta === "si") {
      $("graciasT").textContent = "¡Nos vemos ahí!";
      var p = g.personas || 1;
      $("graciasS").textContent = "Confirmaste " + p + " " + plural(p, "persona", "personas") + ". Gracias por acompañarme.";
    } else {
      $("graciasT").textContent = "Te vamos a extrañar";
      $("graciasS").textContent = "Gracias por avisarme.";
    }
    $("btnCambiar").hidden = new Date() > limite;
    mostrar("pGracias");
  }

  // ---------- Eventos ----------
  Array.prototype.forEach.call(document.querySelectorAll('input[name="asiste"]'), function (r) {
    r.addEventListener("change", cambiarAsiste);
  });
  $("menos").addEventListener("click", function () { if (personas > 1) { personas--; actualizarContador(); } });
  $("mas").addEventListener("click", function () { if (personas < invitado.lugares) { personas++; actualizarContador(); } });
  $("btnCambiar").addEventListener("click", function () { pintarInvitado(); mostrar("form"); });
  $("btnReintentar").addEventListener("click", cargar);

  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var asiste = asisteValor();
    if (!asiste) { $("aviso").textContent = "Elige si podrás asistir."; return; }
    var datos = {
      codigo: codigo,
      asiste: asiste,
      personas: asiste === "si" ? personas : 0,
      acompanantes: asiste === "si" && personas > 1 ? $("acompanantes").value.trim() : "",
      comentario: $("comentario").value.trim()
    };
    var btn = $("btnEnviar");
    btn.disabled = true; btn.textContent = "Enviando…"; $("aviso").textContent = "";
    enviar(datos).then(function (res) {
      if (res && res.ok) {
        invitado.respuesta = datos.asiste;
        invitado.personas = datos.personas;
        invitado.acompanantes = datos.acompanantes;
        invitado.comentario = datos.comentario;
        mostrarGracias();
      } else if (res && res.error === "cerrado") {
        mostrar("pCerrado");
      } else {
        $("aviso").textContent = "No se pudo guardar. Intenta de nuevo.";
      }
    }).catch(function () {
      $("aviso").textContent = "No se pudo enviar. Revisa tu conexión e intenta de nuevo.";
    }).then(function () {
      btn.disabled = false; btn.textContent = "Enviar confirmación";
    });
  });

  // ---------- Carga inicial ----------
  function cargar() {
    if (!codigo) { aplicarVersion("amigos"); mostrar("pSinCodigo"); return; }
    obtener(codigo).then(function (res) {
      if (!res || !res.ok) { mostrar("pSinCodigo"); return; }
      invitado = res.invitado;
      invitado.lugares = Math.max(1, parseInt(invitado.lugares, 10) || 1);
      aplicarVersion(invitado.version);
      pintarInvitado();
      if (invitado.respuesta) mostrarGracias();
      else if (new Date() > limite) mostrar("pCerrado");
      else mostrar("form");
    }).catch(function () { mostrar("pError"); });
  }

  if (DEMO) $("demoTag").hidden = false;
  cargar();
  requestAnimationFrame(function () { document.body.classList.remove("cargando"); });
})();
