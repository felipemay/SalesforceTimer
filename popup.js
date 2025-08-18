// ======= Funções de Formatação =======
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

// ======= Atualização da Lista de Chats =======
function updateChatList(active = true) {
  chrome.storage.local.get(["activeChats", "finishedChats", "inactivityTime"], (data) => {
    const chatList = active
      ? document.getElementById("chatList")
      : document.getElementById("finishedChatList");
    chatList.innerHTML = "";
    const chats = active ? data.activeChats : data.finishedChats;
    const chatEntries = Object.entries(chats || {});
    // Ordena os chats pela data de início (startTime)
    chatEntries.sort((a, b) => a[1].startTime - b[1].startTime);

    chatEntries.forEach(([chatId, chat]) => {
      const li = document.createElement("li");
      li.dataset.chatId = chatId;
      li.dataset.startTime = chat.startTime;
      li.dataset.isPaused = chat.isPaused;
      if (chat.isPaused) {
        li.dataset.totalTime = chat.totalTime;
      }

      const elapsedTime = chat.isPaused
        ? chat.totalTime
        : Date.now() - chat.startTime;

      // Exibe chatId, tempo e data de início formatada
      li.innerHTML = `<span>${chatId}: <span class="chat-timer">${formatTime(elapsedTime)}</span></span>
                      <span> | Iniciado às: ${formatDate(chat.startTime)}</span>`;

      // Cria os botões de ação
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "chat-buttons";

      if (active) {
        const finishButton = document.createElement("button");
        finishButton.textContent = "Finalizar";
        finishButton.onclick = () => {
          data.finishedChats[chatId] = { ...chat, totalTime: Date.now() - chat.startTime, isPaused: true };
          delete data.activeChats[chatId];
          chrome.storage.local.set(
            { activeChats: data.activeChats, finishedChats: data.finishedChats },
            () => {
              updateChatList(true);
            }
          );
        };
        buttonContainer.appendChild(finishButton);
      } else {
        const removeButton = document.createElement("button");
        removeButton.textContent = "Remover";
        removeButton.onclick = () => {
          chrome.storage.local.get(["finishedChats", "closedChats"], (d) => {
            let finishedChats = d.finishedChats || {};
            let closedChats = d.closedChats || {};
            closedChats[chatId] = finishedChats[chatId];
            delete finishedChats[chatId];
            chrome.storage.local.set({ finishedChats, closedChats }, () => {
              updateChatList(false);
            });
          });
        };
        buttonContainer.appendChild(removeButton);

        const reactivateButton = document.createElement("button");
        reactivateButton.textContent = "Reativar";
        reactivateButton.onclick = () => {
          data.activeChats[chatId] = { ...chat, startTime: Date.now(), totalTime: 0, isPaused: false };
          delete data.finishedChats[chatId];
          chrome.storage.local.set(
            { activeChats: data.activeChats, finishedChats: data.finishedChats },
            () => {
              updateChatList(false);
            }
          );
        };
        buttonContainer.appendChild(reactivateButton);
      }

      li.appendChild(buttonContainer);
      chatList.appendChild(li);
    });
  });
}

// ======= Atualização dos Timers nos Chats =======
function refreshTimers() {
  // Atualiza apenas os elementos de tempo na lista de chats ativos
  const timerSpans = document.querySelectorAll("#chatList li .chat-timer");
  timerSpans.forEach(span => {
    const li = span.closest("li");
    const startTime = parseInt(li.dataset.startTime, 10);
    const isPaused = li.dataset.isPaused === "true";
    let elapsed;
    if (isPaused) {
      elapsed = parseInt(li.dataset.totalTime, 10);
    } else {
      elapsed = Date.now() - startTime;
    }
    span.textContent = formatTime(elapsed);
  });
}

// ======= Listener Único de DOMContentLoaded =======
document.addEventListener("DOMContentLoaded", () => {
  // Carrega as configurações salvas (agora só as de tempo)
  chrome.storage.local.get(["inactivityTime", "repeatTime"], (data) => {
    document.getElementById("inactivityTime").value = data.inactivityTime || 30;
    document.getElementById("repeatTime").value = data.repeatTime || 5;
  });

  // Configuração Geral
  document.getElementById("applySettings").onclick = () => {
    const inactivityTime = parseInt(document.getElementById("inactivityTime").value, 10);
    const repeatTime = parseInt(document.getElementById("repeatTime").value, 10);
    chrome.storage.local.set({ inactivityTime, repeatTime }, () => {
      alert("Configurações gerais aplicadas!");
    });
  };

  // Alternância entre abas
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
      const tabId = button.getAttribute("data-tab");
      button.classList.add("active");
      document.getElementById(tabId).classList.add("active");
      if (tabId === "activeTab") updateChatList(true);
      if (tabId === "finishedTab") updateChatList(false);
    };
  });

  // Listener para o novo botão que abre a página de opções
  document.getElementById("openOptionsButton").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  // Botão para limpar histórico
  document.getElementById("clearHistory").onclick = () => {
    chrome.storage.local.set({ activeChats: {}, finishedChats: {} }, () => {
      updateChatList(true);
      updateChatList(false);
    });
  };

  // Inicializa a aba "Ativos" e atualiza os timers periodicamente
  updateChatList(true);
  setInterval(() => {
    if (document.getElementById("activeTab").classList.contains("active"))
      refreshTimers();
    if (document.getElementById("finishedTab").classList.contains("active"))
      updateChatList(false);
  }, 1000);

  // Botão para imprimir o storage (se existir)
  if (document.getElementById("printStorage")) {
    document.getElementById("printStorage").addEventListener("click", () => {
      chrome.runtime.sendMessage({ command: 'printStorage' }, (response) => {
        console.log("Resposta do service worker:", response);
      });
    });
  }
});