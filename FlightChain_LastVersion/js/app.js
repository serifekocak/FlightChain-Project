
'use strict';

// --- GLOBAL DEĞİŞKENLER ---
let web3, flightChainContract, userAccount;
let entityIdMappings = {};
const entityBorderColors = { "ATC": "border-atc", "TK-001": "border-tk001", "TK-002": "border-tk002" };
const entityColors = { "ATC": "var(--atc-color)", "TK-001": "var(--tk001-color)", "TK-002": "var(--tk002-color)" };
const entityIcons = { "ATC": "fa-broadcast-tower", "TK-001": "fa-plane", "TK-002": "fa-plane" };
let rawData = {};
let routeMap; 
let routeLayers;
let allWaypointsLayer = null;


let airportsData = [];
let flightPlansData = [];
let waypointsData = [];


$(document).ready(async function () {
    await loadStaticData();
    if (typeof window.ethereum === 'undefined') {
        showAlert('Lütfen MetaMask kurun!', 'danger');
        $('#connect-wallet-btn').prop('disabled', true).text('MetaMask Gerekli');
        return;
    }
    // Başlangıçta panelleri gizle, karşılama ekranını göster
    $('#message-panel-container').hide();
    $('#message-send-panel').hide();
    $('#welcome-section').show();
    web3 = new Web3(window.ethereum);

    // Tüm olay dinleyicilerini ata
    $('#connect-wallet-btn').click(connectWallet);
    $('#message-form').submit(sendMessage);
    $('#register-btn').click(registerSelectedEntity);
    $('#toggle-tk001, #toggle-tk002').on('change', updateUI);
    $('#fuel-analysis-form').submit(runFuelAnalysis);
    //$('#route-optimization-form').submit(runRouteOptimization);
    $('#open-fuel-analysis-btn').click(populateFuelAnalysisForm);
    $('#open-route-optimization-btn').click(populateRouteOptimizationForm);

    
    $('#run-analysis-btn').click(runFuelAnalysis);
    $('#send-fuel-analysis-result').click(runAndLogFuelAnalysis);

    ethereum.on('accountsChanged', (accounts) => { window.location.reload(); });

    try {
        const accounts = await web3.eth.getAccounts();
        if (accounts.length > 0) {
            userAccount = accounts[0];
            handleWalletConnected();
        } else {
            $('#connect-wallet-btn').show(); // Bağlı değilse bağlanma butonunu göster
            $('#open-fuel-analysis-btn').hide()
            $('#open-route-optimization-btn').hide()
            $('#profile-area').hide();
        }
    } catch (error) {
        console.error("Cüzdan kontrol edilirken hata:", error);
        $('#connect-wallet-btn').show();
        $('#open-fuel-analysis-btn').hide()
        $('#open-route-optimization-btn').hide()
        $('#profile-area').hide();
    }
});

async function loadStaticData() {
    try {
        const airportsResponse = await fetch('./data/airports.json');
        airportsData = await airportsResponse.json();
        
        const flightplansResponse = await fetch('./data/flightplans.json');
        flightPlansData = await flightplansResponse.json();
        
        const waypointsResponse = await fetch('./data/waypoints.json');
        waypointsData = await waypointsResponse.json();
        
        console.log("Havalimanı ve uçuş planları başarıyla yüklendi.");
    } catch(e) {
        console.error("Statik veriler yüklenemedi:", e);
        showAlert("Referans verileri (havalimanları, uçuş planları) yüklenemedi. Lütfen 'data' klasörünü kontrol edin.", "danger");
    }
}

// --- CÜZDAN YÖNETİMİ ---
async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
            // İzin verilirse ana akışı başlat.
            userAccount = accounts[0];
            handleWalletConnected();
        }
    } catch (error) {
        showAlert('Cüzdan bağlantısı reddedildi.', 'warning');
    }
}

async function handleWalletConnected() {
    // Karşılama ekranını gizle, ana panelleri ve analiz butonlarını göster
    $('#welcome-section').hide();
    $('#message-panel-container').show();
    $('#message-send-panel').show();
    $('#open-fuel-analysis-btn, #open-route-optimization-btn').show();
    $('#connect-wallet-btn').hide();
    $('#profile-area').show();
    $('#profile-address-menu').text(`${userAccount.substring(0, 10)}...${userAccount.substring(32)}`);

    try {
        flightChainContract = new web3.eth.Contract(contractABI, contractAddress);
        updateUI();
    } catch (e) {
        showAlert('Sözleşme yüklenemedi. js/config.js dosyasını kontrol edin.', 'danger');
        console.error(e);
    }
}

async function updateUI() {
    if (!flightChainContract || !userAccount) return;
    try {
        await fetchAllEntitiesFromChain();
        await updateUserStatusAndPanelVisibility();
        await displayAllLogs();
    } catch (error) {
        console.error("Ana UI güncelleme hatası:", error);
        showAlert("Veriler yüklenirken bir hata oluştu. Lütfen konsolu kontrol edin.", "danger");
    }
}

async function fetchAllEntitiesFromChain() {
    entityIdMappings = {};
    const entities = ["TK-001", "TK-002", "ATC"];
    for (const id of entities) {
        try {
            const data = await flightChainContract.methods.assetRegistry(id).call();
            if (data.isRegistered) {
                entityIdMappings[data.walletAddress.toLowerCase()] = data.assetId;
            }
        } catch (e) { /* Hata normal */ }
    }
}

async function updateUserStatusAndPanelVisibility() {
    const currentUserEntityId = entityIdMappings[userAccount.toLowerCase()] || "Kayıtlı Değil";
    $('#current-sender').val(currentUserEntityId || "Kayıtlı Değil");
    $('#profile-id, #profile-id-menu').text(currentUserEntityId || "Kayıtlı Değil");
    const allPanels = $('.aircraft-column').parent();
    allPanels.hide();

    const showAllTk001 = $('#toggle-tk001').is(':checked');
    const showAllTk002 = $('#toggle-tk002').is(':checked');

    if (!currentUserEntityId || showAllTk001 || showAllTk002) {
        // EĞER: kullanıcı kayıtsızsa VEYA kullanıcı ATC ise VEYA HERHANGİ BİR "Tümünü Gör" anahtarı açıksa...
        // ...O ZAMAN TÜM PANELLERİ GÖSTER.
        $('.aircraft-column').parent().show();
    } else {
        // HİÇBİR "Tümünü Gör" anahtarı açık değilse VE kullanıcı bir uçak ise...
        // ...O ZAMAN SADECE O uçağın panelini göster.
        const userPanelSelector = '#messages-' + currentUserEntityId.toLowerCase().replace('-', '');
        $(userPanelSelector).closest('.col-lg-4').show();
    }
}

