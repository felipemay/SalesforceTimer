// ==================================================================
// ======== INÍCIO: SISTEMA DE TOAST (SEM DEPENDÊNCIAS) ========
// ==================================================================

// Injeta os estilos CSS necessários para os toasts uma única vez na página.
function injectToastStyles() {
    // Verifica se os estilos já foram adicionados para não duplicar.
    if (document.getElementById('custom-toast-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'custom-toast-styles';
    style.innerHTML = `
        #toast-container {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            pointer-events: none;
        }
        .toast-notification {
            padding: 12px 20px;
            border-radius: 5px;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.4s ease-in-out;
            pointer-events: auto;
        }
        .toast-notification.show {
            opacity: 1;
            transform: translateY(0);
        }
        .toast-notification.success { background: linear-gradient(to right, #00b09b, #96c93d); }
        .toast-notification.error { background: linear-gradient(to right, #ff5f6d, #ffc371); }
        .toast-notification.warning { background: linear-gradient(to right, #ffcd00, #ff9a00); }
    `;
    (document.head || document.documentElement).appendChild(style);
}

// Nossa nova função de alerta amigável e não-bloqueante.
function showToast(message, type = 'success') {
    // Garante que o container para os toasts exista.
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Cria o elemento do toast.
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;

    // Adiciona o toast ao container.
    container.appendChild(toast);

    // Faz o toast aparecer.
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Agenda a remoção do toast após alguns segundos.
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// Injeta os estilos necessários assim que o script carrega.
injectToastStyles();

// ==================================================================
// ======== FIM: SISTEMA DE TOAST (SEM DEPENDÊNCIAS) =========
// ==================================================================

// ================================================================
// ======== NOVA FUNÇÃO PARA COPIAR CNPJ AO CLICAR ========
// ================================================================
function addCnpjClickListener(cnpjFieldContainer) {
    // Evita adicionar o mesmo "ouvinte de clique" várias vezes
    if (cnpjFieldContainer.dataset.copyListenerAdded === 'true') {
        return;
    }
    cnpjFieldContainer.dataset.copyListenerAdded = 'true';

    // Adiciona um feedback visual para o usuário saber que o campo é clicável
    cnpjFieldContainer.style.cursor = 'pointer';
    cnpjFieldContainer.title = 'Clique para copiar o CNPJ'; // Dica ao passar o mouse

    cnpjFieldContainer.addEventListener('click', () => {
        const cnpjElement = cnpjFieldContainer.querySelector(".uiOutputText");
        if (cnpjElement) {
            const cnpjText = cnpjElement.textContent.trim();
            if (cnpjText) {
                navigator.clipboard.writeText(cnpjText)
                    .then(() => {
                        showToast(`CNPJ ${cnpjText} copiado!`, 'success');
                    })
                    .catch(err => {
                        console.error('Falha ao copiar o CNPJ:', err);
                        showToast('Falha ao copiar o CNPJ.', 'error');
                    });
            }
        }
    });
}
// ================================================================
// ======== FIM DA NOVA FUNÇÃO PARA COPIAR CNPJ ========
// ================================================================


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
                showToast(`Chat ${chatId} finalizado!`, 'success');
            });
        } else {
            showToast(`Chat ${chatId} não está ativo.`, 'warning');
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
        const container = dropdownElement.closest(".tabActionsList[title*='MS-']");
        let chatId = null;
        if (container) {
            const title = container.getAttribute("title");
            const match = title.match(/MS-\d+/);
            if (match) {
                chatId = match[0];
                container.setAttribute("data-chat-id", chatId);
            }
        }
        if (chatId) {
            finalizeChat(chatId);
        } else {
            showToast("Não foi possível extrair o chat id.", 'error');
        }
    });
    const ul = dropdownElement.querySelector("ul.dropdown__list");
    if (ul) {
        ul.appendChild(li);
    }
}


