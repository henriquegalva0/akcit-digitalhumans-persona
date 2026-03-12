// ============================================================
// CONFIGURAÇÃO — substitua pela URL do seu Google Apps Script
// ============================================================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNEFHv2PwGv9WEipFA37ll3r1kAl3K5_g7kd_5ohbfNaFHXUtTb2EhiSMpBi3xgBmO/exec";
const PASSCODE_CORRETO = "persona";

// ============================================================
// ETAPA 0 — Verificação de passcode
// ============================================================
function verificarPasscode() {
  const input = document.getElementById("passcode").value.trim();
  if (input === PASSCODE_CORRETO) {
    document.getElementById("section-passcode").style.display = "none";
    document.getElementById("main-form").style.display = "block";
  } else {
    document.getElementById("passcode-erro").style.display = "block";
  }
}

// ============================================================
// ETAPA 2 — Geração dinâmica dos campos por turno
// ============================================================
function gerarTurnos() {
  const n = parseInt(document.getElementById("num-turnos").value);
  if (!n || n < 1) {
    alert("Informe um número de turnos válido (mínimo 1).");
    return;
  }

  const container = document.getElementById("turnos-container");
  container.innerHTML = "";

  for (let i = 1; i <= n; i++) {
    const bloco = document.createElement("div");
    bloco.style.border = "1px solid #aaa";
    bloco.style.margin = "12px 0";
    bloco.style.padding = "10px";

    bloco.innerHTML = `
      <h3>Turno ${i}</h3>

      <label>Mensagem do usuário (turno ${i}):</label><br>
      <textarea id="msg-user-${i}" rows="2" cols="65"
        placeholder="Cole aqui a mensagem enviada pelo usuário neste turno..."></textarea><br><br>

      <label>Resposta do agente (turno ${i}):</label><br>
      <textarea id="msg-agent-${i}" rows="3" cols="65"
        placeholder="Cole aqui a resposta do agente neste turno..."></textarea><br><br>

      <p><strong>Notas Likert</strong> — avalie cada dimensão de 1 (Colapso) a 5 (Exemplar):</p>

      <label>S — Aderência Estilística:</label>
      <select id="nota-s-${i}">
        <option value="">— selecione —</option>
        <option value="5">5 — Exemplar</option>
        <option value="4">4 — Sólido</option>
        <option value="3">3 — Neutro/Instável</option>
        <option value="2">2 — Falha Parcial</option>
        <option value="1">1 — Colapso</option>
      </select><br><br>

      <label>C — Consistência Contextual:</label>
      <select id="nota-c-${i}">
        <option value="">— selecione —</option>
        <option value="5">5 — Exemplar</option>
        <option value="4">4 — Sólido</option>
        <option value="3">3 — Neutro/Instável</option>
        <option value="2">2 — Falha Parcial</option>
        <option value="1">1 — Colapso</option>
      </select><br><br>

      <label>R — Resiliência Adversária:</label>
      <select id="nota-r-${i}">
        <option value="">— selecione —</option>
        <option value="5">5 — Exemplar</option>
        <option value="4">4 — Sólido</option>
        <option value="3">3 — Neutro/Instável</option>
        <option value="2">2 — Falha Parcial</option>
        <option value="1">1 — Colapso</option>
      </select><br><br>

      <label>O — Estabilidade OOD:</label>
      <select id="nota-o-${i}">
        <option value="">— selecione —</option>
        <option value="5">5 — Exemplar</option>
        <option value="4">4 — Sólido</option>
        <option value="3">3 — Neutro/Instável</option>
        <option value="2">2 — Falha Parcial</option>
        <option value="1">1 — Colapso</option>
      </select>
    `;

    container.appendChild(bloco);
  }
}

// ============================================================
// CÁLCULO — Variância de um array
// ============================================================
function variancia(arr) {
  const n = arr.length;
  if (n === 0) return 0;
  const media = arr.reduce((a, b) => a + b, 0) / n;
  return arr.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / n;
}