async function displayAllLogs() {
    try {
        // --- 1. VERİLERİ ÇEK ---
        const [instructionCount, analysisCount, messageCount, telemetryCount] = (await Promise.all([
            flightChainContract.methods.getInstructionLogsCount().call(),
            flightChainContract.methods.getAnalysisLogsCount().call(),
            flightChainContract.methods.getGenericMessageLogsCount().call(),
            flightChainContract.methods.getTelemetryLogsCount().call(),

        ])).map(Number);

        let promises = [];
        for (let i = 0; i < instructionCount; i++) promises.push(flightChainContract.methods.instructionLogs(i).call().then(log => ({ ...log, type: 'Instruction' })));
        for (let i = 0; i < analysisCount; i++) promises.push(flightChainContract.methods.analysisLogs(i).call().then(log => ({ ...log, type: 'Analysis' })));
        for (let i = 0; i < telemetryCount; i++) promises.push(flightChainContract.methods.telemetryLogs(i).call().then(log => ({ ...log, type: 'Telemetry' })));
        for (let i = 0; i < messageCount; i++) promises.push(flightChainContract.methods.genericMessageLogs(i).call().then(log => ({ ...log, type: 'Message' })));

        // --- 1. VERİ ÇEKME VE SIRALAMA
        const allLogs = await Promise.all(promises);

        if (allLogs.length === 0) {
            $('.log-feed').empty().html('<p class="text-center text-muted m-auto">Henüz bir kayıt yok.</p>');
            return;
        }

        allLogs.sort((a, b) => {
            if (BigInt(a.timestamp) > BigInt(b.timestamp)) return -1;
            if (BigInt(a.timestamp) < BigInt(b.timestamp)) return 1;
            return 0;
        });

        const fillPanelTabs = (panelIdPrefix, logs, viewerId) => {
            // İlgili sekmeleri seç ve içlerini boşalt.
            $(`#tab-${panelIdPrefix}-all .log-feed, 
                #tab-${panelIdPrefix}-instructions .log-feed, 
                #tab-${panelIdPrefix}-analyses .log-feed, 
                #tab-${panelIdPrefix}-messages .log-feed`).empty();

            if (logs.length > 0) {
                logs.forEach(log => {
                    const logHtml = createLogHtml(log, viewerId);
                    //console.log(logs);
                    // Logları türüne göre ilgili sekmelere dağıt.
                    $(`#tab-${panelIdPrefix}-all .log-feed`).append(logHtml);
                    if (log.type === 'Instruction') $(`#tab-${panelIdPrefix}-instructions .log-feed`).append(logHtml);
                    else if (log.type === 'Analysis') $(`#tab-${panelIdPrefix}-analyses .log-feed`).append(logHtml);
                    else if (log.type === 'Message') $(`#tab-${panelIdPrefix}-messages .log-feed`).append(logHtml);
                });
            }
            $(`#${panelIdPrefix}-tabs`).parent().find('.log-feed:empty').html('<p class-="text-center text-muted m-auto">Bu kategoriye ait kayıt yok.</p>');
        };

        const showAllTk001 = $('#toggle-tk001').is(':checked');
        const showAllTk002 = $('#toggle-tk002').is(':checked');
        const anyToggleIsOn = showAllTk001 || showAllTk002;

        // Her panelin görmesi gereken log listesini belirle.
        // TK-001 Paneli:
        const isRelevantForTk001 = log => { const { senderId, recipientId } = getSenderRecipientFromLog(log); return senderId === 'TK-001' || recipientId === 'TK-001'; };
        const tk001Logs = allLogs.filter(log => anyToggleIsOn || isRelevantForTk001(log));

        // TK-002 Paneli:
        const isRelevantForTk002 = log => { const { senderId, recipientId } = getSenderRecipientFromLog(log); return senderId === 'TK-002' || recipientId === 'TK-002'; };
        const tk002Logs = allLogs.filter(log => anyToggleIsOn || isRelevantForTk002(log));

        // Panelleri, kendi filtrelenmiş listeleriyle doldur.
        fillPanelTabs('tk001', tk001Logs, 'TK-001');
        fillPanelTabs('tk002', tk002Logs, 'TK-002');
        fillPanelTabs('atc', allLogs, 'ATC');

    } catch (error) {
        console.error("displayAllLogs fonksiyonunda hata:", error);
    }
}

function registerSelectedEntity() {
    const selectedId = $('#register-select').val();
    if (selectedId === 'ATC') {
        // ATC kaydı için, formu çağıranın cüzdanını kullanıyoruz (simülasyon için)
        registerATC(selectedId, userAccount);
    } else {
        // Uçak kaydı için ayrı fonksiyonu kullanıyoruz
        registerAircraft(selectedId);
    }
}

async function registerAircraft(flightId) {
    if (!flightChainContract || !userAccount) {
        showAlert("Önce cüzdanınızı bağlayın.", 'warning');
        return;
    }
    showAlert(`'${flightId}' kaydediliyor...`, 'info');
    try {
        await flightChainContract.methods.registerAircraft(flightId).send({ from: userAccount });
        showAlert(`Başarıyla kaydedildi!`, 'success');
        updateUI();
    } catch (error) { showAlert('Kayıt başarısız: ' + error.message, 'danger'); }
}

async function registerATC(atcId, atcWallet) {
    if (!flightChainContract || !userAccount) {
        showAlert("Önce cüzdanınızı bağlayın.", 'warning');
        return;
    }
    showAlert(`'${atcId}' kaydediliyor...`, 'info');
    try {
        await flightChainContract.methods.registerATC(atcId, atcWallet).send({ from: userAccount });
        showAlert(`Başarıyla kaydedildi!`, 'success');
        updateUI();
    } catch (error) { showAlert('Kayıt başarısız: ' + error.message, 'danger'); }
}