function addFinalizeTimerButtons() {
    const actionContainers = document.querySelectorAll("div.tabActionsList[title^='Ações para MS-']");
    actionContainers.forEach((container) => {
        const dropdown = container.querySelector("div.slds-dropdown");
        if (dropdown) {
            addFinalizeTimerItem(dropdown);
        }
    });
    document.querySelectorAll('button[title="Encerrar chat"]').forEach(encerrarBtn => {
        const container = encerrarBtn.closest('div.fix_button-group-flexbox[part="button-group"]');
        if (container) {
            if (!container.querySelector('button.finalizeTimerButton')) {
                encerrarBtn.disabled = false;
                encerrarBtn.style.pointerEvents = 'auto';
                const btn = document.createElement('button');
                btn.className = 'slds-button slds-button_brand finalizeTimerButton';
                btn.textContent = 'Finalizar Timer';
                btn.style.marginLeft = '10px';
                btn.disabled = false;
                btn.style.pointerEvents = 'auto';
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const fullTitle = document.title;
                    const match = fullTitle.match(/(MS-\d{4,8})/);
                    let chatId = match ? match[1] : null;
                    if (chatId) {
                        finalizeChat(chatId);
                    } else {
                        const caseMatch = fullTitle.match(/^(\d{7,8})\s+\|/);
                        if (caseMatch) {
                            const caseId = caseMatch[1];
                            chrome.storage.local.get("chatCaseMap", (result) => {
                                const map = result.chatCaseMap || {};
                                const inheritedChatId = map[caseId];
                                if (inheritedChatId) {
                                    finalizeChat(inheritedChatId);
                                }
                            });
                        }
                    }
                });
                container.appendChild(btn);
            }
        }
    });
}
setInterval(addFinalizeTimerButtons, 1000);


