// content.js

// =======================
// Parte 1: Atualização dos Timers
// =======================
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  
  function updateChatTimers() {
    chrome.storage.local.get("activeChats", (data) => {
      const activeChats = data.activeChats || {};
      const chatElements = document.querySelectorAll("a.tabHeader span.title");
      chatElements.forEach(el => {
        const text = el.textContent.trim();
        const match = text.match(/MS-\d+/);
        if (match) {
          const chatId = match[0];
          const chat = activeChats[chatId];
          if (chat) {
            const elapsedTime = chat.isPaused ? chat.totalTime : Date.now() - chat.startTime;
            const timeStr = formatTime(elapsedTime);
            let timerSpan = el.parentNode.querySelector(".chat-timer");
            if (!timerSpan) {
              timerSpan = document.createElement("span");
              timerSpan.className = "chat-timer";
              timerSpan.style.marginLeft = "10px";
              timerSpan.style.fontWeight = "bold";
              timerSpan.style.color = "#007bff";
              el.parentNode.appendChild(timerSpan);
            }
            timerSpan.textContent = timeStr;
          }
        }
      });
    });
  }
  setInterval(updateChatTimers, 1000);
  
  // =======================
  // Parte 2: Finalização do Timer via Dropdown
  // =======================
  function finalizeChat(chatId) {
    chrome.storage.local.get(["activeChats", "finishedChats"], (data) => {
      let activeChats = data.activeChats || {};
      let finishedChats = data.finishedChats || {};
      if (activeChats[chatId]) {
        const chat = activeChats[chatId];
        chat.totalTime = Date.now() - chat.startTime;
        chat.isPaused = true;
        finishedChats[chatId] = chat;
        delete activeChats[chatId];
        chrome.storage.local.set({ activeChats, finishedChats }, () => {
          alert(`Chat ${chatId} finalizado!`);
        });
      } else {
        alert(`Chat ${chatId} não está ativo.`);
      }
    });
  }
  
  function addFinalizeTimerItem(dropdownElement) {
    if (dropdownElement.querySelector("li.finalizeTimer")) return;
    
    const li = document.createElement("li");
    li.setAttribute("role", "presentation");
    li.setAttribute("title", "Finalizar Timer");
    li.classList.add("slds-dropdown__item", "finalizeTimer");
    li.style.backgroundColor = "#ffeb3b";
    li.style.color = "#000";
    
    const a = document.createElement("a");
    a.setAttribute("role", "menuitem");
    a.setAttribute("tabindex", "-1");
    a.setAttribute("href", "javascript:void(0)");
    
    const span = document.createElement("span");
    span.classList.add("slds-truncate");
    span.textContent = "Finalizar Timer";
    
    a.appendChild(span);
    li.appendChild(a);
    
    li.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const chatId = extractChatId();
      if (chatId) {
        finalizeChat(chatId);
      } else {
        alert("Não foi possível extrair o chatId do container.");
      }
    });
    
    const ul = dropdownElement.querySelector("ul.dropdown__list");
    if (ul) {
      ul.appendChild(li);
    }
  }
  
  function checkAndAddFinalizeTimerItem() {
    const actionContainers = document.querySelectorAll("div.tabActionsList[title^='Ações para MS-']");
    actionContainers.forEach((container) => {
      const dropdown = container.querySelector("div.slds-dropdown");
      if (dropdown) {
        const ul = dropdown.querySelector("ul.dropdown__list");
        if (ul && !ul.querySelector("li.finalizeTimer")) {
          addFinalizeTimerItem(dropdown);
        }
      }
    });
  }
  setInterval(checkAndAddFinalizeTimerItem, 1000);
  
  // =======================
  // Parte 3: Botão "Finalizar Timer" Fora do Dropdown
  // =======================
  function extractChatId() {
    const container = document.querySelector(".tabActionsList[title*='MS-']");
    if (container) {
      const title = container.getAttribute("title");
      const match = title.match(/MS-\d+/);
      if (match) {
        return match[0];
      }
    }
    const tabTitle = document.querySelector("a.tabHeader span.title");
    if (tabTitle) {
      const match = tabTitle.textContent.match(/MS-\d+/);
      if (match) {
        return match[0];
      }
    }
    return null;
  }
  
  function addFinalizeTimerButton() {
    const closeChatButton = document.querySelector('button[title="Encerrar chat"]');
    if (closeChatButton && !document.querySelector("#finalizeTimerButton")) {
      const button = document.createElement("button");
      button.id = "finalizeTimerButton";
      button.className = "slds-button slds-button_brand";
      button.style.marginLeft = "10px";
      button.textContent = "Finalizar Timer";
      
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const chatId = extractChatId();
        if (chatId) {
          finalizeChat(chatId);
        } else {
          alert("Não foi possível extrair o chat id.");
        }
      });
      
      closeChatButton.insertAdjacentElement("afterend", button);
    }
  }
  setInterval(addFinalizeTimerButton, 1000);
  
  // =======================
  // Parte 5: Botão "Copiar Dados do Cliente" no Painel de Pre‑Chat (usando configurações salvas)
  // =======================
  function addCopyClientDataPrechatButton() {
    // Procura o legend cujo título contenha "Pre-Chat"
    const legends = document.querySelectorAll("legend .slds-section__title");
    let prechatLegend = null;
    legends.forEach(el => {
      if (el.textContent && el.textContent.includes("Pre-Chat")) {
        prechatLegend = el;
      }
    });
    
    if (prechatLegend) {
      // Obtenha o fieldset pai que contém os dados
      const fieldset = prechatLegend.closest("fieldset.test-id__section");
      if (fieldset && !fieldset.querySelector("#copyClientDataPrechatButton")) {
        const button = document.createElement("button");
        button.id = "copyClientDataPrechatButton";
        button.textContent = "Copiar Dados do Cliente";
        button.className = "slds-button slds-button_neutral";
        button.style.margin = "10px";
        // Insere o botão logo após o legend
        prechatLegend.parentNode.insertBefore(button, prechatLegend.nextSibling);
        
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const detailSection = fieldset.querySelector(".test-id__section-content");
          if (!detailSection) {
            alert("Detalhes não encontrados.");
            return;
          }
          // Extrai os dados dos campos
          const cnpjElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.CNPJ__c"] .uiOutputText');
          const nomeElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Nome__c"] .uiOutputText');
          const emailElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Email1__c"] .uiOutputText');
          const telefoneElem = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Telefone__c"] .uiOutputText');
          
          const cnpj = cnpjElem ? cnpjElem.textContent.trim() : "";
          const nome = nomeElem ? nomeElem.textContent.trim() : "";
          const email = emailElem ? emailElem.textContent.trim() : "";
          const telefone = telefoneElem ? telefoneElem.textContent.trim() : "";
          
          // Busca as configurações salvas para o Pre‑Chat
          chrome.storage.local.get(["preChatGreeting", "preChatEmpty", "preChatFooter"], (config) => {
            const greeting = config.preChatGreeting || "";
            const emptyTemplate = config.preChatEmpty || "Favor preencher com {campo} que você usa";
            const footer = config.preChatFooter || "Por favor confira se os dados estão corretos pois serão neles que você receberá as respostas e atualizações sobre o caso!";
            
            const nomeValue = nome || emptyTemplate.replace("{campo}", "Nome");
            const cnpjValue = cnpj || emptyTemplate.replace("{campo}", "CNPJ");
            const emailValue = email || emptyTemplate.replace("{campo}", "Email");
            const telefoneValue = telefone || emptyTemplate.replace("{campo}", "Telefone");
            
            const textToCopy = `${greeting}\nNome: ${nomeValue}\nCNPJ: ${cnpjValue}\nEmail: ${emailValue}\nTelefone: ${telefoneValue}\n\n${footer}\n\n`;
            
            navigator.clipboard.writeText(textToCopy)
              .then(() => {
                alert("Dados do cliente copiados para a área de transferência!");
              })
              .catch(err => {
                console.error("Erro ao copiar dados do cliente: ", err);
                alert("Erro ao copiar dados do cliente.");
              });
          });
        });
      }
    }
  }
  setInterval(addCopyClientDataPrechatButton, 1000);
  