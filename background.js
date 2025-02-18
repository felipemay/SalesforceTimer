// background.js

let activeChats = {};
let finishedChats = {};
let closedChats = {}; // Chats removidos/finalizados que não devem voltar automaticamente
let lastPlayed = {};  // Armazena o último momento em que o áudio foi reproduzido para cada chat

// Função para salvar os chats no storage
function saveChats() {
  chrome.storage.local.set({ activeChats, finishedChats, closedChats });
}

// Carrega os chats salvos ao iniciar
chrome.storage.local.get(["activeChats", "finishedChats", "closedChats"], (data) => {
  activeChats = data.activeChats || {};
  finishedChats = data.finishedChats || {};
  closedChats = data.closedChats || {};
});

// Atualiza as variáveis globais quando o storage mudar
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.activeChats) {
      activeChats = changes.activeChats.newValue || {};
      console.log("activeChats atualizados:", activeChats);
    }
    if (changes.finishedChats) {
      finishedChats = changes.finishedChats.newValue || {};
      console.log("finishedChats atualizados:", finishedChats);
    }
    if (changes.closedChats) {
      closedChats = changes.closedChats.newValue || {};
      console.log("closedChats atualizados:", closedChats);
    }
  }
});

// Monitora as abas para detectar novos chats
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.title) {
    console.log(`Tab ${tabId} updated with title: ${changeInfo.title}`);
    const matches = changeInfo.title.match(/(MS-\d{4,8})/g);
    if (matches) {
      // Consulta os dados atuais do storage para garantir sincronização
      chrome.storage.local.get(["activeChats", "finishedChats", "closedChats"], (data) => {
        const active = data.activeChats || {};
        const finished = data.finishedChats || {};
        const closed = data.closedChats || {};

        matches.forEach((chatId) => {
          if (!active[chatId] && !finished[chatId] && !closed[chatId]) {
            active[chatId] = { startTime: Date.now(), totalTime: 0, isPaused: false };
            chrome.storage.local.set({ activeChats: active }, () => {
              console.log(`Chat ${chatId} adicionado em activeChats.`);
            });
          }
        });
      });
    }
  }
});

// Função para verificar os chats ativos e exibir notificações se necessário
function checkChats() {
  chrome.storage.local.get(["activeChats", "inactivityTime", "repeatTime"], (data) => {
    const chats = data.activeChats || {};
    const inactivityTime = (data.inactivityTime || 30) * 60000; // minutos para milissegundos
    const repeatTime = (data.repeatTime || 5) * 60000;           // minutos para milissegundos

    Object.entries(chats).forEach(([chatId, chat]) => {
      const elapsedTime = chat.isPaused ? chat.totalTime : Date.now() - chat.startTime;
      if (elapsedTime > inactivityTime) {
        if (!lastPlayed[chatId] || Date.now() - lastPlayed[chatId] > repeatTime) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png", // Substitua pelo ícone da sua extensão
            title: "Chat Excedeu o Tempo",
            message: `O chat ${chatId} está ativo há mais de ${data.inactivityTime} minutos.`,
            priority: 2,
            eventTime: Date.now() + 5000,
            silent: false
          });
          lastPlayed[chatId] = Date.now();
        }
      }
    });
  });
}

// Listener para mensagens (ex: comando para imprimir o storage)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'printStorage') {
    chrome.storage.local.get(null, (data) => {
      console.log("Conteúdo do chrome.storage.local:", data);
      sendResponse({ result: data });
    });
    return true;
  }
});

// Verifica os chats a cada segundo
setInterval(checkChats, 1000);
