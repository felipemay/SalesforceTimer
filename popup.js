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

// ======= Botão "Copiar Dados do Cliente" no Painel de Pre‑Chat =======
function addCopyClientDataPrechatButton() {
  // Procura o legend cujo texto contenha "Pre-Chat"
  const legends = document.querySelectorAll("legend .slds-section__title");
  let prechatLegend = null;
  legends.forEach(el => {
    if (el.textContent && el.textContent.includes("Pre-Chat")) {
      prechatLegend = el;
    }
  });

  if (prechatLegend) {
    const fieldset = prechatLegend.closest("fieldset.test-id__section");
    if (fieldset && !fieldset.querySelector("#copyClientDataPrechatButton")) {
      const button = document.createElement("button");
      button.id = "copyClientDataPrechatButton";
      button.textContent = "Copiar Dados do Cliente";
      button.className = "slds-button slds-button_neutral";
      button.style.margin = "10px";
      prechatLegend.parentNode.insertBefore(button, prechatLegend.nextSibling);

      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const detailSection = fieldset.querySelector(".test-id__section-content");
        if (!detailSection) {
          alert("Detalhes não encontrados.");
          return;
        }
        // Seleciona os campos padrão
        const cnpjElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.CNPJ__c"] .uiOutputText');
        const nomeElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Nome__c"] .uiOutputText');
        const emailElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Email1__c"] .uiOutputText');
        const telefoneElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Telefone__c"] .uiOutputText');

        const cnpj = cnpjElem ? cnpjElem.textContent.trim() : "";
        const nome = nomeElem ? nomeElem.textContent.trim() : "";
        const email = emailElem ? emailElem.textContent.trim() : "";
        const telefone = telefoneElem ? telefoneElem.textContent.trim() : "";

        // Busca as configurações Pre‑Chat salvas (incluindo custom fields)
        chrome.storage.local.get(
          [
            "preChatGreeting", "preChatEmpty", "preChatFooter",
            "preChatName", "preChatCNPJ", "preChatEmail", "preChatPhone",
            "preChatCustomFields"
          ],
          (config) => {
            const greeting = config.preChatGreeting || "";
            const emptyTemplate = config.preChatEmpty || "Favor preencher com {campo} que você usa";
            const footer = config.preChatFooter || "Por favor confira se os dados estão corretos pois serão neles que você receberá as respostas e atualizações sobre o caso!";

            const preChatNameValue = config.preChatName || "Nome:";
            const preChatCNPJValue = config.preChatCNPJ || "CNPJ:";
            const preChatEmailValue = config.preChatEmail || "Email:";
            const preChatPhoneValue = config.preChatPhone || "Telefone:";

            const nomeValue = nome || emptyTemplate.replace("{campo}", "Nome");
            const cnpjValue = cnpj || emptyTemplate.replace("{campo}", "CNPJ");
            const emailValue = email || emptyTemplate.replace("{campo}", "Email");
            const telefoneValue = telefone || emptyTemplate.replace("{campo}", "Telefone");

            // Monta os campos customizados (se houver)
            let customText = "";
            if (config.preChatCustomFields && Array.isArray(config.preChatCustomFields)) {
              config.preChatCustomFields.forEach(field => {
                const fieldValue = field.value.trim() || emptyTemplate.replace("{campo}", field.label);
                customText += `${field.label}: ${fieldValue}\n`;
              });
            }

            const textToCopy = `${greeting}\n\n${preChatNameValue} ${nomeValue}\n${preChatCNPJValue} ${cnpjValue}\n${preChatEmailValue} ${emailValue}\n${preChatPhoneValue} ${telefoneValue}\n\n${customText}\n${footer}\n\n`;

            navigator.clipboard.writeText(textToCopy)
              .then(() => {
                alert("Dados do cliente copiados para a área de transferência!");
              })
              .catch(err => {
                console.error("Erro ao copiar dados do cliente: ", err);
                alert("Erro ao copiar dados do cliente.");
              });
          }
        );
      });
    }
  }
}

// ======= Evento para adicionar um novo Campo Customizado =======
document.getElementById("addCustomFieldButton").addEventListener("click", () => {
  const container = document.getElementById("customFieldsContainer");
  const fieldDiv = document.createElement("div");
  fieldDiv.className = "customField";
  fieldDiv.style.marginBottom = "5px";

  // Input para o rótulo
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "Rótulo do Campo (ex: Usuário)";
  labelInput.className = "customFieldLabel";
  labelInput.style.marginRight = "5px";

  // Input para o valor
  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.placeholder = "Valor do Campo";
  valueInput.className = "customFieldValue";

  fieldDiv.appendChild(labelInput);
  fieldDiv.appendChild(valueInput);
  container.appendChild(fieldDiv);
});