async function sendMessage(e) {

    // Sayfanın yenilenmesini engelle.
    e.preventDefault();

    // MetaMask bağlantısını kontrol et.
    if (!flightChainContract || !userAccount) {
        showAlert("Mesaj göndermeden önce cüzdanınızı bağlayın.", 'warning');
        return;
    }

    const senderId = entityIdMappings[userAccount.toLowerCase()];
    const recipientId = $('#recipient-select').val();
    const content = $('#message-content').val();
    const affectedDevices = [getDeviceNumber(senderId), getDeviceNumber(recipientId)];

    let transaction;

    if (!content) {
        showAlert("Lütfen bir mesaj girin.", "warning");
        return;
    }

    try {
        const senderInfo = await flightChainContract.methods.assetRegistry(senderId).call();
        if(senderInfo.isATC) {
            transaction = flightChainContract.methods.issueInstruction(recipientId, content);
        } else {
            transaction = flightChainContract.methods.sendMessage(recipientId, content);
        }
    } catch(e) { 
        return showAlert("Gönderen bilgileri alınamadı.", "danger"); 
    }
    
    showAlert(`'${recipientId}' varlığına mesaj gönderiliyor...`, 'info');
    
    try {
        await notifyMasterESP("submitted", affectedDevices);
        
        // İşlemi gönder ama 'await' ile ONAYLANMASINI BEKLEME.
        // Bunun yerine, işlemin farklı aşamalarını yönetecek olan promise'i al.
        const promiEvent = transaction.send({ from: userAccount });

        // AŞAMA 2: BEKLENİYOR
        // '.on('transactionHash', ...)' yerine, hash'in gelmesini BEKLE.
        promiEvent.on('transactionHash', async (hash) => {
            console.log(`İşlem ağa gönderildi, onay bekleniyor. Hash: ${hash}`);
            showAlert(`İşlem beklemede... Hash: ${hash.substring(0, 10)}...`, "info");
            // 'hash' alındığı anda 'waiting' durumunu gönder.
            await notifyMasterESP("waiting", affectedDevices);
        });

        // AŞAMA 3: ONAYLANDI
        // İşlemin bloğa dahil edilmesini ve 'receipt' (makbuz) dönmesini BEKLE.
        const receipt = await promiEvent;
        
        console.log("İşlem onaylandı!", receipt);
        showAlert("İşlem başarıyla zincire kaydedildi!", "success");
        await notifyMasterESP("confirmed", affectedDevices);
        
        $('#message-form')[0].reset();
        updateUI();
    } 
    catch (error) {
        await notifyMasterESP("failed", affectedDevices);
        showAlert('İşlem başarısız: ' + error.message, 'danger');
    }
}

async function runAndLogFuelAnalysis() {
    // Verileri sakladığımız sonuç div'ini hedefle
    const currentUserFlightId = entityIdMappings[userAccount.toLowerCase()];
    const resultDiv = $('#fuel-analysis-result');
    const affectedDevices = [getDeviceNumber(currentUserFlightId)];
    // 1. VERİLERİ HTML'in "data-" attribute'larından OKU
    const riskStatus = resultDiv.data('status-text');
    const estimatedReserve = resultDiv.data('estimated-reserve');
    const recommendation = resultDiv.data('recommendation');
    const rawDataHash = resultDiv.data('raw-data-hash');

    // 2. Kontrolleri yap
    if (!riskStatus || estimatedReserve === undefined || !recommendation || !rawDataHash) {
        showAlert("Kaydedilecek analiz verisi bulunamadı.", "danger");
        return;
    }
    if (!currentUserFlightId || currentUserFlightId === 'ATC') {
        showAlert("Analiz sonucu kaydetmek için bir uçak olarak bağlı olmalısınız.", "warning");
        return;
    }

    // 3. Arayüzü güncelle ve işlemi gönder
    $('#log-analysis-btn').prop('disabled', true).text('Kaydediliyor...');
    showAlert("Yakıt analizi sonucu zincire kaydediliyor...", "info");

    try {
        await notifyMasterESP("submitted", affectedDevices);
        await flightChainContract.methods.logFuelAnalysis(
            currentUserFlightId,        // string _analyzedAircraftId
            riskStatus,                 // string _riskStatus
            Number(estimatedReserve),   // uint8 _estRemainingFuel
            recommendation,             // string _recommendation
            rawDataHash,                // bytes32 _rawDataHash
            // YENİ GÖNDERİLEN PARAMETRELER
            Number(rawData.plannedReserve), // uint8 _plannedReserveFuel
            Number(rawData.currentFuel),      // uint8 _currentFuel
            Number(rawData.remainingRange),   // uint16 _remainingRangeNM
            Number(rawData.holdingTime)       // uint8 _holdingTimeMinutes
        ).send({ from: userAccount }).on('transactionHash', (hash) => notifyMasterESP("waiting", affectedDevices));

        showAlert("Analiz sonucu başarıyla zincire kaydedildi!", "success");
        
        updateUI();
        await notifyMasterESP("confirmed", affectedDevices);
        $('#fuelAnalysisModal').modal('hide');

    } catch (error) {
        showAlert('Analiz sonucu kaydedilemedi: ' + error.message, 'danger');
        await notifyMasterESP("failed", affectedDevices);
        $('#log-analysis-btn').prop('disabled', false).text('Bu Analizi Zincire Kaydet');
    }
}

function runFuelAnalysis() {
    // 1. Formdan verileri al
    const currentFuel = parseFloat($('#fa-fuel').val());
    const remainingRange = parseFloat($('#fa-range').val());
    const plannedReserve = parseFloat($('#fa-planned-reserve').val());
    const wind = parseFloat($('#fa-wind').val());
    const holdingTime = parseFloat($('#fa-holding').val());
    const resultDiv = $('#fuel-analysis-result');

    if (isNaN(currentFuel) || isNaN(remainingRange)) {
        showAlert("Lütfen tüm alanları geçerli sayılarla doldurun.", "danger");
        return;
    }

    // 2. Basit Simülasyon Sabitleri (Bunlar uçağın tipine göre değişir)
    const fuelConsumptionPerNM = 0.025; // 1 Deniz Mili için %0.025 yakıt harcandığını varsayalım
    const fuelConsumptionPerMinuteHolding = 0.1; // 1 Dakika bekleme için %0.1 yakıt harcandığını varsayalım
    const windFactor = 0.0005; // Her bir knot rüzgarın tüketim üzerindeki % etkisi

    // 3. Hesaplamaları yap
    const fuelForRange = remainingRange * fuelConsumptionPerNM;
    const fuelForHolding = holdingTime * fuelConsumptionPerMinuteHolding;
    const windEffectFuel = fuelForRange * (wind * windFactor); // Kafa rüzgarı (-) yakıtı artırır, kuyruk (+) azaltır

    const totalFuelRequired = fuelForRange + fuelForHolding - windEffectFuel;
    const estimatedReserve = currentFuel - totalFuelRequired;

    // 4. Sonucu ve öneriyi oluştur
    let statusClass = '';
    let statusText = '';
    let recommendation = '';

    if (estimatedReserve < 10) {
        statusClass = 'alert-danger';
        statusText = 'RİSKLİ';
        recommendation = 'Hedefe ulaşmak için yakıt kritik seviyede. Acilen en yakın iniş noktasına yönelmeniz tavsiye edilir.';
    } else if (estimatedReserve < plannedReserve) {
        statusClass = 'alert-warning';
        statusText = 'DİKKAT';
        recommendation = 'Tahmini iniş yakıtı, planlanan rezervin altında. Verimlilik için hızı %5 düşürmeyi veya irtifayı optimize etmeyi değerlendirin.';
    } else {
        statusClass = 'alert-success';
        statusText = 'GÜVENLİ';
        recommendation = 'Mevcut koşullarda yakıt seviyesi optimum. Uçuş planına devam edilebilir.';
    }

    // 5. Sözleşmeye göndermek için verileri hazırla.
    rawData = { currentFuel, remainingRange, plannedReserve, wind, holdingTime };
    const rawDataHash = web3.utils.sha3(JSON.stringify(rawData));
    const estimatedReserveInt = Math.round(estimatedReserve);

    // 6. Sonucu Arayüze Yazdırılacak HTML'i oluştur
    const resultHtml = `
        <div class="text-center">
            <div class="alert ${statusClass} fs-4"><strong>${statusText}</strong></div>
            <p>Tahmini İniş Yakıtı: <strong class="fs-5">${estimatedReserve.toFixed(1)}%</strong></p>
            <p class="small text-muted">Planlanan Rezerv: ${plannedReserve}%</p>
            <hr>
            <h6><i class="fas fa-robot"></i> AI Önerisi:</h6>
            <p class="mt-2"><em>${recommendation}</em></p>
            <hr>
            <div class="d-grid gap-2">
                <button type="button" id="send-fuel-analysis-result" class="btn btn-warning">Sonucu Gönder</button>
            </div>
        </div>
    `;

    // Oluşturulan HTML'i ilgili div'in içine yazdır
    resultDiv.html(resultHtml);

    // Verileri daha sonra okunmak üzere sonuç div'ine "data-" attribute'ları olarak ekle
    resultDiv.data('status-text', statusText);
    resultDiv.data('estimated-reserve', estimatedReserveInt);
    resultDiv.data('recommendation', recommendation);
    resultDiv.data('raw-data-hash', rawDataHash);

    resultDiv.data('raw-data-object', rawData);

    // Dinamik olarak oluşturulan yeni butona tıklama olayını ata
    $('#send-fuel-analysis-result').click(runAndLogFuelAnalysis);

}