function addPreChatButtons() {
    const fieldsets = document.querySelectorAll("fieldset.test-id__section");
    fieldsets.forEach((fieldset) => {
        const legend = fieldset.querySelector("legend .slds-section__title");
        if (legend && legend.textContent.includes("Pre-Chat")) {
            const detailSection = fieldset.querySelector(".test-id__section-content");
            if (!detailSection) return;
            let buttonsContainer = fieldset.querySelector('.prechat-buttons-container');
            if (!buttonsContainer) {
                buttonsContainer = document.createElement('div');
                buttonsContainer.className = 'prechat-buttons-container';
                buttonsContainer.style.margin = '10px 0';
                buttonsContainer.style.display = 'flex';
                buttonsContainer.style.gap = '10px';
                legend.parentNode.insertBefore(buttonsContainer, legend.nextSibling);
            }
            if (!buttonsContainer.querySelector("#copyClientDataPrechatButton")) {
                const copyBtn = document.createElement("button");
                copyBtn.id = "copyClientDataPrechatButton";
                copyBtn.textContent = "📋 Copiar Saudação";
                copyBtn.style.padding = "4px 8px";
                copyBtn.style.backgroundColor = "#007bff";
                copyBtn.style.color = "#fff";
                copyBtn.style.border = "none";
                copyBtn.style.borderRadius = "3px";
                copyBtn.style.cursor = "pointer";
                copyBtn.style.minWidth = "120px";
                buttonsContainer.appendChild(copyBtn);
                copyBtn.addEventListener("click", () => {
                    if (!detailSection) {
                        showToast("Detalhes do pré-chat não encontrados.", 'error');
                        return;
                    }
                    const nome = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Nome__c"] .uiOutputText')?.textContent.trim() || "";
                    const cnpj = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.CNPJ__c"] .uiOutputText')?.textContent.trim() || "";
                    const email = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Email1__c"] .uiOutputText')?.textContent.trim() || "";
                    const telefone = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Telefone__c"] .uiOutputText')?.textContent.trim() || "";
                    const storageKeys = [ "preChatGreeting", "preChatTemplate", "preChatEmpty", "preChatFooter", "preChatCustomFields", "disableGreeting", "disableEmpty", "disableFooter" ];
                    chrome.storage.local.get(storageKeys, (config) => {
                        const greeting = config.disableGreeting ? "" : (config.preChatGreeting || "Olá! Tudo bem? 😊\n Antes de darmos sequência ao atendimento, por favor, poderia confirmar o informar os seguintes dados:");
                        const footer = config.disableFooter ? "" : (config.preChatFooter || "Ah! Aproveito para informar que, através deste chat, é possível enviar e receber áudios, prints e vídeos. Esse recurso facilita muito o nosso atendimento, tornando a comunicação mais rápida e assertiva!\nFico no aguardo das informações para prosseguirem.");
                        let template = config.preChatTemplate || "• Nome: {{nome}}\n• CNPJ: {{cnpj}}\n• Email: {{email}}\n• Telefone: {{telefone}}";
                        const emptyTemplate = config.preChatEmpty || "Favor preencher com {campo} que você usa";
                        const getValueOrDefault = (value, fieldName) => {
                            if (value) return value;
                            return config.disableEmpty ? "" : emptyTemplate.replace("{campo}", fieldName);
                        };
                        const nomeValue = getValueOrDefault(nome, "Nome");
                        const cnpjValue = getValueOrDefault(cnpj, "CNPJ");
                        const emailValue = getValueOrDefault(email, "Email");
                        const telefoneValue = getValueOrDefault(telefone, "Telefone");
                        template = template.replace(/{{nome}}/g, nomeValue).replace(/{{cnpj}}/g, cnpjValue).replace(/{{email}}/g, emailValue).replace(/{{telefone}}/g, telefoneValue);
                        if (Array.isArray(config.preChatCustomFields)) {
                            config.preChatCustomFields.forEach(field => {
                                if (field.variable) {
                                    const customValue = getValueOrDefault(field.value, field.label);
                                    const variableRegex = new RegExp(`{{${field.variable}}}`, 'g');
                                    template = template.replace(variableRegex, customValue);
                                }
                            });
                        }
                        template = template.replace(/{{campos_customizados}}/g, '');
                        const parts = [];
                        if (greeting) parts.push(greeting);
                        if (template.trim()) parts.push(template.trim());
                        if (footer) parts.push(footer);
                        const textToCopy = parts.join('\n\n');
                        navigator.clipboard.writeText(textToCopy)
                            .then(() => showToast("Dados de saudação copiados!", 'success'))
                            .catch(() => showToast("Erro ao copiar dados.", 'error'));
                    });
                });
            }

            const cnpjFieldContainer = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.CNPJ__c"]');
            if (cnpjFieldContainer) {
                if (!buttonsContainer.querySelector("#copiarDadosMicrovixBtn")) {
                    const copiarDadosBtn = document.createElement("button");
                    copiarDadosBtn.textContent = "📋 Copiar Detalhamento";
                    copiarDadosBtn.id = "copiarDadosMicrovixBtn";
                    copiarDadosBtn.style.padding = "4px 8px";
                    copiarDadosBtn.style.backgroundColor = "#28a745";
                    copiarDadosBtn.style.color = "#fff";
                    copiarDadosBtn.style.border = "none";
                    copiarDadosBtn.style.borderRadius = "3px";
                    copiarDadosBtn.style.cursor = "pointer";
                    copiarDadosBtn.style.minWidth = "120px";
                    buttonsContainer.appendChild(copiarDadosBtn);
                    copiarDadosBtn.addEventListener("click", async () => {
                        const cnpj = cnpjFieldContainer.querySelector(".uiOutputText")?.textContent.replace(/\D/g, "");
                        if (!cnpj || cnpj.length < 14) {
                            showToast("CNPJ inválido ou não encontrado.", 'warning');
                            return;
                        }
                        copiarDadosBtn.textContent = "⏳ Buscando...";
                        copiarDadosBtn.disabled = true;
                        try {
                            const response = await chrome.runtime.sendMessage({ action: 'searchCnpjInMicrovix', cnpj: cnpj });
                            if (response.error) {
                                showToast(`Erro: ${response.error}`, 'error');
                            } else if (response.data && response.data.length > 0) {
                                const allPortals = response.data;
                                const firstPortal = allPortals[0];
                                const extractedDetails = firstPortal;
                                const telefonePreChat = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Telefone__c"] .uiOutputText')?.textContent.trim() || "";
                                chrome.storage.local.get("detailingTemplate", (config) => {
                                    const defaultTemplate = `Dados do portal.\nCNPJ: {{CNPJ}}\nPortal: {{Portal}}\nLoja: {{Loja}}\nEmpresa: {{Nome}}\nAmbiente: {{Ambiente}}\nLogin utilizado: {{Login}}\nEndereço BD: {{EndereoBD}}\n\nDados Cliente.\nNome: \nTelefone: {{telefone_pre_chat}}\nE-mail: {{Email}}\n\nDescrição do problema:\n\nPasso a passo para chegar ao problema:\n\nO que foi analisado:\n\nAnexos:`;
                                    let template = config.detailingTemplate || defaultTemplate;
                                    for (const key in extractedDetails) {
                                        const value = extractedDetails[key] || '';
                                        const regex = new RegExp(`{{${key}}}`, 'g');
                                        template = template.replace(regex, value);
                                    }
                                    template = template.replace(/{{telefone_pre_chat}}/g, telefonePreChat);
                                    template = template.replace(/{{[^{}]+}}/g, '');
                                    navigator.clipboard.writeText(template)
                                        .then(() => {
                                            showToast("Dados de detalhamento copiados!", 'success');
                                            if (allPortals.length > 1) {
                                                showMultiplePortalsOption(allPortals);
                                            }
                                        })
                                        .catch(err => {
                                            console.error("Erro ao copiar para a área de transferência:", err);
                                            showToast("Falha ao copiar os dados.", 'error');
                                        });
                                });
                            } else {
                                showToast("Nenhum dado encontrado para o CNPJ.", 'warning');
                            }
                        } catch (error) {
                            console.error("Erro ao buscar dados do Microvix:", error);
                            showToast("Erro inesperado ao buscar dados.", 'error');
                        } finally {
                            copiarDadosBtn.textContent = "📋 Copiar Detalhamento";
                            copiarDadosBtn.disabled = false;
                        }
                    });
                }
                if (!buttonsContainer.querySelector("#copyFinalizationButton")) {
                    const copyFinalizationBtn = document.createElement("button");
                    copyFinalizationBtn.id = "copyFinalizationButton";
                    copyFinalizationBtn.textContent = "📋 Copiar Finalização";
                    copyFinalizationBtn.style.padding = "4px 8px";
                    copyFinalizationBtn.style.backgroundColor = "#4a54e4ff";
                    copyFinalizationBtn.style.color = "#fff";
                    copyFinalizationBtn.style.border = "none";
                    copyFinalizationBtn.style.borderRadius = "3px";
                    copyFinalizationBtn.style.cursor = "pointer";
                    copyFinalizationBtn.style.minWidth = "120px";
                    buttonsContainer.appendChild(copyFinalizationBtn);
                    copyFinalizationBtn.addEventListener("click", () => {
                        chrome.storage.local.get("finalizationTemplate", (config) => {
                            const textToCopy = config.finalizationTemplate || "";
                            if (textToCopy) {
                                navigator.clipboard.writeText(textToCopy)
                                    .then(() => showToast("Mensagem de finalização copiada!", 'success'))
                                    .catch(() => showToast("Erro ao copiar mensagem.", 'error'));
                            } else {
                                showToast("Nenhum template de finalização configurado.", 'warning');
                            }
                        });
                    });
                }
                if (!cnpjFieldContainer.querySelector("#consultarMicrovixBtn")) {
                    const bigHostBtn = document.createElement("button");
                    bigHostBtn.textContent = "🔍 BigHost";
                    bigHostBtn.id = "consultarMicrovixBtn";
                    bigHostBtn.style.marginLeft = "10px";
                    bigHostBtn.style.padding = "4px 8px";
                    bigHostBtn.style.backgroundColor = "#007bff";
                    bigHostBtn.style.color = "#fff";
                    bigHostBtn.style.border = "none";
                    bigHostBtn.style.borderRadius = "3px";
                    bigHostBtn.style.cursor = "pointer";
                    bigHostBtn.addEventListener("click", () => {
                        const cnpj = cnpjFieldContainer.querySelector(".uiOutputText")?.textContent.replace(/\D/g, "");
                        if (!cnpj || cnpj.length < 14) {
                            showToast("CNPJ inválido ou não encontrado.", 'warning');
                            return;
                        }
                        const form = document.createElement("form");
                        form.method = "POST";
                        form.action = "https://admin.microvix.com.br/bighost/";
                        form.target = "_blank";
                        const dados = { operacaoCodigoPortalEncontrado: "0", operacao: "1", d: "", equipe: "", opcao_pesquisa: "C", conteudo: cnpj, slt_classificacao: "3", slt_plano_comercial_microvix: "0", ordem_listagem: "N", };
                        for (const key in dados) {
                            const input = document.createElement("input");
                            input.type = "hidden";
                            input.name = key;
                            input.value = dados[key];
                            form.appendChild(input);
                        }
                        document.body.appendChild(form);
                        form.submit();
                        document.body.removeChild(form);
                    });
                    cnpjFieldContainer.appendChild(bigHostBtn);
                }
                
                // ========= ADICIONA O "OUVINTE DE CLIQUE" PARA O CNPJ =========
                addCnpjClickListener(cnpjFieldContainer);
            }
        }
    });
}
setInterval(addPreChatButtons, 1000);