// ============================================================
// CÁLCULO — Pscore Instantâneo por Turno (Pt)
// Fórmula: Pt = sum(wd * xd) - Var(x)
// ============================================================
function calcularPt(ws, wc, wr, wo, xs, xc, xr, xo) {
  const soma = ws * xs + wc * xc + wr * xr + wo * xo;
  const varNota = variancia([xs, xc, xr, xo]);
  return soma - varNota;
}

// ============================================================
// CÁLCULO — Taxa de Erosão (λ) via mínimos quadrados
// Lineariza ln(Pt) = ln(P0) - λ*t e acha a inclinação
// ============================================================
function calcularLambda(pts) {
  const n = pts.length;
  // t indexado a partir de 1
  const lnPts = pts.map(p => Math.log(Math.max(p, 0.0001))); // evita log(0)
  const ts = pts.map((_, i) => i + 1);

  const sumT = ts.reduce((a, b) => a + b, 0);
  const sumLn = lnPts.reduce((a, b) => a + b, 0);
  const sumTLn = ts.reduce((acc, t, i) => acc + t * lnPts[i], 0);
  const sumT2 = ts.reduce((acc, t) => acc + t * t, 0);

  const numerador = n * sumTLn - sumT * sumLn;
  const denominador = n * sumT2 - sumT * sumT;

  if (denominador === 0) return 0;
  const b = numerador / denominador; // b = -λ
  return -b; // retorna λ
}

// ============================================================
// CÁLCULO — Pscore Final
// Fórmula: Pscore = (1/n) * sum( Pi * e^(-λ*(i-1)) )
// ============================================================
function calcularPscoreFinal(pts, lambda) {
  const n = pts.length;
  let soma = 0;
  for (let i = 0; i < n; i++) {
    soma += pts[i] * Math.exp(-lambda * i); // i começa em 0 => (i-1) quando i é 1-indexed
  }
  return soma / n;
}