function getSenderRecipientFromLog(log) {
    let senderId = '';
    let recipientId = '';

    // Gelen log'un türüne göre doğru alanları oku
    if (log.type === 'Instruction') {
        // Talimat log'ları 'atcAddress' ve 'recipientAircraft' alanlarına sahiptir
        senderId = entityIdMappings[log.atcAddress.toLowerCase()] || 'Bilinmeyen ATC';
        recipientId = entityIdMappings[log.recipientAircraft.toLowerCase()] || 'Bilinmeyen Uçak';
    }
    else if (log.type === 'Analysis') {
        //console.log("Analiz");
        // Analiz log'ları sadece 'subjectAircraft' alanına sahiptir (gönderen odur).
        senderId = entityIdMappings[log.subjectAircraft.toLowerCase()] || 'Bilinmeyen Uçak';
        recipientId = 'ANALİZ'; // Analizin özel bir alıcısı yok
    }
    else if (log.type === 'Telemetry') {
        // Telemetri log'ları sadece 'aircraftAddress' alanına sahiptir.
        senderId = entityIdMappings[log.aircraftAddress.toLowerCase()] || 'Bilinmeyen Uçak';
        recipientId = 'AĞ'; // Ağdaki herkese yayın gibidir
    }
    else if (log.type === 'Message') {
        // Jenerik mesajlar 'sender' ve 'recipient' alanlarına sahiptir.
        senderId = entityIdMappings[log.sender.toLowerCase()] || 'Bilinmeyen';
        recipientId = entityIdMappings[log.recipient.toLowerCase()] || 'Bilinmeyen';
    }

    return { senderId, recipientId };
}

