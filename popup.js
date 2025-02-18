function formatTime(ms) {
  let totalSeconds = Math.floor(ms / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function updateChatList(active = true) {
  // Recupera activeChats, finishedChats e inactivityTime de uma só vez
  chrome.storage.local.get(["activeChats", "finishedChats", "inactivityTime"], (data) => {
    const chatList = active ? document.getElementById("chatList") : document.getElementById("finishedChatList");
    chatList.innerHTML = "";
    const chats = active ? data.activeChats : data.finishedChats;
    
    for (const [chatId, chat] of Object.entries(chats || {})) {
      const li = document.createElement("li");
      // Se o chat estiver pausado, usa o tempo total armazenado; caso contrário, calcula o tempo decorrido
      const elapsedTime = chat.isPaused ? chat.totalTime : Date.now() - chat.startTime;
      
      // Verifica se o chat excedeu o tempo de inatividade (padrão: 30 minutos)
      const inactivityTime = (data.inactivityTime || 30) * 60000; // converte minutos para milissegundos
      if (elapsedTime > inactivityTime) {
        li.classList.add("highlight");
      }
      
      li.innerHTML = `<span>${chatId}: ${formatTime(elapsedTime)}</span>
                      <span>Iniciado às: ${formatDate(chat.startTime)}</span>`;
      
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "chat-buttons";
      
      if (active) {
        // Botão para finalizar o chat ativo
        const finishButton = document.createElement("button");
        finishButton.textContent = "Finalizar";
        finishButton.onclick = () => {
          chrome.storage.local.get(["activeChats", "finishedChats"], (storageData) => {
            let activeChats = storageData.activeChats || {};
            let finishedChats = storageData.finishedChats || {};
            finishedChats[chatId] = { ...chat, totalTime: elapsedTime, isPaused: true };
            delete activeChats[chatId];
            chrome.storage.local.set({ activeChats, finishedChats }, () => {
              updateChatList(true);
            });
          });
        };
        buttonContainer.appendChild(finishButton);
      } else {
        // Botão para remover o chat finalizado (movendo-o para closedChats)
        const removeButton = document.createElement("button");
        removeButton.textContent = "Remover";
        removeButton.onclick = () => {
          chrome.storage.local.get(["finishedChats", "closedChats"], (storageData) => {
            let finishedChats = storageData.finishedChats || {};
            let closedChats = storageData.closedChats || {};
            closedChats[chatId] = finishedChats[chatId];
            delete finishedChats[chatId];
            chrome.storage.local.set({ finishedChats, closedChats }, () => {
              updateChatList(false);
            });
          });
        };
        buttonContainer.appendChild(removeButton);

        // Botão para reativar o chat finalizado
        const reactivateButton = document.createElement("button");
        reactivateButton.textContent = "Reativar";
        reactivateButton.onclick = () => {
          chrome.storage.local.get(["activeChats", "finishedChats"], (storageData) => {
            let activeChats = storageData.activeChats || {};
            let finishedChats = storageData.finishedChats || {};
            activeChats[chatId] = { ...chat, startTime: Date.now(), totalTime: 0, isPaused: false };
            delete finishedChats[chatId];
            chrome.storage.local.set({ activeChats, finishedChats }, () => {
              updateChatList(false);
            });
          });
        };
        buttonContainer.appendChild(reactivateButton);
      }
      
      li.appendChild(buttonContainer);
      chatList.appendChild(li);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Carrega os valores salvos tanto das configurações gerais quanto das configurações Pre‑Chat
  chrome.storage.local.get(
    ["inactivityTime", "repeatTime", "preChatGreeting", "preChatEmpty", "preChatFooter"],
    (data) => {
      document.getElementById("inactivityTime").value = data.inactivityTime || 30;
      document.getElementById("repeatTime").value = data.repeatTime || 5;
      document.getElementById("preChatGreeting").value = data.preChatGreeting || "";
      document.getElementById("preChatEmpty").value = data.preChatEmpty || "";
      document.getElementById("preChatFooter").value = data.preChatFooter || "";
    }
  );

  // Configurações gerais: salva os valores quando o botão "Aplicar" é clicado
  document.getElementById("applySettings").onclick = () => {
    const inactivityTime = parseInt(document.getElementById("inactivityTime").value, 10);
    const repeatTime = parseInt(document.getElementById("repeatTime").value, 10);
    chrome.storage.local.set({ inactivityTime, repeatTime }, () => {
      alert("Configurações gerais aplicadas!");
    });
  };

  // Configurações Pre‑Chat: salva os valores quando o botão "Aplicar Pre‑Chat" é clicado
  document.getElementById("applyPreChatSettings").onclick = () => {
    const preChatGreeting = document.getElementById("preChatGreeting").value;
    const preChatEmpty = document.getElementById("preChatEmpty").value;
    const preChatFooter = document.getElementById("preChatFooter").value;
    chrome.storage.local.set({ preChatGreeting, preChatEmpty, preChatFooter }, () => {
      alert("Configurações Pre‑Chat aplicadas!");
    });
  };

  // Alterna entre as abas
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));

      const tabId = button.getAttribute("data-tab");
      button.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      // Atualiza a lista de chats conforme a aba ativa
      if (tabId === "activeTab") updateChatList(true);
      if (tabId === "finishedTab") updateChatList(false);
    };
  });

  // Botão para limpar histórico de chats
  document.getElementById("clearHistory").onclick = () => {
    chrome.storage.local.set({ activeChats: {}, finishedChats: {} }, () => {
      updateChatList(true);
      updateChatList(false);
    });
  };

  // Botão para imprimir o storage (útil para debug)
  document.getElementById("printStorage").onclick = () => {
    chrome.runtime.sendMessage({ command: 'printStorage' }, (response) => {
      console.log("Resposta do service worker:", response);
    });
  };

  // Inicializa a aba "Ativos" e atualiza as listas periodicamente a cada 1 segundo
  updateChatList(true);
  setInterval(() => {
    if (document.getElementById("activeTab").classList.contains("active"))
      updateChatList(true);
    if (document.getElementById("finishedTab").classList.contains("active"))
      updateChatList(false);
  }, 1000);
});