function showMultiplePortalsOption(portals) {
    let multiplePortalsInfo = document.getElementById('multiplePortalsInfo');
    if (!multiplePortalsInfo) {
        multiplePortalsInfo = document.createElement('div');
        multiplePortalsInfo.id = 'multiplePortalsInfo';
        multiplePortalsInfo.style.cssText = ` position: fixed; bottom: 20px; right: 20px; background-color: #fff; border: 1px solid #ccc; padding: 10px 15px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 99999; display: flex; align-items: center; gap: 10px; `;
        document.body.appendChild(multiplePortalsInfo);
    }
    multiplePortalsInfo.innerHTML = ` <span>${portals.length} portais encontrados!</span> <button id="viewAllPortalsBtn" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;"> Ver Todos </button> `;
    multiplePortalsInfo.style.display = 'flex';
    document.getElementById('viewAllPortalsBtn').addEventListener('click', () => {
        displayPortalsModal(portals);
        multiplePortalsInfo.style.display = 'none';
    });
    setTimeout(() => {
        if (multiplePortalsInfo.style.display === 'flex') {
            multiplePortalsInfo.style.display = 'none';
        }
    }, 10000);
}

function displayPortalsModal(portals) {
    let modal = document.getElementById('microvixPortalsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'microvixPortalsModal';
        modal.style.cssText = ` position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; padding: 20px; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 100000; max-height: 80vh; overflow-y: auto; width: 500px; border-radius: 8px; `;
        document.body.appendChild(modal);
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.cssText = ` position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 1.2em; cursor: pointer; `;
        closeButton.onclick = () => modal.style.display = 'none';
        modal.appendChild(closeButton);
    }
    let contentHtml = `<h2>Portais Encontrados</h2>`;
    portals.forEach((portal, index) => {
        contentHtml += ` <div style="border: 1px solid #eee; padding: 10px; margin-bottom: 10px; border-radius: 5px;"> <h4>Portal ${index + 1}</h4> <div style="font-size: 0.9em;"> `;
        for (const key in portal) {
            contentHtml += `<p style="margin: 2px 0;"><strong>${key}:</strong> ${portal[key] || ''}</p>`;
        }
        contentHtml += ` </div> <button class="copyIndividualPortalBtn" data-portal-index="${index}" style="background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 10px;"> Copiar Este Portal </button> </div> `;
    });
    const existingCloseButton = modal.querySelector('button');
    modal.innerHTML = '';
    modal.appendChild(existingCloseButton);
    modal.insertAdjacentHTML('beforeend', contentHtml);
    modal.style.display = 'block';
    modal.querySelectorAll('.copyIndividualPortalBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.portalIndex);
            const selectedPortal = portals[index];
            let textToCopy = '';
            for (const key in selectedPortal) {
                textToCopy += `${key}: ${selectedPortal[key] || ''}\n`;
            }
            try {
                await navigator.clipboard.writeText(textToCopy);
                showToast(`Dados do Portal ${index + 1} copiados!`, 'success');
            } catch (err) {
                console.error("Erro ao copiar dados do portal individual:", err);
                showToast("Erro ao copiar dados deste portal.", 'error');
            }
        });
    });
}
setInterval(addPreChatButtons, 1000);


document.addEventListener("mousedown", (e) => {
    const btn = e.target.closest("button.slds-button.slds-button_brand[title='Submit']");

    if (btn && btn.textContent.includes("Salvar")) {
        const title = document.title;
        const match = title.match(/(MS-\d{4,8})/);

        if (match) {
            const chatId = match[1];
            const timestamp = Date.now();

            chrome.storage.local.set({
                currentChatData: {
                    chatId,
                    timestamp
                }
            }, () => {
                console.log("[DEBUG] 💾 currentChatData salvo:", {
                    chatId,
                    timestamp
                });
            });
        } else {
            console.log("[DEBUG] Nenhum chat MS-XXXXX detectado no título.");
        }
    }
});