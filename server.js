const express = require('express');
const net = require('net');
const WebSocket = require('ws');
const app = express();
const httpPort = 3000; // Порт для HTTP-сервера
const tcpPort = 7108; // Порт для TCP-сервера
const tcpHost = '192.168.0.96'; // IP для прослушивания TCP-соединений

const DATA_TO_SEND = Buffer.from([0xFF, 0x00, 0x08, 0xD0, 0x00, 0x02, 0x00, 0x0A, 0x00, 0x0A, 0x00, 0xEE]);

let tcpSocket = null; // Для хранения сокета TCP-клиента

app.use(express.static('public'));

const server = app.listen(httpPort, () => {
    console.log(`HTTP Server running on port ${httpPort}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    console.log('WebSocket client connected');
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
    });

    if (tcpSocket) {
        tcpSocket.on('data', (data) => {
            // Преобразование буфера данных в шестнадцатеричную строку
            const hexString = data.toString('hex').toUpperCase().match(/.{1,2}/g).map(byte => '0x' + byte).join(' ');
            console.log('TCP Data received:', hexString);
            ws.send(hexString); // Отправляем данные веб-клиенту в шестнадцатеричном формате
        });
    }
});
// Предопределенные ID карт
const predefinedCardIds = new Set([
    '02B37B06', // 0x53 0x45 0x49 0x0E
    'E4320AAE', // 0x52 0x45 0x49 0x01
    '52474901'  // 0x52 0x47 0x49 0x01
]);
  
let lastReceivedCardId = ''; // Для хранения последнего полученного ID
let waitingForCardId = false; // Изначально режим ожидания не активирован

const tcpServer = net.createServer((socket) => {
    console.log(`TCP Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
    tcpSocket = socket; // Сохраняем ссылку на сокет TCP-клиента

    socket.on('data', (data) => {
        console.log(`Data received: ${data.toString('hex')}`);
        if (waitingForCardId) {
            const cardId = data.slice(5, 9).toString('hex').toUpperCase();
            console.log(`Received card ID: ${cardId}`);
            if (predefinedCardIds.has(cardId)) {
                console.log(`Card ID ${cardId} recognized.`);
                // Здесь можно выполнить дополнительные действия, например, отправить данные обратно
                tcpSocket.write(Buffer.from([0xFF, 0x00, 0x08, 0xD0, 0x00, 0x02, 0x00, 0x0A, 0x00, 0x0A, 0x00, 0xEE]));
                waitingForCardId = false; // Сброс режима ожидания
            }
        }
    });

    socket.on('close', () => {
        console.log('TCP client disconnected');
        tcpSocket = null;
    });
});

tcpServer.listen(tcpPort, tcpHost, () => {
    console.log(`TCP Server listening on ${tcpHost}:${tcpPort}`);
});

app.get('/send-data', (req, res) => {
    if (tcpSocket) {
        tcpSocket.write(DATA_TO_SEND, () => {
            res.send('Data sent to the TCP client');
        });
    } else {
        res.status(404).send('TCP client not connected');
    }
});

// Для CmdReset
app.get('/cmd-reset', (req, res) => {
    if (tcpSocket) {
        const data = Buffer.from([0xFF, 0x00, 0x01, 0x80, 0x81]);
        tcpSocket.write(data, () => {
            res.send('CmdReset sent');
        });
    } else {
        res.status(404).send('TCP client not connected');
    }
});

// Для CmdActivateAll
app.get('/cmd-activate-all', (req, res) => {
    if (tcpSocket) {
        const data = Buffer.from([0xFF, 0x00, 0x01, 0x83, 0x84]);
        tcpSocket.write(data, () => {
            res.send('CmdActivateAll sent');
        });
    } else {
        res.status(404).send('TCP client not connected');
    }
});

app.get('/cmd-seek-for-tag', (req, res) => {
    if (tcpSocket) {
        // Подготовка пакета данных для отправки
        const seekForTagCommand = Buffer.from([0xFF, 0x00, 0x01, 0x82, 0x83]);
        
        // Отправка пакета команды TCP-клиенту
        tcpSocket.write(seekForTagCommand, () => {
            console.log("Command 'Seek For Tag' sent.");
        });

        // Установка флага ожидания ответа
        waitingForCardId = true;
        res.send('Waiting for card ID...');

        // Установка таймаута на ожидание ответа
        setTimeout(() => {
            if (waitingForCardId) {
                waitingForCardId = false; // Сброс флага, если ID так и не был получен
                console.log("Timeout waiting for card ID.");
            }
        }, 10000); // Ожидание 10 секунд
    } else {
        res.status(404).send('TCP client not connected');
    }
});
