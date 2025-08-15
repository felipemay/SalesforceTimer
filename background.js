// Seu background.js existente...

let activeChats = {};
let finishedChats = {};
let closedChats = {};
let lastPlayed = {};
let nextCaseFromChatId = null;
let tabChatMap = {};
let chatCaseMap = {};
let currentChatData = null;

chrome.storage.local.get(["activeChats", "finishedChats", "closedChats", "chatCaseMap", "currentChatData"], (data) => {
  activeChats = data.activeChats || {};
  finishedChats = data.finishedChats || {};
  closedChats = data.closedChats || {};
  chatCaseMap = data.chatCaseMap || {};
  currentChatData = data.currentChatData || null;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.activeChats) activeChats = changes.activeChats.newValue || {};
    if (changes.finishedChats) finishedChats = changes.finishedChats.newValue || {};
    if (changes.closedChats) closedChats = changes.closedChats.newValue || {};
    if (changes.chatCaseMap) chatCaseMap = changes.chatCaseMap.newValue || {};
    if (changes.currentChatData) currentChatData = changes.currentChatData.newValue || null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.title) return;

  const title = changeInfo.title;
  console.log(`Tab ${tabId} updated with title: ${title}`);

  const chatMatches = title.match(/(MS-\d{4,8})/g);
  const caseMatch = title.match(/^(\d{7,8})\s+\|/);

  if (chatMatches) {
    chatMatches.forEach((chatId) => {
      if (!activeChats[chatId] && !finishedChats[chatId] && !closedChats[chatId]) {
        let razaoSocial = "";
        const razaoMatch = title.match(new RegExp(`${chatId}\\s*-\\s*(.+)`));
        if (razaoMatch && razaoMatch[1]) {
          razaoSocial = razaoMatch[1].trim();
        }
        activeChats[chatId] = { startTime: Date.now(), totalTime: 0, isPaused: false, razaoSocial };
        chrome.storage.local.set({ activeChats });
        console.log(`Chat ${chatId} adicionado em activeChats.`);
      }
    });
  }

  if (caseMatch) {
    const caseId = caseMatch[1];

    if (currentChatData && (Date.now() - currentChatData.timestamp < 5000)) {
      const inheritedChat = currentChatData.chatId;
      chatCaseMap[caseId] = inheritedChat;
      chrome.storage.local.set({ chatCaseMap });
      console.log(`[DEBUG] Caso ${caseId} herdou chat: ${inheritedChat}`);
      currentChatData = null;
      chrome.storage.local.remove("currentChatData");
    } else {
      console.log(`[DEBUG] Caso ${caseId} sem chat herdado (timestamp inválido ou ausente)`);
    }
  }
});

function checkChats() {
  chrome.storage.local.get(["activeChats", "finishedChats", "inactivityTime", "repeatTime"], (data) => {
    const chats = data.activeChats || {};
    const finished = data.finishedChats || {};
    const inactivityTime = (data.inactivityTime || 30) * 60000;
    const repeatTime = (data.repeatTime || 5) * 60000;
    const now = Date.now();
    const MAX_DURATION = 180 * 60 * 1000; // 3 horas

    let updated = false;

    Object.entries(chats).forEach(([chatId, chat]) => {
      const elapsedTime = chat.isPaused ? chat.totalTime : now - chat.startTime;


      if (elapsedTime > inactivityTime) {
        if (!lastPlayed[chatId] || now - lastPlayed[chatId] > repeatTime) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon.png", // Ajuste o caminho do ícone se necessário
            title: "Chat Excedeu o Tempo",
            message: `O chat ${chatId} está ativo há mais de ${data.inactivityTime} minutos.`,
            priority: 2,
            silent: false
          });
          lastPlayed[chatId] = now;
        }
      }

      if (elapsedTime > MAX_DURATION) {
        console.log(`[AUTO-FINALIZADO] Chat ${chatId} atingiu o tempo máximo e será finalizado automaticamente.`);
        chat.totalTime = elapsedTime;
        chat.isPaused = true;
        finished[chatId] = chat;
        delete chats[chatId];
        updated = true;
      }
    });

    if (updated) {
      chrome.storage.local.set({ activeChats: chats, finishedChats: finished });
    }
  });
}


setInterval(checkChats, 1000);

// --- INÍCIO DAS NOVAS FUNÇÕES PARA BUSCA DE CNPJ ---

let offscreenDocumentCreating; // Garante que apenas um offscreen document seja criado por vez

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return; // O documento offscreen já está pronto
  }

  if (offscreenDocumentCreating) {
    await offscreenDocumentCreating;
  } else {
    offscreenDocumentCreating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_PARSER'],
      justification: 'Necessário para fazer o parsing de HTML.',
    });
    await offscreenDocumentCreating;
    offscreenDocumentCreating = null;
  }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'printStorage') {
    chrome.storage.local.get(null, (data) => {
      console.log("Conteúdo do chrome.storage.local:", data);
      sendResponse({ result: data });
    });
    return true;
  }

  if (message.action === "nextCaseFromChat") {
    nextCaseFromChatId = message.data.chatId;
    currentChatData = {
      chatId: message.data.chatId,
      timestamp: Date.now()
    };
    chrome.storage.local.set({ currentChatData });
    console.log(`[DEBUG] Sinal recebido: próximo caso virá do chat ${message.data.chatId}`);
    return true; // Importante para mensagens assíncronas
  }

  // NOVA AÇÃO: Buscar CNPJ no Microvix (BigHost)
  if (message.action === 'searchCnpjInMicrovix') {
    const cnpj = message.cnpj;

    const formData = new URLSearchParams();
    formData.append('operacaoCodigoPortalEncontrado', '0');
    formData.append('operacao', '1');
    formData.append('d', '');
    formData.append('equipe', '');
    formData.append('opcao_pesquisa', 'C'); // CNPJ
    formData.append('conteudo', cnpj);
    formData.append('slt_classificacao', '0');
    formData.append('slt_plano_comercial_microvix', '0');
    formData.append('ordem_listagem', 'N');

    fetch('https://admin.microvix.com.br/bighost/', {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6',
        'Cache-Control': 'max-age=0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://admin.microvix.com.br',
        'Referer': 'https://admin.microvix.com.br/bighost/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
      },
      body: formData.toString()
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(async (html) => {
      await setupOffscreenDocument('offscreen.html');

      // Envia o HTML e o CNPJ para o documento offscreen para parsing
      const offscreenResponse = await chrome.runtime.sendMessage({
        action: 'parseMicrovixHtml', // Ação específica para o offscreen.js
        html: html,
        cnpj: cnpj
      });
      
      // Envia a resposta do documento offscreen de volta para o content.js
      sendResponse(offscreenResponse);
    })
    .catch(error => {
      console.error('Erro na requisição ou parsing (Microvix):', error);
      sendResponse({ error: `Erro ao buscar ou processar dados do Microvix: ${error.message}` });
    });

    return true; // Indica que a resposta será enviada assincronamente
  }
});