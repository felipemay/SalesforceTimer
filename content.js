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
            alert("Não foi possível extrair o chat id.");
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
                    console.log('💡 document.title:', fullTitle);

                    const match = fullTitle.match(/(MS-\d{4,8})/);
                    let chatId = match ? match[1] : null;

                    if (chatId) {
                        console.log('Chat ativo detectado diretamente:', chatId);
                        finalizeChat(chatId);
                    } else {
                        const caseMatch = fullTitle.match(/^(\d{7,8})\s+\|/);
                        if (caseMatch) {
                            const caseId = caseMatch[1];
                            chrome.storage.local.get("chatCaseMap", (result) => {
                                const map = result.chatCaseMap || {};
                                const inheritedChatId = map[caseId];
                                if (inheritedChatId) {
                                    console.log(`Herdado do chat ${inheritedChatId} para o caso ${caseId}`);
                                    finalizeChat(inheritedChatId);
                                } else {
                                    console.warn(`Nenhum chatId herdado encontrado para o caso ${caseId}`);
                                }
                            });
                        } else {
                            console.warn('Nenhum chatId encontrado na aba atual nem herdado.');
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

            // Botão "Copiar Dados do Cliente"
            if (!buttonsContainer.querySelector("#copyClientDataPrechatButton")) {
                const copyBtn = document.createElement("button");
                copyBtn.id = "copyClientDataPrechatButton";
                copyBtn.textContent = "📋 Copiar Dados do Cliente";
                copyBtn.className = "slds-button slds-button_neutral";
                copyBtn.style.padding = "4px 8px";
    copyBtn.style.backgroundColor = "#007bff"; // Cor primária (azul) para consistência
    copyBtn.style.color = "#fff";
    copyBtn.style.border = "none";
    copyBtn.style.borderRadius = "3px";
    copyBtn.style.cursor = "pointer";
    copyBtn.style.minWidth = "120px";
                buttonsContainer.appendChild(copyBtn);

                copyBtn.addEventListener("click", () => {
    if (!detailSection) return alert("Detalhes não encontrados.");

    const nome = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Nome__c"] .uiOutputText')?.textContent.trim() || "";
    const cnpj = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.CNPJ__c"] .uiOutputText')?.textContent.trim() || "";
    const email = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Email1__c"] .uiOutputText')?.textContent.trim() || "";
    const telefone = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Telefone__c"] .uiOutputText')?.textContent.trim() || "";

    const storageKeys = [
        "preChatGreeting", "preChatTemplate", "preChatEmpty", "preChatFooter", 
        "preChatCustomFields", "disableGreeting", "disableEmpty", "disableFooter"
    ];

    chrome.storage.local.get(storageKeys, (config) => {
        // --- LÓGICA ATUALIZADA ---
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
        
        template = template.replace(/{{nome}}/g, nomeValue)
                           .replace(/{{cnpj}}/g, cnpjValue)
                           .replace(/{{email}}/g, emailValue)
                           .replace(/{{telefone}}/g, telefoneValue);

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

        // Monta o texto final de forma mais robusta, evitando linhas em branco extras
        const parts = [];
        if (greeting) parts.push(greeting);
        if (template.trim()) parts.push(template.trim());
        if (footer) parts.push(footer);
        const textToCopy = parts.join('\n\n');
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => alert("Dados copiados para a área de transferência!"))
            .catch(() => alert("Erro ao copiar dados."));
    });
});
            }

            const cnpjFieldContainer = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.CNPJ__c"]');
            if (cnpjFieldContainer) {
                // Botão "Copiar Dados para Detalhamento"
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
        alert("CNPJ inválido ou não encontrado.");
        return;
    }

    copiarDadosBtn.textContent = "⏳ Buscando...";
    copiarDadosBtn.disabled = true;

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'searchCnpjInMicrovix',
            cnpj: cnpj
        });

        if (response.error) {
            alert(`Erro: ${response.error}`);
        } else if (response.data && response.data.length > 0) {
            const allPortals = response.data;
            const firstPortal = allPortals[0];
            const extractedDetails = firstPortal;

            console.log("Dados extraídos do portal (objeto):", extractedDetails);

            const telefonePreChat = detailSection.querySelector('[data-target-selection-name="sfdc:RecordField.MessagingSession.Telefone__c"] .uiOutputText')?.textContent.trim() || "";
            
            // Busca o template de detalhamento salvo nas configurações
            chrome.storage.local.get("detailingTemplate", (config) => {
                const defaultTemplate = `Dados do portal.\nCNPJ: {{CNPJ}}\nPortal: {{Portal}}\nLoja: {{Loja}}\nEmpresa: {{Nome}}\nAmbiente: {{Ambiente}}\nLogin utilizado: {{Login}}\nEndereço BD: {{EndereoBD}}\n\nDados Cliente.\nNome: \nTelefone: {{telefone_pre_chat}}\nE-mail: {{Email}}\n\nDescrição do problema:\n\nPasso a passo para chegar ao problema:\n\nO que foi analisado:\n\nAnexos:`;
                
                let template = config.detailingTemplate || defaultTemplate;

                // Substitui as variáveis do BigHost
                for (const key in extractedDetails) {
                    const value = extractedDetails[key] || '';
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    template = template.replace(regex, value);
                }

                // Substitui as variáveis extras (do pré-chat, etc.)
                template = template.replace(/{{telefone_pre_chat}}/g, telefonePreChat);

                // Limpa quaisquer variáveis que não foram encontradas para não aparecerem no texto final
                template = template.replace(/{{[^{}]+}}/g, '');

                navigator.clipboard.writeText(template)
                    .then(() => {
                        alert("Dados de detalhamento copiados para a área de transferência!");
                        if (allPortals.length > 1) {
                            showMultiplePortalsOption(allPortals);
                        }
                    })
                    .catch(err => {
                        console.error("Erro ao copiar para a área de transferência:", err);
                        alert("Falha ao copiar os dados.");
                    });
            });

        } else {
            alert("Nenhum dado encontrado para o CNPJ informado.");
        }
    } catch (error) {
        console.error("Erro ao buscar dados do Microvix:", error);
        alert("Erro inesperado ao buscar dados do Microvix.");
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
                    copyFinalizationBtn.style.backgroundColor = "#4a54e4ff"; // Sua nova cor
                    copyFinalizationBtn.style.color = "#fff";
                    copyFinalizationBtn.style.border = "none";
                    copyFinalizationBtn.style.borderRadius = "3px";
                    copyFinalizationBtn.style.cursor = "pointer";
                    copyFinalizationBtn.style.minWidth = "120px";;
                    buttonsContainer.appendChild(copyFinalizationBtn);

                    copyFinalizationBtn.addEventListener("click", () => {
                        chrome.storage.local.get("finalizationTemplate", (config) => {
                            const textToCopy = config.finalizationTemplate || "";
                            if (textToCopy) {
                                navigator.clipboard.writeText(textToCopy)
                                    .then(() => alert("Mensagem de finalização copiada!"))
                                    .catch(() => alert("Erro ao copiar mensagem."));
                            } else {
                                alert("Nenhum template de finalização configurado. Salve um nas opções da extensão.");
                            }
                        });
                    });             
                }
                // Botão "🔍 BigHost"
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
                            alert("CNPJ inválido ou não encontrado.");
                            return;
                        }

                        const form = document.createElement("form");
                        form.method = "POST";
                        form.action = "https://admin.microvix.com.br/bighost/";
                        form.target = "_blank";

                        const dados = {
                            operacaoCodigoPortalEncontrado: "0",
                            operacao: "1",
                            d: "",
                            equipe: "",
                            opcao_pesquisa: "C",
                            conteudo: cnpj,
                            slt_classificacao: "3",
                            slt_plano_comercial_microvix: "0",
                            ordem_listagem: "N",
                        };

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
            }
        }
    });
}