function createLogHtml(log, viewerId) {
    const { senderId, recipientId } = getSenderRecipientFromLog(log);
    const timestamp = new Date(Number(log.timestamp) * 1000).toLocaleString('tr-TR');
    const borderColorClass = entityBorderColors[senderId] || 'border-secondary';
    const senderColor = entityColors[senderId] || '#6c757d';
    const recipientColor = entityColors[recipientId] || '#6c757d';
    // Aktif kullanıcının (sayfayı görüntüleyenin) kimliğini al
    const currentUserEntityId = entityIdMappings[userAccount.toLowerCase()] || "Kayıtlı Değil";
    let contentHtml = '';

    if (log.type === 'Instruction') {
        const isRelatedParty = (viewerId === recipientId || viewerId === senderId || viewerId === 'ATC');
        console.log(isRelatedParty);
        try {
            // Gelen 'instruction' içeriği JSON formatında mı diye kontrol et.
            // Eğer öyleyse, bu GİZLİ bir talimattır.
            const data = JSON.parse(log.instruction);
            console.log(data);
            console.log(data.content);
            
            if (isRelatedParty) {
                // İLGİLİ TARAFLAR (ATC ve Alıcı Uçak) gizli talimatın içeriğini görür.
                contentHtml = `<p class="text-center text-danger" style="font-size: 1.1rem; padding: 1rem 0;">
                                <strong>TALİMAT: </strong> 
                                <em>"${data.content}"</em>
                               </p>`;
            } else {
                // İLGİLİ OLMAYAN UÇAKLAR, sadece kanıtı (hash) görür.
                contentHtml = `
                    <div class="p-3 text-center">
                        <p class="mb-1"><strong><i class="fas fa-lock me-2"></i>ATC Talimat İçeriği Gizlidir</strong></p>
                        <p class="mb-0 text-muted"><small>Doğrulama Kanıtı (Hash):</small></p>
                        <p class="mb-0 text-muted font-monospace small" style="word-break: break-all;">${data.proofHash}</p>
                    </div>`;
            }

        } catch (e) {
            // Eğer JSON.parse başarısız olursa, bu normal, ŞİFRESİZ bir talimattır.
            // Herkes içeriği görebilir.
            contentHtml = `<p class="text-center" style="font-size: 1.1rem; padding: 1rem 0;">
                            <strong>Talimat:</strong> <em>"${log.instruction}"</em>
                           </p>`;
        }
    }
    else if (log.type === 'Analysis') {
        // Bu logu görüntüleyen kişi, analizin sahibi mi veya ATC mi?
        const canViewDetails = (viewerId === senderId || viewerId === 'ATC');

        if (canViewDetails) {
            let riskStatusHtml = ''; // Risk durumu satırı için özel HTML

            if (log.riskStatus === 'RİSKLİ') {
                riskStatusHtml = `<div class="text-danger fs-5">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <strong>${log.riskStatus}</strong>
                                  </div>`;

            } else if (log.riskStatus === 'DİKKAT') {
                riskStatusHtml = `<div class="text-warning fs-5">
                                    <i class="fas fa-exclamation-circle me-2"></i>
                                    <strong>${log.riskStatus}</strong>
                                  </div>`;

            } else if (log.riskStatus === 'GÜVENLİ') {
                riskStatusHtml = `<div class="text-success fs-5">
                                    <i class="fas fa-check-circle me-2"></i>
                                    <strong>${log.riskStatus}</strong>
                                  </div>`;
            } else {
                riskStatusHtml = `<span>${log.riskStatus}</span>`; // Bilinmeyen bir durum için
            }

            
            let actionButtonHtml = ''; // Aksiyon butonu için boş bir string  
            
            console.log(currentUserEntityId);
            if (currentUserEntityId === 'ATC') {
                console.log("if içi");
                const analyzedAircraftId = senderId; // Analizi yapan uçak, butonun hedefidir.
                if (log.riskStatus === 'RİSKLİ') {
                    actionButtonHtml = `<div class="d-grid mt-3">
                                            <button class="btn btn-danger btn-sm" height: 80px onclick="instructNearestAirport('${analyzedAircraftId}')">
                                                En Yakın İniş Noktasına Yönlendir
                                            </button>
                                        </div>`;
                } else if (log.riskStatus === 'DİKKAT') {
                    actionButtonHtml = `<div class="d-grid mt-3">
                                            <button class="btn btn-warning btn-sm" onclick="grantLandingPriority('${analyzedAircraftId}')">
                                                İniş Önceliği Tanımla
                                            </button>
                                        </div>`;
                }
            }
            contentHtml = `<div class="container-fluid mt-2">
                                    <div class="row">
                                        <div class="col text-start">${riskStatusHtml}</div>
                                    <div class="col text-end">
                                        <strong>Tahmini İniş Yakıtı:</strong> ${log.estRemainingFuel}%
                                    </div>
                                    </div>
                                    <hr>
    
                                    <div class="row">
                                    <div class="col text-start">
                                        <strong>Planlanan Rezerv:</strong> ${log.plannedReserveFuel}%
                                    </div>
                                    <div class="col text-end">
                                        <strong>Güncel Yakıt Seviyesi:</strong> ${log.currentFuel}%
                                    </div>
                                    </div>
                                    <hr>
    
                                    <div class="row">
                                    <div class="col text-start">
                                        <strong>Hedefe Kalan Mesafe:</strong> ${log.remainingRangeNM} Deniz Mili
                                    </div>
                                    <div class="col text-end">
                                        <strong>Bekleme Süresi:</strong> ${log.holdingTimeMinutes} dakika
                                    </div>
                                    </div>
                                    <hr>
    
                                    <div class="row">
                                    <div class="col text-center">
                                        <strong>Öneri: </strong><em>"${log.recommendation}"</em>
                                    </div>
                                    </div>
                                    ${actionButtonHtml}
                            </div> `;
        }
        else {
            // HAYIR, ÜÇÜNCÜ TARAF: Sadece kanıtı, yani "GENEL AĞ" verisini göster.
            contentHtml = `
                <div class="p-3 text-center">
                    <p class="mb-1"><strong><i class="fas fa-lock me-2"></i>Operasyonel Analiz Detayları Gizlidir</strong></p>
                    <p class="mb-0 text-muted"><small>Bu analizin yapıldığına dair değiştirilemez kanıt (Hash):</small></p>
                    <p class="mb-0 text-muted font-monospace small" style="word-break: break-all;">${log.rawDataHash}</p>
                </div>`;
        }
    }
    else if (log.type === 'Message') {
        contentHtml = `<p><strong>Mesaj: </strong><em>${log.message}</em></p>`;
    } else if (log.type === 'Telemetry') {
        contentHtml = `<p class="small"><strong>Telemetri:</strong> Yakıt: ${log.fuelPercent}% | Hız: ${log.speedKTS}kts | Hava: ${log.weather}</p>`;
        if (log.emergencyStatus) contentHtml += `<p class="text-danger"><strong>ACİL DURUM: ${log.emergencyStatus}</strong></p>`;
    }

    // Log türüne göre doğru adres değişkenlerini seç.
    let senderAddr, recipientAddr;
    if (log.type === 'Instruction') {
        senderAddr = log.atcAddress;
        recipientAddr = log.recipientAircraft;
    } else if (log.type === 'Analysis') {
        senderAddr = log.subjectAircraft;
        recipientAddr = "Sistemsel Analiz"; // Analizlerin belirli bir alıcısı yoktur
    } else if (log.type === 'Telemetry') {
        senderAddr = log.aircraftAddress;
        recipientAddr = "Telemetri Verileri"; // Telemetri ağa yayınlanır
    } else if (log.type === 'Message') {
        senderAddr = log.sender;
        recipientAddr = log.recipient;
    }


    return `<div class="log-card ${borderColorClass}">
                <div class="log-card-header">
                    <h6 class="mb-0">
                        <strong style="color: ${senderColor};">${senderId}</strong>
                        <i class="fas fa-long-arrow-alt-right mx-2 text-muted"></i>
                        <strong style="color: ${recipientColor};">${recipientId}</strong>
                    </h6>
                    <span class="badge bg-dark">${timestamp}</span>
                </div>
                <div class="log-card-body">${contentHtml}
                    <div class="log-addresses">
                        <div>
                            <strong>Kaydeden Adres (${senderId}):</strong> ${senderAddr}
                        </div>
                        <div>
                            <strong>Alıcı Adres (${recipientId}):</strong> ${recipientAddr}
                        </div>
                    </div>
                </div>
                </div>`;
}

/**
 * RİSKLİ durumdaki bir uçağın güncel konumuna en yakın havalimanını bulur
 * ve o havalimanına yönelmesi için bir talimat gönderir.
 * @param {string} flightId Yönlendirilecek uçağın ID'si
 */
async function instructNearestAirport(flightId) {
    if (!flightId) return showAlert("Hedef uçak ID'si bulunamadı.", "danger");
    const currentUserFlightId = entityIdMappings[userAccount.toLowerCase()];
    const affectedDevices = [getDeviceNumber(currentUserFlightId),getDeviceNumber(flightId)];
    // 1. İlgili uçağın anlık konumunu `flightplans.json` verisinden bul.
    const flightPlan = flightPlansData.find(fp => fp.flightId === flightId);
    if (!flightPlan) return showAlert(`${flightId} için uçuş planı bulunamadı.`, "danger");
    console.log(flightPlan);
    
    const currentLat = flightPlan.currentStatus.location.lat;
    console.log("Current Lat: " + currentLat);
    const currentLon = flightPlan.currentStatus.location.lon;
    console.log("Current Lon: " + currentLon);

    
    // 2. En yakın havalimanını bul.
    let nearestAirport = null;
    let minDistance = Infinity;

    airportsData.forEach(airport => {
        const distance = getDistanceFromLatLonInKm(currentLat, currentLon, airport.lat, airport.lon);
        console.log("Distance: " + distance);

        if (distance < minDistance) {
            minDistance = distance;
            nearestAirport = airport;
            console.log("En yakın iniş noktası: " + airport);

        }
    });

    if (!nearestAirport) return showAlert("Yönlendirilecek uygun bir havalimanı bulunamadı.", "danger");
    
    // 3. Otomatik talimat metnini oluştur ve zincire gönder.
    const instructionText = `ACİL DURUM - Düşük Yakıt Riski! Rotanızı derhal ${nearestAirport.name} (${nearestAirport.icao}) iniş noktasına çevirin. Mesafe: ${minDistance.toFixed(0)} km.`;
    console.log(instructionText);
    
    const dataToSend = JSON.stringify({
        content: instructionText,
        proofHash: web3.utils.sha3(instructionText + Date.now()) // Kanıt
    });
    console.log(dataToSend.content);
    console.log(dataToSend.proofHash);

    
    showAlert(`'${flightId}' uçağına yönlendirme talimatı gönderiliyor...`, 'info');
    try {
        await notifyMasterESP("submitted", affectedDevices);
        await flightChainContract.methods.issueInstruction(flightId, dataToSend).send({ from: userAccount }).on('transactionHash', (hash) => notifyMasterESP("waiting", affectedDevices));;
        showAlert("Acil durum yönlendirme talimatı başarıyla zincire kaydedildi!", "success");
        // Arayüzün güncellenmesini olay dinleyici halledecek.
        await notifyMasterESP("confirmed", affectedDevices);
        updateUI();
    } catch(error) {
        await notifyMasterESP("failed", affectedDevices);
        showAlert("Talimat gönderilemedi: " + error.message, "danger");
    }
}


