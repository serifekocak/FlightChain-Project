// FlightChain.sol - En Son, Anlaşılır ve Tam Sürüm
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title FlightChain V4.2
 * @dev Uçuş operasyonlarını (telemetri, analiz, talimat) yöneten modüler ve rol tabanlı
 * akıllı sözleşme. Fonksiyon isimleri ve mantığı en sade haline getirilmiştir.
 * @author Bilim Konya Coplar Takımı
 */
contract FlightChain {

    //================================================================
    // 1. STATE VARIABLES, STRUCTS & ENUMS (SÖZLEŞMENİN HAFIZASI)
    //================================================================
    
    address public owner; // Sözleşmeyi dağıtan ve özel yetkilere sahip olan adres.

    // Kayıtlı bir varlığın temel bilgilerini tutan yapı (struct).
    // Bir cüzdan adresi hem uçak hem de ATC olamaz, bu yapı bunu yönetir.
    struct RegisteredAsset {
        string assetId;        // Varlığın benzersiz kimliği (TK-001 veya ATC).
        address walletAddress; // Varlığı temsil eden Ethereum cüzdan adresi.
        bool isRegistered;     // Bu ID veya adresin sistemde kayıtlı olup olmadığını belirtir.
        bool isATC;            // Eğer 'true' ise, bu varlık bir Hava Trafik Kulesidir. Değilse, bir uçaktır.
    }
    
    // Telemetri verilerini tutmak için özel olarak tasarlanmış yapı.
    // Veri tipleri (uint8, uint16) gaz maliyetini optimize etmek için seçilmiştir.
    struct TelemetryLog {
        uint256 timestamp;         // Verinin kaydedildiği an (Unix timestamp).
        address aircraftAddress;   // Telemetriyi gönderen uçağın cüzdan adresi.
        uint8 fuelPercent;         // Yakıt seviyesi (0-100).
        uint16 speedKTS;           // Hız (knot cinsinden).
        string weather;            // O anki hava durumu raporu.
        string emergencyStatus;    // Sadece acil bir durum varsa doldurulur.
    }

    // Arayüzde yapılan analizlerin sonucunu ve kanıtını saklayan yapı.
    struct AnalysisLog {
        uint256 timestamp;         // Analizin yapıldığı zaman.
        address subjectAircraft;   // Analizin yapıldığı uçağın adresi.
        uint8 riskScore;           // Hesaplanan risk skoru (0-100).
        string recommendation;      // Yapay zeka tarafından üretilen öneri metni.
        bytes32 rawDataHash;       // Analize giren verilerin (yakıt, rüzgar vb.) değiştirilemez kanıtı.
    }
    
    // ATC tarafından verilen resmi talimatları saklayan yapı.
    struct InstructionLog {
        uint256 timestamp;         // Talimatın verildiği zaman.
        address atcAddress;        // Talimatı veren ATC'nin adresi.
        address recipientAircraft; // Talimatı alan uçağın adresi.
        string instruction;       // Talimatın içeriği (örn: "Pist 24'e iniş için serbestsiniz").
    }

    

    // Depolama alanları. Mapping'ler, verilere hızlı erişim sağlar.
    mapping(string => RegisteredAsset) public assetRegistry;      // ID'den varlık bilgilerine erişim (örn: "TK-001" -> Bilgiler).
    mapping(address => string) public idOfAddress;             // Adresten varlık ID'sine erişim (örn: 0x... -> "TK-001").
    
    // Her log türü için ayrı, sıralı bir kayıt defteri.
    TelemetryLog[] public telemetryLogs;
    AnalysisLog[] public analysisLogs;
    InstructionLog[] public instructionLogs;

    //================================================================
    // 2. EVENTS (ARAYÜZE BİLDİRİMLER)
    //================================================================
    
    // Blockchain'e yeni bir kayıt yapıldığında, dış dünyadaki uygulamalara (bizim app.js gibi)
    // haber veren sinyallerdir. Bu, "gerçek zamanlı" güncellemeler için temeldir.
    event AircraftRegistered(string flightId, address walletAddress);
    event ATCRegistered(string atcId, address walletAddress);
    event TelemetryLogged(address indexed aircraft, uint8 fuelPercent);
    event AnalysisLogged(address indexed aircraft, uint8 riskScore);
    event InstructionIssued(address indexed atc, address indexed recipient, string instruction);
    
    //================================================================
    // 3. MODIFIERS (GÜVENLİK VE ERİŞİM KONTROLÜ)
    //================================================================

    // Bir fonksiyonun sadece rolü "ATC" olan bir cüzdan tarafından çağrılabilmesini sağlayan güvenlik kuralı.
    modifier onlyATC() {
        require(assetRegistry[idOfAddress[msg.sender]].isATC, "Erisim Reddedildi: Sadece ATC bu islemi yapabilir.");
        _; // Bu, asıl fonksiyonun kodunun çalışmaya devam etmesine izin verir.
    }
    
    // Bir fonksiyonun sadece "Uçak" rolündeki bir cüzdan tarafından çağrılabilmesini sağlayan güvenlik kuralı.
    modifier onlyAircraft() {
        require(
            assetRegistry[idOfAddress[msg.sender]].isRegistered &&
            !assetRegistry[idOfAddress[msg.sender]].isATC, 
            "Erisim Reddedildi: Sadece kayitli bir ucak bu islemi yapabilir."
        );
        _;
    }


    //================================================================
    // 4. CONSTRUCTOR VE KAYIT FONKSİYONLARI
    //================================================================
    
    // `constructor`, akıllı sözleşme blockchain'e ilk kez dağıtıldığında sadece bir kez çalışır.
    constructor() {
        owner = msg.sender; // Sözleşmeyi dağıtan adresi 'owner' olarak atar.
    }

    /**
     * @dev Yeni bir UÇAĞI sisteme kaydeder. Fonksiyonu çağıran cüzdan adresi, uçağa atanır.
     * @param _flightId Kaydedilecek uçağın benzersiz kimliği (örn: "TK-001").
     */
    function registerAircraft(string memory _flightId) public {
        require(bytes(idOfAddress[msg.sender]).length == 0, "Bu cuzdan adresi zaten baska bir kimlik icin kayitli.");
        require(!assetRegistry[_flightId].isRegistered, "Bu ucus ID'si zaten kullaniliyor.");

        assetRegistry[_flightId] = RegisteredAsset({
            assetId: _flightId,
            walletAddress: msg.sender,
            isRegistered: true,
            isATC: false // ÖNEMLİ: Bu bir uçaktır, ATC değildir.
        });
        idOfAddress[msg.sender] = _flightId;
        
        emit AircraftRegistered(_flightId, msg.sender);
    }

    /**
     * @dev ATC'yi (Hava Trafik Kulesi) sisteme kaydeder.
     * @param _atcId Kaydedilecek ATC'nin kimliği (örn: "LTFM_TOWER").
     * @param _atcWallet ATC'ye atanacak cüzdan adresi.
     */
    function registerATC(string memory _atcId, address _atcWallet) public {
        // Gerçek bir sistemde, bu fonksiyonu sadece 'owner' çağırabilmelidir.
        // require(msg.sender == owner, "Sadece sozlesme sahibi ATC atayabilir.");
        
        require(!assetRegistry[_atcId].isRegistered, "Bu ATC ID'si zaten kullaniliyor.");
        require(bytes(idOfAddress[_atcWallet]).length == 0, "Bu cuzdan adresi zaten baska bir kimlik icin kayitli.");

         assetRegistry[_atcId] = RegisteredAsset({
            assetId: _atcId,
            walletAddress: _atcWallet,
            isRegistered: true,
            isATC: true // ÖNEMLİ: Bu bir ATC'dir.
        });
        idOfAddress[_atcWallet] = _atcId;

        emit ATCRegistered(_atcId, _atcWallet);
    }


    //================================================================
    // 5. İŞLEVSEL (MODÜLER) FONKSİYONLAR
    //================================================================

    /**
     * @dev Bir uçağın anlık telemetri verisini kaydeder. Sadece uçaklar tarafından çağrılabilir.
     */
    function logTelemetry(
        uint8 _fuelPercent,
        uint16 _speedKTS,
        string memory _weather,
        string memory _emergencyStatus
    ) public onlyAircraft {
        telemetryLogs.push(TelemetryLog({
            timestamp: block.timestamp,
            aircraftAddress: msg.sender,
            fuelPercent: _fuelPercent,
            speedKTS: _speedKTS,
            weather: _weather,
            emergencyStatus: _emergencyStatus
        }));
        emit TelemetryLogged(msg.sender, _fuelPercent);
    }

    /**
     * @dev Yapılan bir yakıt/risk analizinin sonucunu ve kanıtını kaydeder. Herkes çağırabilir.
     */
    function logFuelAnalysis(
        string memory _analyzedAircraftId,
        uint8 _riskScore,
        string memory _recommendation,
        bytes32 _rawDataHash
    ) public {
        RegisteredAsset storage analyzedAircraft = assetRegistry[_analyzedAircraftId];
        require(analyzedAircraft.isRegistered, "Analizi yapilan ucak sistemde kayitli degil.");
        
        analysisLogs.push(AnalysisLog({
            timestamp: block.timestamp,
            subjectAircraft: analyzedAircraft.walletAddress,
            riskScore: _riskScore,
            recommendation: _recommendation,
            rawDataHash: _rawDataHash
        }));
        emit AnalysisLogged(analyzedAircraft.walletAddress, _riskScore);
    }

    /**
     * @dev ATC, bir uçağa resmi talimat gönderir. Sadece ATC tarafından çağrılabilir.
     */
    function issueInstruction(string memory _recipientFlightId, string memory _instruction) public onlyATC {
        RegisteredAsset storage recipientAircraft = assetRegistry[_recipientFlightId];
        require(recipientAircraft.isRegistered, "Talimat gonderilen ucak sistemde kayitli degil.");
        require(!recipientAircraft.isATC, "Bir ATC'ye talimat gonderilemez.");
        
        instructionLogs.push(InstructionLog({
            timestamp: block.timestamp,
            atcAddress: msg.sender,
            recipientAircraft: recipientAircraft.walletAddress,
            instruction: _instruction
        }));
        emit InstructionIssued(msg.sender, recipientAircraft.walletAddress, _instruction);
    }
    
    //================================================================
    // 6. YARDIMCI OKUMA (VIEW) FONKSİYONLARI
    //================================================================
    // Bu fonksiyonlar, blockchain'in durumunu değiştirmez ve gaz ücreti gerektirmez.
    
    function getTelemetryLogsCount() public view returns (uint256) { return telemetryLogs.length; }
    function getAnalysisLogsCount() public view returns (uint256) { return analysisLogs.length; }
    function getInstructionLogsCount() public view returns (uint256) { return instructionLogs.length; }
}