// ======= Listener Único de DOMContentLoaded =======
document.addEventListener("DOMContentLoaded", () => {
  // Carrega as configurações salvas
  chrome.storage.local.get(
    [
      "inactivityTime", "repeatTime",
      "preChatGreeting", "preChatEmpty", "preChatFooter",
      "preChatName", "preChatCNPJ", "preChatEmail", "preChatPhone",
      "preChatCustomFields"
    ],
    (data) => {
      document.getElementById("inactivityTime").value = data.inactivityTime || 30;
      document.getElementById("repeatTime").value = data.repeatTime || 5;
      document.getElementById("preChatGreeting").value = data.preChatGreeting || "";
      document.getElementById("preChatEmpty").value = data.preChatEmpty || "";
      document.getElementById("preChatFooter").value = data.preChatFooter || "";
      document.getElementById("preChatName").value = data.preChatName || "";
      document.getElementById("preChatCNPJ").value = data.preChatCNPJ || "";
      document.getElementById("preChatEmail").value = data.preChatEmail || "";
      document.getElementById("preChatPhone").value = data.preChatPhone || "";

      // Restaura os campos customizados (se houver)
      if (data.preChatCustomFields && Array.isArray(data.preChatCustomFields)) {
        const container = document.getElementById("customFieldsContainer");
        container.innerHTML = ""; // Limpa para evitar duplicatas
        data.preChatCustomFields.forEach(field => {
          const fieldDiv = document.createElement("div");
          fieldDiv.className = "customField";
          fieldDiv.style.marginBottom = "5px";

          const labelInput = document.createElement("input");
          labelInput.type = "text";
          labelInput.placeholder = "Rótulo do Campo (ex: Usuário)";
          labelInput.className = "customFieldLabel";
          labelInput.style.marginRight = "5px";
          labelInput.value = field.label || "";

          const valueInput = document.createElement("input");
          valueInput.type = "text";
          valueInput.placeholder = "Valor do Campo";
          valueInput.className = "customFieldValue";
          valueInput.value = field.value || "";

          fieldDiv.appendChild(labelInput);
          fieldDiv.appendChild(valueInput);
          container.appendChild(fieldDiv);
        });
      }
    }
  );

  // Configuração Geral
  document.getElementById("applySettings").onclick = () => {
    const inactivityTime = parseInt(document.getElementById("inactivityTime").value, 10);
    const repeatTime = parseInt(document.getElementById("repeatTime").value, 10);
    chrome.storage.local.set({ inactivityTime, repeatTime }, () => {
      alert("Configurações gerais aplicadas!");
    });
  };

  // Configurações Pre‑Chat (incluindo custom fields)
  document.getElementById("applyPreChatSettings").onclick = () => {
    const preChatGreeting = document.getElementById("preChatGreeting").value;
    const preChatEmpty = document.getElementById("preChatEmpty").value;
    const preChatFooter = document.getElementById("preChatFooter").value;
    const preChatName = document.getElementById("preChatName").value;
    const preChatCNPJ = document.getElementById("preChatCNPJ").value;
    const preChatEmail = document.getElementById("preChatEmail").value;
    const preChatPhone = document.getElementById("preChatPhone").value;

    // Coleta os campos customizados
    const customFields = [];
    document.querySelectorAll("#customFieldsContainer .customField").forEach(div => {
      const label = div.querySelector(".customFieldLabel").value.trim();
      const value = div.querySelector(".customFieldValue").value.trim();
      if (label) {
        customFields.push({ label, value });
      }
    });

    chrome.storage.local.set(
      { 
        preChatGreeting, 
        preChatEmpty, 
        preChatFooter, 
        preChatName, 
        preChatCNPJ, 
        preChatEmail, 
        preChatPhone,
        preChatCustomFields: customFields 
      },
      () => {
        alert("Configurações Pre‑Chat aplicadas!");
      }
    );
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

  // Chama o botão de copiar dados do Pre‑Chat a cada 1 segundo
  setInterval(addCopyClientDataPrechatButton, 1000);
});

// Botão para imprimir o storage (se existir)
if (document.getElementById("printStorage")) {
  document.getElementById("printStorage").addEventListener("click", () => {
    chrome.runtime.sendMessage({ command: 'printStorage' }, (response) => {
      console.log("Resposta do service worker:", response);
    });
  });
}
