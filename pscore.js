// ============================================================
// CONFIGURAÇÃO — substitua pela URL do seu Google Apps Script
// ============================================================
// ============================================================
// BOTÃO NOVA ANÁLISE — zera o formulário inteiro
// ============================================================
function novaAnalise() {
  if (!confirm("Tem certeza? Todos os dados preenchidos serão perdidos.")) return;
 
  document.getElementById("descricao").value = "";
  document.getElementById("num-turnos").value = "";
  document.getElementById("peso-s").value = "0.25";
  document.getElementById("peso-c").value = "0.25";
  document.getElementById("peso-r").value = "0.25";
  document.getElementById("peso-o").value = "0.25";
  document.getElementById("url-conversa").value = "";
  document.getElementById("modelo").value = "";
  document.getElementById("persona-prompt").value = "";
 
  document.getElementById("turnos-container").innerHTML =
    "<p><em>Os campos de turno aparecerão após você confirmar o número de turnos na Etapa 2.</em></p>";
 
  document.getElementById("resultados").style.display = "none";
  document.getElementById("resultados-conteudo").innerHTML = "";
  document.getElementById("status-envio").textContent = "";
  document.getElementById("aviso-pesos").style.display = "none";
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
// CÁLCULO — Variância populacional de um array
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
//
// PROTEÇÃO: Pt é clipado a mínimo 0.01.
// Justificativa: Pt <= 0 não tem interpretação válida na escala
// Likert e quebraria o ln() da regressão linear subsequente.
// ============================================================
function calcularPt(ws, wc, wr, wo, xs, xc, xr, xo) {
  const soma    = ws * xs + wc * xc + wr * xr + wo * xo;
  const varNota = variancia([xs, xc, xr, xo]);
  return Math.max(soma - varNota, 0.01);
}
 
// ============================================================
// CÁLCULO — Taxa de Erosão (λ) via mínimos quadrados
//
// Lineariza: ln(Pt) = ln(P0) - λ*t
// Slope OLS: b = [n·Σ(t·ln(Pt)) - Σt·Σln(Pt)] / [n·Σ(t²) - (Σt)²]
// λ = -b
// ============================================================
function calcularLambda(pts) {
  const n = pts.length;
  if (n < 2) return 0;
 
  const ts    = pts.map((_, i) => i + 1);
  const lnPts = pts.map(p => Math.log(Math.max(p, 0.01)));
 
  const sumT   = ts.reduce((a, b) => a + b, 0);
  const sumLn  = lnPts.reduce((a, b) => a + b, 0);
  const sumTLn = ts.reduce((acc, t, i) => acc + t * lnPts[i], 0);
  const sumT2  = ts.reduce((acc, t) => acc + t * t, 0);
 
  const numerador   = n * sumTLn - sumT * sumLn;
  const denominador = n * sumT2  - sumT * sumT;   // n·Σt² − (Σt)²
 
  if (denominador === 0) return 0;
  return -(numerador / denominador); // λ = -b
}
 
// ============================================================
// CÁLCULO — Pscore Final com decaimento exponencial
// Fórmula: Pscore = (1/n) · Σ [ Pi · e^(−λ·(i−1)) ]
// Turno 1 → expoente 0 → e^0 = 1 (sem penalidade no primeiro turno)
// ============================================================
function calcularPscoreFinal(pts, lambda) {
  const n = pts.length;
  let soma = 0;
  for (let i = 0; i < n; i++) {
    soma += pts[i] * Math.exp(-lambda * i);
  }
  return soma / n;
}
 
// ============================================================
// PRINCIPAL — Validar, calcular e enviar
// ============================================================
function calcularEEnviar() {
  const descricao     = document.getElementById("descricao").value.trim();
  const numTurnos     = parseInt(document.getElementById("num-turnos").value);
  const ws            = parseFloat(document.getElementById("peso-s").value);
  const wc            = parseFloat(document.getElementById("peso-c").value);
  const wr            = parseFloat(document.getElementById("peso-r").value);
  const wo            = parseFloat(document.getElementById("peso-o").value);
  const urlConversa   = document.getElementById("url-conversa").value.trim();
  const modelo        = document.getElementById("modelo").value.trim();
  const personaPrompt = document.getElementById("persona-prompt").value.trim();
 
  // Validações
  if (!descricao)                  { alert("Preencha a descrição (Etapa 1)."); return; }
  if (!numTurnos || numTurnos < 1) { alert("Informe um número de turnos válido (Etapa 2)."); return; }
  if (isNaN(ws)||isNaN(wc)||isNaN(wr)||isNaN(wo)) { alert("Preencha todos os pesos (Etapa 3)."); return; }
 
  const somaPesos = ws + wc + wr + wo;
  if (Math.abs(somaPesos - 1.0) > 0.01) {
    document.getElementById("aviso-pesos").style.display = "block";
    alert(`A soma dos pesos é ${somaPesos.toFixed(2)}. Deve ser 1.00.`);
    return;
  }
  document.getElementById("aviso-pesos").style.display = "none";
 
  if (!urlConversa)   { alert("Informe a URL da conversa (Etapa 5)."); return; }
  if (!modelo)        { alert("Informe o modelo utilizado (Etapa 5)."); return; }
  if (!personaPrompt) { alert("Informe o Persona Prompt (Etapa 5)."); return; }
 
  // Coleta turnos
  const listaMsgsUser  = [];
  const listaMsgsAgent = [];
  const listaS = [], listaC = [], listaR = [], listaO = [];
 
  for (let i = 1; i <= numTurnos; i++) {
    const msgUser  = document.getElementById(`msg-user-${i}`)?.value.trim();
    const msgAgent = document.getElementById(`msg-agent-${i}`)?.value.trim();
    const xs = parseFloat(document.getElementById(`nota-s-${i}`)?.value);
    const xc = parseFloat(document.getElementById(`nota-c-${i}`)?.value);
    const xr = parseFloat(document.getElementById(`nota-r-${i}`)?.value);
    const xo = parseFloat(document.getElementById(`nota-o-${i}`)?.value);
 
    if (!msgUser)  { alert(`Preencha a mensagem do usuário no Turno ${i}.`); return; }
    if (!msgAgent) { alert(`Preencha a resposta do agente no Turno ${i}.`); return; }
    if (isNaN(xs)||isNaN(xc)||isNaN(xr)||isNaN(xo)) {
      alert(`Selecione todas as notas Likert no Turno ${i}.`); return;
    }
 
    listaMsgsUser.push(msgUser);
    listaMsgsAgent.push(msgAgent);
    listaS.push(xs);
    listaC.push(xc);
    listaR.push(xr);
    listaO.push(xo);
  }

function verificarPasscode() {
  const input = document.getElementById("passcode").value.trim();
  if (input === "persona") {
    document.getElementById("section-passcode").style.display = "none";
    document.getElementById("main-form").style.display = "block";
  } else {
    document.getElementById("passcode-erro").style.display = "block";
  }
}
  
  // Cálculos
  const listaPt = [];
  for (let i = 0; i < numTurnos; i++) {
    listaPt.push(calcularPt(ws, wc, wr, wo, listaS[i], listaC[i], listaR[i], listaO[i]));
  }
 
  const lambda      = calcularLambda(listaPt);
  const pscoreFinal = calcularPscoreFinal(listaPt, lambda);
 
  // Exibe tabela de resultados na página
  const divResultados = document.getElementById("resultados");
  const divConteudo   = document.getElementById("resultados-conteudo");
 
  let html = `<table border="1" cellpadding="5">
    <tr><th>Turno</th><th>S</th><th>C</th><th>R</th><th>O</th><th>Pt (instantâneo)</th></tr>`;
  for (let i = 0; i < numTurnos; i++) {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${listaS[i]}</td><td>${listaC[i]}</td><td>${listaR[i]}</td><td>${listaO[i]}</td>
      <td>${listaPt[i].toFixed(4)}</td>
    </tr>`;
  }
  html += `</table>
    <p><strong>Taxa de Erosão (λ):</strong> ${lambda.toFixed(6)}</p>
    <p><strong>Pscore Final:</strong> ${pscoreFinal.toFixed(6)}</p>`;
  divConteudo.innerHTML = html;
  divResultados.style.display = "block";
 
  // Payload para o Sheets
  // Listas de perguntas e respostas são JSON arrays — cada item é um turno
  const payload = {
    timestamp:        new Date().toISOString(),
    descricao:        descricao,
    num_turnos:       numTurnos,
    peso_s:           ws,
    peso_c:           wc,
    peso_r:           wr,
    peso_o:           wo,
    lista_notas_s:    JSON.stringify(listaS),
    lista_notas_c:    JSON.stringify(listaC),
    lista_notas_r:    JSON.stringify(listaR),
    lista_notas_o:    JSON.stringify(listaO),
    lista_msgs_user:  JSON.stringify(listaMsgsUser),   // array JSON, um item por turno
    lista_msgs_agent: JSON.stringify(listaMsgsAgent),  // array JSON, um item por turno
    lista_pt:         JSON.stringify(listaPt.map(v => parseFloat(v.toFixed(4)))),
    taxa_erosao:      parseFloat(lambda.toFixed(6)),
    pscore_final:     parseFloat(pscoreFinal.toFixed(6)),
    url_conversa:     urlConversa,
    modelo:           modelo,
    persona_prompt:   personaPrompt
  };
 
  const statusEl = document.getElementById("status-envio");
  statusEl.textContent = "⏳ Enviando dados para o Google Sheets...";
 
  fetch("https://script.google.com/macros/s/AKfycbyNEFHv2PwGv9WEipFA37ll3r1kAl3K5_g7kd_5ohbfNaFHXUtTb2EhiSMpBi3xgBmO/exec", {
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