/**
 * DİKKAT durumundaki bir uçağa iniş sıralamasında öncelik tanındığını belirten
 * bir talimat gönderir.
 * @param {string} flightId Öncelik tanınacak uçağın ID'si
 */
async function grantLandingPriority(flightId) {
    if (!flightId) return showAlert("Hedef uçak ID'si bulunamadı.", "danger");

    const instructionText = `Yakıt durumu 'DİKKAT' seviyesinde olduğundan iniş sıralamasında öncelik tanınmıştır. Yaklaşma kontrolü ile mevcut durumunuzu teyit edin.`;
    const currentUserFlightId = entityIdMappings[userAccount.toLowerCase()];
    const affectedDevices = [getDeviceNumber(currentUserFlightId), getDeviceNumber(flightId)];

    const dataToSend = JSON.stringify({
        content: instructionText,
        proofHash: web3.utils.sha3(instructionText + Date.now()) // Kanıt
    });
    
    showAlert(`'${flightId}' uçağına öncelik talimatı gönderiliyor...`, 'info');
    try {
        await notifyMasterESP("submitted", affectedDevices);
        await flightChainContract.methods.issueInstruction(flightId, dataToSend).send({ from: userAccount }).on('transactionHash', (hash) => notifyMasterESP("waiting", affectedDevices));
        showAlert("İniş önceliği talimatı başarıyla zincire kaydedildi!", "success");
        await notifyMasterESP("confirmed", affectedDevices);
        updateUI();
    } catch(error) {
        await notifyMasterESP("failed", affectedDevices);
        showAlert("Mesaj gönderilemedi: " + error.message, "danger");
    }
}

function getRandomInt(min, max) { 
    min = Math.ceil(min); 
    max = Math.floor(max); 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}

function getRandomFloat(min, max, decimals) {
    const str = (Math.random() * (max - min) + min).toFixed(decimals);
    return parseFloat(str);
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Mesafe (km)
}

/**
 * Bir doğru parçasının (p1-p2), bir daireyle (merkez, yarıçap) kesişip kesişmediğini kontrol eder.
 * @param {object} p1 - Başlangıç noktası {lat, lon}
 * @param {object} p2 - Bitiş noktası {lat, lon}
 * @param {object} center - Daire merkezi {lat, lon}
 * @param {number} radiusKm - Daire yarıçapı (km)
 * @returns {boolean} Kesişim varsa 'true' döner.
 */
function lineIntersectsCircle(p1, p2, center, radiusKm) {
    // Doğru parçasının orta noktasını bul ve bu noktanın daireye olan mesafesini kontrol et.
    const midPoint = { lat: (p1.lat + p2.lat) / 2, lon: (p1.lon + p2.lon) / 2 };
    const distanceToCenter = getDistanceFromLatLonInKm(midPoint.lat, midPoint.lon, center.lat, center.lon);
    
    // Rota uzunluğunun yarısını da hesaba kat - daire kenarlarda kalmasın.
    const segmentLength = getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
    
    // Eğer orta noktanın daire merkezine uzaklığı, dairenin yarıçapı + rotanın yarısından küçükse, kesişim olasıdır.
    if (distanceToCenter < radiusKm + segmentLength / 2) {
        if(getDistanceFromLatLonInKm(p1.lat, p1.lon, center.lat, center.lon) < radiusKm ||
           getDistanceFromLatLonInKm(p2.lat, p2.lon, center.lat, center.lon) < radiusKm ||
           distanceToCenter < radiusKm)
        {
           return true;
        }
    }
    return false;
}

/**
 * Verilen entity ID'sini, ESP32'nin anlayacağı cihaz numarasına çevirir.
 * Örn: "TK-001" -> 1, "ATC" -> 3
 */
function getDeviceNumber(entityId) {
    if (entityId === 'TK-001') return 1;
    if (entityId === 'TK-002') return 2;
    if (entityId === 'ATC') return 3;
    return 0; // Bilinmeyen veya alakasız ise (örn: 'ANALİZ')
}

/**
 * Master ESP32'ye belirtilen durumda (status) ve cihazlar için HTTP isteği gönderir.
 * @param {string} status 'submitted', 'waiting', 'confirmed', failed gibi.
 * @param {Array<number>} devices [1, 3] gibi cihaz numaraları dizisi.
 */
