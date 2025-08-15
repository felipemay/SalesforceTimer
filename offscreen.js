// offscreen.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'parseMicrovixHtml') {
      const html = message.html;
      const cnpj = message.cnpj;
  
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
  
      const allExtractedData = [];
      const formattedCnpj = cnpj.replace(/\D/g, ''); // Remove caracteres não numéricos
  
      const rows = doc.querySelectorAll('#listagemRelatorio tbody tr');
  
      rows.forEach(row => {
        const textContentOfRow = row.innerText;
  
        if (textContentOfRow.includes(`CNPJ: ${formattedCnpj}`)) {
          let currentPortalData = {};
  
          const dataDiv = row.querySelector('div[id^="dadosAdicionais_"]'); // Busca o div de dados adicionais
          if (dataDiv) {
            const dataDivText = dataDiv.innerText; // Pega todo o texto do div
  
            // Extração genérica de chave:valor a partir das linhas do div dadosAdicionais_
            const lines = dataDivText.split('\n').filter(line => line.trim() !== '');
            lines.forEach(line => {
              const parts = line.split(':');
              if (parts.length >= 2) {
                const keyRaw = parts[0].trim(); // Pega a chave como está
                const value = parts.slice(1).join(':').trim();
  
                // Processa a chave para remover espaços e tentar normalizar caracteres especiais
                let processedKey = keyRaw.replace(/ /g, ''); // Remove todos os espaços
                processedKey = processedKey.replace(/[^a-zA-Z0-9]/g, ''); // Remove caracteres não alfanuméricos
  
                // Mapeamentos específicos para casos onde o nome da chave pode variar ou ter �
                if (keyRaw.toLowerCase().includes('endereço bd')) {
                    processedKey = 'EndereçoBD';
                } else if (keyRaw.toLowerCase().includes('razão')) {
                    processedKey = 'RAZAO';
                } else if (keyRaw.toLowerCase().includes('usuáro')) { // Supondo que "Usuáro" é a chave
                    processedKey = 'Usuario';
                } else if (keyRaw.toLowerCase().includes('e-mail')) {
                    processedKey = 'Email';
                }
                
                currentPortalData[processedKey] = value;
              }
            });
          }
  
          // Extrair Plano Comercial da CÉLULA da tabela (coluna 9, índice 8)
          const cells = row.querySelectorAll('td');
          if (cells.length > 8) {
            const planoComercialCell = cells[8];
            const planoComercialText = planoComercialCell.textContent.trim();
            if (planoComercialText) {
              // Limpa o caractere '�' ou outros especiais do PlanoComercial se necessário
              currentPortalData['PlanoComercial'] = planoComercialText.replace(/[^a-zA-Z0-9\s+]/g, '').trim(); 
            }
          }
          
          // Assegurar que Portal e Nome estejam presentes (redundância, mas útil)
          const portalCodeElement = row.querySelector('td:nth-child(3) a');
          if (portalCodeElement && !currentPortalData.Portal) {
            currentPortalData.Portal = portalCodeElement.textContent.trim();
          }
          const portalNameElement = row.querySelector('td:nth-child(4)');
          if (portalNameElement && !currentPortalData.Nome) {
            let nameTextContent = portalNameElement.cloneNode(true);
            const tempDiv = nameTextContent.querySelector('div[id^="dadosAdicionais_"]');
            if (tempDiv) nameTextContent.removeChild(tempDiv);
            currentPortalData.Nome = nameTextContent.textContent.trim();
          }
  
          allExtractedData.push(currentPortalData);
        }
      });
  
      if (allExtractedData.length > 0) {
        sendResponse({ data: allExtractedData });
      } else {
        sendResponse({ error: 'CNPJ não encontrado ou dados não puderam ser extraídos para nenhum portal.' });
      }
  
      return true;
    }
  });