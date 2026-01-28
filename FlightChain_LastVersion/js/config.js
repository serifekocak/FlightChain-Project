const MASTER_ESP32_IP = "http://192.168.129.226"
const contractAddress = "0xC29b2ABd3E5BE5cD0365139F68b1c0391E48857d";
const contractABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "atcId",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "walletAddress",
				"type": "address"
			}
		],
		"name": "ATCRegistered",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "flightId",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "walletAddress",
				"type": "address"
			}
		],
		"name": "AircraftRegistered",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "aircraft",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "riskStatus",
				"type": "string"
			}
		],
		"name": "AnalysisLogged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "atc",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "instruction",
				"type": "string"
			}
		],
		"name": "InstructionIssued",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_recipientFlightId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_instruction",
				"type": "string"
			}
		],
		"name": "issueInstruction",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_analyzedAircraftId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_riskStatus",
				"type": "string"
			},
			{
				"internalType": "uint8",
				"name": "_estRemainingFuel",
				"type": "uint8"
			},
			{
				"internalType": "string",
				"name": "_recommendation",
				"type": "string"
			},
			{
				"internalType": "bytes32",
				"name": "_rawDataHash",
				"type": "bytes32"
			},
			{
				"internalType": "uint8",
				"name": "_plannedReserveFuel",
				"type": "uint8"
			},
			{
				"internalType": "uint8",
				"name": "_currentFuel",
				"type": "uint8"
			},
			{
				"internalType": "uint16",
				"name": "_remainingRangeNM",
				"type": "uint16"
			},
			{
				"internalType": "uint8",
				"name": "_holdingTimeMinutes",
				"type": "uint8"
			}
		],
		"name": "logFuelAnalysis",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint8",
				"name": "_fuelPercent",
				"type": "uint8"
			},
			{
				"internalType": "uint16",
				"name": "_speedKTS",
				"type": "uint16"
			},
			{
				"internalType": "string",
				"name": "_weather",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_emergencyStatus",
				"type": "string"
			}
		],
		"name": "logTelemetry",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "content",
				"type": "string"
			}
		],
		"name": "MessageSent",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_flightId",
				"type": "string"
			}
		],
		"name": "registerAircraft",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_atcId",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "_atcWallet",
				"type": "address"
			}
		],
		"name": "registerATC",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_recipientId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_message",
				"type": "string"
			}
		],
		"name": "sendMessage",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "aircraft",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint8",
				"name": "fuelPercent",
				"type": "uint8"
			}
		],
		"name": "TelemetryLogged",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "analysisLogs",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "subjectAircraft",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "riskStatus",
				"type": "string"
			},
			{
				"internalType": "uint8",
				"name": "estRemainingFuel",
				"type": "uint8"
			},
			{
				"internalType": "string",
				"name": "recommendation",
				"type": "string"
			},
			{
				"internalType": "bytes32",
				"name": "rawDataHash",
				"type": "bytes32"
			},
			{
				"internalType": "uint8",
				"name": "plannedReserveFuel",
				"type": "uint8"
			},
			{
				"internalType": "uint8",
				"name": "currentFuel",
				"type": "uint8"
			},
			{
				"internalType": "uint16",
				"name": "remainingRangeNM",
				"type": "uint16"
			},
			{
				"internalType": "uint8",
				"name": "holdingTimeMinutes",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "assetRegistry",
		"outputs": [
			{
				"internalType": "string",
				"name": "assetId",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "walletAddress",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "isRegistered",
				"type": "bool"
			},
			{
				"internalType": "bool",
				"name": "isATC",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "genericMessageLogs",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getAnalysisLogsCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getGenericMessageLogsCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getInstructionLogsCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getTelemetryLogsCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "idOfAddress",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "instructionLogs",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "atcAddress",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "recipientAircraft",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "instruction",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "telemetryLogs",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "aircraftAddress",
				"type": "address"
			},
			{
				"internalType": "uint8",
				"name": "fuelPercent",
				"type": "uint8"
			},
			{
				"internalType": "uint16",
				"name": "speedKTS",
				"type": "uint16"
			},
			{
				"internalType": "string",
				"name": "weather",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "emergencyStatus",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];