async function notifyMasterESP(status, devices) {
    const validDevices = [...new Set(devices.filter(d => d > 0))];
    if (validDevices.length === 0) return;

    const url = `${MASTER_ESP32_IP}/${status}?esp=${validDevices.join(',')}`;

    // --- KONSOL BİLGİLENDİRME BÖLÜMÜ ---
    let styles = 'background: #222; color: #bada55; font-size: 14px; padding: 2px 5px; border-radius: 3px;';
    let statusText = status.toUpperCase();

    if (status === 'submitted') {
        styles = 'background: #0d6efd; color: white; font-size: 14px; padding: 2px 5px; border-radius: 3px;';
        statusText = "GÖNDERİLİYOR";
    } else if (status === 'waiting') {
        styles = 'background: #ffc107; color: black; font-size: 14px; padding: 2px 5px; border-radius: 3px;';
        statusText = "BEKLENİYOR";
    } else if (status === 'confirmed') {
        styles = 'background: #198754; color: white; font-size: 14px; padding: 2px 5px; border-radius: 3px;';
        statusText = "ONAYLANDI";
    } else if (status === "failed") {
        styles = 'background: #dc3545; color: white; font-size: 14px; padding: 2px 5px; border-radius: 3px;';
        statusText = "BAŞARISIZ";
    }

    console.log(`%c[${statusText}]`, styles, `Fiziksel prototipe HTTP isteği gönderiliyor -> ${url}`);
    // ------------------------------------

    try {
        // HTTP isteğini gerçekten göndermeye çalış
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 saniye zaman aşımı
        
        await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId); // Başarılı olursa zaman aşımını temizle
        console.log(`%c[${statusText}]`, styles, '--> İstek BAŞARIYLA gönderildi (ESP32 cevap verdi).');

    } catch(e) {
        // Donanım bağlı olmadığında bu `catch` bloğunun çalışması NORMALDİR.
        // Önemli olan, isteği göndermeye çalıştığımızı konsolda görmektir.
        if (e.name === 'AbortError') {
             console.warn(`%c[${statusText}]`, styles, `--> İSTEK ZAMAN AŞIMINA UĞRADI: Prototip (${MASTER_ESP32_IP}) çevrimdışı veya cevap vermiyor.`);
        } else {
            console.error(`%c[${statusText}]`, styles, `--> İSTEK BAŞARISIZ: Prototip (${MASTER_ESP32_IP}) ağda bulunamadı veya CORS hatası var.`);
        }
    }
}

function populateFuelAnalysisForm() {
    $('#fa-fuel').val(getRandomInt(40, 85));
    $('#fa-range').val(getRandomInt(500, 1500));
    $('#fa-planned-reserve').val(getRandomInt(10, 20));
    $('#fa-wind').val(getRandomInt(-60, 30));
    $('#fa-holding').val(getRandomInt(0, 25));
    $('#fuel-analysis-result').html('<p class="text-center text-muted">Analiz için verileri girip "Analizi Çalıştır" butonuna basın.</p>');
}


// Rastgele ondalıklı sayı üreten bir yardımcı fonksiyon
function getRandomFloat(min, max, decimals) {
    const str = (Math.random() * (max - min) + min).toFixed(decimals);
    return parseFloat(str);
}

/**
 * Rota Optimizasyonu'nu başlatan ana fonksiyon.
 * Hem senaryoyu oluşturur, hem haritayı çizer, hem de en iyi rotayı analiz eder.
 */
function populateRouteOptimizationForm(e) {
    if (e) e.preventDefault(); // Form submit olayını engelle
    
    // --- UÇUŞ SEÇİMİ VE VERİ HAZIRLIĞI ---
    
    const currentUserFlightId = entityIdMappings[userAccount.toLowerCase()];
    if (!currentUserFlightId || currentUserFlightId === 'ATC') {
        showAlert("Rota optimizasyonu sadece kayıtlı uçaklar için geçerlidir.", "warning");
        return;
    }
    const flightPlan = flightPlansData.find(fp => fp.flightId === currentUserFlightId);
    console.log(flightPlan);
    if (!flightPlan) return showAlert(`${currentUserFlightId} için uçuş planı bulunamadı.`, "danger");

    $('#ro-flightid').val(flightPlan.flightId);
    console.log("Flight ID:" + flightPlan);
    $('#ro-departure-arrival').val(`${flightPlan.departure} -> ${flightPlan.arrival}`);
    console.log("Departure --Z arrival:" + flightPlan.departure, flightPlan.arrival);
    console.log("currentlan" + flightPlan.currentStatus.location.lat);

    $('#ro-current-pos').val(`${flightPlan.currentStatus.location.lat}, ${flightPlan.currentStatus.location.lon}`);
    console.log("deneme")
    // HARİTAYI BAŞLATMA VE RASTGELE RİSK OLUŞTURMA ---
    
    if (!routeMap) {
        console.log("deneme2");
        // Modal görünür olduktan sonra haritayı başlat (boyut hatasını önler)
        $('#routeOptimizationModal').one('shown.bs.modal', () => {
            if(!routeMap) {
                routeMap = L.map('routeMap').setView([39.0, 35.0], 5.5);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 15 }).addTo(routeMap);
                routeLayers = L.layerGroup().addTo(routeMap);
                //runRouteOptimization(e); // Harita hazır olduğunda fonksiyonu tekrar çağır
                //setupRouteOptimization(flightPlan);
                allWaypointsLayer = L.layerGroup().addTo(routeMap);

                 // 2. waypointsData dizisindeki tüm noktaları bu yeni katmana çiz.
                 if (waypointsData) {
                    waypointsData.forEach(waypoint => {
                        if (waypoint.lat && waypoint.lon) {
                            L.circleMarker([waypoint.lat, waypoint.lon], {
                                radius: 5,         // Daha küçük daireler
                                color: '#555',     // Arka plan rengi (koyu gri)
                                fillColor: '#777',
                                fillOpacity: 0.6
                            }).addTo(allWaypointsLayer)
                              .bindPopup(`Waypoint: <strong>${waypoint.name} (${waypoint.id})</strong>`);
                        }
                    });
                 }

                 setupRouteOptimization(flightPlan);
            }
        });
        // Harita hazır değilken modal'ın açılmasını tetikleyelim, sonra fonksiyondan çıkalım
        $('#routeOptimizationModal').modal('show');
        return;
    }     else {
        // Harita zaten varsa (İKİNCİ VE SONRAKİ TIKLAMALAR), "işi" hemen yap
        setupRouteOptimization(flightPlan);
}
}
function setupRouteOptimization(flightPlan){
    if (!flightPlan) return;
    

    console.log(flightPlan);
    routeLayers.clearLayers();
    $('#route-analysis-result').html('<i>Uçuş planı haritaya aktarılıyor ve risk analizi yapılıyor...</i>');
    const currentPos = L.latLng(flightPlan.currentStatus.location.lat, flightPlan.currentStatus.location.lon);
    const arrivalAirport = airportsData.find(ap => ap.icao === flightPlan.arrival);
    if (!arrivalAirport) 
        {
            console.error("Varış havalimanı verisi bulunamadı! ICAO:", flightPlan.arrival);
            return;

        }
    const targetPos = L.latLng(arrivalAirport.lat, arrivalAirport.lon);

    // Rastgele Risk
    const riskLat = getRandomFloat(Math.min(currentPos.lat, targetPos.lat), Math.max(currentPos.lat, targetPos.lat), 4);
    const riskLon = getRandomFloat(Math.min(currentPos.lng, targetPos.lng), Math.max(currentPos.lng, targetPos.lng), 4);
    console.log(riskLon);
    const riskRadiusKM = getRandomInt(30, 40);
    $('#ro-risk-pos').val(`${riskLat.toFixed(4)}, ${riskLon.toFixed(4)}`);
    $('#ro-risk-radius').val(riskRadiusKM);
    const riskPos = L.latLng(riskLat, riskLon);
    
    // --- ÖRSELLEŞTİRME VE AKILLI ANALİZ ---

    
    // 4. HARİTA ÜZERİNE GÖRSELLEŞTİRME

    // a. Kalkıştan varışa tam rotayı çiz
    const fullRouteCoords = [];
    const departureAirport = airportsData.find(ap => ap.icao === flightPlan.departure);
    if (departureAirport) fullRouteCoords.push([departureAirport.lat, departureAirport.lon]);
    
    flightPlan.route.forEach(wpId => {
        const wp = waypointsData.find(w => w.id === wpId);
        if (wp) fullRouteCoords.push([wp.lat, wp.lon]);
    });
    if (arrivalAirport) fullRouteCoords.push([arrivalAirport.lat, arrivalAirport.lon]);
    
    const flightPath = L.polyline(fullRouteCoords, { color: '#0d6efd', weight: 3, opacity: 0.7 }).addTo(routeLayers);

    // b. Her bir waypoint için haritaya daire şeklinde bir işaretleyici ekle
    flightPlan.route.forEach((waypointId, index) => {
        const waypoint = waypointsData.find(wp => wp.id === waypointId);
        if(waypoint) {
            L.circleMarker([waypoint.lat, waypoint.lon], {
                radius: 6,
                color: '#ffc107', // Sarı
                fillColor: '#fff',
                fillOpacity: 1
            }).addTo(routeLayers).bindTooltip(`${index + 1}. Waypoint: <strong>${waypoint.name} (${waypoint.id})</strong>`);
        }
    });

    // c. Uçağın o anki konumunu gösteren bir ikon ekle
    // Basit bir uçak ikonu (SVG)
    const planeIconSvg = `<svg viewBox="-5 -10 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill="#dc3545" d="M21.001 5.999c0-1.102-0.897-1.999-1.999-1.999h-3.996c0-1.104-0.897-2-2-2h-2c-1.103 0-2 0.896-2 2h-4c-1.103 0-2 0.897-2 2v1h15.994l-0.001-1.001zM24 15.183v-5.184h-24v5.184l6-3.183v12l-3 2.183v2.817l9-2.5v-7.184l6 3.184z"></path> </g></svg>`;
    const planeIcon = L.divIcon({
        html: planeIconSvg,
        className: 'plane-icon',
        iconSize: [30, 30]
    });
    L.marker(currentPos, { icon: planeIcon }).addTo(routeLayers).bindPopup(`<strong>${flightPlan.flightId}</strong><br>Anlık Konum`);

    // Haritayı, rotanın ve riskin tamamını gösterecek şekilde ayarla
    routeMap.fitBounds(flightPath.getBounds().pad(0.2));

    $('#route-analysis-result').html('Uçuş planı ve dinamik risk senaryosu yüklendi. Şimdi bu riski analiz edebiliriz.');

}

