// Estado da aplicação
let data = [];
let filteredData = [];
let headers = [];

// Elementos DOM
const fileInput = document.getElementById('fileInput');
const uploadLabel = document.getElementById('uploadLabel');
const uploadText = document.getElementById('uploadText');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const statsContainer = document.getElementById('statsContainer');
const filtersContainer = document.getElementById('filtersContainer');
const tableContainer = document.getElementById('tableContainer');
const emptyState = document.getElementById('emptyState');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const noResults = document.getElementById('noResults');

// Carregar dados ao iniciar
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    fileInput.addEventListener('change', handleFileUpload);
    exportBtn.addEventListener('click', exportData);
    clearBtn.addEventListener('click', clearData);
    searchInput.addEventListener('input', applyFilters);
    filterSelect.addEventListener('change', applyFilters);
}

// Carregar dados do localStorage
function loadData() {
    try {
        const stored = localStorage.getItem('faturas-data');
        if (stored) {
            const parsed = JSON.parse(stored);
            data = parsed.data || [];
            headers = parsed.headers || [];
            
            if (data.length > 0) {
                showDataView();
                renderTable();
                updateStats();
                applyFilters();
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// Salvar dados no localStorage
function saveData() {
    try {
        localStorage.setItem('faturas-data', JSON.stringify({
            data: data,
            headers: headers,
            lastUpdate: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        alert('Erro ao salvar dados');
    }
}

// Upload de arquivo
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    uploadText.textContent = 'Processando...';
    uploadLabel.style.backgroundColor = '#9ca3af';
    uploadLabel.style.cursor = 'not-allowed';

    const fileExtension = file.name.split('.').pop().toLowerCase();

    try {
        if (fileExtension === 'csv') {
            await handleCSV(file);
        } else if (['xlsx', 'xls'].includes(fileExtension)) {
            await handleExcel(file);
        } else {
            alert('Por favor, envie um arquivo CSV ou Excel (.xlsx, .xls)');
        }
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        alert('Erro ao processar o arquivo: ' + error.message);
    } finally {
        uploadText.textContent = 'Importar Planilha';
        uploadLabel.style.backgroundColor = '';
        uploadLabel.style.cursor = '';
        fileInput.value = '';
    }
}

// Processar CSV
function handleCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    if (results.errors.length > 0) {
                        console.warn('Avisos ao processar CSV:', results.errors);
                    }

                    const cols = results.meta.fields || [];
                    if (cols.length === 0) {
                        reject(new Error('Nenhuma coluna encontrada no arquivo'));
                        return;
                    }

                    const rows = results.data
                        .filter(row => Object.values(row).some(val => val !== null && val !== ''))
                        .map((row, index) => ({
                            id: `row-${Date.now()}-${index}`,
                            status: 'pendente',
                            observacao: '',
                            ...row
                        }));

                    if (rows.length === 0) {
                        reject(new Error('Nenhum dado encontrado no arquivo'));
                        return;
                    }

                    headers = cols;
                    data = rows;
                    saveData();
                    showDataView();
                    renderTable();
                    updateStats();
                    applyFilters();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}

// Processar Excel
async function handleExcel(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
            throw new Error('Nenhuma planilha encontrada no arquivo');
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (jsonData.length === 0) {
            throw new Error('Nenhum dado encontrado na planilha');
        }

        const cols = Object.keys(jsonData[0]);
        if (cols.length === 0) {
            throw new Error('Nenhuma coluna encontrada');
        }

        const rows = jsonData.map((row, index) => ({
            id: `row-${Date.now()}-${index}`,
            status: 'pendente',
            observacao: '',
            ...row
        }));

        headers = cols;
        data = rows;
        saveData();
        showDataView();
        renderTable();
        updateStats();
        applyFilters();
    } catch (error) {
        throw error;
    }
}

// Mostrar visualização com dados
function showDataView() {
    emptyState.style.display = 'none';
    statsContainer.style.display = 'grid';
    filtersContainer.style.display = 'flex';
    tableContainer.style.display = 'block';
    exportBtn.style.display = 'inline-flex';
    clearBtn.style.display = 'inline-flex';
}

// Esconder visualização com dados
function hideDataView() {
    emptyState.style.display = 'block';
    statsContainer.style.display = 'none';
    filtersContainer.style.display = 'none';
    tableContainer.style.display = 'none';
    exportBtn.style.display = 'none';
    clearBtn.style.display = 'none';
}

// Renderizar tabela
function renderTable() {
    // Renderizar cabeçalho
    tableHead.innerHTML = `
        <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
            <th style="min-width: 160px;">Status</th>
            <th style="min-width: 250px;">Observação</th>
        </tr>
    `;

    // Renderizar corpo
    if (filteredData.length === 0) {
        tableBody.style.display = 'none';
        noResults.style.display = 'block';
    } else {
        tableBody.style.display = '';
        noResults.style.display = 'none';
        
        tableBody.innerHTML = filteredData.map(row => `
            <tr>
                ${headers.map(h => `
                    <td>${row[h] !== undefined && row[h] !== null && row[h] !== '' ? String(row[h]) : '-'}</td>
                `).join('')}
                <td>
                    <select 
                        class="status-select status-${row.status}" 
                        onchange="updateStatus('${row.id}', this.value)"
                    >
                        <option value="pendente" ${row.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option>
                        <option value="pago" ${row.status === 'pago' ? 'selected' : ''}>✓ Pago</option>
                        <option value="atrasado" ${row.status === 'atrasado' ? 'selected' : ''}>✗ Atrasado</option>
                    </select>
                </td>
                <td>
                    <input 
                        type="text" 
                        class="obs-input" 
                        value="${row.observacao || ''}"
                        placeholder="Adicionar nota..."
                        onchange="updateObservacao('${row.id}', this.value)"
                    >
                </td>
            </tr>
        `).join('');
    }
}

// Atualizar status
function updateStatus(id, newStatus) {
    data = data.map(row => 
        row.id === id ? { ...row, status: newStatus } : row
    );
    saveData();
    updateStats();
    applyFilters();
}

// Atualizar observação
function updateObservacao(id, observacao) {
    data = data.map(row => 
        row.id === id ? { ...row, observacao } : row
    );
    saveData();
}

// Aplicar filtros
function applyFilters() {
    const filter = filterSelect.value;
    const search = searchInput.value.toLowerCase();

    filteredData = data.filter(row => {
        // Filtro de status
        const statusMatch = filter === 'todos' || row.status === filter;
        
        // Filtro de busca
        const searchMatch = !search || Object.values(row).some(val => 
            String(val).toLowerCase().includes(search)
        );

        return statusMatch && searchMatch;
    });

    renderTable();
}

// Atualizar estatísticas
function updateStats() {
    const stats = {
        total: data.length,
        pago: data.filter(r => r.status === 'pago').length,
        pendente: data.filter(r => r.status === 'pendente').length,
        atrasado: data.filter(r => r.status === 'atrasado').length
    };

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statPaid').textContent = stats.pago;
    document.getElementById('statPending').textContent = stats.pendente;
    document.getElementById('statLate').textContent = stats.atrasado;
}

// Exportar dados
function exportData() {
    const csv = [
        [...headers, 'Status', 'Observação'].join(','),
        ...data.map(row => [
            ...headers.map(h => {
                const val = row[h] || '';
                return `"${String(val).replace(/"/g, '""')}"`;
            }),
            `"${row.status}"`,
            `"${row.observacao}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faturas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Limpar dados
function clearData() {
    if (confirm('Tem certeza que deseja limpar todos os dados?')) {
        data = [];
        headers = [];
        filteredData = [];
        localStorage.removeItem('faturas-data');
        searchInput.value = '';
        filterSelect.value = 'todos';
        hideDataView();
    }
}