function showMultiplePortalsOption(portals) {
    let multiplePortalsInfo = document.getElementById('multiplePortalsInfo');
    if (!multiplePortalsInfo) {
        multiplePortalsInfo = document.createElement('div');
        multiplePortalsInfo.id = 'multiplePortalsInfo';
        multiplePortalsInfo.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #fff;
            border: 1px solid #ccc;
            padding: 10px 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        document.body.appendChild(multiplePortalsInfo);
    }

    multiplePortalsInfo.innerHTML = `
        <span>${portals.length} portais encontrados!</span>
        <button id="viewAllPortalsBtn" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
            Ver Todos
        </button>
    `;
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
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border: 1px solid #ccc;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 100000;
            max-height: 80vh;
            overflow-y: auto;
            width: 500px;
            border-radius: 8px;
        `;
        document.body.appendChild(modal);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 1.2em;
            cursor: pointer;
        `;
        closeButton.onclick = () => modal.style.display = 'none';
        modal.appendChild(closeButton);
    }

    let contentHtml = `<h2>Portais Encontrados</h2>`;
    portals.forEach((portal, index) => {
        contentHtml += `
            <div style="border: 1px solid #eee; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                <h4>Portal ${index + 1}</h4>
                <div style="font-size: 0.9em;">
        `;
        // Exibir todos os dados na modal (como você tinha antes)
        for (const key in portal) {
            contentHtml += `<p style="margin: 2px 0;"><strong>${key}:</strong> ${portal[key] || ''}</p>`;
        }

        contentHtml += `
                </div>
                <button class="copyIndividualPortalBtn" data-portal-index="${index}" style="background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 10px;">
                    Copiar Este Portal
                </button>
            </div>
        `;
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
            // Copiar todos os dados para cópia individual (como você tinha antes)
            for (const key in selectedPortal) {
                textToCopy += `${key}: ${selectedPortal[key] || ''}\n`;
            }

            try {
                await navigator.clipboard.writeText(textToCopy);
                alert(`Dados do Portal ${index + 1} copiados!`);
            } catch (err) {
                console.error("Erro ao copiar dados do portal individual:", err);
                alert("Erro ao copiar dados deste portal.");
            }
        });
    });
}


setInterval(addPreChatButtons, 1000); // Para os botões de pré-chat (incluindo o de CNPJ)


document.addEventListener("mousedown", (e) => {
    const btn = e.target.closest("button.slds-button.slds-button_brand[title='Submit']");

    if (btn && btn.textContent.includes("Salvar")) {
        const title = document.title;
        const match = title.match(/(MS-\d{4,8})/);

        if (match) {
            const chatId = match[1];
            const timestamp = Date.now();

            chrome.storage.local.set({ currentChatData: { chatId, timestamp } }, () => {
                console.log("[DEBUG] 💾 currentChatData salvo:", { chatId, timestamp });
            });
        } else {
            console.log("[DEBUG] Nenhum chat MS-XXXXX detectado no título.");
        }
    }
});