/**
 * Haritayı temizler, yeni senaryoyu (risk, rota vb.) oluşturur ve analizi başlatır.
 */

function findBestAvoidanceRoute(currentPos, targetPos, riskPos, riskRadiusMeters) { /* ... önceki cevaptaki tam kod ... */ }


// --- 1. YENİ MATEMATİKSEL YARDIMCI NESNE ---
// Vektör matematiği ve kesişim hesaplamaları için.
const VectorMath = {
    subtract: (p2, p1) => ({ x: p2.x - p1.x, y: p2.y - p1.y }),
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,
    lenSq: (v) => v.x * v.x + v.y * v.y,
    // Bir doğru parçasının (p1-p2) bir daireyle (c, r) kesişimini bulan doğru algoritma.
    lineIntersectsCircle(p1, p2, c, r) {
        let d = this.subtract(p2, p1);
        let f = this.subtract(p1, c);
        let a = this.dot(d, d);
        let b = 2 * this.dot(f, d);
        let termC = this.dot(f, f) - r * r;
        let discriminant = b * b - 4 * a * termC;
        if (discriminant < 0) {
            return false;
        } else {
            discriminant = Math.sqrt(discriminant);
            let t1 = (-b - discriminant) / (2 * a);
            let t2 = (-b + discriminant) / (2 * a);
            return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
        }
    }
};


// --- 2. YENİ AKILLI ROTA BULMA FONKSİYONU ---
// Bu fonksiyon, en iyi kaçış rotasını bulma işini yapar.
function findBestAvoidanceRoute(currentPos, targetPos, riskPos, riskRadiusMeters) {
    let bestAlternative = null;
    let minTotalDistance = Infinity;

    const originalDistance = currentPos.distanceTo(targetPos);
    
    // Haritayı piksel koordinatlarına çevirerek matematiksel hesaplama yap
    const p1_pix = routeMap.project(currentPos);
    const p2_pix = routeMap.project(targetPos);
    const c_pix = routeMap.project(riskPos);
    const r_pix = riskRadiusMeters / Math.pow(2, routeMap.getZoom());

    if (!VectorMath.lineIntersectsCircle(p1_pix, p2_pix, c_pix, r_pix)) {
        return null; // Orijinal rota zaten güvenliyse, alternatif aramaya gerek yok.
    }

    // Orijinal rota riskliyse, tüm waypoint'leri potansiyel "kaçış noktası" olarak değerlendir.
    waypointsData.forEach(waypoint => {
        // Hedefi veya kalkış noktasını atla
        if (waypoint.lat === targetPos.lat || waypoint.lat === currentPos.lat) return;

        const candidatePos = L.latLng(waypoint.lat, waypoint.lon);
        const candidate_pix = routeMap.project(candidatePos);
        
        // Aday rotanın iki bacağının da riskten geçmediğini KONTROL ET
        const isLeg1Safe = !VectorMath.lineIntersectsCircle(p1_pix, candidate_pix, c_pix, r_pix);
        const isLeg2Safe = !VectorMath.lineIntersectsCircle(candidate_pix, p2_pix, c_pix, r_pix);
        
        if (isLeg1Safe && isLeg2Safe) {
            const totalDistance = currentPos.distanceTo(candidatePos) + candidatePos.distanceTo(targetPos);
            if (totalDistance < minTotalDistance) {
                minTotalDistance = totalDistance;
                bestAlternative = {
                    points: [currentPos, candidatePos, targetPos],
                    waypoint: waypoint,
                    distance: totalDistance
                };
            }
        }
    });

    return bestAlternative;
}

// BİLDİRİM FONKSİYONU
function showAlert(message, type = 'info') {
    const toastId = 'toast-' + Math.random().toString(36).substr(2, 9);
    const toastHtml = `<div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                            <div class="d-flex">
                                <div class="toast-body">${message}
                                </div>
                                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                            </div>
                        </div>`;
    $('#toast-container').append(toastHtml);
    const toastElement = new bootstrap.Toast(document.getElementById(toastId), { delay: 5000 });
    toastElement.show();
}