// ============================================================
// PRINCIPAL — Validar, calcular e enviar
// ============================================================
function calcularEEnviar() {
  // — Coleta dados básicos
  const descricao = document.getElementById("descricao").value.trim();
  const numTurnos = parseInt(document.getElementById("num-turnos").value);
  const ws = parseFloat(document.getElementById("peso-s").value);
  const wc = parseFloat(document.getElementById("peso-c").value);
  const wr = parseFloat(document.getElementById("peso-r").value);
  const wo = parseFloat(document.getElementById("peso-o").value);
  const urlConversa = document.getElementById("url-conversa").value.trim();
  const modelo = document.getElementById("modelo").value.trim();
  const personaPrompt = document.getElementById("persona-prompt").value.trim();

  // — Validações básicas
  if (!descricao) { alert("Preencha a descrição da interação (Etapa 1)."); return; }
  if (!numTurnos || numTurnos < 1) { alert("Informe um número de turnos válido (Etapa 2)."); return; }
  if (isNaN(ws) || isNaN(wc) || isNaN(wr) || isNaN(wo)) { alert("Preencha todos os pesos (Etapa 3)."); return; }

  const somaPesos = ws + wc + wr + wo;
  if (Math.abs(somaPesos - 1.0) > 0.01) {
    document.getElementById("aviso-pesos").style.display = "block";
    alert(`A soma dos pesos é ${somaPesos.toFixed(2)}. Deve ser 1.00. Corrija na Etapa 3.`);
    return;
  }
  document.getElementById("aviso-pesos").style.display = "none";

  if (!urlConversa) { alert("Informe a URL da conversa (Etapa 5)."); return; }
  if (!modelo) { alert("Informe o modelo utilizado (Etapa 5)."); return; }
  if (!personaPrompt) { alert("Informe o Persona Prompt (Etapa 5)."); return; }

  // — Coleta e valida turnos
  const listaMsgsUser = [];
  const listaMsgsAgent = [];
  const listaS = [], listaC = [], listaR = [], listaO = [];

  for (let i = 1; i <= numTurnos; i++) {
    const msgUser  = document.getElementById(`msg-user-${i}`)?.value.trim();
    const msgAgent = document.getElementById(`msg-agent-${i}`)?.value.trim();
    const xs = parseFloat(document.getElementById(`nota-s-${i}`)?.value);
    const xc = parseFloat(document.getElementById(`nota-c-${i}`)?.value);
    const xr = parseFloat(document.getElementById(`nota-r-${i}`)?.value);
    const xo = parseFloat(document.getElementById(`nota-o-${i}`)?.value);

    if (!msgUser)              { alert(`Preencha a mensagem do usuário no Turno ${i}.`); return; }
    if (!msgAgent)             { alert(`Preencha a resposta do agente no Turno ${i}.`); return; }
    if (isNaN(xs) || isNaN(xc) || isNaN(xr) || isNaN(xo)) {
      alert(`Selecione todas as notas Likert no Turno ${i}.`); return;
    }

    listaMsgsUser.push(msgUser);
    listaMsgsAgent.push(msgAgent);
    listaS.push(xs);
    listaC.push(xc);
    listaR.push(xr);
    listaO.push(xo);
  }

  // — Calcula Pt para cada turno
  const listaPt = [];
  for (let i = 0; i < numTurnos; i++) {
    const pt = calcularPt(ws, wc, wr, wo, listaS[i], listaC[i], listaR[i], listaO[i]);
    listaPt.push(pt);
  }

  // — Calcula λ
  const lambda = calcularLambda(listaPt);

  // — Calcula Pscore Final
  const pscoreFinal = calcularPscoreFinal(listaPt, lambda);

  // — Exibe resultados na página
  const divResultados = document.getElementById("resultados");
  const divConteudo = document.getElementById("resultados-conteudo");
  let html = "<table border='1' cellpadding='5'><tr><th>Turno</th><th>S</th><th>C</th><th>R</th><th>O</th><th>Pt</th></tr>";
  for (let i = 0; i < numTurnos; i++) {
    html += `<tr><td>${i+1}</td><td>${listaS[i]}</td><td>${listaC[i]}</td><td>${listaR[i]}</td><td>${listaO[i]}</td><td>${listaPt[i].toFixed(4)}</td></tr>`;
  }
  html += "</table>";
  html += `<p><strong>Taxa de Erosão (λ):</strong> ${lambda.toFixed(4)}</p>`;
  html += `<p><strong>Pscore Final:</strong> ${pscoreFinal.toFixed(4)}</p>`;
  divConteudo.innerHTML = html;
  divResultados.style.display = "block";

  // — Monta payload para o Google Sheets
  const payload = {
    descricao:         descricao,
    num_turnos:        numTurnos,
    peso_s:            ws,
    peso_c:            wc,
    peso_r:            wr,
    peso_o:            wo,
    lista_notas_s:     listaS.join("|"),
    lista_notas_c:     listaC.join("|"),
    lista_notas_r:     listaR.join("|"),
    lista_notas_o:     listaO.join("|"),
    lista_msgs_user:   listaMsgsUser.join(" ||| "),
    lista_msgs_agent:  listaMsgsAgent.join(" ||| "),
    lista_pt:          listaPt.map(v => v.toFixed(4)).join("|"),
    taxa_erosao:       lambda.toFixed(6),
    pscore_final:      pscoreFinal.toFixed(6),
    url_conversa:      urlConversa,
    modelo:            modelo,
    persona_prompt:    personaPrompt,
    timestamp:         new Date().toISOString()
  };

  // — Envia ao Apps Script
  const statusEl = document.getElementById("status-envio");
  statusEl.textContent = "⏳ Enviando dados para o Google Sheets...";

  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(() => {
    statusEl.textContent = "✅ Dados enviados com sucesso para o Google Sheets!";
  })
  .catch(err => {
    statusEl.textContent = "❌ Erro ao enviar: " + err.message;
  });
}
