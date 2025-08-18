document.addEventListener("DOMContentLoaded", () => {
    function updateHelpText() {
        const container = document.getElementById("customVariablesHelp");
        const variableInputs = document.querySelectorAll(".customFieldVariable");
        let helpHTML = "";
        variableInputs.forEach(input => {
            const variableName = input.value.trim();
            if (variableName) helpHTML += `<code>{{${variableName}}}</code>`;
        });
        container.innerHTML = helpHTML;
    }

    function createCustomFieldElement(labelValue, valueValue, variableValue) {
        const fieldDiv = document.createElement("div");
        fieldDiv.className = "row gx-2 align-items-center customField";
        const labelCol = document.createElement("div");
        labelCol.className = "col";
        const labelInput = document.createElement("input");
        labelInput.type = "text";
        labelInput.className = "form-control customFieldLabel";
        labelInput.placeholder = "Rótulo";
        labelInput.value = labelValue;
        labelCol.appendChild(labelInput);
        const valueCol = document.createElement("div");
        valueCol.className = "col";
        const valueInput = document.createElement("input");
        valueInput.type = "text";
        valueInput.className = "form-control customFieldValue";
        valueInput.placeholder = "Valor Padrão";
        valueInput.value = valueValue;
        valueCol.appendChild(valueInput);
        const variableCol = document.createElement("div");
        variableCol.className = "col";
        const variableInput = document.createElement("input");
        variableInput.type = "text";
        variableInput.className = "form-control customFieldVariable";
        variableInput.placeholder = "Variável";
        variableInput.value = variableValue;
        variableInput.addEventListener("input", updateHelpText);
        variableCol.appendChild(variableInput);
        const buttonCol = document.createElement("div");
        buttonCol.className = "col-auto";
        const removeButton = document.createElement("button");
        removeButton.textContent = "X";
        removeButton.className = "btn btn-danger removeFieldButton";
        removeButton.onclick = () => {
            fieldDiv.remove();
            updateHelpText();
        };
        buttonCol.appendChild(removeButton);
        fieldDiv.appendChild(labelCol);
        fieldDiv.appendChild(valueCol);
        fieldDiv.appendChild(variableCol);
        fieldDiv.appendChild(buttonCol);
        return fieldDiv;
    }

    function toggleFieldState(checkbox, textField) {
        textField.disabled = checkbox.checked;
    }

    const fieldsToToggle = {
        'disableGreeting': 'preChatGreeting',
        'disableEmpty': 'preChatEmpty',
        'disableFooter': 'preChatFooter'
    };
    
    const storageKeys = [
        "preChatGreeting", "preChatTemplate", "preChatEmpty", "preChatFooter", 
        "preChatCustomFields", "disableGreeting", "disableEmpty", "disableFooter",
        "detailingTemplate", "finalizationTemplate" // Adiciona a nova chave
    ];
    
    chrome.storage.local.get(storageKeys, (data) => {
        document.getElementById("preChatGreeting").value = data.preChatGreeting || "";
        document.getElementById("preChatTemplate").value = data.preChatTemplate || "";
        document.getElementById("preChatEmpty").value = data.preChatEmpty || "";
        document.getElementById("preChatFooter").value = data.preChatFooter || "";
        document.getElementById("detailingTemplate").value = data.detailingTemplate || "";
        // Carrega o novo template
        document.getElementById("finalizationTemplate").value = data.finalizationTemplate || "";

        for (const checkboxId in fieldsToToggle) {
            const checkbox = document.getElementById(checkboxId);
            const textField = document.getElementById(fieldsToToggle[checkboxId]);
            checkbox.checked = data[checkboxId] || false;
            toggleFieldState(checkbox, textField);
        }

        if (data.preChatCustomFields && Array.isArray(data.preChatCustomFields)) {
            const container = document.getElementById("customFieldsContainer");
            container.innerHTML = "";
            data.preChatCustomFields.forEach(field => {
                const fieldDiv = createCustomFieldElement(field.label, field.value, field.variable);
                container.appendChild(fieldDiv);
            });
            updateHelpText();
        }
    });

    document.getElementById("applyPreChatSettings").onclick = () => {
        const customFields = [];
        document.querySelectorAll("#customFieldsContainer .customField").forEach(div => {
            const label = div.querySelector(".customFieldLabel").value.trim();
            const value = div.querySelector(".customFieldValue").value.trim();
            const variable = div.querySelector(".customFieldVariable").value.trim();
            if (label && variable) {
                customFields.push({ label, value, variable });
            }
        });

        chrome.storage.local.set({ 
            preChatGreeting: document.getElementById("preChatGreeting").value,
            preChatTemplate: document.getElementById("preChatTemplate").value,
            preChatEmpty: document.getElementById("preChatEmpty").value, 
            preChatFooter: document.getElementById("preChatFooter").value, 
            preChatCustomFields: customFields,
            disableGreeting: document.getElementById("disableGreeting").checked,
            disableEmpty: document.getElementById("disableEmpty").checked,
            disableFooter: document.getElementById("disableFooter").checked,
            detailingTemplate: document.getElementById("detailingTemplate").value,
            // Salva o novo template
            finalizationTemplate: document.getElementById("finalizationTemplate").value
        }, () => {
            alert("Configurações salvas com sucesso!");
        });
    };

    document.getElementById("addCustomFieldButton").addEventListener("click", () => {
        const container = document.getElementById("customFieldsContainer");
        const fieldDiv = createCustomFieldElement("", "", "");
        container.appendChild(fieldDiv);
    });

    for (const checkboxId in fieldsToToggle) {
        const checkbox = document.getElementById(checkboxId);
        const textField = document.getElementById(fieldsToToggle[checkboxId]);
        checkbox.addEventListener('change', () => toggleFieldState(checkbox, textField));
    }
});